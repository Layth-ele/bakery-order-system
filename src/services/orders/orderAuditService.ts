/**
 * Order Audit Service
 * 
 * Provides comprehensive audit logging for all order operations.
 * Tracks:
 * - Order creation
 * - Status changes
 * - Price/quantity modifications
 * - Payment updates
 * - Admin actions
 * 
 * ✅ PRODUCTION-SAFE: Feb 14, 2026
 * - Removed demo data import dependency
 * - Uses types from canonical /types instead
 * - logOrderEvent() is now async
 *
 * FIX R8-S5-F49 (CRITICAL): Was writing audit events to the in-document
 * snapshots[] array via updateOrder().  But the schema migration on Mar 17,
 * 2026 moved snapshots to a subcollection (orders/{orderId}/snapshots) to
 * prevent the 1MB document limit.  The old code grew the order doc unbounded
 * AND was invisible to the new subcollection-aware reader.  Switched to
 * addOrderSnapshot() which writes to the subcollection consistently.
 */

import type { Order, OrderSnapshot } from '../../types';
import { logger } from '../../utils/logger';
import { addOrderSnapshot } from '../../firebase/firestore/snapshots';

/**
 * Generate unique audit event ID
 *
 * FIX T2R4-H3 (HIGH — collision-prone audit IDs): Was using
 * `Math.random().toString(36).substring(2, 10)` which is reverse-
 * engineerable in V8 and prone to collisions when many events fire in
 * the same millisecond. Audit records have compliance significance —
 * collisions could overwrite a real audit with another, leaving a gap.
 * Now uses crypto.getRandomValues() for collision-resistant suffixes.
 */
function generateAuditId(): string {
  const timestamp = new Date().getTime();
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const random = Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8);
  return `AUDIT-${timestamp}-${random}`;
}

/**
 * Log an audit event for an order
 * Lightweight event tracking for compliance and debugging
 *
 * Writes a snapshot doc to orders/{orderId}/snapshots/* (the canonical
 * subcollection path).  Returns the order unmodified — the in-document
 * snapshots[] array is no longer used for new audit events.
 * 
 * @param order - The order to log event for
 * @param trigger - What triggered this event
 * @param createdBy - Who created this event (customer ID or admin email)
 * @param reason - Human-readable reason (optional)
 * @returns The same order (unchanged); audit lives in subcollection
 */
export async function logOrderEvent(
  order: Order,
  trigger: OrderSnapshot['trigger'],
  createdBy: string,
  reason?: string
): Promise<Order> {
  // FIX S5-F49: refuse to write if order has no real ID (e.g. caller passed
  // a tempOrder with id="order-${Date.now()}").  Writing to a non-existent
  // doc creates an orphan subcollection and the audit is invisible to the
  // real order's history.
  if (!order.id || order.id.startsWith('order-')) {
    logger.warn(`⚠️ [Audit] Skipping audit log — invalid order ID: ${order.id}`);
    return order;
  }

  const auditEvent: Omit<OrderSnapshot, 'createdAt'> = {
    id: generateAuditId(),
    orderId: order.id,
    customerId: order.customerId, // Required by Pass-4 denormalized read fast-path
    createdBy,
    trigger,
    reason,
    status: order.status,
    items: [], // Empty for lightweight audit events (not full state snapshot)
    subtotal: order.subtotal,
    gst: order.gst,
    deliveryFee: order.deliveryFee,
    serviceCharge: order.serviceCharge,
    discount: order.discount,
    discountNote: order.discountNote ?? undefined,
    total: order.total,
    paymentReceived: order.paymentReceived,
    paymentSubmitted: order.paymentSubmitted,
    paidAt: order.paidAt,
    adjustmentsCount: (order.adjustments || []).length,
    totalAdjustmentsDelta: 0,
    locked: order.locked,
    finalInvoiceId: order.finalInvoiceId,
  };

  try {
    await addOrderSnapshot(order.id, auditEvent);
  } catch (error) {
    // Non-fatal: audit logging failure should not block the main operation
    logger.warn(`⚠️ [Audit] Failed to persist audit event for order ${order.id}:`, error);
  }

  return order;
}
