/**
 * Order Display Helpers
 * 
 * Pure functions for calculating and formatting order display data
 * Extracted from OrderRow component for better testability and reusability
 * 
 * ✅ MARCH 10, 2026: Created during components architecture refactoring
 * - Extracted badge logic from OrderRow
 * - Extracted calculation helpers
 * - All functions are pure and testable
 * 
 * @author Bakery Order Management System
 */

import type { Order } from '../../types';
import { getWeekRange } from '../../utils/weekUtils';
import { toDate } from '../../utils/timestampFormatting';

/**
 * Determine if order should show a "reprint needed" badge
 * Uses both boolean flag and timestamp comparison for maximum reliability
 */
export function shouldShowReprintBadge(order: Order): boolean {
  // Fast path: Check boolean flag first (most common case - 99%)
  if (order.productionNeedsReprint === true) {
    return true;
  }
  
  // Failsafe: Check timestamps (for orders where boolean might be wrong/missing)
  const lastAdjustment = order.lastAdjustmentConfirmedAt;
  const lastPrint = order.productionLastPrintedAt;
  
  if (!lastAdjustment) return false; // No adjustments confirmed
  if (!lastPrint) return true; // Adjustment confirmed but never printed
  
  // Show badge if adjustment was confirmed AFTER last print
  const lastAdjustmentDate = toDate(lastAdjustment);
  const lastPrintDate = toDate(lastPrint);
  
  if (!lastAdjustmentDate || !lastPrintDate) return false;
  
  return lastAdjustmentDate > lastPrintDate;
}

/**
 * Compute the week range from order's week and year
 * Always computed fresh - never trust stored weekRange
 */
export function computeWeekRange(order: Order): string {
  if (order.week && order.year) {
    return getWeekRange(order.week as any, order.year as any);
  }
  return order.weekRange || 'N/A';
}

/**
 * Get the number of unique products in an order
 */
export function getProductCount(order: Order): number {
  return order.items?.length || 0;
}

/**
 * Get the total quantity of all items in an order
 */
export function getTotalQuantity(order: Order): number {
  if (!order.items || !Array.isArray(order.items)) {
    return 0;
  }
  return order.items.reduce((sum, item) => sum + (item.total || 0), 0);
}

/**
 * Check if order has any pending adjustments
 */
export function hasPendingAdjustments(order: Order): boolean {
  const adjustments = order.adjustments;
  if (!adjustments || !Array.isArray(adjustments)) return false;
  
  return adjustments.some((adj) => {
    const paidStatus = adj.paid?.status;
    return paidStatus === 'unpaid';
  });
}

/**
 * Get count of unpaid adjustments for an order
 */
export function getUnpaidAdjustmentsCount(order: Order): number {
  const adjustments = order.adjustments;
  if (!adjustments || !Array.isArray(adjustments)) return 0;
  
  return adjustments.filter((adj) => {
    const paidStatus = adj.paid?.status;
    return paidStatus === 'unpaid';
  }).length;
}

/**
 * Check if order has update requested flag
 */
export function hasUpdateRequested(order: Order): boolean {
  return order.updateRequested === true;
}

/**
 * Get customer display name from order
 * Fallback chain: customerName -> customerId
 */
export function getCustomerDisplayName(order: Order): string {
  return order.customerName || order.customerId || 'Unknown';
}

/**
 * Check if order is in a state where it can be edited
 */
export function isOrderEditable(order: Order, isAdmin: boolean): boolean {
  // Admins can edit most orders
  if (isAdmin) {
    return !['cancelled', 'rejected'].includes(order.status);
  }
  
  // Customers can only edit pending orders
  return order.status === 'pending';
}

/**
 * Check if order can be cancelled
 */
export function isOrderCancellable(order: Order, isAdmin: boolean): boolean {
  // Completed orders cannot be cancelled
  if (order.status === 'completed') return false;
  
  // Already cancelled
  if (order.status === 'cancelled') return false;
  
  // Admins can cancel most orders
  if (isAdmin) return true;
  
  // Customers can only cancel pending orders
  return order.status === 'pending';
}
