/**
 * Analytics Service - Type Definitions and Utilities
 * 
 * ✅ FEB 13, 2026: Duplication eliminated
 * - Removed 250 lines of duplicate calculation code
 * - Removed unused getAnalytics() orchestrator
 * - This file now only contains:
 *   • Type definitions (interfaces)
 *   • Date range utilities
 *   • Formatting helpers
 * 
 * For calculations, see: /services/analyticsAggregators.ts
 * For orchestration, see: /hooks/useSalesAnalytics.ts
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SalesMetrics {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  gstCollected: number;
  deliveryFeesCollected: number;
  serviceChargesCollected: number;
  approvedOrders: number;
  pendingOrders: number;
  rejectedOrders: number;
  cancelledOrders: number;
  completedOrders: number;
  updatedOrders: number;
  totalDiscountsGiven: number; // Total discount amount given
  ordersWithDiscounts: number; // Number of orders with discounts
  averageDiscountPercentage: number; // Average discount percentage
}

export interface ProductSalesData {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

export interface MonthlyData {
  month: string;
  monthNumber: number;
  year: number;
  sales: number;
  orders: number;
  averageOrder: number;
}

export interface WeeklyData {
  weekNumber: number;
  year: number;
  weekLabel: string;
  sales: number;
  orders: number;
}

export interface CategorySalesData {
  category: string;
  revenue: number;
  orderCount: number;
  percentage: number;
}

export interface CustomerSalesData {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface AnalyticsResult {
  metrics: SalesMetrics;
  topProducts: ProductSalesData[];
  topCustomers: CustomerSalesData[];
  monthlyData: MonthlyData[];
  weeklyData: WeeklyData[];
  categorySales: CategorySalesData[];
  periodStart: string;
  periodEnd: string;
}

// ============================================================================
// TIME PERIOD UTILITIES
// ============================================================================

/**
 * Calculate start and end dates for analytics period
 */
export const getDateRange = (
  period: 'last7days' | 'last30days' | 'last3months' | 'last6months' | 'last12months' | 'custom',
  customStart?: Date,
  customEnd?: Date
) => {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999); // End of today
  
  let startDate = new Date();
  
  switch (period) {
    case 'last7days':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'last30days':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'last3months':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'last6months':
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case 'last12months':
      startDate.setMonth(startDate.getMonth() - 12);
      break;
    case 'custom':
      if (customStart && customEnd) {
        startDate = new Date(customStart);
        return { startDate, endDate: new Date(customEnd) };
      }
      break;
  }
  
  startDate.setHours(0, 0, 0, 0); // Start of day
  return { startDate, endDate };
};

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format number as Canadian currency
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
};

/**
 * Format number with Canadian locale
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-CA').format(num);
};

/**
 * Format date string to readable format
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
