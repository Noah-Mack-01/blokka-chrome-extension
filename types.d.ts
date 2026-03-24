/**
 * Shared TypeScript type definitions for Chrome extension network traffic interceptor
 * Uses Declarative Net Request (DNR) API for MV3 compliance.
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

/**
 * Declarative Net Request rule condition for MV3 DNR API.
 * Maps to chrome.declarativeNetRequest.RuleCondition.
 */
export interface DnrRuleCondition {
  /** URL filter pattern (supports wildcards per DNR spec) */
  urlFilter?: string;
  /** Resource types this rule applies to */
  resourceTypes?: chrome.declarativeNetRequest.ResourceType[];
  /** Domains where this rule is initiated from */
  initiatorDomains?: string[];
  /** Domains to exclude from this rule */
  excludedInitiatorDomains?: string[];
}

/**
 * Declarative Net Request rule action for MV3 DNR API.
 * Maps to chrome.declarativeNetRequest.RuleAction.
 */
export interface DnrRuleAction {
  /** The type of action to perform */
  type: chrome.declarativeNetRequest.RuleActionType;
  /** Redirect details (used when type is 'redirect') */
  redirect?: chrome.declarativeNetRequest.Redirect;
  /** Request headers to modify (used when type is 'modifyHeaders') */
  requestHeaders?: chrome.declarativeNetRequest.ModifyHeaderInfo[];
  /** Response headers to modify (used when type is 'modifyHeaders') */
  responseHeaders?: chrome.declarativeNetRequest.ModifyHeaderInfo[];
}

/**
 * A fully-specified Declarative Net Request rule as used with
 * chrome.declarativeNetRequest.updateDynamicRules().
 */
export interface DnrRule {
  /** Integer rule ID required by the DNR API */
  id: number;
  /** Priority (higher value = higher priority) */
  priority: number;
  /** Condition that triggers this rule */
  condition: DnrRuleCondition;
  /** Action to perform when the condition matches */
  action: DnrRuleAction;
}

/**
 * Payload carried in an UPDATE_RULES message.
 */
export interface UpdateRulesPayload {
  rules: Rule[];
}

/**
 * Payload carried in a REQUEST_INTERCEPTED or RESPONSE_INTERCEPTED message.
 */
export interface RequestInterceptedPayload {
  request: InterceptedRequest;
}
