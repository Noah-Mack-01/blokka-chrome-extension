// Background service worker for Network Traffic Interceptor
// Manages network request interception and rule processing

import { loadRules, saveRules, saveRequest, getRequests } from '../shared/storage';
import type { Rule, InterceptedRequest, Message, MessageResponse } from '../shared/types';

let rules: Rule[] = [];
let interceptedRequests: InterceptedRequest[] = [];

// Initialize on service worker startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeRules();
});

// Initialize on extension install
chrome.runtime.onInstalled.addListener(async () => {
  await initializeRules();
});

/**
 * Convert a Rule's string id to a positive integer required by declarativeNetRequest.
 */
function ruleIdToInt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2147483646) + 1;
}

/**
 * Convert internal Rule objects to chrome.declarativeNetRequest rule format.
 * Only enabled rules are included.
 */
function toDNRRules(appRules: Rule[]): chrome.declarativeNetRequest.Rule[] {
  return appRules
    .filter(rule => rule.enabled)
    .map(rule => {
      const action: chrome.declarativeNetRequest.RuleAction =
        rule.action === 'block'
          ? { type: 'block' as chrome.declarativeNetRequest.RuleActionType }
          : { type: 'allow' as chrome.declarativeNetRequest.RuleActionType };

      return {
        id: ruleIdToInt(rule.id),
        priority: 1,
        action,
        condition: {
          urlFilter: rule.pattern,
          resourceTypes: [
            'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
            'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
            'media', 'websocket', 'other'
          ] as chrome.declarativeNetRequest.ResourceType[]
        }
      };
    });
}

/**
 * Sync the current in-memory rules to chrome.declarativeNetRequest dynamic rules.
 */
async function syncDNRRules(): Promise<void> {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);
    const addRules = toDNRRules(rules);
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  } catch (error) {
    console.error('Failed to sync DNR rules:', error);
  }
}

/**
 * Initialize rules from storage and sync to declarativeNetRequest.
 */
async function initializeRules(): Promise<void> {
  try {
    rules = await loadRules();
    await syncDNRRules();
    setupWebRequestListeners();
  } catch (error) {
    console.error('Failed to initialize rules:', error);
    rules = [];
  }
}

/**
 * Set up read-only webRequest listeners for logging (no 'blocking' — valid in MV3).
 */
function setupWebRequestListeners(): void {
  // Log completed responses
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      const interceptedRequest: InterceptedRequest = {
        id: String(details.requestId),
        url: details.url,
        method: details.method,
        timestamp: Date.now(),
        status: details.statusCode,
      };

      interceptedRequests.push(interceptedRequest);
      if (interceptedRequests.length > 100) {
        interceptedRequests = interceptedRequests.slice(-100);
      }

      saveInterceptedRequest(interceptedRequest);

      chrome.runtime.sendMessage({
        type: 'RESPONSE_INTERCEPTED',
        payload: interceptedRequest
      } as Message).catch(() => {});
    },
    { urls: ['<all_urls>'] }
  );

  // Log errors
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      const requestIndex = interceptedRequests.findIndex(req => req.id === String(details.requestId));
      if (requestIndex !== -1) {
        interceptedRequests[requestIndex].status = -1;
        saveRequest(interceptedRequests[requestIndex]).catch(err => {
          console.error('Failed to save error status:', err);
        });
      }
    },
    { urls: ['<all_urls>'] }
  );
}

/**
 * Save an intercepted request to memory and storage
 */
async function saveInterceptedRequest(request: InterceptedRequest): Promise<void> {
  interceptedRequests.push(request);

  // Keep only last 100 requests in memory
  if (interceptedRequests.length > 100) {
    interceptedRequests = interceptedRequests.slice(-100);
  }

  // Save to storage using imported function
  try {
    await saveRequest(request);
  } catch (error) {
    console.error('Failed to save request:', error);
  }
}

/**
 * Get all rules
 */
async function getRulesInternal(): Promise<Rule[]> {
  return [...rules];
}

/**
 * Update rules — persists to storage AND syncs to declarativeNetRequest.
 */
async function updateRulesInternal(newRules: Rule[]): Promise<void> {
  rules = [...newRules];

  try {
    await saveRules(rules);
  } catch (error) {
    console.error('Failed to update rules:', error);
    throw error;
  }

  await syncDNRRules();
}

/**
 * Get intercepted requests
 */
async function getInterceptedRequestsInternal(): Promise<InterceptedRequest[]> {
  // Load from storage to get most recent state using imported function
  try {
    return await getRequests();
  } catch (error) {
    console.error('Failed to get requests:', error);
    return [];
  }
}

/**
 * Message listener for communication with popup and content scripts
 */
chrome.runtime.onMessage.addListener(
  (message: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void): boolean => {
    // Handle async responses properly
    (async () => {
      try {
        switch (message.type) {
          case 'GET_RULES': {
            const currentRules = await getRulesInternal();
            sendResponse({ success: true, data: currentRules });
            break;
          }

          case 'UPDATE_RULES': {
            await updateRulesInternal(message.payload);
            sendResponse({ success: true });
            break;
          }

          case 'GET_REQUESTS': {
            const requests = await getInterceptedRequestsInternal();
            sendResponse({ success: true, data: requests });
            break;
          }

          default: {
            sendResponse({ success: false, error: 'Unknown message type' });
          }
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();

    // Return true to indicate async response
    return true;
  }
);

// Initialize rules when service worker starts
initializeRules();
