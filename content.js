// Content script for Network Traffic Interceptor
// Provides page-level network monitoring and optional UI injection

/**
 * Content script initialization
 * Runs in the context of web pages to provide additional monitoring capabilities
 */

// Track if we've already injected UI elements to avoid duplicates
let uiInjected = false;

/**
 * Listen for messages from the background script
 * Handles intercepted request/response notifications and rule updates
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.type) {
      case 'REQUEST_INTERCEPTED':
        handleRequestIntercepted(message.payload);
        sendResponse({ success: true });
        break;

      case 'RESPONSE_INTERCEPTED':
        handleResponseIntercepted(message.payload);
        sendResponse({ success: true });
        break;

      case 'GET_RULES':
        // Forward rule request to background script
        forwardToBackground(message).then(response => {
          sendResponse(response);
        });
        return true; // Async response

      case 'UPDATE_RULES':
        // Forward rule update to background script
        forwardToBackground(message).then(response => {
          sendResponse(response);
        });
        return true; // Async response

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ success: false, error: error.message });
  }

  return false;
});

/**
 * Handle intercepted request notification from background script
 * @param {Object} request - Intercepted request details
 */
function handleRequestIntercepted(request) {
  // Log for debugging - could be extended to show UI notifications
  console.log('[Network Interceptor] Request intercepted:', request);

  // Optionally show a visual indicator on the page
  if (shouldShowVisualIndicator()) {
    showRequestIndicator(request);
  }
}

/**
 * Handle intercepted response notification from background script
 * @param {Object} response - Intercepted response details
 */
function handleResponseIntercepted(response) {
  // Log for debugging
  console.log('[Network Interceptor] Response intercepted:', response);

  // Optionally update UI with response status
  if (shouldShowVisualIndicator()) {
    updateRequestIndicator(response);
  }
}

/**
 * Forward message to background script
 * @param {Object} message - Message to forward
 * @returns {Promise<Object>} - Response from background script
 */
async function forwardToBackground(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('Failed to forward message to background:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if visual indicators should be shown on the page
 * @returns {boolean}
 */
function shouldShowVisualIndicator() {
  // Could be made configurable via storage settings
  // For now, disabled by default to avoid page interference
  return false;
}

/**
 * Show a visual indicator when a request is intercepted
 * @param {Object} request - Request details
 */
function showRequestIndicator(request) {
  if (!uiInjected) {
    injectUIContainer();
  }

  const container = document.getElementById('network-interceptor-ui');
  if (!container) return;

  const indicator = document.createElement('div');
  indicator.className = 'interceptor-request';
  indicator.setAttribute('data-request-id', request.id);
  indicator.textContent = `⚡ ${request.method} ${truncateUrl(request.url)}`;
  indicator.style.cssText = `
    padding: 8px 12px;
    margin: 4px 0;
    background: #fff3cd;
    border-left: 3px solid #ffc107;
    font-size: 12px;
    font-family: monospace;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  container.appendChild(indicator);

  // Fade in
  setTimeout(() => {
    indicator.style.opacity = '1';
  }, 10);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 5000);
}

/**
 * Update the visual indicator when a response is received
 * @param {Object} response - Response details
 */
function updateRequestIndicator(response) {
  const indicator = document.querySelector(`[data-request-id="${response.id}"]`);
  if (!indicator) return;

  const statusColor = response.status >= 200 && response.status < 300 ? '#28a745' : '#dc3545';
  indicator.style.borderLeftColor = statusColor;
  indicator.textContent += ` [${response.status || 'ERROR'}]`;
}

/**
 * Inject UI container for visual indicators
 */
function injectUIContainer() {
  if (uiInjected) return;

  const container = document.createElement('div');
  container.id = 'network-interceptor-ui';
  container.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 999999;
    max-width: 400px;
    max-height: 300px;
    overflow-y: auto;
    pointer-events: none;
  `;

  document.body.appendChild(container);
  uiInjected = true;
}

/**
 * Truncate URL for display
 * @param {string} url - Full URL
 * @returns {string} - Truncated URL
 */
function truncateUrl(url) {
  if (url.length <= 50) return url;

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    if (path.length <= 40) {
      return urlObj.host + path;
    }
    return urlObj.host + path.substring(0, 37) + '...';
  } catch {
    return url.substring(0, 47) + '...';
  }
}

/**
 * Intercept fetch requests at the page level (experimental)
 * This provides an additional layer of monitoring beyond the background script
 */
function interceptPageLevelFetch() {
  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const url = args[0] instanceof Request ? args[0].url : args[0];
    const method = args[0] instanceof Request ? args[0].method : (args[1]?.method || 'GET');

    console.log('[Network Interceptor] Page-level fetch detected:', method, url);

    // Notify background script about page-level fetch
    try {
      chrome.runtime.sendMessage({
        type: 'REQUEST_INTERCEPTED',
        payload: {
          id: generateRequestId(),
          url: url,
          method: method,
          timestamp: Date.now(),
          source: 'content-script'
        }
      }).catch(() => {
        // Ignore if background script is not ready
      });
    } catch (error) {
      // Silently fail - don't break the page
    }

    // Call original fetch
    return originalFetch.apply(this, args);
  };
}

/**
 * Intercept XMLHttpRequest at the page level (experimental)
 */
function interceptPageLevelXHR() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._interceptorMethod = method;
    this._interceptorUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this._interceptorMethod && this._interceptorUrl) {
      console.log('[Network Interceptor] Page-level XHR detected:', this._interceptorMethod, this._interceptorUrl);

      // Notify background script
      try {
        chrome.runtime.sendMessage({
          type: 'REQUEST_INTERCEPTED',
          payload: {
            id: generateRequestId(),
            url: this._interceptorUrl,
            method: this._interceptorMethod,
            timestamp: Date.now(),
            source: 'content-script'
          }
        }).catch(() => {});
      } catch (error) {
        // Silently fail
      }
    }

    return originalSend.apply(this, args);
  };
}

/**
 * Generate a unique request ID
 * @returns {string}
 */
function generateRequestId() {
  return `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize content script
 */
function initialize() {
  console.log('[Network Interceptor] Content script loaded');

  // Optionally enable page-level interception
  // Uncomment these lines to enable experimental page-level monitoring
  // interceptPageLevelFetch();
  // interceptPageLevelXHR();
}

// Run initialization when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
