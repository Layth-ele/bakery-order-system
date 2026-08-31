/**
 * Client-Side Operations Helper
 * ✅ Pure utility functions for data transformations
 * ✅ No Firebase dependencies - only operates on data passed in
 * ✅ Used for post-processing data after retrieval
 */

import type { Order, OrderItem, Product } from '../types';
import { getServerTimestamp } from './timestamps'; // ✅ TIMESTAMP FIX

// ============================================
// ORDER VALIDATION (Client-Side)
// ============================================

/**
 * Validate order before submission
 * Eliminates need for server-side validation function
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateOrder(
  order: Partial<Order>,
  products: Product[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check required fields
  if (!order.customerId) errors.push('Customer ID is required');
  if (!order.items || order.items.length === 0) {
    errors.push('Order must contain at least one item');
  }

  // 2. Validate items
  order.items?.forEach((item, index) => {
    const product = products.find(p => p.id === item.productId);
    
    if (!product) {
      errors.push(`Item ${index + 1}: Product not found`);
      return;
    }

    // Check minimum quantity
    const totalQty = item.monday + item.tuesday + item.wednesday + 
                     item.thursday + item.friday + item.saturday + item.sunday;
    
    if (totalQty < (product.minQty ?? 1)) {
      errors.push(
        `${product.name}: Minimum order ${(product.minQty ?? 1)} units (you have ${totalQty})`
      );
    }

    // Check daily minimum for each day
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      const qty = item[day as keyof OrderItem] as number;
      if (qty > 0 && qty < (product.dailyMinOrder ?? 0)) {
        warnings.push(
          `${product.name} on ${day}: Below daily minimum of ${(product.dailyMinOrder ?? 0)}`
        );
      }
    });

    // Validate price
    if (item.price <= 0) {
      errors.push(`${product.name}: Invalid price`);
    }
  });

  // 3. Validate totals
  if (order.subtotal && order.subtotal <= 0) {
    errors.push('Subtotal must be greater than 0');
  }

  if (order.total && order.total <= 0) {
    errors.push('Total must be greater than 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// PRICE CALCULATIONS (Client-Side)
// ============================================

/**
 * Calculate order totals client-side
 * No server call needed!
 */
export interface OrderTotals {
  subtotal: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  discount: number;
  total: number;
}

export function calculateOrderTotals(
  items: OrderItem[],
  options: {
    customerType: 'individual' | 'commercial';
    freeDeliveryMin?: number;
    serviceChargeEnabled?: boolean;
    serviceChargeAmount?: number;
    deliveryFeeAmount?: number;
    discountPercent?: number;
    discountFlat?: number;
  }
): OrderTotals {
  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.total), 0);

  // Calculate discount
  let discount = 0;
  if (options.discountPercent) {
    discount = subtotal * (options.discountPercent / 100);
  }
  if (options.discountFlat) {
    discount += options.discountFlat;
  }

  // ✅ FIX: GST on (subtotal - discount), not raw subtotal
  const discountedBase = Math.max(0, subtotal - discount);
  const gst = Math.round((discountedBase * 0.05 + Number.EPSILON) * 100) / 100;

  // Calculate delivery fee
  const freeDeliveryMin = options.freeDeliveryMin || 250;
  const deliveryFee = subtotal >= freeDeliveryMin ? 0 : (options.deliveryFeeAmount || 0);

  // Calculate service charge
  const serviceChargeEnabled = options.serviceChargeEnabled ?? true;
  const serviceCharge = serviceChargeEnabled ? (options.serviceChargeAmount || 3.99) : 0;

  // Calculate total
  const total = Math.max(0, discountedBase + gst + deliveryFee + serviceCharge);

  return {
    subtotal,
    gst,
    deliveryFee,
    serviceCharge,
    discount,
    total,
  };
}

// ============================================
// DATA DENORMALIZATION (Client-Side)
// ============================================

/**
 * Denormalize order data for faster queries
 * Eliminates need for complex server-side joins
 */
export interface DenormalizedOrder extends Order {
  // Customer info (denormalized)
  customerEmail?: string;
  customerPhone?: string;
  customerType?: 'individual' | 'commercial';
  
  // Product info (denormalized)
  itemsWithDetails?: Array<OrderItem & {
    productCost: number;
    productCategory: string;
    productImage?: string;
  }>;
  
  // Calculated fields (cached)
  totalItems?: number;
  totalQuantity?: number;
  averageItemPrice?: number;
  
  // Search optimization
  searchableText?: string; // Combined text for searching
}

/**
 * Denormalize an order with customer and product data
 */
export function denormalizeOrder(
  order: Order,
  customer: any,
  products: Product[],
  categories: any[]
): DenormalizedOrder {
  const denormalized = { ...order } as DenormalizedOrder;

  // Add customer info
  denormalized.customerEmail = customer.email;
  denormalized.customerPhone = customer.phone;
  denormalized.customerType = (customer.customerType === 'commercial' ? 'commercial' : 'individual') as 'commercial' | 'individual';

  // Add product details to items
  denormalized.itemsWithDetails = order.items.map(item => {
    const product = products.find(p => p.id === item.productId);
    const category = categories.find(c => c.id === product?.categoryId);

    return {
      ...item,
      productCost: product?.cost || 0,
      productCategory: category?.name || 'Unknown',
      productImage: product?.image,
    };
  });

  // Calculate aggregate fields
  denormalized.totalItems = order.items.length;
  denormalized.totalQuantity = order.items.reduce((sum, item) => sum + item.total, 0);
  denormalized.averageItemPrice = order.subtotal / denormalized.totalQuantity;

  // Create searchable text
  denormalized.searchableText = [
    order.id,
    order.orderNumber || '',
    order.invoiceNumber || '',
    order.customerName,
    order.customerAddress,
    order.customerContactPerson,
    order.status,
    ...order.items.map(i => i.productName),
  ].join(' ').toLowerCase();

  return denormalized;
}

// ============================================
// BULK OPERATIONS (Client-Side Batch)
// ============================================

/**
 * Process multiple orders client-side
 * Eliminates need for server-side batch processing
 */
export function bulkUpdateOrderStatus(
  orders: Order[],
  orderIds: string[],
  newStatus: Order['status']
): Order[] {
  return orders.map(order => {
    if (orderIds.includes(order.id)) {
      return {
        ...order,
        status: newStatus,
        updatedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
      };
    }
    return order;
  });
}

/**
 * Calculate analytics client-side
 * No server aggregation needed!
 */
export interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  topProducts: Array<{ productId: string; productName: string; quantity: number; revenue: number }>;
  customerStats: Record<string, { orderCount: number; totalSpent: number }>;
}

export function calculateAnalytics(orders: Order[]): OrderAnalytics {
  const analytics: OrderAnalytics = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
    averageOrderValue: 0,
    ordersByStatus: {},
    topProducts: [],
    customerStats: {},
  };

  // Average order value
  analytics.averageOrderValue = analytics.totalRevenue / analytics.totalOrders || 0;

  // Orders by status
  orders.forEach(order => {
    analytics.ordersByStatus[order.status] = (analytics.ordersByStatus[order.status] || 0) + 1;
  });

  // Top products
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  
  orders.forEach(order => {
    order.items.forEach(item => {
      const existing = productMap.get(item.productId) || { 
        name: item.productName, 
        quantity: 0, 
        revenue: 0 
      };
      
      existing.quantity += item.total;
      existing.revenue += item.price * item.total;
      
      productMap.set(item.productId, existing);
    });
  });

  analytics.topProducts = Array.from(productMap.entries())
    .map(([productId, data]) => ({ productId, productName: (data.name ?? ""), ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Customer stats
  orders.forEach(order => {
    const existing = analytics.customerStats[order.customerId] || { orderCount: 0, totalSpent: 0 };
    existing.orderCount++;
    existing.totalSpent += order.total;
    analytics.customerStats[order.customerId] = existing;
  });

  return analytics;
}

// ============================================
// SEARCH & FILTER (Client-Side)
// ============================================

/**
 * Search orders client-side
 * No server-side search function needed!
 */
export function searchOrders(
  orders: DenormalizedOrder[],
  searchTerm: string
): DenormalizedOrder[] {
  if (!searchTerm.trim()) return orders;

  const term = searchTerm.toLowerCase();

  return orders.filter(order => 
    order.searchableText?.includes(term) ||
    order.id.toLowerCase().includes(term) ||
    (order.orderNumber?.toLowerCase() || '').includes(term) ||
    (order.invoiceNumber?.toLowerCase() || '').includes(term) ||
    order.customerName.toLowerCase().includes(term)
  );
}

/**
 * Filter orders by multiple criteria
 */
export interface OrderFilters {
  status?: Order['status'][];
  customerId?: string;
  minTotal?: number;
  maxTotal?: number;
  dateFrom?: string;
  dateTo?: string;
  week?: number;
  productIds?: string[];
}

export function filterOrders(
  orders: Order[],
  filters: OrderFilters
): Order[] {
  return orders.filter(order => {
    // Status filter
    if (filters.status && !filters.status.includes(order.status)) {
      return false;
    }

    // Customer filter
    if (filters.customerId && order.customerId !== filters.customerId) {
      return false;
    }

    // Total range filter
    if (filters.minTotal !== undefined && order.total < filters.minTotal) {
      return false;
    }
    if (filters.maxTotal !== undefined && order.total > filters.maxTotal) {
      return false;
    }

    // Date range filter
    if (filters.dateFrom && order.createdAt < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && order.createdAt > filters.dateTo) {
      return false;
    }

    // Week filter
    if (filters.week !== undefined && order.week !== filters.week) {
      return false;
    }

    // Product filter
    if (filters.productIds && filters.productIds.length > 0) {
      const hasProduct = order.items.some(item => 
        filters.productIds!.includes(item.productId)
      );
      if (!hasProduct) return false;
    }

    return true;
  });
}

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * EXAMPLE 1: Validate order before submission
 * 
 * ```typescript
 * const handleSubmitOrder = () => {
 *   const validation = validateOrder(newOrder, products);
 *   
 *   if (!validation.isValid) {
 *     alert(validation.errors.join('\n'));
 *     return;
 *   }
 *   
 *   if (validation.warnings.length > 0) {
 *     const proceed = confirm(
 *       'Warnings:\n' + validation.warnings.join('\n') + '\n\nContinue?'
 *     );
 *     if (!proceed) return;
 *   }
 *   
 *   // Submit order...
 * };
 * ```
 * 
 * EXAMPLE 2: Calculate totals client-side
 * 
 * ```typescript
 * const totals = calculateOrderTotals(cartItems, {
 *   customerType: user.customerType,
 *   freeDeliveryMin: 250,
 *   serviceChargeEnabled: true,
 *   serviceChargeAmount: 3.99,
 * });
 * 
 * console.log(`Total: $${totals.total.toFixed(2)}`);
 * ```
 * 
 * EXAMPLE 3: Generate analytics dashboard
 * 
 * ```typescript
 * const analytics = calculateAnalytics(allOrders);
 * 
 * console.log(`Total Revenue: $${analytics.totalRevenue}`);
 * console.log(`Average Order: $${analytics.averageOrderValue.toFixed(2)}`);
 * console.log(`Top Product: ${analytics.topProducts[0]?.productName}`);
 * ```
 * 
 * EXAMPLE 4: Search and filter
 * 
 * ```typescript
 * // Denormalize orders first (one time)
 * const denormalized = orders.map(order => 
 *   denormalizeOrder(order, customers, products, categories)
 * );
 * 
 * // Search
 * const searchResults = searchOrders(denormalized, 'john');
 * 
 * // Filter
 * const filtered = filterOrders(orders, {
 *   status: ['approved', 'pending'],
 *   minTotal: 100,
 *   week: 15,
 * });
 * ```
 * 
 * COST COMPARISON:
 * 
 * Scenario: 25,000 orders/month
 * 
 * WITH CLOUD FUNCTIONS:
 *   - Validation: 25,000 invocations × $0.40/1M = $0.01
 *   - Calculations: 25,000 invocations × $0.40/1M = $0.01
 *   - Analytics: 1,000 invocations × $0.40/1M = $0.0004
 *   - Search: 50,000 invocations × $0.40/1M = $0.02
 *   - Compute time: 100,000 × 100ms × $0.25/GB-sec = $0.25
 *   TOTAL: ~$0.29/month
 * 
 * WITH CLIENT-SIDE:
 *   - All operations: FREE ✅
 *   TOTAL: $0.00/month
 * 
 * SAVINGS: $0.29/month
 * 
 * BONUS BENEFITS:
 * - Instant calculations (no network latency)
 * - Works offline
 * - Scales infinitely (browser does the work)
 * - No server maintenance
 */

export default {
  validateOrder,
  calculateOrderTotals,
  denormalizeOrder,
  bulkUpdateOrderStatus,
  calculateAnalytics,
  searchOrders,
  filterOrders,
};