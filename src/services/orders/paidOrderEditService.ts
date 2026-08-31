/**
 * Paid Order Edit Service
 *
 * Business rules and operations for editing orders that have already been paid.
 * Extracted from creditService.ts to isolate concerns.
 *
 * This module handles:
 * - Validating whether a paid order can be edited
 * - Validating item quantity changes
 * - Calculating credit from order reductions
 * - Executing admin edits on paid orders
 */
import { formatCreditAmount } from '../../services/creditService';
import type { OrderEditHistory } from '../creditService';
import { getOrder, updateOrder } from "../data/ordersDataService";
import { safeParseJSON } from '../../utils/safeLocalStorage';
import type { Order, OrderItem } from "../../types";
import {createCreditNote} from "../creditService"
import { getServerTimestamp } from "../../utils/timestamps";
import { invalidateCache } from "../../hooks/useCachedFirebase";
import { isFirebaseConfigured } from '../../firebase/config';
import { createOrderEditHistory as createFirestoreOrderEditHistory } from '../../firebase/firestore/orderEditHistory';
import { createAndSaveInvoiceSnapshot } from './invoiceSnapshotService';
import { logger } from '../../utils/logger';
// FIX T2R4-H5 (HIGH): Was dynamically importing these inside the
// adminEditPaidOrder hot path on every call:
//   const { updateOrder } = await import('../../firebase/firestore');
//   const { notifyOrderEdited } = await import('../../notifications');
// Each dynamic import incurs a microtask + module-resolution cost on top
// of the work the function actually does.  Static imports up here let
// the bundler pre-resolve the modules and avoid the per-call overhead.
// Aliased to avoid name collision with the dual-mode `updateOrder` from
// ordersDataService imported above.
import { updateOrder as updateOrderFirestoreDirect } from '../../firebase/firestore';
import { notifyOrderEdited } from '../../notifications';


export type { OrderEditHistory } from "../creditService";

export function canEditPaidOrder(order: Order): { canEdit: boolean; reason?: string } {
  // ✅ Status is the single source of truth
  // Paid = in_process or completed (not using paymentReceived flag)
  const isPaid = order.status === 'in_process' || order.status === 'completed';
  
  if (!isPaid) {
    return {
      canEdit: false,
      reason: 'Order must have confirmed payment (status: in_process or completed) before admin can edit it',
    };
  }

  // ✅ Cannot edit cancelled orders
  if (order.status === 'cancelled') {
    return {
      canEdit: false,
      reason: 'Cannot edit cancelled orders',
    };
  }

  return { canEdit: true };
}

/**
 * Validate that an item edit does not exceed original quantity
 * ✅ MAR 17, 2026: Updated to allow increases up to original quantity
 * - Allows admin to correct mistakes (e.g., reduced too much by accident)
 * - Prevents increasing beyond what customer originally ordered
 */
export function validateItemEdit(
  originalItem: OrderItem,
  newQuantity: number
): { valid: boolean; error?: string } {
  // OrderItem uses `total` for the aggregate weekly quantity (no `quantity` field)
  const originalQuantity = (originalItem as any).quantity ?? originalItem.total ?? 0;

  // ✅ Allow reductions but not beyond original quantity
  if (newQuantity > originalQuantity) {
    return {
      valid: false,
      error: `Cannot increase ${originalItem.productName} beyond original quantity. (Original: ${originalQuantity}, Attempted: ${newQuantity})`,
    };
  }

  // ✅ Allow quantity to go to 0 (complete removal)
  if (newQuantity < 0) {
    return {
      valid: false,
      error: `Invalid quantity for ${originalItem.productName}. Must be 0 or greater.`,
    };
  }

  return { valid: true };
}

/**
 * Calculate credit amount from order total reduction
 * 
 * @param originalTotal - Original order total
 * @param newTotal - New order total after edit
 * @returns Credit amount (never negative)
 */
export function calculateCreditFromReduction(originalTotal: number, newTotal: number): number {
  const creditAmount = originalTotal - newTotal;
  return Math.max(0, creditAmount); // Never negative
}

/**
 * Admin edit paid order (main function)
 * 
 * @param order - The order to edit
 * @param newItems - Array of updated order items
 * @param adminEmail - Email of admin making the edit
 * @param reason - Reason for the edit
 * @returns Result object with success status and credit issued
 */
export async function adminEditPaidOrder(
  order: Order,
  newItems: OrderItem[],
  adminEmail: string,
  reason: string
): Promise<{ success: boolean; creditIssued: number; error?: string }> {
  // 1️⃣ Validate order can be edited
  const canEdit = canEditPaidOrder(order);
  if (!canEdit.canEdit) {
    console.error('❌ [adminEditPaidOrder] Cannot edit order:', canEdit.reason);
    return {
      success: false,
      creditIssued: 0,
      error: canEdit.reason,
    };
  }

  // 2️⃣ Validate all item changes (decrease only)
  const itemsChanged: OrderEditHistory['itemsChanged'] = [];
  
  for (const newItem of newItems) {
    const originalItem = order.items.find(item => item.productId === newItem.productId);
    
    if (!originalItem) {
      return {
        success: false,
        creditIssued: 0,
        error: `Product ${newItem.productName} not found in original order`,
      };
    }

    // Validate decrease-only
    const validation = validateItemEdit(originalItem, newItem.quantity ?? newItem.total);
    if (!validation.valid) {
      return {
        success: false,
        creditIssued: 0,
        error: validation.error,
      };
    }

    // Track changes
    if ((newItem.quantity ?? newItem.total) !== (originalItem.quantity ?? originalItem.total)) {
      itemsChanged.push({
        productId: newItem.productId,
        productName: newItem.productName,
        originalQuantity: originalItem.quantity ?? originalItem.total,
        newQuantity: newItem.quantity ?? newItem.total,
        quantityChange: (newItem.quantity ?? newItem.total) - (originalItem.quantity ?? originalItem.total),
        priceChange: (newItem.total * newItem.price) - (originalItem.total * originalItem.price), // ✅ FIX: Use total * price
      });
    }
  }

  // 3️⃣ Calculate new totals
  let newSubtotal = newItems.reduce((sum, item) => sum + (item.total * item.price), 0); // ✅ FIX: Use total * price
  
  // ✅ CRITICAL FIX: Apply discount from original order (if any)
  let discount = 0;
  if (order.discountPercentage) {
    // Percentage discount — recalculate against new subtotal
    discount = newSubtotal * (order.discountPercentage / 100);
  } else if (order.discount) {
    // Flat dollar discount — clamp to new subtotal so it never goes negative
    discount = Math.min(order.discount, newSubtotal);
  }
  
  // Apply discount to subtotal — never negative
  const discountedSubtotal = Math.max(0, newSubtotal - discount);
  
  // ✅ CRITICAL FIX: Detect if original order had GST in total or not
  // Some orders have GST calculated but NOT included in total (legacy bug)
  const originalSubtotal = order.subtotal || 0;
  const originalGst = order.gst || 0;
  const originalDeliveryFee = order.deliveryFee || 0;
  const originalServiceCharge = order.serviceChargeWaived ? 0 : (order.serviceCharge || 0);
  const originalDiscount = order.discount || 0;
  
  // Reconstruct what the total SHOULD be with GST
  const reconstructedTotalWithGst = originalSubtotal + originalGst + originalDeliveryFee + originalServiceCharge - originalDiscount;
  // What the total SHOULD be without GST
  const reconstructedTotalWithoutGst = originalSubtotal + originalDeliveryFee + originalServiceCharge - originalDiscount;
  
  // Check which one matches the stored total (within 1 cent tolerance)
  const gstWasIncludedInOriginalTotal = Math.abs(reconstructedTotalWithGst - order.total) < 0.01;
  const gstWasNotIncludedInOriginalTotal = Math.abs(reconstructedTotalWithoutGst - order.total) < 0.01;
  
  let newGst = 0;
  let newTotal = 0;
  
  if (gstWasNotIncludedInOriginalTotal) {
    // ✅ Original order did NOT include GST in total (legacy bug)
    // So we should NOT include it in new total either
    newGst = 0;
    newTotal = discountedSubtotal + originalDeliveryFee + originalServiceCharge;
  } else {
    // ✅ Original order DID include GST in total (correct behavior)
    // So we should include it in new total too
    const gstRate = 0.05; // 5% GST
    newGst = discountedSubtotal * gstRate;
    newTotal = discountedSubtotal + newGst + originalDeliveryFee + originalServiceCharge;
  }

  const originalTotal = order.total;
  
  
  // 4️⃣ Calculate credit amount
  const creditAmount = calculateCreditFromReduction(originalTotal, newTotal);

  if (creditAmount <= 0) {
    logger.warn('⚠️ [adminEditPaidOrder] No credit to issue - total not reduced');
    return {
      success: false,
      creditIssued: 0,
      error: 'No credit to issue. Total was not reduced.',
    };
  }

  
  // 5️⃣ Create edit history entry
 // Updated to use dual-mode Firebase pattern
  const editHistoryData: Omit<OrderEditHistory, 'id' | 'editedAt'> = {
    orderId: order.id || "",
    editedBy: adminEmail,
    reason,
    changesSummary: `Reduced ${itemsChanged.length} item(s)`,
    originalTotal,
    newTotal,
    creditIssued: creditAmount,
    itemsChanged,
  };

  // Save edit history with dual-mode pattern
  if (isFirebaseConfigured) {
    await createFirestoreOrderEditHistory(editHistoryData);
  } else {
    // FIX T2R4-H2 (HIGH): Was Math.random() for the edit history ID. Two
    // simultaneous edits in the same millisecond could collide on the
    // suffix. Switched to crypto.getRandomValues() for an unpredictable,
    // collision-resistant 9-char base36 suffix.
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    const suffix = Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
    const editHistory: OrderEditHistory = {
      id: `EDIT-${Date.now()}-${suffix}`,
      ...editHistoryData,
      editedAt: getServerTimestamp() as any,
    };
    // FIX T2R5-H5 (HIGH): Was `safeParseJSON<...>(...).push(history)`
    // — pushes to a local copy of the array but never writes it back to
    // localStorage. Demo-mode edit history was silently lost. Now reads,
    // pushes, and writes back.
    const editHistoryList = safeParseJSON<any[]>('bakery_order_edit_history', []);
    editHistoryList.push(editHistory);
    try {
      localStorage.setItem('bakery_order_edit_history', JSON.stringify(editHistoryList));
    } catch (e) {
      logger.warn('[paidOrderEditService] Failed to persist edit history:', e);
    }
  }

  // 6️⃣ Update order with dual-mode pattern
 // Updated to use dual-mode Firebase pattern
  const orderUpdates = {
    items: newItems,
    subtotal: newSubtotal,
    gst: newGst,
    total: newTotal,
    creditIssued: creditAmount,
    editedBy: adminEmail,
    editedAt: getServerTimestamp() as any,
    editReason: reason,
  };

  if (isFirebaseConfigured) {
    // FIX T2R4-H5: was `await import('../../firebase/firestore')` per call
    await updateOrderFirestoreDirect(order.id, orderUpdates);
  } else {
    const existingOrder = await getOrder(order.id);
    if (!existingOrder) {
      return {
        success: false,
        creditIssued: 0,
        error: 'Order not found',
      };
    }
    await updateOrder(order.id, orderUpdates);
  }

  // ✅ Get updated order for snapshot creation
  const updatedOrder: Order = {
    ...order,
    ...orderUpdates,
  };

 // Create invoice snapshot capturing the admin edit
 // Now awaited (createAndSaveSnapshot is now async)
  try {
    await createAndSaveInvoiceSnapshot(
      updatedOrder,
      'payment', 
      adminEmail,
      `Admin decrease edit: ${reason} - Credit issued: $${creditAmount.toFixed(2)}`
    );
  } catch (snapshotError) {
    logger.warn('⚠️ [adminEditPaidOrder] Snapshot creation failed (non-fatal):', snapshotError);
  }

  // 7️⃣ Create credit note for customer
  const creditNote = await createCreditNote(
    order.customerId,
    order.id,
    creditAmount,
    `Admin edit: ${reason}`,
    'admin_edit',
    adminEmail
  );


  // 8️⃣ Dispatch events for UI refresh
  window.dispatchEvent(new CustomEvent('orderEdited', {
    detail: {
      orderId: order.id || "",
      customerId: order.customerId || "",
      creditIssued: creditAmount,
      editedBy: adminEmail,
    },
  }));

  try {
    // FIX T2R4-H5: was `await import('../../notifications')` per call
    await notifyOrderEdited(
      order.customerId,
      order.customerName,
      order.id,
      order.weekRange || `Week ${order.week}`,
      creditAmount,
      reason,
      itemsChanged.map((change) => ({
        productName: change.productName,
        originalQuantity: change.originalQuantity,
        newQuantity: change.newQuantity,
        quantityChange: change.quantityChange,
        priceChange: change.priceChange,
      } as any))
    );
  } catch (error) {
    console.error('❌ [adminEditPaidOrder] Failed to send customer notification:', error);
    // Don't fail the entire operation if notification fails
  }


 // Invalidate TanStack Query cache for both orders and credit
  // Orders cache needs refresh because order totals changed
  // Credit cache needs refresh because a new credit note was created
  invalidateCache.orders();
  invalidateCache.credit(order.customerId);

 // Production To-Do automatic update
  // The Production To-Do page (ProductionToDoSheet.tsx) automatically reflects
  // the decreased quantities because it aggregates order.items in real-time.
  // No additional update needed - the production page will show the new quantities
  // immediately when the orders cache is invalidated above.

  return {
    success: true,
    creditIssued: creditAmount,
  };
}