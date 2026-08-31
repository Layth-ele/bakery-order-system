/**
 * Order Edit Rules Service
 * 
 * Defines business rules for when orders can be edited:
 * - After approval: Limited to admin-initiated revisions
 * - After payment: Only adjustments allowed
 * - After completion: Read-only (locked)
 * 
 * This service provides a single source of truth for edit permissions.
 * 
 * ✅ PRODUCTION-SAFE: Feb 14, 2026
 * - Removed demo data import dependency
 * - Uses types from canonical /types instead
 */

import type { Order } from '../../types'; // ✅ FIXED: Import from types instead of demo data

export interface EditPermissionResult {
  allowed: boolean;
  reason?: string;
  allowedDeliveryDays?: string[];
  blockedDeliveryDays?: string[];
}

/**
 * Check edit permissions for CUSTOMERS
 * 
 * Simple rule: PENDING orders ONLY
 * Once approved, customer cannot edit (only admin can)
 * 
 * @param order - The order to check
 * @param now - Current time (for testing)
 * @returns Detailed edit permission result
 */
export function canCustomerEditOrder(
  order: Order,
  now: Date = new Date()
): EditPermissionResult {
  // ✅ CUSTOMER RULE: Can ONLY edit PENDING orders (before approval)
  if (order.status === 'pending') {
    return {
      allowed: true,
      reason: undefined,
      blockedDeliveryDays: [],
      allowedDeliveryDays: [],
    };
  }
  
  // ❌ APPROVED/IN_PROCESS → Customer CANNOT edit (locked after approval)
  if (order.status === 'approved' || order.status === 'in_process') {
    return {
      allowed: false,
      reason: 'Approved orders cannot be edited. Please contact the bakery to request changes.',
      blockedDeliveryDays: [],
      allowedDeliveryDays: [],
    };
  }
  
  // ❌ COMPLETED orders CANNOT be edited
  if (order.status === 'completed') {
    return {
      allowed: false,
      reason: 'Completed orders cannot be edited.',
      blockedDeliveryDays: [],
      allowedDeliveryDays: [],
    };
  }
  
  // ❌ REJECTED/CANCELLED orders cannot be edited
  if (order.status === 'rejected' || order.status === 'cancelled') {
    return {
      allowed: false,
      reason: `${order.status === 'rejected' ? 'Rejected' : 'Cancelled'} orders cannot be edited.`,
      blockedDeliveryDays: [],
      allowedDeliveryDays: [],
    };
  }
  
  // Default: not allowed
  return {
    allowed: false,
    reason: 'Order cannot be edited in its current state.',
    blockedDeliveryDays: [],
    allowedDeliveryDays: [],
  };
}

/**
 * Check if order has payment submitted (blocks editing for payment-pending orders)
 * 
 * @param order - The order to check
 * @returns true if payment submitted but not yet confirmed
 */
export function isPaymentPending(order: Order): boolean {
  return !!(order.paymentSubmitted && !order.paidAt);
}

/**
 * Check edit permissions for ADMIN
 * 
 * Admin Rules:
 * - Can edit PENDING, APPROVED, IN_PROCESS (no 48h restrictions)
 * - Cannot edit COMPLETED (finalized invoices)
 * - Decreased quantities are automatically credited to customer
 * 
 * @param order - The order to check
 * @returns Edit permission result
 */
export function canAdminEditOrder(order: Order): EditPermissionResult {
  // ❌ COMPLETED orders CANNOT be edited (final invoice locked)
  if (order.status === 'completed') {
    return {
      allowed: false,
      reason: 'Completed orders with final invoices cannot be edited.',
      blockedDeliveryDays: [],
      allowedDeliveryDays: [],
    };
  }
  
  // ❌ REJECTED/CANCELLED orders cannot be edited
  if (order.status === 'rejected' || order.status === 'cancelled') {
    return {
      allowed: false,
      reason: `${order.status === 'rejected' ? 'Rejected' : 'Cancelled'} orders cannot be edited.`,
      blockedDeliveryDays: [],
      allowedDeliveryDays: [],
    };
  }
  
  // ✅ Admin can edit: PENDING, APPROVED, IN_PROCESS
  // No 48h restrictions for admin
  // Decreases automatically credited to customer
  return {
    allowed: true,
    reason: undefined,
    blockedDeliveryDays: [],
    allowedDeliveryDays: [],
  };
}