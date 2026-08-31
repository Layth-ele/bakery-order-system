/**
 * Analytics Aggregator Functions
 * 
 * Pure calculation functions extracted from analytics.ts
 * Each function is optimized to avoid nested loops and recalculation
 */

import { Order } from '../types';
import { toDate } from '../utils/timestampFormatting';
import {
  SalesMetrics,
  ProductSalesData,
  CustomerSalesData,
  MonthlyData,
  WeeklyData,
  CategorySalesData
} from './analyticsService'; // ✅ UPDATED: Now both files are in /services

// ============================================================================
// METRICS CALCULATION
// ============================================================================

/**
 * Calculate all metrics in a single pass through the orders
 * No nested loops - O(n) complexity
 */
export function calculateMetrics(allOrders: Order[], approvedOrders: Order[]): SalesMetrics {
  // Initialize counters
  let totalSales = 0;
  let gstCollected = 0;
  let deliveryFeesCollected = 0;
  let serviceChargesCollected = 0;
  let totalDiscountsGiven = 0;
  let ordersWithDiscounts = 0;

  // Status counters
  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let cancelledCount = 0;
  let completedCount = 0;
  let updatedCount = 0;

  // Single pass through all orders for status counts
  allOrders.forEach(order => {
    switch (order.status) {
      case 'approved':
        approvedCount++;
        break;
      case 'completed':
        completedCount++;
        break;
      case 'pending':
        pendingCount++;
        break;
      case 'rejected':
        rejectedCount++;
        break;
      case 'cancelled':
        cancelledCount++;
        break;
      case 'updated' as any:
        updatedCount++;
        break;
    }
  });

  // Single pass through approved orders for sales metrics
  approvedOrders.forEach(order => {
    totalSales += order.total || 0;
    gstCollected += order.gst || 0;
    deliveryFeesCollected += order.deliveryFee || 0;
    serviceChargesCollected += order.serviceCharge || (order as any).serviceFee || 0;
    
    const discount = order.discount || 0;
    if (discount > 0) {
      totalDiscountsGiven += discount;
      ordersWithDiscounts++;
    }
  });

  const totalOrders = approvedOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const averageDiscountPercentage = totalSales > 0 ? (totalDiscountsGiven / totalSales) * 100 : 0;

  return {
    totalSales,
    totalOrders,
    averageOrderValue,
    gstCollected,
    deliveryFeesCollected,
    serviceChargesCollected,
    approvedOrders: approvedCount,
    completedOrders: completedCount,
    pendingOrders: pendingCount,
    rejectedOrders: rejectedCount,
    cancelledOrders: cancelledCount,
    updatedOrders: updatedCount,
    totalDiscountsGiven,
    ordersWithDiscounts,
    averageDiscountPercentage,
  };
}

// ============================================================================
// TOP PRODUCTS CALCULATION
// ============================================================================

/**
 * Calculate top products using Map for O(n) complexity
 * Avoids nested loops by using hash map
 */
export function calculateTopProducts(orders: Order[], limit: number = 10): ProductSalesData[] {
  const productMap = new Map<string, ProductSalesData>();
  
  // Single pass through all orders and items
  orders.forEach(order => {
    order.items.forEach(item => {
      const existing = productMap.get(item.productId);
      
      if (existing) {
        // Update existing product
        existing.totalQuantity += (item.quantity ?? item.total);
        existing.totalRevenue += item.total;
        existing.orderCount += 1;
      } else {
        // Add new product
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          totalQuantity: (item.quantity ?? item.total),
          totalRevenue: item.total ?? 0,
          orderCount: 1,
        });
      }
    });
  });
  
  // Convert to array, sort, and limit
  return Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

// ============================================================================
// TOP CUSTOMERS CALCULATION
// ============================================================================

/**
 * Calculate top customers using Map for O(n) complexity
 */
export function calculateTopCustomers(orders: Order[], limit: number = 10): CustomerSalesData[] {
  const customerMap = new Map<string, CustomerSalesData>();
  
  // Single pass through orders
  orders.forEach(order => {
    const existing = customerMap.get(order.customerId);
    
    if (existing) {
      // Update existing customer
      existing.totalRevenue += order.total || 0;
      existing.orderCount += 1;
      existing.averageOrderValue = existing.totalRevenue / existing.orderCount;
    } else {
      // Add new customer
      customerMap.set(order.customerId, {
        customerId: order.customerId || "",
        customerName: order.customerName,
        totalRevenue: order.total || 0,
        orderCount: 1,
        averageOrderValue: order.total || 0,
      });
    }
  });
  
  // Convert to array, sort, and limit
  return Array.from(customerMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

// ============================================================================
// MONTHLY DATA CALCULATION
// ============================================================================

/**
 * Calculate monthly aggregates using Map for O(n) complexity
 */
export function calculateMonthlyData(
  orders: Order[],
  startDate: Date,
  endDate: Date
): MonthlyData[] {
  const monthMap = new Map<string, MonthlyData>();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Single pass through orders
  orders.forEach(order => {
    const orderDate = toDate(order.completedAt) || toDate(order.approvedAt) || toDate(order.createdAt) || new Date();
    const year = orderDate.getFullYear();
    const monthNumber = orderDate.getMonth();
    const monthKey = `${year}-${String(monthNumber).padStart(2, '0')}`;
    
    const existing = monthMap.get(monthKey);
    
    if (existing) {
      // Update existing month
      existing.sales += order.total || 0;
      existing.orders += 1;
      existing.averageOrder = existing.sales / existing.orders;
    } else {
      // Add new month
      monthMap.set(monthKey, {
        month: `${monthNames[monthNumber]} ${year}`,
        monthNumber,
        year,
        sales: order.total || 0,
        orders: 1,
        averageOrder: order.total || 0,
      });
    }
  });
  
  // Convert to array and sort chronologically
  return Array.from(monthMap.values())
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNumber - b.monthNumber;
    });
}

// ============================================================================
// WEEKLY DATA CALCULATION
// ============================================================================

/**
 * Calculate weekly aggregates using Map for O(n) complexity
 */
export function calculateWeeklyData(
  orders: Order[],
  startDate: Date,
  endDate: Date
): WeeklyData[] {
  const weekMap = new Map<string, WeeklyData>();
  
  // Single pass through orders
  orders.forEach(order => {
    const year = order.year || (toDate(order.createdAt) ?? new Date()).getFullYear();
    const weekNumber = order.week;
    const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    
    const existing = weekMap.get(weekKey);
    
    if (existing) {
      // Update existing week
      existing.sales += order.total || 0;
      existing.orders += 1;
    } else {
      // Add new week
      weekMap.set(weekKey, {
        weekNumber,
        year,
        weekLabel: `Week ${weekNumber}, ${year}`,
        sales: order.total || 0,
        orders: 1,
      });
    }
  });
  
  // Convert to array and sort chronologically
  return Array.from(weekMap.values())
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.weekNumber - b.weekNumber;
    });
}

// ============================================================================
// CATEGORY SALES CALCULATION
// ============================================================================

/**
 * Calculate category sales using Map for O(n) complexity
 */
export function calculateCategorySales(orders: Order[]): CategorySalesData[] {
  const categoryMap = new Map<string, { revenue: number; orderCount: number }>();
  let totalRevenue = 0;
  
  // Single pass through orders and items
  orders.forEach(order => {
    order.items.forEach(item => {
      const category = item.categoryName || 'Uncategorized';
      const existing = categoryMap.get(category);
      
      if (existing) {
        existing.revenue += item.total;
        existing.orderCount += 1;
      } else {
        categoryMap.set(category, {
          revenue: item.total ?? 0,
          orderCount: 1,
        });
      }
      
      totalRevenue += item.total;
    });
  });
  
  // Convert to array and calculate percentages
  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: data.revenue,
      orderCount: data.orderCount,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
