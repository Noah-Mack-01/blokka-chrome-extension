// Background service worker for Network Traffic Interceptor
// Manages network request interception and rule processing
/** @typedef {import('./types.d.ts').Rule} Rule */
/** @typedef {import('./types.d.ts').InterceptedRequest} InterceptedRequest */

import { saveRules, loadRules, saveRequest, getRequests } from './storage.js';

let rules = [];

// Initialize on service worker startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeRules();
});

// Initialize on extension install
chrome.runtime.onInstalled.addListener(async () => {
  await initializeRules();
});

/**
 * Convert a Rule's string id to a positive integer suitable for DNR.
 * Uses parseInt if the id is numeric, otherwise derives a hash-like value.
 * @param {string} id
 * @returns {number}
 */
function ruleIdToInt(id) {
  const parsed = parseInt(id, 10);
  if (!isNaN(parsed) && parsed > 0) return parsed;

  // Simple hash for non-numeric ids (ensures positive integer)
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * Convert internal Rule objects to chrome.declarativeNetRequest rule format.
 * Only enabled rules are included.
 * @param {Rule[]} appRules
 * @returns {chrome.declarativeNetRequest.Rule[]}
 */
function toDNRRules(appRules) {
  return appRules
    .filter(rule => rule.enabled)
    .map(rule => {
      /** @type {chrome.declarativeNetRequest.RuleAction} */
      let action;
      if (rule.action === 'block') {
        action = { type: 'block' };
      } else if (rule.action === 'allow') {
        action = { type: 'allow' };
      } else {
        // 'modify' — use allow as a safe fallback (actual redirect/modify
        // would need additional data not present in the Rule interface)
        action = { type: 'allow' };
      }

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
          ]
        }
      };
    });
}

/**
 * Sync the current in-memory rules to chrome.declarativeNetRequest dynamic rules.
 * Removes all existing dynamic rules first, then adds the new set.
 */
async function syncDNRRules() {
  try {
    // Retrieve existing dynamic rule IDs so we can remove them
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);

    const addRules = toDNRRules(rules);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    });
  } catch (error) {
    console.error('Failed to sync DNR rules:', error);
  }
}

/**
 * Initialize rules from storage and sync to DNR
 */
async function initializeRules() {
  try {
    rules = await loadRules();
    await syncDNRRules();
  } catch (error) {
    console.error('Failed to initialize rules:', error);
    rules = [];
  }
}

/**
 * Record an intercepted request to in-memory list and persistent storage.
 * @param {InterceptedRequest} request
 */
async function saveInterceptedRequest(request) {
  // Save to storage using storage.js
  try {
    await saveRequest(request);
  } catch (error) {
    console.error('Failed to save request:', error);
  }
}

// Observe completed requests via webRequest (read-only, no 'blocking')
chrome.webRequest.onCompleted.addListener(
  (details) => {
    /** @type {InterceptedRequest} */
    const interceptedRequest = {
      id: details.requestId,
      url: details.url,
      method: details.method,
      timestamp: Date.now(),
      status: details.statusCode
    };

    saveInterceptedRequest(interceptedRequest);

    chrome.runtime.sendMessage({
      type: 'RESPONSE_INTERCEPTED',
      payload: interceptedRequest
    }).catch(() => {
      // Ignore errors if no listeners
    });
  },
  { urls: ['<all_urls>'] }
);

// Observe errors
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    /** @type {InterceptedRequest} */
    const interceptedRequest = {
      id: details.requestId,
      url: details.url,
      method: details.method,
      timestamp: Date.now(),
      status: -1
    };

    saveInterceptedRequest(interceptedRequest);
  },
  { urls: ['<all_urls>'] }
);

/**
 * Get all rules
 * @returns {Promise<Rule[]>}
 */
async function getRules() {
  return [...rules];
}

/**
 * Update rules — persists to storage AND syncs to chrome.declarativeNetRequest
 * @param {Rule[]} newRules
 * @returns {Promise<void>}
 */
async function updateRules(newRules) {
  rules = [...newRules];

  try {
    await saveRules(rules);
  } catch (error) {
    console.error('Failed to save rules to storage:', error);
    throw error;
  }

  await syncDNRRules();
}

/**
 * Get intercepted requests from storage
 * @returns {Promise<InterceptedRequest[]>}
 */
async function getInterceptedRequests() {
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle async responses properly
  (async () => {
    try {
      switch (message.type) {
        case 'GET_RULES': {
          const currentRules = await getRules();
          sendResponse({ success: true, data: currentRules });
          break;
        }

        case 'UPDATE_RULES': {
          await updateRules(message.payload);
          sendResponse({ success: true });
          break;
        }

        case 'GET_REQUESTS': {
          const requests = await getInterceptedRequests();
          sendResponse({ success: true, data: requests });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate async response
  return true;
});

// Initialize rules when service worker starts (top-level await not needed;
// onInstalled/onStartup listeners cover the cases, but we also call directly
// so rules are available immediately on first load of the service worker)
initializeRules();
