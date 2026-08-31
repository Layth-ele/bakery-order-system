/**
 * useSalesAnalytics Hook
 * 
 * Memoized aggregator hook for analytics calculations
 * Prevents expensive recalculations on every render
 */

import { useMemo } from 'react';
import { getDateRange, AnalyticsResult } from '../services/analyticsService'; // ✅ MOVED: Now in /services
import {
  calculateMetrics,
  calculateTopProducts,
  calculateTopCustomers,
  calculateMonthlyData,
  calculateWeeklyData,
  calculateCategorySales
} from '../services/analyticsAggregators'; // ✅ MOVED: Now in /services
import { Order } from '../types';

export type TimePeriod = 'last7days' | 'last30days' | 'last3months' | 'last6months' | 'last12months' | 'custom';

interface UseSalesAnalyticsParams {
  orders: Order[];
  period: TimePeriod;
  customStart?: Date;
  customEnd?: Date;
}

/**
 * Main analytics hook with memoization
 * All expensive calculations happen inside useMemo blocks
 */
export function useSalesAnalytics({
  orders,
  period,
  customStart,
  customEnd
}: UseSalesAnalyticsParams): AnalyticsResult {
  
  // Memoize date range calculation
  const dateRange = useMemo(() => {
    return getDateRange(period, customStart, customEnd);
  }, [period, customStart, customEnd]);

  // Memoize filtered orders (all statuses)
  const allFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      try {
        if (!order) return false;
        
        // Use appropriate date based on order status
        const rawDate = order.completedAt || order.approvedAt || order.rejectedAt || order.createdAt;
        if (!rawDate) return false;
        // Handle Firestore Timestamp objects (have .toDate() or .seconds)
        let orderDate: Date;
        if (rawDate && typeof (rawDate as any).toDate === 'function') {
          orderDate = (rawDate as any).toDate();
        } else if (rawDate && typeof (rawDate as any).seconds === 'number') {
          orderDate = new Date((rawDate as any).seconds * 1000);
        } else {
          orderDate = new Date(rawDate as any);
        }
        if (isNaN(orderDate.getTime())) return false;
        
        return orderDate >= dateRange.startDate && orderDate <= dateRange.endDate;
      } catch (error) {
        console.error('Error filtering order:', error, order);
        return false;
      }
    });
  }, [orders, dateRange.startDate, dateRange.endDate]);

  // Memoize approved orders only
  const approvedOrders = useMemo(() => {
    return allFilteredOrders.filter(order => 
      order.status === 'approved' || order.status === 'completed'
    );
  }, [allFilteredOrders]);

  // Memoize metrics calculation
  const metrics = useMemo(() => {
    return calculateMetrics(allFilteredOrders, approvedOrders);
  }, [allFilteredOrders, approvedOrders]);

  // Memoize top products calculation
  const topProducts = useMemo(() => {
    return calculateTopProducts(approvedOrders);
  }, [approvedOrders]);

  // Memoize top customers calculation
  const topCustomers = useMemo(() => {
    return calculateTopCustomers(approvedOrders);
  }, [approvedOrders]);

  // Memoize monthly data calculation
  const monthlyData = useMemo(() => {
    return calculateMonthlyData(approvedOrders, dateRange.startDate, dateRange.endDate);
  }, [approvedOrders, dateRange.startDate, dateRange.endDate]);

  // Memoize weekly data calculation
  const weeklyData = useMemo(() => {
    return calculateWeeklyData(approvedOrders, dateRange.startDate, dateRange.endDate);
  }, [approvedOrders, dateRange.startDate, dateRange.endDate]);

  // Memoize category sales calculation
  const categorySales = useMemo(() => {
    return calculateCategorySales(approvedOrders);
  }, [approvedOrders]);

  // Return final analytics result (memoized)
  return useMemo(() => ({
    metrics,
    topProducts,
    topCustomers,
    monthlyData,
    weeklyData,
    categorySales,
    periodStart: dateRange.startDate.toISOString(),
    periodEnd: dateRange.endDate.toISOString()
  }), [metrics, topProducts, topCustomers, monthlyData, weeklyData, categorySales, dateRange]);
}