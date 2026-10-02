/**
 * Paid-order edit rules for the admin screen. Saving happens in the
 * editPaidOrder Cloud Function (see services/orders/orderEdits.ts); these
 * helpers only decide what the screen allows.
 */
import type { Order, OrderItem } from '../../types';

/**
 * A paid order can be reduced while it is in production. Completed orders
 * have a final invoice and are locked.
 */
export function canEditPaidOrder(order: Order): { canEdit: boolean; reason?: string } {
  if (order.status !== 'in_process' || order.paymentReceived !== true) {
    return {
      canEdit: false,
      reason:
        order.status === 'completed'
          ? 'Completed orders have a final invoice and can no longer be changed.'
          : 'Only paid orders in production can be edited here.',
    };
  }
  return { canEdit: true };
}

/** Quantities can only go down (and not below zero). */
export function validateItemEdit(
  originalItem: OrderItem,
  newQuantity: number
): { valid: boolean; error?: string } {
  const originalQuantity = (originalItem as any).quantity ?? originalItem.total ?? 0;
  if (newQuantity > originalQuantity) {
    return {
      valid: false,
      error: `Cannot increase ${originalItem.productName} beyond original quantity. (Original: ${originalQuantity}, Attempted: ${newQuantity})`,
    };
  }
  if (newQuantity < 0) {
    return { valid: false, error: `Invalid quantity for ${originalItem.productName}. Must be 0 or greater.` };
  }
  return { valid: true };
}
