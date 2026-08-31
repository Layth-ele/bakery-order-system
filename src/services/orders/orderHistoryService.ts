/**
 * Order History Service
 * Provides analytics and statistics for historical orders
 */

import { getNowInVancouver } from '../../utils/timezone';
import type { Order } from '../../types'; // ✅ FIXED: Import from types instead of initialData
import { getWeeksInYear } from '../../utils/weekUtilsExport'; // ✅ FIXED: Import from clean utils export
import { toDate } from '../../utils/timestampFormatting';

export interface OrderHistoryStats {
  totalOrders: number;
  totalRevenue: number;
  thisWeekRevenue: number;
  lastWeekRevenue: number;
  averageOrder: number;
  completedCount: number;
  rejectedCount: number;
  cancelledCount: number;
}

/**
 * Calculate order history statistics
 * Shows stats for completed, rejected, and cancelled orders
 */
export function calculateOrderHistoryStatistics(
  orders: Order[],
  currentWeek: number,
  currentYear: number
): OrderHistoryStats {
  // Filter historical orders (completed, rejected, cancelled)
  const historicalOrders = orders.filter(
    o => o.status === 'completed' || o.status === 'rejected' || o.status === 'cancelled'
  );

  // Total counts
  const completedCount = orders.filter(o => o.status === 'completed').length;
  const rejectedCount = orders.filter(o => o.status === 'rejected').length;
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length;

  // Calculate total revenue (only from completed orders)
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Calculate this week's revenue
  // FIX T2R8-H6: Previously read `orderDate.getFullYear()` /
  // `getWeekNumber(orderDate)` in the admin's local timezone, while
  // `currentWeek` / `currentYear` come from a Vancouver-anchored
  // `getCurrentWeekNumber()`. Now both paths anchor to Vancouver.
  const thisWeekOrders = completedOrders.filter(o => {
    const orderDateLocal = toDate(o.completedAt || o.createdAt) ?? new Date();
    const orderDateVan = toVancouverDate(orderDateLocal);
    const orderYear = orderDateVan.getUTCFullYear();
    const orderWeek = getWeekNumber(orderDateVan);
    return orderYear === currentYear && orderWeek === currentWeek;
  });
  const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Calculate last week's revenue
  const lastWeek = currentWeek - 1;
  const lastYear = lastWeek < 1 ? currentYear - 1 : currentYear;
  // ✅ FIXED: Use getWeeksInYear() instead of hardcoded 52
  const adjustedLastWeek = lastWeek < 1 ? getWeeksInYear(lastYear) : lastWeek;
  
  const lastWeekOrders = completedOrders.filter(o => {
    const orderDateLocal = toDate(o.completedAt || o.createdAt) ?? new Date();
    const orderDateVan = toVancouverDate(orderDateLocal);
    const orderYear = orderDateVan.getUTCFullYear();
    const orderWeek = getWeekNumber(orderDateVan);
    return orderYear === lastYear && orderWeek === adjustedLastWeek;
  });
  const lastWeekRevenue = lastWeekOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Calculate average order value
  const averageOrder = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

  return {
    totalOrders: historicalOrders.length,
    totalRevenue,
    thisWeekRevenue,
    lastWeekRevenue,
    averageOrder,
    completedCount,
    rejectedCount,
    cancelledCount
  };
}

/**
 * Convert a Date (any timezone) to its Vancouver-local representation.
 *
 * FIX T2R8-H6 (HIGH — analytics drift across timezones):
 * `calculateOrderHistoryStatistics` previously read `orderDate.getFullYear()`
 * and `getWeekNumber(orderDate)` using the admin's local timezone, but the
 * `currentWeek`/`currentYear` arguments come from `getCurrentWeekNumber()`
 * which uses Vancouver.  An admin viewing the dashboard from Toronto on a
 * Sunday evening could see the same order categorized into different weeks
 * by the two paths, causing "this week revenue" to drift from the totals.
 *
 * This helper converts a Date to a Vancouver-equivalent Date by formatting
 * with `toLocaleString('en-CA', { timeZone: 'America/Vancouver' })` and
 * parsing back. Imperfect across DST transitions but accurate to the day,
 * which is all this analytics use-case needs.
 */
function toVancouverDate(d: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  // Build a UTC-anchored Date from the Vancouver-local components. This way
  // getUTCFullYear / getUTCDay reflect Vancouver semantics deterministically
  // regardless of the runtime's local timezone.
  return new Date(Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) === 24 ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second),
  ));
}
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Get current week number and year in Vancouver timezone
 * ✅ FIXED: Now uses Vancouver timezone instead of device timezone
 */
export function getCurrentWeekNumber(): { week: number; year: number } {
  const now = getNowInVancouver();
  return {
    week: getWeekNumber(now),
    year: now.getFullYear()
  };
}

/**
 * Filter orders by search query (order ID or customer name)
 */
export function filterOrdersBySearch(orders: Order[], searchQuery: string): Order[] {
  if (!searchQuery.trim()) {
    return orders;
  }

  const query = searchQuery.toLowerCase();
  return orders.filter(
    o =>
      o.id.toLowerCase().includes(query) ||
      ((o as any).orderNumber?.toLowerCase() || '').includes(query) ||
      (o.invoiceNumber?.toLowerCase() || '').includes(query) ||
      o.customerName.toLowerCase().includes(query) ||
      o.customerContactPerson?.toLowerCase().includes(query) ||
      o.customerPhone?.toLowerCase().includes(query) ||
      o.customerEmail?.toLowerCase().includes(query) ||
      o.deliveryAddress?.toLowerCase().includes(query) ||
      o.notes?.toLowerCase().includes(query) ||
      o.status?.toLowerCase().includes(query)
  );
}

/**
 * Filter orders by date range
 */
export function filterOrdersByDateRange(
  orders: Order[],
  startDate: string,
  endDate: string
): Order[] {
  if (!startDate || !endDate) {
    return orders;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  return orders.filter(o => {
    const orderDate = toDate(o.completedAt || o.rejectedAt || o.cancelledAt || o.createdAt) ?? new Date();
    return orderDate >= start && orderDate <= end;
  });
}

/**
 * Filter orders by week
 *
 * FIX T2R8-H6 (HIGH): Same Vancouver-anchored fix as
 * `calculateOrderHistoryStatistics`.  Callers pass a `week` and `year`
 * derived from `getCurrentWeekNumber()` (Vancouver), so the filter must
 * compute the order's week in Vancouver too.
 */
export function filterOrdersByWeek(
  orders: Order[],
  week: number,
  year: number
): Order[] {
  return orders.filter(o => {
    const orderDateLocal = toDate(o.completedAt || o.rejectedAt || o.cancelledAt || o.createdAt) ?? new Date();
    const orderDateVan = toVancouverDate(orderDateLocal);
    const orderYear = orderDateVan.getUTCFullYear();
    const orderWeek = getWeekNumber(orderDateVan);
    return orderYear === year && orderWeek === week;
  });
}