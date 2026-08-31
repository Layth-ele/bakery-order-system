/**
 * Production Aggregation Service
 * 
 * Aggregates orders for production planning:
 * - Groups products by category
 * - Sums quantities by delivery day
 * - Identifies production-eligible orders
 * - Generates production to-do lists
 * 
 * Used by: ProductionToDoSheet, Production Reports
 * 
 * ✅ PRODUCTION-SAFE: Feb 14, 2026
 * - Removed demo data import dependency
 * - Uses types from canonical /types instead
 */

import type { Order, OrderItem, Product, Category } from '../../types'; // ✅ FIXED: Import from types instead of demo data
import { isProductionEligible } from '../../utils/orderSelectors';

// Day keys for mapping to OrderItem fields
export const DAY_KEYS: Array<keyof OrderItem> = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Product summary for a specific day
 */
export interface ProductSummary {
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  orderCount: number;
}

/**
 * Day information for production schedule
 */
export interface DayInfo {
  dayName: string;
  dayShort: string;
  date: Date;
  dateStr: string;
  dayIndex: number;
  status: 'done' | 'locked' | 'open';
  productCount: number;
  uniqueProducts: number;
  orderCount: number;
  workloadLevel: 'Low' | 'Medium' | 'High' | 'Very High';
}

/**
 * Customer data for a specific day
 */
export interface CustomerDayData {
  name: string;
  orderId: string;
  customerType: 'commercial' | 'individual';
  items: Array<{
    name: string;
    quantity: number;
  }>;
}

/**
 * ✅ CRITICAL FIX: Helper to convert JS day-of-week to Monday-based index
 * JS: Sun=0, Mon=1, ..., Sat=6
 * We need: Mon=0, Tue=1, ..., Sun=6 (to match order.items structure)
 */
export function getMonBasedDayIndex(date: Date): number {
  const js = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return js === 0 ? 6 : js - 1; // Convert: Mon=0, ..., Sun=6
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get total quantity for an order on a specific date
 * 
 * ✅ CRITICAL: Only aggregates from order.items (NOT productsByDay)
 * This ensures consistency with invoice totals
 * 
 * @param order - Order to check
 * @param date - Target delivery date
 * @param weekDayDateFn - Function to get week day date (from weekUtils)
 * @returns Total quantity for this order on this date
 */
export function getQtyForOrderOnDate(
  order: Order,
  date: Date,
  getWeekDayDateFn: (week: number, dayIndex: number, year: number) => Date
): number {
  if (order.week == null || order.year == null) return 0;

  const monIndex = getMonBasedDayIndex(date); // 0..6 (Mon..Sun)
  const expectedDate = getWeekDayDateFn(order.week, monIndex, order.year);
  const expectedStr = formatDate(expectedDate);
  const selectedStr = formatDate(date);

  // ✅ CRITICAL: Only count if order's week/year matches this exact date
  if (expectedStr !== selectedStr) return 0;

  const key = DAY_KEYS[monIndex];
  let total = 0;

  // ✅ CRITICAL: Always use order.items (single source of truth)
  order.items?.forEach((item) => {
    total += Number(item[key] || 0);
  });

  return total;
}

/**
 * Filter production-eligible orders for a specific date
 * 
 * ✅ Uses centralized isProductionEligible() from orderSelectors.ts
 * 
 * @param orders - All orders
 * @param date - Target delivery date
 * @param getWeekDayDateFn - Function to get week day date
 * @returns Orders that should be produced for this date
 */
export function getOrdersForDate(
  orders: Order[],
  date: Date,
  getWeekDayDateFn: (week: number, dayIndex: number, year: number) => Date
): Order[] {
  return orders.filter(order => {
    if (!isProductionEligible(order)) return false;
    return getQtyForOrderOnDate(order, date, getWeekDayDateFn) > 0;
  });
}

/**
 * Calculate product summary for a specific date
 * 
 * ✅ PHASE 1 FIX: Aggregates from order.items (NOT productsByDay)
 * 
 * @param orders - All orders
 * @param date - Target delivery date
 * @param products - All products (for lookup)
 * @param categories - All categories (for lookup)
 * @param getWeekDayDateFn - Function to get week day date
 * @returns Array of product summaries sorted by category then product name
 */
export function calculateProductSummary(
  orders: Order[],
  date: Date,
  products: Product[],
  categories: Category[],
  getWeekDayDateFn: (week: number, dayIndex: number, year: number) => Date
): ProductSummary[] {
  const dayOrders = getOrdersForDate(orders, date, getWeekDayDateFn);
  const productMap = new Map<string, ProductSummary>();
  const monIndex = getMonBasedDayIndex(date);
  const key = DAY_KEYS[monIndex];

  dayOrders.forEach(order => {
    // BUG 10 FIX (MEDIUM): The date equality check below was REDUNDANT —
    // getOrdersForDate() already guarantees every order in dayOrders matches `date`.
    // The redundant guard masked potential logic errors and made the code misleading.
    // Removed; replaced with a DEV-mode assertion that surfaces any regression immediately.
    if (import.meta.env.DEV) {
      const expectedDate = getWeekDayDateFn(order.week!, monIndex, order.year!);
      console.assert(
        formatDate(expectedDate) === formatDate(date),
        `[calculateProductSummary] BUG: order ${order.id} date mismatch — expected ${formatDate(date)}, got ${formatDate(expectedDate)}`,
      );
    }

    // ✅ CRITICAL: Always use order.items (NOT productsByDay)
    order.items?.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const category = categories.find(c => c.id === product?.categoryId);
      
      if (!product) return;

      const qty = Number(item[key] ?? 0) || 0;
      
      if (qty > 0) {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.quantity += qty;
          existing.orderCount += 1;
        } else {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            categoryId: product.categoryId,
            categoryName: category?.name || 'Unknown',
            quantity: qty,
            orderCount: 1,
          });
        }
      }
    });
  });

  const summaryArray = Array.from(productMap.values());
  
  // Sort by category name, then product name
  summaryArray.sort((a, b) => {
    if (a.categoryName !== b.categoryName) {
      return a.categoryName.localeCompare(b.categoryName);
    }
    return a.productName.localeCompare(b.productName);
  });

  return summaryArray;
}

/**
 * Calculate customer data for a specific date
 * 
 * @param orders - All orders
 * @param date - Target delivery date
 * @param getWeekDayDateFn - Function to get week day date
 * @returns Object with commercial and individual customer arrays
 */
export function calculateCustomerData(
  orders: Order[],
  date: Date,
  getWeekDayDateFn: (week: number, dayIndex: number, year: number) => Date
): { commercial: CustomerDayData[]; individual: CustomerDayData[] } {
  const dayOrders = getOrdersForDate(orders, date, getWeekDayDateFn);
  const commercial: CustomerDayData[] = [];
  const individual: CustomerDayData[] = [];
  const monIndex = getMonBasedDayIndex(date);
  const key = DAY_KEYS[monIndex];

  dayOrders.forEach(order => {
    const customerData: CustomerDayData = {
      name: order.customerName || 'Unknown',
      orderId: order.id || "",
      customerType: order.customerType === 'commercial' ? 'commercial' : 'individual',
      items: order.items
        ?.filter(item => Number(item[key] || 0) > 0)
        .map(item => ({
          name: item.productName,
          quantity: Number(item[key] || 0),
        })) || [],
    };

    if (order.customerType === 'commercial') {
      commercial.push(customerData);
    } else {
      individual.push(customerData);
    }
  });

  return { commercial, individual };
}

/**
 * Calculate customer counts for a specific date
 * 
 * @param orders - All orders
 * @param date - Target delivery date
 * @param getWeekDayDateFn - Function to get week day date
 * @returns Object with commercial and individual counts
 */
export function calculateCustomerCounts(
  orders: Order[],
  date: Date,
  getWeekDayDateFn: (week: number, dayIndex: number, year: number) => Date
): { commercial: number; individual: number } {
  const dayOrders = getOrdersForDate(orders, date, getWeekDayDateFn);
  
  const commercial = dayOrders.filter(o => o.customerType === 'commercial').length;
  const individual = dayOrders.filter(o => o.customerType !== 'commercial').length;

  return { commercial, individual };
}

/**
 * Calculate workload level based on total products
 * 
 * @param totalProducts - Total number of products to produce
 * @returns Workload level classification
 */
export function calculateWorkloadLevel(totalProducts: number): 'Low' | 'Medium' | 'High' | 'Very High' {
  if (totalProducts === 0) return 'Low';
  if (totalProducts < 50) return 'Low';
  if (totalProducts < 100) return 'Medium';
  if (totalProducts < 200) return 'High';
  return 'Very High';
}

/**
 * Calculate day info for a specific date
 * 
 * @param orders - All orders
 * @param date - Target delivery date
 * @param dayIndex - Index of day (0-6)
 * @param getDayStatusFn - Function to get day status (done/locked/open)
 * @param getWeekDayDateFn - Function to get week day date
 * @returns Day information object
 */
export function calculateDayInfo(
  orders: Order[],
  date: Date,
  dayIndex: number,
  getDayStatusFn: (date: Date) => 'done' | 'locked' | 'open',
  getWeekDayDateFn: (week: number, dayIndex: number, year: number) => Date
): Omit<DayInfo, 'dayName' | 'dayShort'> {
  const dateStr = formatDate(date);
  const status = getDayStatusFn(date);
  
  const dayOrders = getOrdersForDate(orders, date, getWeekDayDateFn);

  // Calculate products for this day
  const productMap = new Map<string, number>();
  let totalQuantity = 0;
  const monIndex = getMonBasedDayIndex(date);
  const key = DAY_KEYS[monIndex];

  dayOrders.forEach(order => {
    // BUG 10 FIX (MEDIUM): Redundant date check removed — getOrdersForDate() already
    // guarantees these orders match `date`. DEV assertion surfaces any regression.
    if (import.meta.env.DEV) {
      const expectedDate = getWeekDayDateFn(order.week!, monIndex, order.year!);
      console.assert(
        formatDate(expectedDate) === formatDate(date),
        `[calculateDayInfo] BUG: order ${order.id} date mismatch — expected ${formatDate(date)}, got ${formatDate(expectedDate)}`,
      );
    }

    order.items?.forEach(item => {
      const qty = Number(item[key] ?? 0) || 0;
      if (qty > 0) {
        productMap.set(item.productId, (productMap.get(item.productId) || 0) + qty);
        totalQuantity += qty;
      }
    });
  });

  return {
    date,
    dateStr,
    dayIndex,
    status,
    productCount: totalQuantity,
    uniqueProducts: productMap.size,
    orderCount: dayOrders.length,
    workloadLevel: calculateWorkloadLevel(totalQuantity),
  };
}

/**
 * Group products by category
 * 
 * @param products - Array of product summaries
 * @returns Object mapping category name to products
 */
export function groupProductsByCategory(
  products: ProductSummary[]
): Record<string, ProductSummary[]> {
  return products.reduce((acc, product) => {
    if (!acc[product.categoryName]) {
      acc[product.categoryName] = [];
    }
    acc[product.categoryName].push(product);
    return acc;
  }, {} as Record<string, ProductSummary[]>);
}