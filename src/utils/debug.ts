/**
 * Centralized Debug Logging Utility
 * 
 * ✅ FEB 23, 2026: Created to replace scattered console.log calls
 * 
 * Features:
 * - Only logs in development mode
 * - Colored output for different log levels
 * - Consistent formatting
 * - Production-safe (zero overhead in production builds)
 * 
 * Usage:
 *   import { debug } from '@/utils/debug';
 *   
 *   debug.log('Regular message');
 *   debug.info('Info message');
 *   debug.warn('Warning message');
 *   debug.error('Error message');
 *   debug.success('Success message');
 */

import { logger } from './logger';
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

/**
 * Format timestamp for logs
 */
const getTimestamp = (): string => {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
};

/**
 * Debug logger that only runs in development
 */
export const debug = {
  /**
   * Regular log (gray)
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      logger.log(`[${getTimestamp()}]`, ...args);
    }
  },

  /**
   * Info log (blue)
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      logger.log(`%c[${getTimestamp()}] ℹ️`, 'color: #2196F3', ...args);
    }
  },

  /**
   * Warning log (orange)
   */
  warn: (...args: unknown[]) => {
    if (isDev) {
      logger.warn(`%c[${getTimestamp()}] ⚠️`, 'color: #FF9800', ...args);
    }
  },

  /**
   * Error log (red) - ALWAYS logs (even in production for critical errors)
   */
  error: (...args: unknown[]) => {
    console.error(`%c[${getTimestamp()}] ❌`, 'color: #F44336', ...args);
  },

  /**
   * Success log (green)
   *
   * FIX R10-S6-F70 (HIGH): Function body was empty `if (isDev) {}` — calling
   * debug.success(...) was a silent no-op even in development.  Now logs.
   */
  success: (...args: unknown[]) => {
    if (isDev) {
      logger.log(`%c[${getTimestamp()}] ✅`, 'color: #4CAF50', ...args);
    }
  },

  /**
   * Component lifecycle log (purple)
   *
   * FIX R10-S6-F70 (HIGH): Function body was empty.  Now logs.
   */
  component: (componentName: string, action: string, ...args: unknown[]) => {
    if (isDev) {
      logger.log(`%c[${getTimestamp()}] 🔄 ${componentName}`, 'color: #9C27B0', action, ...args);
    }
  },

  /**
   * API/Network log (cyan)
   */
  api: (method: string, endpoint: string, ...args: unknown[]) => {
    if (isDev) {
      logger.log(`%c[${getTimestamp()}] 🌐 ${method}`, 'color: #00BCD4', endpoint, ...args);
    }
  },

  /**
   * Performance log (yellow)
   */
  perf: (label: string, duration: number) => {
    if (isDev) {
      logger.log(`%c[${getTimestamp()}] ⚡ Performance`, 'color: #FFC107', `${label}: ${duration.toFixed(2)}ms`);
    }
  },

  /**
   * Group logs together
   */
  group: (label: string, collapsed: boolean = false) => {
    if (isDev) {
      if (collapsed) {
        console.groupCollapsed(`%c${label}`, 'color: #607D8B; font-weight: bold');
      } else {
        console.group(`%c${label}`, 'color: #607D8B; font-weight: bold');
      }
    }
  },

  /**
   * End log group
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },

  /**
   * Table log (for arrays/objects)
   */
  table: (data: unknown) => {
    if (isDev) {
      console.table(data);
    }
  },
};

/**
 * Legacy compatibility - for gradual migration
 * @deprecated Use debug.log() instead
 */
export const devLog = (...args: unknown[]) => {
  if (isDev) {
    logger.log(...args);
  }
};

/**
 * Create a scoped logger for a specific module
 * 
 * Usage:
 *   const log = createLogger('MyComponent');
 *   log.info('Component mounted');
 */
export const createLogger = (scope: string) => ({
  log: (...args: unknown[]) => debug.log(`[${scope}]`, ...args),
  info: (...args: unknown[]) => debug.info(`[${scope}]`, ...args),
  warn: (...args: unknown[]) => debug.warn(`[${scope}]`, ...args),
  error: (...args: unknown[]) => debug.error(`[${scope}]`, ...args),
  success: (...args: unknown[]) => debug.success(`[${scope}]`, ...args),
});