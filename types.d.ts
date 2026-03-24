/**
 * Shared TypeScript type definitions for Chrome extension network traffic interceptor
 */

/**
 * Represents a rule for intercepting and handling network requests
 */
export interface Rule {
  /** Unique identifier for the rule */
  id: string;
  /** URL pattern to match against requests (supports wildcards) */
  pattern: string;
  /** Action to take when pattern matches */
  action: 'block' | 'allow' | 'modify';
  /** Whether this rule is currently active */
  enabled: boolean;
}

/**
 * Represents an intercepted network request with its metadata
 */
export interface InterceptedRequest {
  /** Unique identifier for this request instance */
  id: string;
  /** Full URL of the request */
  url: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Unix timestamp when request was intercepted */
  timestamp: number;
  /** HTTP status code of response (if available) */
  status?: number;
}

/**
 * Message types for communication between extension components
 * (background script, content script, popup, etc.)
 */
export type MessageType = {
  /** Type discriminator for message routing */
  type: 'REQUEST_INTERCEPTED' | 'RESPONSE_INTERCEPTED' | 'GET_RULES' | 'UPDATE_RULES';
  /** Optional message payload - structure varies by type */
  payload?: any;
};
