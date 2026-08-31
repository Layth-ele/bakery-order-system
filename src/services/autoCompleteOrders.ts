/**
 * Auto-Complete Orders (Week Close) — Thin Wrapper
 *
 * ✅ REFACTORED: Feb 13, 2026
 * - Now delegates to canonical completeOrderNow() service
 * - Prevents race conditions
 * - Maintains backward compatibility
 * 
 * ✅ PRODUCTION-SAFE: Feb 14, 2026
 * - Removed demo data import dependency
 * - Uses types from canonical /types instead
 * 
 * ✅ Rules:
 * - Only completes orders that are APPROVED OR IN_PROCESS + base PAID
 * - Delegates actual completion to completeOrderNow() (single source of truth)
 * - Safe to run multiple times (idempotent via completeOrderNow guards)
 *
 * This is a UI-side helper (client). Can be moved to scheduled Cloud Function later.
 */

import type { Order } from '../types';
import { getNowInVancouver } from '../utils/timezone';
import { getOrders } from './dataService';
import { completeOrderNow } from './orderCompletion/completeOrderNow';
import { toDate } from '../utils/timestampFormatting';
import { logger } from '../utils/logger';


function defaultWeekCloseAt(now: Date): Date {
  // ✅ Friday 12:00 PM (noon) Vancouver time — uses canonical Vancouver time helper
  const vancouverNow = getNowInVancouver();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Vancouver',
    weekday: 'narrow', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(vancouverNow);
  const yr = Number(parts.find(p => p.type === 'year')?.value);
  const mo = Number(parts.find(p => p.type === 'month')?.value) - 1;
  const dy = Number(parts.find(p => p.type === 'day')?.value);
  const dow = ['S','M','T','W','T','F','S'].indexOf(
    parts.find(p => p.type === 'weekday')?.value?.charAt(0) ?? 'S'
  );
  // Days until next Friday (5)
  const diffToFriday = (5 - (dow === -1 ? 0 : dow) + 7) % 7 || 7;
  const friday = new Date(yr, mo, dy + diffToFriday, 12, 0, 0, 0);
  // Adjust to UTC equivalent of Vancouver Friday noon
  const offsetMs = new Date(friday.toLocaleString('en-US', { timeZone: 'America/Vancouver' })).getTime() -
                   new Date(friday.toLocaleString('en-US')).getTime();
  return new Date(friday.getTime() - offsetMs);
}

/**
 * Determine if an order should be auto-completed
 * 
 * @param order - The order to check
 * @param now - Current time (for testing)
 * @returns true if order is eligible for auto-completion
 */
export function shouldAutoComplete(order: Order, now: Date = getNowInVancouver()): boolean {
  if (!order?.id) return false;

  // Already closed
  if (order.locked) return false;
  if (order.status === 'completed') return false;

  // Must be approved OR in_process + base paid
  if (order.status !== 'approved' && order.status !== 'in_process') return false;
  if (!order.paymentReceived) return false;

  // Week close check
  const closeAt = order.weekCloseAt
    ? (toDate(order.weekCloseAt) ?? new Date())
    : defaultWeekCloseAt(now);

  return closeAt < now;
}

export type AutoCompleteResult = {
  checked: number;
  eligible: number;
  completed: number;
  skippedWithUnpaidAdjustments: number; // ❌ DEPRECATED: Always 0 now, kept for backward compat
  failures: Array<{ orderId: string; reason: string }>;
  completedOrderIds: string[];
};

/**
 * ✅ REFACTORED: Main entry point - thin wrapper around completeOrderNow()
 * 
 * Finds eligible orders and delegates completion to canonical service.
 * Safe to run multiple times (idempotent thanks to completeOrderNow guards).
 * 
 * @param now - Current time (for testing)
 * @returns Summary of completion results
 */
export async function autoCompleteOrdersFinalize(now: Date = getNowInVancouver()): Promise<AutoCompleteResult> {
  const orders = await getOrders();

  const result: AutoCompleteResult = {
    checked: orders.length,
    eligible: 0,
    completed: 0,
    skippedWithUnpaidAdjustments: 0, // Deprecated, always 0
    failures: [],
    completedOrderIds: [],
  };

  // 2️⃣ Find eligible orders using existing logic
  const eligibleOrders = orders.filter(o => shouldAutoComplete(o as Order, now));
  result.eligible = eligibleOrders.length;

  // 3️⃣ DELEGATE to completeOrderNow() for each eligible order
  for (const order of eligibleOrders) {
    try {
      
      // ✅ Delegate to canonical completion service
      const completionResult = await completeOrderNow(order as Order, {
        actor: 'auto-scheduler'
      });

      if (completionResult.success) {
        result.completed += 1;
        result.completedOrderIds.push(order.id);
      } else {
        result.failures.push({
          orderId: order.id || "",
          reason: completionResult.error || 'Unknown error'
        });
        logger.warn(`⚠️ [autoCompleteOrders] Order ${order.id} failed: ${completionResult.error}`);
      }
    } catch (error) {
      result.failures.push({
        orderId: order.id || "",
        reason: (error as any).message || 'Failed to complete order'
      });
      console.error(`❌ [autoCompleteOrders] Order ${order.id} threw error:`, error);
    }
  }

  
  if (result.failures.length > 0) {
    logger.warn(`⚠️ [autoCompleteOrders] ${result.failures.length} failures:`, result.failures);
  }

  return result;
}

/**
 * ✅ Backward compatibility wrapper
 * Legacy fire-and-forget version for existing code
 */
export function autoCompleteOrders(): void {
  void autoCompleteOrdersFinalize(getNowInVancouver()).catch((e) => {
    console.error('❌ autoCompleteOrdersFinalize failed:', e);
  });
}

/**
 * ✅ Backward compatibility wrapper
 * Async version that returns count for existing code
 */
export async function autoCompleteOrdersAsync(): Promise<number> {
  const result = await autoCompleteOrdersFinalize(getNowInVancouver());
  return result.completed;
}