/**
 * routes/optimistic/utils.ts
 * 
 * Core utilities for optimistic UI updates.
 * Updates UI immediately before server responds, then syncs in background.
 * 
 * Benefits:
 * - Instant UI feedback (feels 10x faster)
 * - Automatic rollback on errors
 * - Background server synchronization
 * - Professional UX (no waiting)
 * 
 * Created: March 10, 2026
 */

import { invalidateRouteCache } from '../loaders/utils';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Optimistic update context for rollback
 */
export interface OptimisticContext<T = any> {
  previousData: T;
  snapshot: Map<string, any>;
  timestamp: number;
}

/**
 * Optimistic update options
 */
export interface OptimisticUpdateOptions<TData, TVariables> {
  /**
   * Mutation function (API call)
   */
  mutationFn: (variables: TVariables) => Promise<TData>;
  
  /**
   * Optimistic update function (runs immediately)
   */
  onOptimisticUpdate: (variables: TVariables) => void;
  
  /**
   * Rollback function (runs on error)
   */
  onRollback?: (context: OptimisticContext) => void;
  
  /**
   * Success callback
   */
  onSuccess?: (data: TData, variables: TVariables) => void;
  
  /**
   * Error callback
   */
  onError?: (error: Error, variables: TVariables, context?: OptimisticContext) => void;
  
  /**
   * Cache keys to invalidate on success
   */
  invalidateKeys?: string[];
  
  /**
   * Success message
   */
  successMessage?: string;
  
  /**
   * Error message
   */
  errorMessage?: string;
}

/**
 * Optimistic mutation state
 */
export interface OptimisticMutationState {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: Error | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTIMISTIC UPDATE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

class OptimisticUpdateManager {
  private pendingUpdates = new Map<string, OptimisticContext>();
  
  /**
   * Start an optimistic update
   */
  start<T>(key: string, data: T): OptimisticContext<T> {
    const context: OptimisticContext<T> = {
      previousData: data,
      snapshot: new Map(),
      timestamp: Date.now(),
    };
    
    this.pendingUpdates.set(key, context);
    return context;
  }
  
  /**
   * Complete an optimistic update
   */
  complete(key: string): void {
    this.pendingUpdates.delete(key);
  }
  
  /**
   * Get context for rollback
   */
  getContext<T>(key: string): OptimisticContext<T> | undefined {
    return this.pendingUpdates.get(key) as OptimisticContext<T> | undefined;
  }
  
  /**
   * Check if update is pending
   */
  isPending(key: string): boolean {
    return this.pendingUpdates.has(key);
  }
  
  /**
   * Clear all pending updates
   */
  clear(): void {
    this.pendingUpdates.clear();
  }
  
  /**
   * Get all pending update keys
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingUpdates.keys());
  }
}

// Global manager instance
const optimisticManager = new OptimisticUpdateManager();

/**
 * Get the optimistic update manager
 */
export function getOptimisticManager(): OptimisticUpdateManager {
  return optimisticManager;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE OPTIMISTIC UPDATE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute an optimistic update
 * 
 * @example
 * await executeOptimisticUpdate({
 *   mutationFn: (id) => approveOrder(id),
 *   onOptimisticUpdate: (id) => {
 *     // Update UI immediately
 *     updateOrderStatus(id, 'approved');
 *   },
 *   onRollback: (context) => {
 *     // Restore previous state on error
 *     restoreOrders(context.previousData);
 *   },
 *   invalidateKeys: ['orders'],
 *   successMessage: 'Order approved!',
 *   errorMessage: 'Failed to approve order',
 * });
 */
export async function executeOptimisticUpdate<TData, TVariables>(
  variables: TVariables,
  options: OptimisticUpdateOptions<TData, TVariables>
): Promise<TData> {
  const {
    mutationFn,
    onOptimisticUpdate,
    onRollback,
    onSuccess,
    onError,
    invalidateKeys = [],
    successMessage,
    errorMessage,
  } = options;
  
  // Generate unique key for this update
  //
  // FIX T2R4-H3 (HIGH): Was `Math.random()` which produces a ~17-digit
  // decimal in [0,1). Two simultaneous optimistic updates in the same
  // millisecond have a small but non-zero collision probability — if
  // they collide, `optimisticManager.start(key)` overwrites the first
  // update's tracking context, and the rollback path then targets the
  // wrong update. Now uses crypto.getRandomValues() for collision-
  // resistant keys.
  const _keyBuf = new Uint8Array(8);
  crypto.getRandomValues(_keyBuf);
  const _keyRand = Array.from(_keyBuf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 11);
  const updateKey = `optimistic-${Date.now()}-${_keyRand}`;
  
  try {
    // 1. Execute optimistic update immediately
    onOptimisticUpdate(variables);
    
    // 2. Start tracking (for rollback)
    const context = optimisticManager.start(updateKey, variables);
    
    // 3. Execute actual mutation (in background)
    const result = await mutationFn(variables);
    
    // 4. Mark as complete
    optimisticManager.complete(updateKey);
    
    // 5. Invalidate caches
    invalidateKeys.forEach(key => {
      invalidateRouteCache(key);
    });
    
    // 6. Success callback
    if (onSuccess) {
      onSuccess(result, variables);
    }
    
    // 7. Show success message
    if (successMessage && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    }
    
    return result;
    
  } catch (error) {
    // 8. Rollback on error
    const context = optimisticManager.getContext(updateKey);
    if (context && onRollback) {
      onRollback(context);
    }
    
    // 9. Clean up
    optimisticManager.complete(updateKey);
    
    // 10. Error callback
    if (onError) {
      onError(error as Error, variables, context);
    }
    
    // 11. Show error message
    if (errorMessage && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.error(`❌ ${errorMessage}:`, error);
    }
    
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE SNAPSHOT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a snapshot of current state for rollback
 */
export function createStateSnapshot<T>(data: T): T {
  // Deep clone to prevent mutations
  return ((() => { try { return JSON.parse(JSON.stringify(data)); } catch { return null; } })());
}

/**
 * Restore state from snapshot
 */
export function restoreStateFromSnapshot<T>(snapshot: T): T {
  return ((() => { try { return JSON.parse(JSON.stringify(snapshot)); } catch { return snapshot; } })());
}

// ═══════════════════════════════════════════════════════════════════════════
// ARRAY MANIPULATION UTILITIES (for optimistic updates)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Optimistically remove item from array
 */
export function optimisticRemove<T extends { id: string }>(
  array: T[],
  id: string
): T[] {
  return array.filter(item => item.id !== id);
}

/**
 * Optimistically add item to array
 */
export function optimisticAdd<T>(
  array: T[],
  item: T,
  position: 'start' | 'end' = 'end'
): T[] {
  return position === 'start' ? [item, ...array] : [...array, item];
}

/**
 * Optimistically update item in array
 */
export function optimisticUpdate<T extends { id: string }>(
  array: T[],
  id: string,
  updates: Partial<T>
): T[] {
  return array.map(item =>
    item.id === id ? { ...item, ...updates } : item
  );
}

/**
 * Optimistically move item between arrays
 */
export function optimisticMove<T extends { id: string }>(
  sourceArray: T[],
  targetArray: T[],
  id: string,
  updates?: Partial<T>
): { source: T[]; target: T[] } {
  const item = sourceArray.find(item => item.id === id);
  if (!item) {
    return { source: sourceArray, target: targetArray };
  }
  
  const updatedItem = updates ? { ...item, ...updates } : item;
  
  return {
    source: sourceArray.filter(item => item.id !== id),
    target: [...targetArray, updatedItem],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

interface OptimisticUpdateMetrics {
  updateKey: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: Error;
}

const metricsHistory: OptimisticUpdateMetrics[] = [];

/**
 * Track optimistic update performance
 */
export function trackOptimisticUpdate(
  updateKey: string,
  success: boolean,
  duration: number,
  error?: Error
): void {
  const metrics: OptimisticUpdateMetrics = {
    updateKey,
    startTime: Date.now() - duration,
    endTime: Date.now(),
    duration,
    success,
    error,
  };
  
  metricsHistory.push(metrics);
  
  // Keep only last 100 metrics
  if (metricsHistory.length > 100) {
    metricsHistory.shift();
  }
  
  // Log slow updates in development
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && duration > 1000) {
    logger.warn(
      `⚠️ Slow optimistic update: ${updateKey} took ${duration}ms`
    );
  }
}

/**
 * Get optimistic update metrics
 */
export function getOptimisticMetrics(): OptimisticUpdateMetrics[] {
  return [...metricsHistory];
}

/**
 * Get average optimistic update duration
 */
export function getAverageOptimisticDuration(): number {
  if (metricsHistory.length === 0) return 0;
  
  const total = metricsHistory.reduce(
    (sum, m) => sum + (m.duration || 0),
    0
  );
  
  return total / metricsHistory.length;
}

/**
 * Get optimistic update success rate
 */
export function getOptimisticSuccessRate(): number {
  if (metricsHistory.length === 0) return 0;
  
  const successful = metricsHistory.filter(m => m.success).length;
  return (successful / metricsHistory.length) * 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVELOPMENT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  // Expose utilities for debugging
  (window as any).__optimisticUtils = {
    manager: optimisticManager,
    getMetrics: getOptimisticMetrics,
    getAverageDuration: getAverageOptimisticDuration,
    getSuccessRate: getOptimisticSuccessRate,
    getPendingUpdates: () => optimisticManager.getPendingKeys(),
  };
  
  logger.log(
    '🔧 Optimistic update utilities available at window.__optimisticUtils'
  );
}