import * as React from 'react';
import { logger } from './logger';


const IS_DEV = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || false;

// ============================================================================
// SUBSCRIPTION TRACKER
// ============================================================================

interface SubscriptionInfo {
  key: string;
  timestamp: number;
  stackTrace?: string;
  unsubscribe: () => void;
}

const activeSubscriptions = new Map<string, SubscriptionInfo>();

/**
 * Get current stack trace (for debugging)
 */
function getStackTrace(): string {
  try {
    throw new Error();
  } catch (e) {
    return (e as any).stack?.split('\n').slice(3, 6).join('\n') || 'unknown';
  }
}

/**
 * Wraps a subscription with safety guards
 * 
 * Features:
 * - Detects duplicate subscriptions
 * - Auto-cleanup previous subscriptions
 * - Logs warnings in dev mode
 * - Tracks active subscriptions
 * 
 * @param key - Unique key for this subscription (e.g., "order:123", "customer:orders:abc")
 * @param subscribe - Function that returns unsubscribe function
 * @returns Unsubscribe function
 * 
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = safeSubscribe(
 *     `order:${orderId}`,
 *     () => subscribeToOrder(orderId, handleUpdate)
 *   );
 *   return unsubscribe;
 * }, [orderId]);
 * ```
 */
export function isExpectedFirestoreListenerError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
  const code = String((error as { code?: string } | null)?.code ?? '').toLowerCase();
  const patterns = [
    'aborted',
    'cancelled',
    'deadline-exceeded',
    'failed-precondition',
    'internal',
    'listen stream closed',
    'network',
    'permission-denied',
    'resource-exhausted',
    'unavailable',
  ];

  return patterns.some((pattern) => message.includes(pattern) || code.includes(pattern));
}

export function safeSubscribe(
  key: string,
  subscribe: () => (() => void)
): () => void {
  // Check for duplicate subscription
  const existing = activeSubscriptions.get(key);
  
  if (existing) {
    if (IS_DEV) {
      logger.warn(
        `⚠️ [SUBSCRIPTION SAFETY] Duplicate subscription detected: "${key}"\n` +
        `Previous subscription created ${Date.now() - existing.timestamp}ms ago\n` +
        `This is likely a memory leak or unnecessary re-subscription.\n` +
        `Original stack:\n${existing.stackTrace}\n` +
        `New stack:\n${getStackTrace()}`
      );
    }
    
    // Auto-cleanup previous subscription
    existing.unsubscribe();
    activeSubscriptions.delete(key);
  }
  
  // Create new subscription
  const unsubscribe = subscribe();
  
  // Track it
  const info: SubscriptionInfo = {
    key,
    timestamp: Date.now(),
    stackTrace: IS_DEV ? getStackTrace() : undefined,
    unsubscribe,
  };
  
  activeSubscriptions.set(key, info);
  
  if (IS_DEV) {
  }
  
  // Return wrapped unsubscribe
  return () => {
    const current = activeSubscriptions.get(key);
    if (current === info) {
      activeSubscriptions.delete(key);
      if (IS_DEV) {
      }
    }
    unsubscribe();
  };
}

/**
 * Get all active subscriptions (for debugging)
 */
export function getActiveSubscriptions(): string[] {
  return Array.from(activeSubscriptions.keys());
}

/**
 * Get subscription count (for monitoring)
 */
export function getSubscriptionCount(): number {
  return activeSubscriptions.size;
}

/**
 * Clean up all subscriptions (use sparingly, mainly for testing)
 */
export function cleanupAllSubscriptions(): void {
  if (IS_DEV) {
    logger.warn(`🧹 [SUBSCRIPTION SAFETY] Cleaning up all ${activeSubscriptions.size} subscriptions`);
  }
  
  activeSubscriptions.forEach((info) => {
    info.unsubscribe();
  });
  
  activeSubscriptions.clear();
}

/**
 * Check for subscription leaks (call periodically in dev)
 */
export function checkForLeaks(maxExpected: number = 10): void {
  if (!IS_DEV) return;
  
  const count = activeSubscriptions.size;
  
  if (count > maxExpected) {
    console.error(
      `🚨 [SUBSCRIPTION SAFETY] Possible memory leak detected!\n` +
      `Active subscriptions: ${count} (expected: <${maxExpected})\n` +
      `Subscriptions:\n${Array.from(activeSubscriptions.entries())
        .map(([key, info]) => `  - ${key} (age: ${Date.now() - info.timestamp}ms)`)
        .join('\n')}`
    );
  }
}

// ============================================================================
// REACT HOOKS INTEGRATION
// ============================================================================

/**
 * React hook for safe subscriptions with automatic cleanup
 * 
 * @param key - Unique subscription key
 * @param subscribe - Subscribe function
 * @param deps - Dependency array (like useEffect)
 * 
 * @example
 * ```tsx
 * useSafeSubscription(
 *   `order:${orderId}`,
 *   () => subscribeToOrder(orderId, setOrder),
 *   [orderId]
 * );
 * ```
 */
export function useSafeSubscription(
  key: string | null,
  subscribe: () => (() => void),
  deps: React.DependencyList
): void {
  React.useEffect(() => {
    if (!key) return;
    
    const unsubscribe = safeSubscribe(key, subscribe);
    return unsubscribe;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// ============================================================================
// DEVELOPMENT MONITORING
// ============================================================================

// ✅ TIMER CLEANUP: Track intervals for proper cleanup
let leakCheckInterval: NodeJS.Timeout | null = null;

if (IS_DEV) {
  // Check for leaks every 10 seconds in dev
  leakCheckInterval = setInterval(() => {
    checkForLeaks(20); // Adjust threshold based on your app
  }, 10000);
  
  // Log active subscriptions on window focus (helps debug)
  window.addEventListener('focus', () => {
    if (activeSubscriptions.size > 0) {
      logger.log(
        `📊 [SUBSCRIPTION SAFETY] Active subscriptions: ${activeSubscriptions.size}\n` +
        Array.from(activeSubscriptions.keys()).map(key => `  - ${key}`).join('\n')
      );
    }
  });
}

/**
 * Cleanup development monitoring intervals
 * ✅ Call this when unmounting app or during cleanup
 */
export function cleanupDevMonitoring(): void {
  if (leakCheckInterval) {
    clearInterval(leakCheckInterval);
    leakCheckInterval = null;
  }
}

// ============================================================================
// TYPESCRIPT HELPERS
// ============================================================================

/**
 * Type-safe subscription wrapper
 */
export type SafeUnsubscribe = () => void;

/**
 * Subscription function type
 */
export type SubscriptionFunction<T> = (
  callback: (data: T) => void,
  onError?: (error: Error) => void
) => SafeUnsubscribe;