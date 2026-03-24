/**
 * Shared type definitions for the Chrome extension
 */

// Core data types
export interface Rule {
  id: string;
  pattern: string;
  action: 'block' | 'allow' | 'modify';
  enabled: boolean;
}

export interface InterceptedRequest {
  id: string;
  url: string;
  method: string;
  timestamp: number;
  status?: number;
}

// Message types with discriminated unions for type safety
export type Message =
  | { type: 'REQUEST_INTERCEPTED'; payload: InterceptedRequest }
  | { type: 'RESPONSE_INTERCEPTED'; payload: InterceptedRequest }
  | { type: 'GET_RULES'; payload?: never }
  | { type: 'UPDATE_RULES'; payload: Rule[] }
  | { type: 'GET_REQUESTS'; payload?: never };

// Message response type
export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}
