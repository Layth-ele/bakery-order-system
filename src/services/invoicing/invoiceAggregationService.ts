/**
 * Invoice Aggregation Service
 * 
 * Provides aggregated analytics for invoices:
 * - Monthly totals
 * - Revenue metrics
 * - Payment status breakdown
 * 
 * This service READS from the invoices collection and does NOT mutate data.
 * 
 * ✅ PRODUCTION-SAFE: Feb 14, 2026
 * - Removed demo data import dependency
 * - Uses types from canonical /types instead
 */

import type { Order } from '../../types'; // ✅ FIXED: Import from types instead of demo data
import { toDate } from '../../utils/timestampFormatting';
import { logger } from '../../utils/logger';
 // BUG 8 FIX

/**
 * BUG 8 FIX (MEDIUM): order.month is declared optional in the Zod schema.
 * When undefined (legacy orders, admin-created orders, test-path orders),
 * `String(order.month).padStart(2,'0')` produced the string "undefined" and
 * parseInt("undefined") = NaN — bucketing all such orders under "2026-Mundefined"
 * and understating revenue for every real month.
 *
 * Fix: derive month from order.year+order.month when present; fall back to
 * createdAt timestamp so no order is ever lost into a NaN bucket.
 */
function getDeliveryMonthYear(order: Order): { year: number; month: number } {
  if (order.year && order.month && !isNaN(order.month)) {
    return { year: order.year, month: order.month };
  }
  // Fallback: derive from createdAt timestamp
  const d = toDate(order.createdAt) ?? new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Monthly invoice summary for dashboard display
 */
export interface MonthlyInvoiceSummary {
  month: number;
  year: number;
  monthRange: string;
  orderCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  orders: Order[];
}

/**
 * Customer-level aggregation within a month
 */
export interface CustomerMonthlySummary {
  customerId: string;
  customerName: string;
  orderCount: number;
  totalSpent: number;
  orders: Order[];
}

/**
 * ✅ CRITICAL: Group orders by delivery month (not creation date)
 * 
 * Business Rule: Invoices are grouped by when items are DELIVERED,
 * not when the order was created.
 * 
 * @param orders - All completed orders
 * @returns Map of monthKey → orders for that delivery month
 */
export function groupOrdersByDeliveryMonth(
  orders: Order[]
): Map<string, Order[]> {
  const grouped = new Map<string, Order[]>();

  for (const order of orders) {
    // BUG 8 FIX: Use safe helper — order.month is optional; raw access produced NaN keys
    const { year, month } = getDeliveryMonthYear(order);
    const monthKey = `${year}-M${String(month).padStart(2, '0')}`;
    
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    
    grouped.get(monthKey)!.push(order);
  }

  return grouped;
}

/**
 * Calculate summary statistics for a month's orders
 * 
 * @param orders - Orders for a specific month
 * @returns Monthly summary with totals and averages
 */
export function calculateMonthlySummary(
  orders: Order[]
): Omit<MonthlyInvoiceSummary, 'month' | 'year' | 'monthRange'> {
  const totalRevenue = orders.reduce((sum, order) => {
    return sum + (order.total || 0);
  }, 0);

  const orderCount = orders.length;
  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  return {
    orderCount,
    totalRevenue,
    averageOrderValue,
    orders,
  };
}

/**
 * Get all monthly summaries from orders
 * Sorted by month descending (newest first)
 * 
 * @param orders - All completed orders
 * @returns Array of monthly summaries sorted newest first
 */
export function getMonthlySummaries(orders: Order[]): MonthlyInvoiceSummary[] {
  const grouped = groupOrdersByDeliveryMonth(orders);
  const summaries: MonthlyInvoiceSummary[] = [];

  for (const [monthKey, monthOrders] of grouped.entries()) {
    // Extract month and year from monthKey (format: "2026-M04")
    const [yearStr, monthStr] = monthKey.split('-M');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    // BUG 8 FIX: Skip malformed keys that somehow slipped through (defensive guard)
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      logger.warn(`⚠️ [getMonthlySummaries] Skipping malformed monthKey: "${monthKey}"`);
      continue;
    }

    // Get monthRange from first order (all orders in group have same month)
    const monthRange = monthOrders[0]?.monthRange || monthKey;

    const summary = calculateMonthlySummary(monthOrders);

    summaries.push({
      month,
      year,
      monthRange,
      ...summary,
    });
  }

  // Sort by year desc, then month desc (newest first)
  summaries.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return summaries;
}

/**
 * Group orders by customer within a specific month
 * 
 * @param orders - Orders for a specific month
 * @returns Map of customerId → customer summary
 */
export function groupOrdersByCustomer(
  orders: Order[]
): Map<string, CustomerMonthlySummary> {
  const grouped = new Map<string, CustomerMonthlySummary>();

  for (const order of orders) {
    const customerId = order.customerId;

    if (!grouped.has(customerId)) {
      grouped.set(customerId, {
        customerId,
        customerName: order.customerName,
        orderCount: 0,
        totalSpent: 0,
        orders: [],
      });
    }

    const summary = grouped.get(customerId)!;
    summary.orderCount++;
    summary.totalSpent += order.total || 0;
    summary.orders.push(order);
  }

  return grouped;
}

/**
 * Get top customers by revenue for a specific month
 * 
 * @param orders - Orders for a specific month
 * @param limit - Maximum number of customers to return
 * @returns Array of customer summaries sorted by total spent desc
 */
export function getTopCustomers(
  orders: Order[],
  limit: number = 10
): CustomerMonthlySummary[] {
  const grouped = groupOrdersByCustomer(orders);
  const summaries = Array.from(grouped.values());

  // Sort by total spent descending
  summaries.sort((a, b) => b.totalSpent - a.totalSpent);

  return summaries.slice(0, limit);
}

/**
 * Calculate global statistics across all orders
 * 
 * @param orders - All orders to analyze
 * @returns Global summary statistics
 */
export interface GlobalInvoiceStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  uniqueCustomers: number;
  monthsCovered: number;
}

export function calculateGlobalStats(orders: Order[]): GlobalInvoiceStats {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Count unique customers
  const uniqueCustomerIds = new Set(orders.map(o => o.customerId));
  const uniqueCustomers = uniqueCustomerIds.size;

  // Count unique months
  const uniqueMonths = new Set(orders.map(o => `${o.year}-M${o.month}`));
  const monthsCovered = uniqueMonths.size;

  return {
    totalOrders,
    totalRevenue,
    averageOrderValue,
    uniqueCustomers,
    monthsCovered,
  };
}

/**
 * Filter orders by year
 * Helper for year-based filtering in UI
 * 
 * @param orders - All orders
 * @param year - Year to filter by, or 'all'
 * @returns Filtered orders
 */
export function filterOrdersByYear(
  orders: Order[],
  year: number | 'all'
): Order[] {
  if (year === 'all') return orders;

  return orders.filter(order => {
    // ✅ Use delivery year (order.year), not creation date
    return order.year === year;
  });
}

/**
 * Filter orders by customer
 * Helper for customer-based filtering in UI
 * 
 * @param orders - All orders
 * @param customerId - Customer ID to filter by, or 'all'
 * @returns Filtered orders
 */
export function filterOrdersByCustomer(
  orders: Order[],
  customerId: string | 'all'
): Order[] {
  if (customerId === 'all') return orders;

  return orders.filter(order => order.customerId === customerId);
}

/**
 * Search orders by query string
 * Searches across: order ID, customer name, month range
 * 
 * @param orders - All orders
 * @param query - Search query
 * @returns Filtered orders
 */
export function searchOrders(orders: Order[], query: string): Order[] {
  if (!query) return orders;

  const searchLower = query.toLowerCase();

  return orders.filter(order => {
    return (
      order.id.toLowerCase().includes(searchLower) ||
      (order.orderNumber?.toLowerCase() || '').includes(searchLower) ||
      (order.invoiceNumber?.toLowerCase() || '').includes(searchLower) ||
      order.customerName?.toLowerCase().includes(searchLower) ||
      order.monthRange?.toLowerCase().includes(searchLower)
    );
  });
}

/**
 * Calculate total revenue from orders
 * ✅ Single source of truth for revenue calculation
 * Used by: MonthlyInvoices, CompleteOrders, Analytics
 */
export function calculateTotalRevenue(orders: Order[]): number {
  return orders.reduce((sum, order) => {
    const total = Number(order.total || order.finalTotal || 0);
    return sum + total;
  }, 0);
}

/**
 * Group orders by status (completed, rejected, cancelled)
 * ✅ NEW (Feb 9, 2026): For CompleteOrders statistics
 * Used by: CompleteOrders, Analytics, Reports
 */
export function groupOrdersByStatus(orders: Order[]): {
  completed: Order[];
  rejected: Order[];
  cancelled: Order[];
  other: Order[];
} {
  const completed: Order[] = [];
  const rejected: Order[] = [];
  const cancelled: Order[] = [];
  const other: Order[] = [];

  orders.forEach(order => {
    switch (order.status) {
      case 'completed':
        completed.push(order);
        break;
      case 'rejected':
        rejected.push(order);
        break;
      case 'cancelled':
        cancelled.push(order);
        break;
      default:
        other.push(order);
        break;
    }
  });

  return { completed, rejected, cancelled, other };
}