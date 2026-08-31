/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INVOICE SNAPSHOT SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Creates READ-ONLY snapshots of orders at critical lifecycle moments.
 * 
 * Purpose: Historical audit trail of order state changes
 * 
 * ✅ MAR 17, 2026: Migrated to subcollection architecture
 * ✅ MAR 17, 2026: Fixed missing imports and createInvoiceSnapshot function
 * ✅ MAR 12, 2026: Added validation to reject cancelled/rejected orders
 * ✅ FEB 7, 2026: Creates snapshots for admin edits
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Order, OrderSnapshot, SnapshotTrigger } from '../../types';
import { getOrder } from '../data/ordersDataService';
import { isFirebaseConfigured } from '../../firebase/config';
import { addOrderSnapshot } from '../../firebase/firestore/snapshots';
import { generateSnapshotId } from '../../utils/uid';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an invoice snapshot from an order
 * ✅ Pure function - creates snapshot object only (doesn't save)
 * 
 * @param order - The order to snapshot
 * @param trigger - What triggered this snapshot
 * @param createdBy - Who created this snapshot
 * @param reason - Human-readable reason (optional)
 */
export function createInvoiceSnapshot(
  order: Order,
  trigger: SnapshotTrigger = 'payment',
  createdBy: string = 'system',
  reason?: string
): Omit<OrderSnapshot, 'createdAt'> {
 // Validate order state
  if (order.status === 'cancelled' || order.status === 'rejected') {
    logger.warn(`⚠️ [InvoiceSnapshot] Cannot create snapshot for ${order.status} order ${order.id}`);
    throw new Error(`Cannot create invoice snapshot for ${order.status} order`);
  }

  return {
    id: generateSnapshotId(),
    orderId: order.id || "",
    // ✅ PASS 4 (M2): Denormalize customerId so the rule on
    // orders/{orderId}/snapshots/{snapId} can verify ownership without a
    // parent-doc get(). Reduces billed reads per snapshot read by ~33%.
    customerId: order.customerId || "",
    trigger,
    createdBy,
    reason,
    
    // Order state at snapshot time
    status: order.status,
    items: order.items,
    subtotal: order.subtotal,
    gst: order.gst,
    deliveryFee: order.deliveryFee || 0,
    serviceCharge: order.serviceCharge || 0,
    ...(order.discount !== undefined ? { discount: order.discount } : {}),
    ...(order.discountNote ? { discountNote: order.discountNote } : {}),
    total: order.total,
    
    // Payment state
    paymentReceived: order.paymentReceived ?? false,
    paymentSubmitted: order.paymentSubmitted ?? false,
    ...(order.paidAt !== undefined ? { paidAt: order.paidAt } : {}),
    
    // Adjustments state
    adjustmentsCount: order.adjustments?.length || 0,
    totalAdjustmentsDelta: order.adjustments?.reduce((sum, adj) => sum + adj.deltaTotal, 0),
    
    // Lifecycle flags
    locked: order.locked ?? false,
    ...(order.finalInvoiceId !== undefined ? { finalInvoiceId: order.finalInvoiceId } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create snapshot and save by order ID (async version that fetches order)
 * Used by notification workflows and services that work with order IDs
 * ✅ MAR 17, 2026: Migrated to subcollection
 * 
 * @param orderOrId - The order object OR order ID to snapshot
 * @param trigger - What triggered this snapshot (defaults to 'payment')
 * @param createdBy - Who created this snapshot (defaults to 'system')
 * @param reason - Human-readable reason (optional)
 */
export async function createAndSaveInvoiceSnapshot(
  orderOrId: string | Order,
  trigger?: SnapshotTrigger,
  createdBy?: string,
  reason?: string
): Promise<void> {
  try {
    // Fetch the order if ID was provided, otherwise use the order object
    let order: Order | null;
    let orderId: string;
    
    if (typeof orderOrId === 'string') {
      orderId = orderOrId;
      order = await getOrder(orderId);
    } else {
      order = orderOrId;
      orderId = orderOrId.id;
    }
    
    if (!order) {
      console.error(`⚠️ [InvoiceSnapshot] Order ${orderId} not found`);
      return;
    }

 // Skip snapshot creation for cancelled/rejected orders
    if (order.status === 'cancelled' || order.status === 'rejected') {
      logger.warn(`⚠️ [InvoiceSnapshot] Skipping snapshot for ${order.status} order ${orderId}`);
      return;
    }

 // Skip snapshot for orders not in a valid state
    // Valid states: approved+paymentSubmitted, in_process, or completed
    const isPaymentSubmitted = order.status === 'approved' && order.paymentSubmitted;
    const isPaymentConfirmed = order.status === 'in_process';
    const isCompleted = order.status === 'completed';
    if (!isPaymentSubmitted && !isPaymentConfirmed && !isCompleted) {
      return;
    }

    // Create snapshot
    const snapshot = createInvoiceSnapshot(
      order,
      trigger || 'payment',
      createdBy || 'system',
      reason
    );

    if (isFirebaseConfigured) {
      await addOrderSnapshot(orderId, snapshot);
    } else {
      const { updateOrder } = await import('../data/ordersDataService');
      const updatedSnapshots = [...(order.snapshots || []), snapshot];
      await updateOrder(orderId, { snapshots: updatedSnapshots });
    }
  } catch (error) {
    console.error(`❌ [InvoiceSnapshot] Failed to create snapshot:`, error);
    throw error;
  }
}