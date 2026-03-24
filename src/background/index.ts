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
 * Initialize rules from storage
 */
async function initializeRules(): Promise<void> {
  try {
    // Load rules from storage using imported function
    rules = await loadRules();

    // Set up web request listeners
    setupWebRequestListeners();
  } catch (error) {
    console.error('Failed to initialize rules:', error);
    rules = [];
  }
}

/**
 * Set up web request listeners for network interception
 */
function setupWebRequestListeners(): void {
  // Listen for requests before they are sent
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const interceptedRequest: InterceptedRequest = {
        id: String(details.requestId),
        url: details.url,
        method: details.method,
        timestamp: Date.now(),
      };

      // Check if request matches any rules
      const matchedRule = findMatchingRule(details.url);

      if (matchedRule) {
        if (matchedRule.action === 'block') {
          // Save blocked request
          saveInterceptedRequest(interceptedRequest);

          // Notify popup/content script
          chrome.runtime.sendMessage({
            type: 'REQUEST_INTERCEPTED',
            payload: interceptedRequest
          } as Message).catch(() => {
            // Ignore errors if no listeners
          });

          return { cancel: true };
        } else if (matchedRule.action === 'modify') {
          // For now, just log - actual modification would need redirectUrl or other params
          saveInterceptedRequest(interceptedRequest);

          chrome.runtime.sendMessage({
            type: 'REQUEST_INTERCEPTED',
            payload: interceptedRequest
          } as Message).catch(() => {});
        }
      }

      // Allow request (default action)
      saveInterceptedRequest(interceptedRequest);
      return { cancel: false };
    },
    { urls: ['<all_urls>'] },
    ['blocking']
  );

  // Listen for completed responses
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      // Update the request with response status
      const requestIndex = interceptedRequests.findIndex(req => req.id === String(details.requestId));
      if (requestIndex !== -1) {
        interceptedRequests[requestIndex].status = details.statusCode;

        // Update in storage using imported function
        saveRequest(interceptedRequests[requestIndex]).catch(err => {
          console.error('Failed to update request status:', err);
        });

        // Notify popup/content script
        chrome.runtime.sendMessage({
          type: 'RESPONSE_INTERCEPTED',
          payload: interceptedRequests[requestIndex]
        } as Message).catch(() => {});
      }
    },
    { urls: ['<all_urls>'] }
  );

  // Listen for errors
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      const requestIndex = interceptedRequests.findIndex(req => req.id === String(details.requestId));
      if (requestIndex !== -1) {
        interceptedRequests[requestIndex].status = -1; // Error status

        // Update in storage using imported function
        saveRequest(interceptedRequests[requestIndex]).catch(err => {
          console.error('Failed to save error status:', err);
        });
      }
    },
    { urls: ['<all_urls>'] }
  );
}

/**
 * Find a matching rule for a given URL
 */
function findMatchingRule(url: string): Rule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    try {
      // Convert simple pattern to regex
      const pattern = rule.pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '\\?');

      const regex = new RegExp(pattern);
      if (regex.test(url)) {
        return rule;
      }
    } catch (error) {
      console.error(`Invalid pattern for rule ${rule.id}:`, error);
    }
  }

  return null;
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
 * Update rules
 */
async function updateRulesInternal(newRules: Rule[]): Promise<void> {
  rules = [...newRules];

  // Save to storage using imported function
  try {
    await saveRules(rules);
  } catch (error) {
    console.error('Failed to update rules:', error);
    throw error;
  }
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
