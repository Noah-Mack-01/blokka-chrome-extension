/**
 * Storage module for Chrome extension network traffic interceptor
 * Wraps chrome.storage API for persisting interception rules and request logs
 */

// Storage keys
const STORAGE_KEYS = {
  RULES: 'interception_rules',
  REQUESTS: 'intercepted_requests'
};

// Maximum number of requests to keep in storage (FIFO)
const MAX_STORED_REQUESTS = 1000;

/**
 * Save interception rules to chrome.storage
 * @param {Rule[]} rules - Array of Rule objects to persist
 * @returns {Promise<void>}
 */
export async function saveRules(rules) {
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

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to save rules: ${chrome.runtime.lastError.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Load interception rules from chrome.storage
 * @returns {Promise<Rule[]>} Array of Rule objects (empty array if none exist)
 */
export async function loadRules() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEYS.RULES], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to load rules: ${chrome.runtime.lastError.message}`));
      } else {
        const rules = result[STORAGE_KEYS.RULES] || [];
        resolve(rules);
      }
    });
  });
}

/**
 * Save an intercepted request to chrome.storage
 * Maintains a FIFO queue with MAX_STORED_REQUESTS limit
 * @param {InterceptedRequest} request - Request object to persist
 * @returns {Promise<void>}
 */
export async function saveRequest(request) {
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

  return new Promise((resolve, reject) => {
    // First, load existing requests
    chrome.storage.local.get([STORAGE_KEYS.REQUESTS], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to load existing requests: ${chrome.runtime.lastError.message}`));
        return;
      }

      let requests = result[STORAGE_KEYS.REQUESTS] || [];

      // Add new request to the end
      requests.push(request);

      // Maintain FIFO queue - remove oldest if over limit
      if (requests.length > MAX_STORED_REQUESTS) {
        requests = requests.slice(requests.length - MAX_STORED_REQUESTS);
      }

      // Save updated requests array
      chrome.storage.local.set({ [STORAGE_KEYS.REQUESTS]: requests }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to save request: ${chrome.runtime.lastError.message}`));
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Retrieve intercepted requests from chrome.storage
 * @param {number} [limit] - Optional maximum number of requests to return (most recent first)
 * @returns {Promise<InterceptedRequest[]>} Array of InterceptedRequest objects
 */
export async function getRequests(limit) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEYS.REQUESTS], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to get requests: ${chrome.runtime.lastError.message}`));
      } else {
        let requests = result[STORAGE_KEYS.REQUESTS] || [];

        // Return most recent first (reverse chronological order)
        requests = [...requests].reverse();

        // Apply limit if specified
        if (limit !== undefined && typeof limit === 'number' && limit > 0) {
          requests = requests.slice(0, limit);
        }

        resolve(requests);
      }
    });
  });
}

/**
 * Clear all stored requests (useful for testing or manual cleanup)
 * @returns {Promise<void>}
 */
export async function clearRequests() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.REQUESTS]: [] }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to clear requests: ${chrome.runtime.lastError.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Clear all stored rules (useful for testing or manual cleanup)
 * @returns {Promise<void>}
 */
export async function clearRules() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.RULES]: [] }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to clear rules: ${chrome.runtime.lastError.message}`));
      } else {
        resolve();
      }
    });
  });
}
