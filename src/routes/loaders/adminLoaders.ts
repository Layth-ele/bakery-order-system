/**
 * routes/loaders/adminLoaders.ts
 * 
 * Route loaders for admin pages that integrate with Firebase data services
 * and implement parallel loading to eliminate waterfall requests.
 * 
 * All loaders use the cache utilities to prevent duplicate network calls
 * and provide instant navigation when data is already cached.
 * 
 * Created: March 10, 2026
 * ✅ FIXED: Now calls Firebase layer directly (March 13, 2026)
 */

import { 
  createQueryLoader, 
  createParallelLoader, 
  withLoaderTiming,
  withRetry,
  invalidateRouteCache as invalidateCache, // ✅ FIX: Use correct export name
} from './utils';

// ✅ Firebase data services (direct layer)
import { getOrders } from '../../services/data/ordersDataService';
import { getAllCustomers } from '../../services/customersService';
import { getProducts } from '../../firebase/firestore/products';
import { getCategories } from '../../firebase/firestore/categories';
import { getSettings } from '../../services/data/settingsDataService';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (Wrappers for filtering orders by status)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchPendingOrders() {
  const orders = await getOrders();
  return orders.filter(order => order.status === 'pending');
}

async function fetchApprovedOrders() {
  const orders = await getOrders();
  return orders.filter(order => order.status === 'approved');
}

async function fetchCompleteOrders() {
  const orders = await getOrders();
  return orders.filter(order => order.status === 'completed');
}

async function fetchUnpaidOrders() {
  // FIX T2R2-H6 (HIGH): Was filtering by `paymentStatus === 'unpaid'` and
  // `paid !== true`. NEITHER field exists on the canonical Order schema:
  //   - `paymentStatus` is not a field — the schema uses `status` (the
  //     overall order lifecycle) and `paymentReceived` (a boolean for
  //     payment confirmation).
  //   - `paid` is not a field — `paymentReceived` is the canonical name.
  // Result: every order had `paymentStatus === undefined`, which is falsy,
  // so the first clause always failed; and `order.paid !== true` was always
  // true (since `order.paid` was always undefined). The OR ended up
  // equivalent to "every order is unpaid" — meaning the unpaid view showed
  // EVERY order, including completed and paid ones.
  //
  // Correct filter: orders that are approved (admin has accepted) but
  // payment is not yet received. This matches the `confirmOrderPayment`
  // CF's gate (`status: 'approved'` AND `!paymentReceived`).
  const orders = await getOrders();
  return orders.filter(order =>
    order.status === 'approved' && order.paymentReceived !== true
  );
}

// Alias functions for consistency
const fetchCustomers = getAllCustomers;
const fetchProducts = getProducts;
const fetchCategories = getCategories;
const fetchSettings = getSettings;

// ═══════════════════════════════════════════════════════════════════════════
// SHARED DATA LOADERS (Reusable across pages)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load all customers (used across multiple admin pages)
 * Cache for 5 minutes - customer data changes infrequently
 */
const customersLoader = createQueryLoader(
  'customers',
  fetchCustomers,
  { staleTime: 5 * 60 * 1000 } // 5 minutes
);

/**
 * Load all products (used for order details, analytics)
 * Cache for 10 minutes - product catalog is relatively static
 */
const productsLoader = createQueryLoader(
  'products',
  fetchProducts,
  { staleTime: 10 * 60 * 1000 } // 10 minutes
);

/**
 * Load all categories (rarely changes)
 * Cache for 15 minutes
 */
const categoriesLoader = createQueryLoader(
  'categories',
  fetchCategories,
  { staleTime: 15 * 60 * 1000 } // 15 minutes
);

/**
 * Load system settings (rarely changes)
 * Cache for 15 minutes
 */
const settingsLoader = createQueryLoader(
  'settings',
  fetchSettings,
  { staleTime: 15 * 60 * 1000 } // 15 minutes
);

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PAGE LOADERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pending Orders Page Loader
 * 
 * Loads:
 * - Pending orders (fresh, 1 minute cache)
 * - All customers (for filtering/display)
 * - System settings (for business rules)
 * 
 * Performance:
 * - Parallel loading (all queries simultaneously)
 * - Customers cached across pages
 * - Settings cached across pages
 */
export const pendingOrdersLoader = withLoaderTiming(
  'pending-orders',
  createParallelLoader({
    orders: createQueryLoader(
      'orders-pending',
      fetchPendingOrders,
      { staleTime: 60 * 1000 } // 1 minute (frequently changing)
    ),
    customers: customersLoader,
    settings: settingsLoader,
  })
);

/**
 * Unpaid Orders Page Loader
 * 
 * Loads:
 * - Unpaid orders (fresh, 1 minute cache)
 * - All customers (for display)
 * - System settings (for payment rules)
 */
export const unpaidOrdersLoader = withLoaderTiming(
  'unpaid-orders',
  createParallelLoader({
    orders: createQueryLoader(
      'orders-unpaid',
      fetchUnpaidOrders,
      { staleTime: 60 * 1000 } // 1 minute
    ),
    customers: customersLoader,
    settings: settingsLoader,
  })
);

/**
 * Approved Orders Page Loader
 * 
 * Loads:
 * - Approved orders (2 minute cache)
 * - Products (for order details)
 * - Customers (for display)
 */
export const approvedOrdersLoader = withLoaderTiming(
  'approved-orders',
  createParallelLoader({
    orders: createQueryLoader(
      'orders-approved',
      fetchApprovedOrders,
      { staleTime: 2 * 60 * 1000 } // 2 minutes
    ),
    products: productsLoader,
    customers: customersLoader,
  })
);

/**
 * Complete Orders (History) Page Loader
 * 
 * Loads:
 * - Complete orders (5 minute cache - historical data)
 * - Customers (for filtering)
 * - Products (for details)
 * 
 * Note: Historical data can be cached longer
 */
export const completeOrdersLoader = withLoaderTiming(
  'complete-orders',
  createParallelLoader({
    orders: createQueryLoader(
      'orders-complete',
      fetchCompleteOrders,
      { staleTime: 5 * 60 * 1000 } // 5 minutes (historical)
    ),
    customers: customersLoader,
    products: productsLoader,
  })
);

/**
 * Customers List Page Loader
 * 
 * Loads:
 * - All customers
 * - System settings (for account rules)
 */
export const customersListLoader = withLoaderTiming(
  'customers-list',
  createParallelLoader({
    customers: customersLoader,
    settings: settingsLoader,
  })
);

/**
 * Product Management Page Loader
 * 
 * Loads:
 * - All products
 * - All categories
 * - System settings
 */
export const manageProductsLoader = withLoaderTiming(
  'manage-products',
  createParallelLoader({
    products: productsLoader,
    categories: categoriesLoader,
    settings: settingsLoader,
  })
);

/**
 * System Settings Page Loader
 * 
 * Loads:
 * - Current settings
 * 
 * Note: Simple loader, no parallel loading needed
 */
export const systemSettingsLoader = withLoaderTiming(
  'system-settings',
  withRetry(
    settingsLoader,
    { maxRetries: 3 } // Critical data, retry on failure
  )
);

/**
 * Analytics Dashboard Loader
 * 
 * Loads aggregated metrics data
 * Note: Not implemented yet - placeholder
 * 
 * TODO: Implement when analytics service is ready
 */
export const analyticsLoader = withLoaderTiming(
  'analytics',
  async () => {
    // Placeholder - return empty analytics data
    return {
      salesMetrics: {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
      },
      customerMetrics: {
        totalCustomers: 0,
        activeCustomers: 0,
        newCustomers: 0,
      },
      productMetrics: {
        totalProducts: 0,
        topProducts: [] as Array<{ id: string; name: string; sales: number }>,
      },
    };
  }
);

/**
 * Registration Requests Page Loader
 * 
 * Loads:
 * - Pending registration requests
 * - System settings
 * 
 * TODO: Implement when registration service is ready
 */
export const registrationRequestsLoader = withLoaderTiming(
  'registration-requests',
  createParallelLoader({
    requests: async () => [], // Placeholder
    settings: settingsLoader,
  })
);

/**
 * Production Todo Page Loader
 * 
 * Loads:
 * - Approved orders for production
 * - Products (for order details)
 * 
 * Note: Needs fresh data for production planning
 */
export const productionTodoLoader = withLoaderTiming(
  'production-todo',
  createParallelLoader({
    orders: createQueryLoader(
      'orders-production',
      fetchApprovedOrders, // Reuse approved orders
      { staleTime: 30 * 1000 } // 30 seconds (needs fresh data)
    ),
    products: productsLoader,
  })
);

/**
 * Weekly Invoices Page Loader
 * 
 * Loads:
 * - Complete orders for invoice generation
 * - Customers
 * 
 * TODO: Create dedicated invoice fetching service
 */
export const weeklyInvoicesLoader = withLoaderTiming(
  'weekly-invoices',
  createParallelLoader({
    orders: createQueryLoader(
      'orders-complete',
      fetchCompleteOrders,
      { staleTime: 5 * 60 * 1000 } // 5 minutes
    ),
    customers: customersLoader,
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// CACHE INVALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Invalidate order-related caches
 * Call this after order mutations (approve, reject, etc.)
 */
export function invalidateOrderCaches(): void {
  invalidateCache(/orders-/); // Invalidates all order caches
}

/**
 * Invalidate customer-related caches
 * Call this after customer mutations (add, edit, delete)
 */
export function invalidateCustomerCaches(): void {
  invalidateCache('customers');
}

/**
 * Invalidate product-related caches
 * Call this after product mutations
 */
export function invalidateProductCaches(): void {
  invalidateCache('products');
  invalidateCache('categories');
}

/**
 * Invalidate settings cache
 * Call this after settings mutations
 */
export function invalidateSettingsCaches(): void {
  invalidateCache('settings');
}

// ═══════════════════════════════════════════════════════════════════════════
// PRELOADING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Preload critical admin data
 * Call this on admin login or navigation to admin area
 */
export async function preloadCriticalAdminData(): Promise<void> {
  // Preload most commonly accessed data
  await Promise.all([
    customersLoader(),
    productsLoader(),
    settingsLoader(),
  ]);
  
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  }
}

/**
 * Preload all admin data
 * Call this during idle time after admin login
 */
export async function preloadAllAdminData(): Promise<void> {
  // Preload everything for maximum performance
  await Promise.all([
    pendingOrdersLoader(),
    approvedOrdersLoader(),
    unpaidOrdersLoader(),
    customersLoader(),
    productsLoader(),
    settingsLoader(),
  ]);
  
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVELOPMENT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  // Expose loaders in dev mode for testing
  (window as any).__adminLoaders = {
    pendingOrders: pendingOrdersLoader,
    approvedOrders: approvedOrdersLoader,
    completeOrders: completeOrdersLoader,
    unpaidOrders: unpaidOrdersLoader,
    customers: customersListLoader,
    products: manageProductsLoader,
    settings: systemSettingsLoader,
    invalidateOrders: invalidateOrderCaches,
    invalidateCustomers: invalidateCustomerCaches,
    invalidateProducts: invalidateProductCaches,
    invalidateSettings: invalidateSettingsCaches,
    preloadCritical: preloadCriticalAdminData,
    preloadAll: preloadAllAdminData,
  };
  
  logger.log(
    '🔧 Admin loaders available at window.__adminLoaders\n' +
    'Try: await window.__adminLoaders.pendingOrders()'
  );
}