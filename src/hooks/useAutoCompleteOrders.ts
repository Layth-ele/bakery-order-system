/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTO-COMPLETE ORDERS HOOK
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✅ PHASE 2 APPROVED: Perfect Pattern - Scheduler Hook
 * 
 * PURPOSE:
 * - Schedule auto-completion check on page load
 * - Delegate business logic to autoCompleteOrdersFinalize service
 * 
 * STATUS: ✅ EXCELLENT - This is the ideal hook pattern
 * - Pure UI coordination (scheduling)
 * - Delegates 100% of business logic to service
 * - Minimal side effects
 * 
 * PATTERN:
 * This hook is a SCHEDULER, not a business logic container.
 * It only manages WHEN to run, not WHAT to run.
 * 
 * Automatically completes orders when their processing week ends.
 * 
 * Features:
 * - Runs auto-completion check ONCE when page loads
 * - Only runs when component is active (not in background tabs)
 * - Invalidates cache after completion to update UI
 * - Handles errors gracefully
 * 
 * Usage:
 *   useAutoCompleteOrders(isActive);
 * 
 * 💡 PRODUCTION: Move to Firebase Cloud Functions scheduled trigger
 *    - Schedule: Daily at 12:05 PM Vancouver time (5 minutes after cutoff)
 *    - This eliminates client-side costs and ensures reliable execution
 * 
 * ✅ CREATED: MAR 5, 2026
 * ✅ APPROVED: MAR 8, 2026 - Phase 2 Hooks Refactoring
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef } from 'react';
import { autoCompleteOrdersFinalize } from '../services/autoCompleteOrders';
import { invalidateCache } from './useCachedFirebase';
import { debug } from '../utils/debug';

/**
 * Auto-complete orders hook
 * Runs ONCE when component becomes active to check for expired orders
 * 
 * ⚠️ NOTE: This is a client-side fallback. For production, use Firebase Cloud Functions
 * with a scheduled trigger to run daily at 12:05 PM Vancouver time.
 */
export function useAutoCompleteOrders(isActive: boolean = true) {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isActive || hasRunRef.current) {
      return;
    }

    // Mark as run to prevent duplicate execution
    hasRunRef.current = true;

    // ✅ PERFORMANCE FIX: Run after a small delay to avoid blocking initial render
    // This allows the UI to render first, then auto-complete in background
    const timeoutId = setTimeout(() => {
      runAutoCompletion();
    }, 100); // 100ms delay - user won't notice, but UI renders fast

    // Cleanup function (resets flag if component unmounts and remounts)
    return () => {
      hasRunRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [isActive]);

  async function runAutoCompletion() {
    try {
      debug.log('🔄 [useAutoCompleteOrders] Checking for orders to auto-complete...');

      const result = await autoCompleteOrdersFinalize();

      if (result.completed > 0) {
        debug.success(
          `✅ [useAutoCompleteOrders] Completed ${result.completed} order(s)`,
          result.completedOrderIds
        );

        // Invalidate cache to refresh UI
        await invalidateCache.orders(); // ✅ FIX: Use invalidateCache.orders() not invalidateCache('orders')
        debug.log('♻️ [useAutoCompleteOrders] Cache invalidated - UI will refresh');
      } else if (result.eligible > 0) {
        debug.warn(
          `⚠️ [useAutoCompleteOrders] Found ${result.eligible} eligible order(s) but none completed`,
          result.failures
        );
      } else {
        debug.log('✅ [useAutoCompleteOrders] No orders ready for completion');
      }
    } catch (error) {
      debug.error('❌ [useAutoCompleteOrders] Error during auto-completion:', error);
    }
  }
}