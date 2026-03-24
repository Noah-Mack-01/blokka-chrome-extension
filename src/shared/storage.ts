/**
 * Storage module for Chrome extension network traffic interceptor
 * Wraps chrome.storage API for persisting interception rules and request logs
 */

import { STORAGE_KEYS, MAX_STORED_REQUESTS } from './constants';
import type { Rule, InterceptedRequest } from './types';

/**
 * Save interception rules to chrome.storage
 */
export async function saveRules(rules: Rule[]): Promise<void> {
  if (!Array.isArray(rules)) {
    throw new TypeError('saveRules expects an array of Rule objects');
  }

  // Validate rule structure
  for (const rule of rules) {
    if (!rule.id || typeof rule.id !== 'string') {
      throw new TypeError('Each rule must have a string id');
    }
    if (!rule.pattern || typeof rule.pattern !== 'string') {
      throw new TypeError('Each rule must have a string pattern');
    }
    if (!['block', 'allow', 'modify'].includes(rule.action)) {
      throw new TypeError('Each rule must have action: "block", "allow", or "modify"');
    }
    if (typeof rule.enabled !== 'boolean') {
      throw new TypeError('Each rule must have a boolean enabled property');
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules });
}

/**
 * Load interception rules from chrome.storage
 */
export async function loadRules(): Promise<Rule[]> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.RULES]);
  return result[STORAGE_KEYS.RULES] || [];
}

/**
 * Save an intercepted request to chrome.storage
 * Maintains a FIFO queue with MAX_STORED_REQUESTS limit
 */
export async function saveRequest(request: InterceptedRequest): Promise<void> {
  if (!request || typeof request !== 'object') {
    throw new TypeError('saveRequest expects an InterceptedRequest object');
  }

  // Validate request structure
  if (!request.id || typeof request.id !== 'string') {
    throw new TypeError('Request must have a string id');
  }
  if (!request.url || typeof request.url !== 'string') {
    throw new TypeError('Request must have a string url');
  }
  if (!request.method || typeof request.method !== 'string') {
    throw new TypeError('Request must have a string method');
  }
  if (!request.timestamp || typeof request.timestamp !== 'number') {
    throw new TypeError('Request must have a numeric timestamp');
  }
  if (request.status !== undefined && typeof request.status !== 'number') {
    throw new TypeError('Request status must be a number if provided');
  }

  // Load existing requests
  const result = await chrome.storage.local.get([STORAGE_KEYS.REQUESTS]);
  let requests = result[STORAGE_KEYS.REQUESTS] || [];

  // Add new request to the end
  requests.push(request);

  // Maintain FIFO queue - remove oldest if over limit
  if (requests.length > MAX_STORED_REQUESTS) {
    requests = requests.slice(requests.length - MAX_STORED_REQUESTS);
  }

  // Save updated requests array
  await chrome.storage.local.set({ [STORAGE_KEYS.REQUESTS]: requests });
}

/**
 * Retrieve intercepted requests from chrome.storage
 */
export async function getRequests(limit?: number): Promise<InterceptedRequest[]> {
  const result = await chrome.storage.local.get([STORAGE_KEYS.REQUESTS]);
  let requests = result[STORAGE_KEYS.REQUESTS] || [];

  // Return most recent first (reverse chronological order)
  requests = [...requests].reverse();

  // Apply limit if specified
  if (limit !== undefined && typeof limit === 'number' && limit > 0) {
    requests = requests.slice(0, limit);
  }

  return requests;
}

/**
 * Clear all stored requests (useful for testing or manual cleanup)
 */
export async function clearRequests(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.REQUESTS]: [] });
}

/**
 * Clear all stored rules (useful for testing or manual cleanup)
 */
export async function clearRules(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: [] });
}
