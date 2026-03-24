// Background service worker for Network Traffic Interceptor
// Manages network request interception and rule processing
/** @typedef {import('./types.d.ts').Rule} Rule */
/** @typedef {import('./types.d.ts').InterceptedRequest} InterceptedRequest */

import { saveRules, loadRules, saveRequest, getRequests } from './storage.js';

let rules = [];
let interceptedRequests = [];

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
async function initializeRules() {
  try {
    // Load rules from storage using storage.js
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
function setupWebRequestListeners() {
  // Listen for requests before they are sent
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const interceptedRequest = {
        id: details.requestId,
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
          }).catch(() => {
            // Ignore errors if no listeners
          });

          return { cancel: true };
        } else if (matchedRule.action === 'modify') {
          // For now, just log - actual modification would need redirectUrl or other params
          saveInterceptedRequest(interceptedRequest);

          chrome.runtime.sendMessage({
            type: 'REQUEST_INTERCEPTED',
            payload: interceptedRequest
          }).catch(() => {});
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
      const requestIndex = interceptedRequests.findIndex(req => req.id === details.requestId);
      if (requestIndex !== -1) {
        interceptedRequests[requestIndex].status = details.statusCode;

        // Save updated request to storage using storage.js
        saveRequest(interceptedRequests[requestIndex]).catch((err) => {
          console.error('Failed to save completed request:', err);
        });

        // Notify popup/content script
        chrome.runtime.sendMessage({
          type: 'RESPONSE_INTERCEPTED',
          payload: interceptedRequests[requestIndex]
        }).catch(() => {});
      }
    },
    { urls: ['<all_urls>'] }
  );

  // Listen for errors
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      const requestIndex = interceptedRequests.findIndex(req => req.id === details.requestId);
      if (requestIndex !== -1) {
        interceptedRequests[requestIndex].status = -1; // Error status

        // Save updated request to storage using storage.js
        saveRequest(interceptedRequests[requestIndex]).catch((err) => {
          console.error('Failed to save errored request:', err);
        });
      }
    },
    { urls: ['<all_urls>'] }
  );
}

/**
 * Find a matching rule for a given URL
 * @param {string} url - The URL to match
 * @returns {Rule|null} - Matching rule or null
 */
function findMatchingRule(url) {
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
 * @param {InterceptedRequest} request
 */
async function saveInterceptedRequest(request) {
  interceptedRequests.push(request);

  // Keep only last 100 requests in memory
  if (interceptedRequests.length > 100) {
    interceptedRequests = interceptedRequests.slice(-100);
  }

  // Save to storage using storage.js
  try {
    await saveRequest(request);
  } catch (error) {
    console.error('Failed to save request:', error);
  }
}

/**
 * Get all rules
 * @returns {Promise<Rule[]>}
 */
async function getRules() {
  return [...rules];
}

/**
 * Update rules
 * @param {Rule[]} newRules
 * @returns {Promise<void>}
 */
async function updateRules(newRules) {
  rules = [...newRules];

  // Save to storage using storage.js
  try {
    await saveRules(rules);
  } catch (error) {
    console.error('Failed to update rules:', error);
    throw error;
  }
}

/**
 * Get intercepted requests
 * @returns {Promise<InterceptedRequest[]>}
 */
async function getInterceptedRequests() {
  // Load from storage to get most recent state using storage.js
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
        case 'GET_RULES':
          const currentRules = await getRules();
          sendResponse({ success: true, data: currentRules });
          break;

        case 'UPDATE_RULES':
          await updateRules(message.payload);
          sendResponse({ success: true });
          break;

        case 'GET_REQUESTS':
          const requests = await getInterceptedRequests();
          sendResponse({ success: true, data: requests });
          break;

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

// Initialize rules when service worker starts
initializeRules();
