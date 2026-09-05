/**
 * ===================================================================
 * Order Selectors Module
 * ===================================================================
 * 
 * Centralized selector functions for querying orders across the app.
 * 
 * Purpose:
 * - Single source of truth for order filtering logic
 * - Consistent behavior across all components
 * - Easy to test and maintain
 * - Type-safe order queries
 * 
 * Usage:
 * ```typescript
 * const pendingOrders = selectPendingOrders(allOrders);
 * const customerOrders = selectCustomerOrders(allOrders, customerId);
 * ```
 */

import type { Order } from '../types';
import { toDate } from './timestampFormatting';

/**
 * ✅ ORDER STATUS HIERARCHY (Single Source of Truth):
 * 
 * pending → rejected ❌
 *        → approved → in_process → completed ✅
 *                                → cancelled ❌
 * 
 * RULES:
 * - status determines lifecycle stage
 * - paymentReceived is metadata (tracks payment confirmation)
 * - updateRequested is a flag (customer requested changes)
 */

/**
 * Select all pending orders
 * @param orders - All orders
 * @param excludeUpdateRequested - Exclude orders with updateRequested flag
 * @returns Filtered pending orders
 */
export function selectPendingOrders(
  orders: Order[],
  excludeUpdateRequested: boolean = true
): Order[] {
  return orders.filter(order => {
    // ✅ Status check ONLY (single source of truth)
    if (order.status !== 'pending') return false;
    
    // ✅ Optionally exclude update requested orders
    if (excludeUpdateRequested && order.updateRequested === true) return false;
    
    return true;
  });
}

/**
 * Select orders with update requests
 * @param orders - All orders
 * @returns Orders where customer requested changes
 */
export function selectUpdateRequestedOrders(orders: Order[]): Order[] {
  return orders.filter(order => order.updateRequested === true);
}

/**
 * Select rejected orders
 * @param orders - All orders
 * @returns Filtered rejected orders
 */
export function selectRejectedOrders(orders: Order[]): Order[] {
  return orders.filter(order => order.status === 'rejected');
}

/**
 * Groups the pending-order view into the queues the admin screen actually needs.
 * Pending clean orders are separate from active orders awaiting review updates,
 * while rejected orders remain visible in the data model but are intentionally
 * hidden from the pending-page section list.
 */
export function selectPendingOrderGroups(orders: Order[]) {
  const activeStatuses = new Set(['pending', 'approved', 'in_process']);

  return {
    pendingOrders: orders.filter(
      order => order.status === 'pending' && order.updateRequested !== true
    ),
    updateRequestedOrders: orders.filter(
      order => activeStatuses.has(order.status) && order.updateRequested === true
    ),
    rejectedOrders: selectRejectedOrders(orders),
  };
}

/**
 * Select approved orders (awaiting payment or production)
 * @param orders - All orders
 * @returns Filtered approved orders
 */
export function selectApprovedOrders(orders: Order[]): Order[] {
  return orders.filter(order => order.status === 'approved');
}

/**
 * Approved page queue: the production-ready orders shown on the approved screen
 * are the ones that have already cleared payment confirmation and are now
 * in the in_process lifecycle stage.
 */
export function selectApprovedPageOrders(orders: Order[]): Order[] {
  return orders.filter(order => order.status === 'in_process');
}

/**
 * Select approved orders that are unpaid
 * @param orders - All orders
 * @returns Approved orders without payment confirmation
 */
export function selectApprovedUnpaidOrders(orders: Order[]): Order[] {
  return orders.filter(order => {
    // ✅ Status first (single source of truth)
    if (order.status !== 'approved') return false;
    
    // ✅ Payment is secondary metadata
    return !order.paymentReceived;
  });
}

/**
 * Select in-process orders (production eligible)
 * ✅ PRODUCTION ELIGIBILITY: status === 'in_process' ONLY
 * 
 * ⚠️ CRITICAL SAFETY (Feb 9, 2026): Now uses isProductionEligible() 
 * to ensure unpaid adjustments are blocked from production
 * 
 * @param orders - All orders
 * @returns Orders in production
 */
export function selectInProcessOrders(orders: Order[]): Order[] {
  return orders.filter(order => {
    // ✅ Use centralized production eligibility check
    // This ensures ApprovedOrders + ProductionSheet use EXACT same logic
    return isProductionEligible(order);
  });
}

/**
 * Select completed orders
 * @param orders - All orders
 * @returns Filtered completed orders
 */
export function selectCompletedOrders(orders: Order[]): Order[] {
  return orders.filter(order => order.status === 'completed');
}

/**
 * Select cancelled orders
 * @param orders - All orders
 * @returns Filtered cancelled orders
 */
export function selectCancelledOrders(orders: Order[]): Order[] {
  return orders.filter(order => order.status === 'cancelled');
}

/**
 * Select historical orders (completed, rejected, cancelled)
 * Used for Order Invoices / History view
 * 
 * @param orders - All orders
 * @returns Orders that are in terminal states
 */
export function selectHistoricalOrders(orders: Order[]): Order[] {
  return orders.filter(order => {
    // FIX T2R1-F11 (HIGH): Was missing 'delivered' status. Once R10's
    // schema fix added 'delivered' as a valid terminal status, orders that
    // moved completed → delivered disappeared from the historical list
    // entirely (they're not active, but the filter didn't include them
    // either). 'delivered' is a finalized state that belongs in history.
    return (
      order.status === 'completed' ||
      order.status === 'rejected' ||
      order.status === 'cancelled' ||
      order.status === 'delivered'
    );
  });
}

/**
 * Select active customer orders (for customer dashboard)
 * ✅ RULES:
 * - Show: pending, approved, in_process
 * - Show: rejected ONLY if rejected within last 48 hours
 * - Show: cancelled ONLY if cancelled within last 48 hours
 * - Hide: completed (only in Order Invoices)
 * 
 * @param orders - All orders
 * @param customerId - Customer ID to filter by
 * @returns Active orders for customer
 */
export function selectActiveCustomerOrders(orders: Order[], customerId: string): Order[] {
  const now = new Date().getTime();
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

  return orders.filter(order => {
    // ✅ Filter by customer first
    if (order.customerId !== customerId) return false;

    // ✅ Status-based filtering
    if (order.status === 'pending') return true;
    if (order.status === 'approved') return true;
    if (order.status === 'in_process') return true;

    // ✅ Show rejected/cancelled ONLY if within last 48h
    if (order.status === 'rejected' && order.rejectedAt) {
      const rejectedTime = toDate(order.rejectedAt)?.getTime() ?? 0;
      return now - rejectedTime < FORTY_EIGHT_HOURS;
    }

    if (order.status === 'cancelled' && order.cancelledAt) {
      const cancelledTime = toDate(order.cancelledAt)?.getTime() ?? 0;
      return now - cancelledTime < FORTY_EIGHT_HOURS;
    }

    // ✅ Hide completed orders (only in Order Invoices)
    return false;
  });
}

/**
 * Select production-eligible orders for a specific date
 * ✅ CRITICAL: Only status === 'in_process' orders are production-eligible
 * 
 * @param orders - All orders
 * @param getQtyForOrderOnDate - Function to get quantity for order on date
 * @param date - Target date
 * @returns Orders that have production on the given date
 */
export function selectProductionOrdersForDate(
  orders: Order[],
  getQtyForOrderOnDate: (order: Order, date: Date) => number,
  date: Date
): Order[] {
  return orders.filter(order => {
    // ✅ Production eligibility: status === 'in_process' ONLY
    if (order.status !== 'in_process') return false;
    
    // ✅ Check if order has quantity on this date
    return getQtyForOrderOnDate(order, date) > 0;
  });
}

/**
 * Get order counts by status
 * Useful for dashboard metrics
 * 
 * @param orders - All orders
 * @returns Object with count for each status
 */
export function getOrderCountsByStatus(orders: Order[]) {
  return {
    pending: selectPendingOrders(orders, true).length,
    updateRequested: selectUpdateRequestedOrders(orders).length,
    rejected: selectRejectedOrders(orders).length,
    approved: selectApprovedOrders(orders).length,
    approvedUnpaid: selectApprovedUnpaidOrders(orders).length,
    inProcess: selectInProcessOrders(orders).length,
    completed: selectCompletedOrders(orders).length,
    cancelled: selectCancelledOrders(orders).length,
    historical: selectHistoricalOrders(orders).length,
  };
}

/**
 * Check if order is production eligible
 * ✅ SINGLE SOURCE OF TRUTH: status === 'in_process'
 * 
 * ⚠️ CRITICAL: This function is used by BOTH:
 * - ApprovedOrders.tsx (display ready queue)
 * - ProductionToDoSheet.tsx (production planning)
 * 
 * If these two diverge → bakery produces wrong quantities!
 * 
 * @param order - Order to check
 * @returns True if order is eligible for production
 */
export function isProductionEligible(order: Order): boolean {
  // ✅ SINGLE SOURCE OF TRUTH: Status is ONLY criterion
  if (order.status !== 'in_process') return false;
  
  // ✅ PRODUCTION SAFETY: If there's an unpaid adjustment increase, hide from production
  // This prevents producing extra items that customer hasn't paid for yet
  // Note: Unpaid decreases (refunds) are OK - we can still produce the reduced quantity
  if (order.adjustments && order.adjustments.length > 0) {
    const hasUnpaidIncrease = order.adjustments.some(adj => {
      // Only block on INCREASE adjustments that are unpaid
      const isIncrease = adj.subtotalChange && adj.subtotalChange > 0;
      const isUnpaid = !adj.paymentReceived;
      return isIncrease && isUnpaid;
    });
    
    if (hasUnpaidIncrease) return false;
  }
  
  return true;
}

/**
 * Check if order is editable
 * Orders are editable if:
 * - Status is pending
 * - Status is approved (before payment/production starts)
 * 
 * @param order - Order to check
 * @returns True if order can be edited
 */
export function isOrderEditable(order: Order): boolean {
  return order.status === 'pending' || order.status === 'approved';
}

/**
 * Check if order is in terminal state
 * Terminal states: completed, cancelled, rejected
 * 
 * @param order - Order to check
 * @returns True if order is in terminal state
 */
export function isOrderTerminal(order: Order): boolean {
  return (
    order.status === 'completed' ||
    order.status === 'cancelled' ||
    order.status === 'rejected'
  );
}

/**
 * Central lifecycle guard for export / action eligibility.
 * This is the shared decision point for all page-level export actions and
 * other business operations so pages cannot drift into different rules.
 */
export function canExportInvoiceDocument(order: Order): boolean {
  if (!order) return false;
  if (order.status !== 'completed') return false;
  if (order.paymentReceived !== true) return false;
  return true;
}

export function canApproveOrder(order: Order): boolean {
  if (!order) return false;
  return order.status === 'pending' && order.locked !== true;
}

export function canRejectOrder(order: Order): boolean {
  if (!order) return false;
  return order.status === 'pending' && order.locked !== true;
}

export function canConfirmPayment(order: Order): boolean {
  if (!order) return false;
  return order.status === 'approved' && order.paymentSubmitted === true && order.locked !== true;
}

export type OrderActionType = 'approve' | 'reject' | 'confirmPayment' | 'exportInvoice';

export function canPerformOrderAction(order: Order, action: OrderActionType): boolean {
  switch (action) {
    case 'approve':
      return canApproveOrder(order);
    case 'reject':
      return canRejectOrder(order);
    case 'confirmPayment':
      return canConfirmPayment(order);
    case 'exportInvoice':
      return canExportInvoiceDocument(order);
    default:
      return false;
  }
}

/**
 * Check if invoice can be downloaded for this order
 * ✅ PHASE 2 CENTRALIZATION: Invoice visibility rule
 * 
 * Business Rule: Invoice is downloadable when:
 * - Order status is 'completed' (finalized and delivered)
 * - Payment has been received (paymentReceived flag)
 * 
 * ⚠️ CRITICAL: Used across multiple components to ensure consistent invoice visibility:
 * - Customer dashboard (order history)
 * - Admin dashboard (invoice management)
 * - Notification system (invoice download links)
 * 
 * @param order - Order to check
 * @returns True if invoice can be downloaded
 */
export function canDownloadInvoice(order: Order): boolean {
  return canExportInvoiceDocument(order);
}