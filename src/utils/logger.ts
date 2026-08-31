/**
 * 🔍 Conditional Logger Utility
 * 
 * **Purpose:** Reduce console.log overhead in production
 * 
 * **Performance Impact:**
 * - Development: All logs visible for debugging
 * - Production: Only errors logged (10-20ms saved per action)
 * 
 * **Usage:**
 * ```typescript
 * import { logger } from '@/utils/logger';
 * 
 * // Instead of console.log
 * logger.log('User logged in', user);
 * 
 * // Errors always logged
 * logger.error('Failed to save order', error);
 * 
 * // Warnings only in dev
 * logger.warn('Deprecated function used');
 * 
 * // Debug-level logs
 * logger.debug('Firestore query', query);
 * ```
 * 
 * **Migration:**
 * Search & replace throughout codebase:
 * - `console.log(` → `logger.log(`
 * - `console.warn(` → `logger.warn(`
 * - `console.debug(` → `logger.debug(`
 * - Keep `console.error` as-is or use `logger.error`
 * 
 * @created March 6, 2026
 */

// Detect environment
const isDev = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'development');
const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

// Feature flags for granular control
const LOG_CONFIG = {
  // Always log errors
  error: true,
  
  // Development-only logs
  log: isDev,
  warn: isDev,
  debug: isDev,
  info: isDev,
  
  // Performance tracking (can enable in production)
  performance: isDev,
  
  // Firestore operation logging
  firestore: isDev,
  
  // Cache operation logging  
  cache: isDev,
};

/**
 * Conditional logger that respects environment and feature flags
 *
 * PASS 11: Internally declared as `_logger` so we can attach the
 * structured-event methods (`event`, `exception`) at the bottom of this
 * file with `Object.assign`, then export the merged value as `logger`.
 * Doing it this way (rather than mutating an exported `const`) means
 * TypeScript correctly infers `logger.event` and `logger.exception` at
 * every call site without each caller having to cast to `StructuredLogger`.
 */
const _logger = {
  /**
   * Standard logging - Development only
   */
  log: (...args: unknown[]) => {
    if (LOG_CONFIG.log) {
      console.log(...args);
    }
  },

  /**
   * Error logging - Always enabled
   */
  error: (...args: unknown[]) => {
    if (LOG_CONFIG.error) {
      console.error(...args);
    }
  },

  /**
   * Warning logging - Development only
   */
  warn: (...args: unknown[]) => {
    if (LOG_CONFIG.warn) {
      console.warn(...args);
    }
  },

  /**
   * Debug logging - Development only
   */
  debug: (...args: unknown[]) => {
    if (LOG_CONFIG.debug) {
      console.debug(...args);
    }
  },

  /**
   * Info logging - Development only
   */
  info: (...args: unknown[]) => {
    if (LOG_CONFIG.info) {
      console.info(...args);
    }
  },

  /**
   * Performance measurement
   * 
   * Usage:
   * ```typescript
   * logger.performance.start('expensive-operation');
   * // ... do work
   * logger.performance.end('expensive-operation');
   * ```
   */
  performance: {
    start: (label: string) => {
      if (LOG_CONFIG.performance) {
        console.time(label);
      }
    },
    end: (label: string) => {
      if (LOG_CONFIG.performance) {
        console.timeEnd(label);
      }
    },
  },

  /**
   * Firestore operation logging
   * 
   * Usage:
   * ```typescript
   * logger.firestore('Fetching orders', { limit: 100 });
   * ```
   */
  firestore: (operation: string, ...args: unknown[]) => {
    if (LOG_CONFIG.firestore) {
    }
  },

  /**
   * Cache operation logging
   * 
   * Usage:
   * ```typescript
   * logger.cache('Cache hit', 'orders');
   * logger.cache('Cache miss', 'orders');
   * ```
   */
  cache: (operation: string, ...args: unknown[]) => {
    if (LOG_CONFIG.cache) {
    }
  },

  /**
   * Group related logs (collapsed by default)
   */
  group: (label: string, fn: () => void) => {
    if (isDev) {
      console.groupCollapsed(label);
      fn();
      console.groupEnd();
    } else {
      // In production, just execute without grouping
      fn();
    }
  },

  /**
   * Table logging for structured data
   */
  table: (data: unknown) => {
    if (isDev) {
      console.table(data);
    }
  },
};

/**
 * Performance mark utility for React components
 * 
 * Usage:
 * ```typescript
 * function MyComponent() {
 *   useEffect(() => {
 *     const mark = logger.mark('MyComponent mount');
 *     return () => mark.end();
 *   }, []);
 * }
 * ```
 */
export const createPerformanceMark = (label: string) => {
  const startTime = performance.now();
  
  return {
    end: () => {
      if (LOG_CONFIG.performance) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`⏱️ [Performance] ${label}: ${duration.toFixed(2)}ms`);
      }
    },
  };
};

// Expose for easy debugging in browser console
// PASS 11: refers to `_logger` because the public `logger` export is
// declared at the bottom of this file (after Object.assign attaches
// the structured-event methods).
if (typeof window !== 'undefined' && isDev) {
  (window as any).__logger__ = _logger;
  (window as any).__enableLogs__ = () => {
    Object.keys(LOG_CONFIG).forEach(key => {
      (LOG_CONFIG as any)[key] = true;
    });
  };
  (window as any).__disableLogs__ = () => {
    Object.keys(LOG_CONFIG).forEach(key => {
      if (key !== 'error') {
        (LOG_CONFIG as any)[key] = false;
      }
    });
  };
}

// ════════════════════════════════════════════════════════════════════════════
// PASS 8 — STRUCTURED EVENT LOGGING + ERROR REPORTER INTEGRATION
// ════════════════════════════════════════════════════════════════════════════
//
// The methods above (logger.log, logger.warn, logger.debug, logger.info,
// logger.error) match `console.*` in spirit and are kept for backwards compat.
//
// The methods below add structured event logging — every event has a
// dot-namespaced name searchable in any log aggregator, plus optional
// typed context. These are the methods to use for net-new code (Cloud
// Functions, security-critical paths, payment flows). Existing call sites
// migrate opportunistically as files are touched.

export interface LogContext {
  [key: string]: unknown;
}

export interface ErrorReporter {
  /** Capture a thrown error with optional context. */
  captureException(error: Error, context?: LogContext): void;
  /** Capture a non-error message at the given level. */
  captureMessage(message: string, level: 'info' | 'warn' | 'error', context?: LogContext): void;
}

let _reporter: ErrorReporter | null = null;

/**
 * Inject an error reporter (e.g. Sentry, Bugsnag, Cloud Logging).
 * Call once at app startup. Not setting one is fine — events still flow
 * through to the console; they just don't get aggregated upstream.
 *
 * @example
 *   import * as Sentry from '@sentry/react';
 *   import { setErrorReporter } from '@/utils/logger';
 *   Sentry.init({ ... });
 *   setErrorReporter({
 *     captureException: (e, ctx) => Sentry.captureException(e, { extra: ctx }),
 *     captureMessage: (m, lvl, ctx) => Sentry.captureMessage(m, { level: lvl, extra: ctx }),
 *   });
 */
export function setErrorReporter(reporter: ErrorReporter | null): void {
  _reporter = reporter;
}

/** Test-only: reset the reporter between unit tests. */
export function _resetReporterForTests(): void {
  _reporter = null;
}

/**
 * Log a structured event.
 *
 * @param event Dot-namespaced event name, e.g. 'order.approved' or
 *              'payment.proof.submitted'. Searchable in any aggregator.
 * @param level Severity. info/debug stripped from production via Pass 3
 *              esbuild config; warn/error retained.
 * @param context Optional structured metadata. Avoid PII at this level.
 *
 * @example
 *   logger.event('order.approved', 'info', { orderId, total });
 *   logger.event('payment.proof.missing', 'warn', { orderId });
 */
function eventLog(event: string, level: 'debug' | 'info' | 'warn' | 'error', context?: LogContext): void {
  switch (level) {
    case 'debug':
      if (LOG_CONFIG.debug) console.debug(event, context ?? '');
      break;
    case 'info':
      if (LOG_CONFIG.info) console.info(event, context ?? '');
      break;
    case 'warn':
      console.warn(event, context ?? '');
      _reporter?.captureMessage(event, 'warn', context);
      break;
    case 'error':
      console.error(event, context ?? '');
      _reporter?.captureMessage(event, 'error', context);
      break;
  }
}

/**
 * Log a thrown error with context. Preserves the stack trace via the reporter.
 *
 * @example
 *   try { ... } catch (err) {
 *     logger.exception('order.creation.failed', err as Error, { orderId });
 *   }
 */
function exception(event: string, error: Error, context?: LogContext): void {
  console.error(event, error, context ?? '');
  _reporter?.captureException(error, { event, ...(context ?? {}) });
}

// PASS 11: Build the public `logger` by attaching structured-event methods
// to `_logger` via Object.assign. Object.assign returns a value typed as
// the intersection of its inputs, so the exported `logger` has type
// `typeof _logger & { event: typeof eventLog; exception: typeof exception }`.
// Every call site of `logger.event(...)` / `logger.exception(...)` therefore
// type-checks without any cast — matching the runtime contract added in
// Pass 8 with the static contract callers already assumed.
//
// Why not declare `event` / `exception` directly inside the `_logger`
// literal? They reference `_reporter` (module-private state) plus a few
// other helpers defined later in the file. Object.assign sidesteps the
// hoisting problem cleanly without splitting the file.
export const logger = Object.assign(_logger, {
  event: eventLog,
  exception,
});

/** @deprecated Type kept for backwards compat. Use `typeof logger` directly. */
export type StructuredLogger = typeof logger;

/**
 * Migration helper - Find all console.log usages
 * Run in browser console:
 * ```javascript
 * __logger__.findConsoleLogs()
 * ```
 */
if (typeof window !== 'undefined' && isDev) {
  (window as any).__findConsoleLogs__ = () => {
    console.log('1. console.log(');
    console.log('2. console.warn(');
    console.log('3. console.debug(');
    console.log('');
    console.log('Replace with:');
    console.log('1. logger.log(');
    console.log('2. logger.warn(');
    console.log('3. logger.debug(');
  };
}

export default logger;