/**
 * Error Logger
 * 
 * Step 9: Error Boundary Implementation - CustomerDashboard Optimization
 * 
 * Centralized error logging and reporting service
 */

import type { ErrorInfo } from 'react';
import { logger } from '../../utils/logger';


// ============================================================================
// TYPES
// ============================================================================

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  RENDER = 'render',
  DATA_LOADING = 'data_loading',
  CART = 'cart',
  ORDER_SUBMISSION = 'order_submission',
  VALIDATION = 'validation',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

export interface ErrorLogEntry {
  timestamp: string;
  error: Error;
  errorInfo?: ErrorInfo;
  severity: ErrorSeverity;
  category: ErrorCategory;
  componentName?: string;
  userId?: string;
  additionalContext?: Record<string, unknown>;
  userAgent?: string;
  url?: string;
}

// ============================================================================
// ERROR LOGGER CLASS
// ============================================================================

class ErrorLoggerService {
  private logs: ErrorLogEntry[] = [];
  private maxLogs = 100;

  /**
   * Log an error with context
   */
  log(
    error: Error,
    options: {
      errorInfo?: ErrorInfo;
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      componentName?: string;
      userId?: string;
      additionalContext?: Record<string, unknown>;
    } = {}
  ): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      error,
      errorInfo: options.errorInfo,
      severity: options.severity || this.inferSeverity(error),
      category: options.category || this.inferCategory(error),
      componentName: options.componentName,
      userId: options.userId,
      additionalContext: options.additionalContext,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Add to in-memory logs
    this.logs.push(entry);

    // Trim logs if exceeds max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging based on severity
    this.logToConsole(entry);

    // Send to external service (if configured)
    this.sendToExternalService(entry);

    this.storeInLocalStorage(entry);
  }

  /**
   * Infer error severity from error object
   */
  private inferSeverity(error: Error): ErrorSeverity {
    const message = (error as any).message.toLowerCase();

    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }

    if (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('timeout')
    ) {
      return ErrorSeverity.HIGH;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  /**
   * Infer error category from error object
   */
  private inferCategory(error: Error): ErrorCategory {
    const message = (error as any).message.toLowerCase();
    const stack = (error as any).stack?.toLowerCase() || '';

    if (message.includes('cart') || stack.includes('cart')) {
      return ErrorCategory.CART;
    }

    if (message.includes('order') || stack.includes('order')) {
      return ErrorCategory.ORDER_SUBMISSION;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }

    if (message.includes('network') || message.includes('fetch')) {
      return ErrorCategory.NETWORK;
    }

    if (message.includes('render') || stack.includes('render')) {
      return ErrorCategory.RENDER;
    }

    if (message.includes('load') || message.includes('data')) {
      return ErrorCategory.DATA_LOADING;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Log to console with appropriate level
   */
  private logToConsole(entry: ErrorLogEntry): void {
    const prefix = `[${entry.severity.toUpperCase()}][${entry.category}]`;

    switch (entry.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        console.error(prefix, entry.error, entry);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(prefix, entry.error, entry);
        break;
      default:
        logger.log(prefix, entry.error, entry);
    }
  }

  /**
   * Send error to external monitoring service
   * TODO: Integrate with Sentry, LogRocket, or similar
   */
  private sendToExternalService(entry: ErrorLogEntry): void {
    // Only send in production
    // TODO: Implement actual service integration
    // Example: Sentry
    // if (window.Sentry) {
    //   window.Sentry.captureException(entry.error, {
    //     level: entry.severity,
    //     tags: {
    //       category: entry.category,
    //       component: entry.componentName,
    //     },
    //     extra: entry.additionalContext,
    //   });
    // }

    logger.log('[ErrorLogger] Would send to external service:', entry);
  }

  /**
   */
  private storeInLocalStorage(entry: ErrorLogEntry): void {
    try {
      const key = 'error_logs';
      const logs = [];

      // Add new entry
      logs.push({
        timestamp: entry.timestamp,
        message: (entry.error as any)?.message,
        severity: entry.severity,
        category: entry.category,
        componentName: entry.componentName,
        url: entry.url,
      });

      // Keep only last 50 errors
      const trimmed = logs.slice(-50);

    } catch (error) { console.error("Firebase error:", error); throw error; }
  }

  /**
   * Get all logged errors
   */
  getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  /**
   */
  getStoredLogs(): Array<{
    timestamp: string;
    message: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    componentName?: string;
    url?: string;
  }> {
    try {
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    try {

    } catch {
      // Ignore
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const ErrorLogger = new ErrorLoggerService();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Log a render error
 */
export function logRenderError(
  error: Error,
  errorInfo: ErrorInfo,
  componentName?: string
): void {
  ErrorLogger.log(error as unknown as Error, {
    errorInfo,
    category: ErrorCategory.RENDER,
    componentName,
    severity: ErrorSeverity.HIGH,
  });
}

/**
 * Log a cart error
 */
export function logCartError(error: Error, additionalContext?: Record<string, unknown>): void {
  ErrorLogger.log(error as unknown as Error, {
    category: ErrorCategory.CART,
    severity: ErrorSeverity.MEDIUM,
    additionalContext,
  });
}

/**
 * Log an order submission error
 */
export function logOrderError(error: Error, additionalContext?: Record<string, unknown>): void {
  ErrorLogger.log(error as unknown as Error, {
    category: ErrorCategory.ORDER_SUBMISSION,
    severity: ErrorSeverity.CRITICAL,
    additionalContext,
  });
}

/**
 * Log a network error
 */
export function logNetworkError(error: Error, additionalContext?: Record<string, unknown>): void {
  ErrorLogger.log(error as unknown as Error, {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    additionalContext,
  });
}

/**
 * Log a validation error
 */
export function logValidationError(
  error: Error,
  additionalContext?: Record<string, unknown>
): void {
  ErrorLogger.log(error as unknown as Error, {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    additionalContext,
  });
}

// ============================================================================
// EXPORT
// ============================================================================

export default ErrorLogger;
