// Content script for Network Traffic Interceptor
// Provides page-level network monitoring and optional UI injection

import type { Message, InterceptedRequest, MessageResponse } from '../shared/types';

// Track if we've already injected UI elements to avoid duplicates
let uiInjected = false;

/**
 * Listen for messages from the background script
 * Handles intercepted request/response notifications and rule updates
 */
chrome.runtime.onMessage.addListener(
  (message: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void): boolean => {
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
        case 'UPDATE_RULES':
          // Forward to background script (async)
          forwardToBackground(message).then(response => {
            sendResponse(response);
          });
          return true; // Async response

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }

    return false;
  }
);

/**
 * Handle intercepted request notification from background script
 */
function handleRequestIntercepted(request: InterceptedRequest): void {
  // Log for debugging - could be extended to show UI notifications
  console.log('[Network Interceptor] Request intercepted:', request);

  // Optionally show a visual indicator on the page
  if (shouldShowVisualIndicator()) {
    showRequestIndicator(request);
  }
}

/**
 * Handle intercepted response notification from background script
 */
function handleResponseIntercepted(response: InterceptedRequest): void {
  // Log for debugging
  console.log('[Network Interceptor] Response intercepted:', response);

  // Optionally update UI with response status
  if (shouldShowVisualIndicator()) {
    updateRequestIndicator(response);
  }
}

/**
 * Forward message to background script
 */
async function forwardToBackground(message: Message): Promise<MessageResponse> {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('Failed to forward message to background:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Check if visual indicators should be shown on the page
 */
function shouldShowVisualIndicator(): boolean {
  // Could be made configurable via storage settings
  // For now, disabled by default to avoid page interference
  return false;
}

/**
 * Show a visual indicator when a request is intercepted
 */
function showRequestIndicator(request: InterceptedRequest): void {
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
 */
function updateRequestIndicator(response: InterceptedRequest): void {
  const indicator = document.querySelector(`[data-request-id="${response.id}"]`);
  if (!indicator) return;

  const statusColor = response.status && response.status >= 200 && response.status < 300 ? '#28a745' : '#dc3545';
  (indicator as HTMLElement).style.borderLeftColor = statusColor;
  indicator.textContent += ` [${response.status || 'ERROR'}]`;
}

/**
 * Inject UI container for visual indicators
 */
function injectUIContainer(): void {
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
 */
function truncateUrl(url: string): string {
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
 * Initialize content script
 */
function initialize(): void {
  console.log('[Network Interceptor] Content script loaded');
}

// Run initialization when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
