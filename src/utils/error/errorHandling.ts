/**
 * errorHandling.ts
 * ✅ PHASE 5: Reliability - Error handling utilities
 * ✅ Comprehensive error classification and handling
 * ✅ User-friendly error messages
 */

import { getServerTimestamp } from '../timestamps'; // ✅ TIMESTAMP FIX

/**
 * Error types for classification
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
  CRITICAL = 'CRITICAL', // App unusable - mirrors ErrorSeverity.CRITICAL
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',       // User can continue
  MEDIUM = 'MEDIUM', // Feature unavailable but app works
  HIGH = 'HIGH',     // Major functionality broken
  CRITICAL = 'CRITICAL', // App unusable
}

/**
 * Structured error object
 */
export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  details?: unknown;
  timestamp: string | ReturnType<typeof import('../timestamps').getServerTimestamp>;
  canRetry: boolean;
  retryAfter?: number;
}

/**
 * PASS 12: Narrow accessor for the loose error shape this module deals with.
 *
 * Errors arriving here come from many places — Firebase Auth, Firestore,
 * fetch(), thrown strings, third-party libs — so the type really is
 * `unknown`. But every classifier below only ever asks for `error.message`
 * (string) and `error.code` (string OR number, depending on source).
 * `getMsg`/`getCode` give us those two fields with proper guards instead
 * of 22 individual `(error as any).x` casts.
 *
 * Non-string `code`s come from HTTP-style errors where libraries hand back
 * a numeric status. We preserve both shapes because the existing range
 * checks (`code >= 500`) depend on the numeric form.
 */
function getMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}
function getCode(error: unknown): string | number | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code: unknown }).code;
    if (typeof c === 'string' || typeof c === 'number') return c;
  }
  return undefined;
}

/**
 * Classify error type from error object
 */
export function classifyError(error: unknown): ErrorType {
  const msg = getMsg(error);
  const code = getCode(error);

  // Network errors
  if (msg.includes('fetch') || msg.includes('network') || code === 'NETWORK_ERROR') {
    return ErrorType.NETWORK;
  }

  // Authentication errors
  if (code === 'auth/invalid-credential' ||
      code === 'auth/user-not-found' ||
      msg.includes('authentication')) {
    return ErrorType.AUTHENTICATION;
  }

  // Authorization errors
  if (code === 'permission-denied' ||
      msg.includes('unauthorized') ||
      msg.includes('forbidden')) {
    return ErrorType.AUTHORIZATION;
  }

  // Validation errors
  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required')) {
    return ErrorType.VALIDATION;
  }

  // Not found errors
  if (code === '404' || msg.includes('not found')) {
    return ErrorType.NOT_FOUND;
  }

  // Timeout errors
  if (code === 'TIMEOUT' || msg.includes('timeout')) {
    return ErrorType.TIMEOUT;
  }

  // Server errors — numeric HTTP codes
  if (typeof code === 'number' && code >= 500 && code < 600) {
    return ErrorType.SERVER;
  }

  // Client errors — numeric HTTP codes
  if (typeof code === 'number' && code >= 400 && code < 500) {
    return ErrorType.CLIENT;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown, type: ErrorType): string {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    
    case ErrorType.AUTHENTICATION:
      return 'Your session has expired. Please sign in again.';
    
    case ErrorType.AUTHORIZATION:
      return 'You don\'t have permission to perform this action.';
    
    case ErrorType.VALIDATION:
      return getMsg(error) || 'Please check your input and try again.';
    
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found.';
    
    case ErrorType.TIMEOUT:
      return 'The request took too long. Please try again.';
    
    case ErrorType.SERVER:
      return 'A server error occurred. Our team has been notified. Please try again later.';
    
    case ErrorType.CLIENT:
      return 'Invalid request. Please refresh the page and try again.';
    
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Determine if error is retryable
 */
export function canRetry(type: ErrorType): boolean {
  return [
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.SERVER,
  ].includes(type);
}

/**
 * Get retry delay in milliseconds
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
  return Math.min(1000 * Math.pow(2, attemptNumber - 1), 10000);
}

/**
 * Create structured AppError from any error
 */
export function createAppError(error: unknown, customMessage?: string): AppError {
  const type = classifyError(error);
  const userMessage = customMessage || getUserFriendlyMessage(error, type);
  
  // Determine severity
  let severity: ErrorSeverity;
  switch (type) {
    case ErrorType.AUTHENTICATION:
    case ErrorType.CRITICAL:
      severity = ErrorSeverity.CRITICAL;
      break;
    case ErrorType.SERVER:
    case ErrorType.AUTHORIZATION:
      severity = ErrorSeverity.HIGH;
      break;
    case ErrorType.NETWORK:
    case ErrorType.TIMEOUT:
      severity = ErrorSeverity.MEDIUM;
      break;
    default:
      severity = ErrorSeverity.LOW;
  }

  return {
    type,
    severity,
    message: getMsg(error) || 'Unknown error',
    userMessage,
    details: error,
    // PASS 12: timestamp cast kept — getServerTimestamp() returns a Firestore
    // FieldValue marker that is structurally compatible with this AppError
    // shape but TypeScript can't see the structural match because AppError's
    // `timestamp` is a union with a string. Genuinely unavoidable boundary.
    timestamp: getServerTimestamp() as AppError['timestamp'],
    canRetry: canRetry(type),
    retryAfter: canRetry(type) ? getRetryDelay(1) : undefined,
  };
}

/**
 * Log error to console with proper formatting
 */
export function logError(error: AppError, context?: string) {
  const prefix = context ? `[${context}]` : '';

  console.group(`${prefix} Error: ${error.type} (${error.severity})`);
  console.error('Message:', error.message);
  console.error('User Message:', error.userMessage);
  console.error('Timestamp:', error.timestamp);
  console.error('Can Retry:', error.canRetry);
  if (error.details) {
    console.error('Details:', error.details);
  }
  console.groupEnd();
}

/**
 * Handle async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries: number = 3
): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      lastError = error;
      const appError = createAppError(error);
      
      // Log error
      logError(appError, `${context} (Attempt ${attempt}/${maxRetries})`);
      
      // If not retryable or last attempt, return error
      if (!appError.canRetry || attempt === maxRetries) {
        return { success: false, error: appError };
      }
      
      // Wait before retry with exponential backoff
      const delay = getRetryDelay(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Should never reach here, but TypeScript needs it
  return { success: false, error: createAppError(lastError) };
}

/**
 * Check if error is a specific type
 */
export function isErrorType(error: AppError, type: ErrorType): boolean {
  return error.type === type;
}

/**
 * Check if error has specific severity
 */
export function hasErrorSeverity(error: AppError, severity: ErrorSeverity): boolean {
  return error.severity === severity;
}
