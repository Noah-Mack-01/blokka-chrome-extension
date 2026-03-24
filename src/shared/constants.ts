/**
 * Shared constants for the Chrome extension
 */

// Storage keys - unified to match background.js convention
// for backward compatibility with existing user data
export const STORAGE_KEYS = {
  RULES: 'rules',
  REQUESTS: 'requests'
} as const;

// Maximum number of requests to keep in storage (FIFO queue)
export const MAX_STORED_REQUESTS = 100;
