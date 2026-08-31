/**
 * Order Snapshot Service (Client-Side)
 * 
 * Creates READ-ONLY snapshots when orders change state.
 * Not to be confused with Invoice Snapshots (finalizeOrderToInvoice.ts).
 * 
 * Purpose: Historical record of order state at critical moments
 * 
 * ✅ PRODUCTION-SAFE: Feb 14, 2026
 * - Removed demo data import dependency
 * - Uses types from canonical /types instead
 */

import type {Order, OrderSnapshot} from '../../types'
import { toDate } from '../../utils/timestampFormatting';

/**
 * Get all snapshots for an order, sorted by creation time (newest first)
 * 
 * @param order - The order to get snapshots for
 * @returns Array of snapshots, sorted newest first
 */
export function getOrderSnapshots(order: Order): OrderSnapshot[] {
  return [...(order.snapshots || [])].sort((a, b) => 
    (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)
  );
}

/**
 * Get the most recent snapshot for an order
 * 
 * @param order - The order to get latest snapshot for
 * @returns Latest snapshot or undefined if none exist
 */
export function getLatestSnapshot(order: Order): OrderSnapshot | undefined {
  const snapshots = getOrderSnapshots(order);
  return snapshots[0];
}

/**
 * Compare two order states to generate a diff summary
 * Useful for showing "what changed" in notifications/logs
 * 
 * @param before - Previous order state (snapshot)
 * @param after - Current order state (snapshot)
 * @returns Human-readable change summary
 */
export function generateSnapshotDiff(before: OrderSnapshot, after: OrderSnapshot): string[] {
  const changes: string[] = [];

  // Status change
  if (before.status !== after.status) {
    changes.push(`Status: ${before.status} → ${after.status}`);
  }

  // Total change
  if (before.total !== after.total) {
    const diff = after.total - before.total;
    const sign = diff > 0 ? '+' : '';
    changes.push(`Total: $${before.total.toFixed(2)} → $${after.total.toFixed(2)} (${sign}$${diff.toFixed(2)})`);
  }

  // Payment state
  if (!before.paymentReceived && after.paymentReceived) {
    changes.push('Payment confirmed');
  }

  // Items count change
  const beforeItemCount = (before.items ?? []).reduce((sum, item) => sum + item.total, 0);
  const afterItemCount = (after.items ?? []).reduce((sum, item) => sum + item.total, 0);
  if (beforeItemCount !== afterItemCount) {
    const diff = afterItemCount - beforeItemCount;
    const sign = diff > 0 ? '+' : '';
    changes.push(`Quantity: ${beforeItemCount} → ${afterItemCount} (${sign}${diff})`);
  }

  // Adjustments change
  if (before.adjustmentsCount !== after.adjustmentsCount) {
    changes.push(`Adjustments: ${before.adjustmentsCount || 0} → ${after.adjustmentsCount || 0}`);
  }

  // Locked/finalized
  if (!before.locked && after.locked) {
    changes.push('Order locked');
  }
  
  if (!before.finalInvoiceId && after.finalInvoiceId) {
    changes.push('Final invoice generated');
  }

  return changes;
}