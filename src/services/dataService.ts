/**
 * Unified Data Service
 * 
 * This service provides a seamless interface for data operations.
 * Firebase-first data service.
 * All components should use this service instead of directly accessing storage.
 * 
 * ✅ CONSOLIDATION COMPLETE:
 * - Products: Delegated to productsDataService (~45 lines eliminated)
 * - Settings: Delegated to settingsDataService (~25 lines eliminated)
 * - Orders: Delegated to ordersDataService (~90 lines eliminated)
 * - Customers: Delegated to customersService (~287 lines eliminated)
 * - Categories: Delegated to categoriesDataService (Phase 3)
 * Total: ~447 lines of duplicate code eliminated
 * 
 * @updated 2026-03-08 - Added categories exports
 */

import { isFirebaseConfigured } from '../firebase/config';
import { 
  createUserProfile as fbCreateUserProfile,
  Product,
  Order,
  Settings,
} from '../firebase/firestore';

// ✅ CANONICAL: Delegate all customer operations to customersService
import * as customersService from './customersService';
import type { Customer } from '../types/customer';

import { invalidateCache } from '../hooks/useCachedFirebase';
import { logOrderEvent } from './orders/orderAuditService'; // ✅ Audit logging for order creation

// ✅ Data service imports
import * as productsDataService from './data/productsDataService';
import * as categoriesDataService from './data/categoriesDataService';
import * as ordersDataService from './data/ordersDataService';
import { type SystemSettings } from './data/settingsDataService';

// ============================================================================
// TYPES
// ============================================================================

export type { Customer, Product, Order, Settings };

export interface Week {
  weekNumber: number;
  startDate: string;
  endDate: string;
  deliveryDate: string;
  cutoffDate: string;
  isActive: boolean;
}

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

/**
 * Generate customer code — delegates to Firestore atomic counter.
 * Format: CUST-YYYY-MM-DD-NNN (grows: 001→999→1000→…)
 * @deprecated params kept for backward-compat but are unused
 */
const generateCustomerId = (_contactPerson?: string, _phone?: string): string => {
  // Sync shim — callers in demo/localStorage mode get a timestamp-based fallback.
  // In Firebase mode useCustomerAccountActions uses the async generateCustomerId() directly.
  const d = new Date().toISOString().slice(0, 10);
  const seq = String(Date.now()).slice(-3).padStart(3, '0');
  return `CUST-${d}-${seq}`;
};

const getFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {

    return defaultValue;
  }
};

const setToLocalStorage = <T,>(key: string, value: T): void => {
  try {
  } catch (error) {

  }
};

// ============================================================================
// CUSTOMER OPERATIONS
// ============================================================================
// ✅ STEP 1/4: Simplified getCustomers() delegation
// - Eliminates ~9 lines of duplicate logic
// ============================================================================

export const getCustomers = async (): Promise<Customer[]> => {
  // ✅ CANONICAL: Full delegation - customersService handles all fallback logic internally
  return await customersService.getAllCustomers();
};

// Get customer for authentication
export const getCustomerForAuth = async (email: string): Promise<Customer | null> => {
  // ✅ CANONICAL: Full delegation to customersService
  return await customersService.getCustomerForAuth(email);
};

// ============================================================================
// ✅ STEP 2/4: Simplified createCustomer() delegation
// - Eliminates ~23 lines of duplicate logic
// ============================================================================

export const createCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
  // ✅ CANONICAL: Full delegation - customersService handles all mode logic internally
  const input = {
    email: (customer.email ?? ""),
    password: customer.password || 'temp123', // Default password if not provided
    storeName: customer.storeName || '',
    storeAddress: customer.storeAddress || '',
    contactPerson: customer.contactPerson || '',
    phone: customer.phone || '',
    customerType: customer.customerType || 'individual',
    role: customer.role || 'customer',
    status: customer.status || 'pending',
  };
  
  const newCustomer = await customersService.createCustomer(input);
  
  // Invalidate cache after creating customer
  await invalidateCache.customers();
  
  return newCustomer;
};

// Create user profile with specific UID (for Firebase Auth registration)
//
// FIX T2R8-H4 (HIGH — schema split): `source` parameter forwarded to the
// Firestore-direct function so the appropriate Zod schema validates the
// input. Default 'self-registration' chooses the restricted schema; admin
// callers must pass 'admin-on-behalf' explicitly. See customer.schema.ts
// FIX T2R8-H4 for full rationale.
export const createUserProfile = async (
  uid: string,
  userData: Omit<Customer, 'id'>,
  source: 'self-registration' | 'admin-on-behalf' = 'self-registration'
): Promise<Customer> => {
  if (isFirebaseConfigured) {
    const newUser = await fbCreateUserProfile(uid, userData, source);
    // Invalidate cache after creating user profile
    await invalidateCache.customers();
    return newUser;
  }
  
  return createCustomer(userData);
};

// ============================================================================
// ✅ STEP 3/4: Simplified updateCustomer() delegation
// - Eliminates ~35 lines of duplicate logic
// ============================================================================

export const updateCustomer = async (id: string, data: Partial<Customer>): Promise<void> => {
  // ✅ CANONICAL: Full delegation - customersService handles all mode logic internally
  await customersService.updateCustomer({
    id,
    ...data,
  });
  
  // Invalidate cache after updating customer
  await invalidateCache.customers();
};

// ============================================================================
// ✅ STEP 4/4: Simplified deleteCustomer() delegation
// - Eliminates ~18 lines of duplicate logic
// - TOTAL CUSTOMER OPERATIONS ELIMINATION: ~63 lines of duplicate code
// ============================================================================

export const deleteCustomer = async (id: string): Promise<void> => {
  // ✅ CANONICAL: Full delegation - customersService handles all mode logic internally
  await customersService.deleteCustomer(id);
  
  // Invalidate cache after deleting customer
  await invalidateCache.customers();
};

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================
// ✅ CONSOLIDATION: Delegate all product operations to productsDataService
// - Eliminates ~45 lines of duplicate Firebase/localStorage logic
// - productsDataService auto-invalidates cache on writes
// ============================================================================

export const getProducts = productsDataService.getAllProducts;
export const createProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  // Convert to CreateProductData format
  // ✅ PASS 6: CreateProductData requires `price: number` and `unit: string`
  // (non-optional). Default both when the source product is missing them
  // — better than failing at the persistence layer.
  const productData = {
    name: (product.name ?? ""),
    categoryId: product.categoryId,
    price: product.price ?? 0,
    unit: product.unit ?? "ea",
    available: product.available ?? true,
    image: product.image,
    description: product.description,
    order: product.order,
  };
  
  // Create via canonical service
  const created = await productsDataService.createProduct(productData);
  return created;
};
export const updateProduct = async (id: string, data: Partial<Product>): Promise<void> => {
  await productsDataService.updateProduct(id, data);
};
export const deleteProduct = productsDataService.deleteProduct;

// ============================================================================
// CATEGORY OPERATIONS
// ============================================================================
// ✅ PHASE 3: Delegate all category operations to categoriesDataService
// - categoriesDataService auto-invalidates cache on writes
// ============================================================================

export { getAllCategories as getCategories } from './data/categoriesDataService';
export { getCategory } from './data/categoriesDataService';
export { createCategory } from './data/categoriesDataService';
export { updateCategory } from './data/categoriesDataService';
export { deleteCategory } from './data/categoriesDataService';

// ============================================================================
// ORDER OPERATIONS
// ============================================================================
// ✅ PHASE 2: Delegate all order operations to ordersDataService
// - Eliminates ~90 lines of duplicate code
// - ordersDataService auto-invalidates cache on writes
// ============================================================================

export const getOrders = ordersDataService.getOrders;
export const getActiveOrders = ordersDataService.getActiveOrders;
export const getOrder = ordersDataService.getOrder;
export const getOrdersByCustomer = ordersDataService.getOrdersByCustomer;

// Note: createOrder needs special handling for audit logging
//
// FIX R4-S4-F27 (CRITICAL): Was returning a synthetic `id: order-${Date.now()}`
// while addOrder() generated the real Firestore ID server-side and discarded it.
// Callers receiving the fake id used it to:
//   - link UI navigation (broken — opens "order not found")
//   - record in audit logs (orphan: writes to non-existent doc)
//   - emit notifications (notification.orderId pointed to nothing)
// Now we capture the real ID returned by addOrder() and pass it forward.
export const createOrder = async (order: Omit<Order, 'id'>): Promise<Order> => {
  // Strip any synthetic id the caller may have provided
  const orderForCreate: Omit<Order, 'id'> = {
    ...(order as any),
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.updatedAt || new Date().toISOString(),
  };

  // Add order through canonical service — returns the real Firestore-generated ID
  const realId = await ordersDataService.addOrder(orderForCreate);

  const persistedOrder: Order = {
    ...(orderForCreate as any),
    id: realId,
  };

  // ✅ AUDIT: Log order creation against the REAL document ID so the audit
  // event lands in the correct subcollection (orders/{realId}/snapshots/*).
  await logOrderEvent(
    persistedOrder,
    'create',
    persistedOrder.customerId,
    'Order submitted by customer'
  );

  return persistedOrder;
};

export const updateOrder = ordersDataService.updateOrder;
export const deleteOrder = ordersDataService.deleteOrder;

// ============================================================================
// SETTINGS OPERATIONS
// ============================================================================
// ✅ CONSOLIDATION: Delegate all settings operations to settingsDataService
// - Eliminates ~25 lines of duplicate Firebase/localStorage logic
// - settingsDataService provides type-safe SystemSettings
// ============================================================================

import * as settingsDataService from './data/settingsDataService';

export const getSettings = async (): Promise<Settings> => {
  const systemSettings = await settingsDataService.getSettings();
  // Convert SystemSettings to Settings format for backward compatibility
  return {
    deliveryFee: systemSettings.deliveryFee ?? 0,
    serviceFee: systemSettings.serviceFee ?? 3.99,
    taxRate: systemSettings.gstRate ?? 0.05,
    minimumOrder: systemSettings.minimumOrder ?? 0,
    orderCutoffDays: systemSettings.orderCutoffDays ?? 2,
    // Include additional fields if present
    businessName: systemSettings.businessName,
    businessAddress: systemSettings.businessAddress,
    businessPhone: systemSettings.businessPhone,
    businessEmail: systemSettings.businessEmail,
  } as unknown as Settings;
};

export const updateSettings = async (data: Partial<Settings>): Promise<void> => {
  // Convert Settings to SystemSettings format
  const systemSettingsData: Partial<SystemSettings> = {
    deliveryFee: (data as any).deliveryFee,
    ...(data as any).serviceFee !== undefined && { serviceFee: (data as any).serviceFee },
    gstRate: (data as any).taxRate,
    ...(data as any).minimumOrder !== undefined && { minimumOrder: (data as any).minimumOrder },
    ...(data as any).orderCutoffDays !== undefined && { orderCutoffDays: (data as any).orderCutoffDays },
    businessName: (data as any).businessName,
    businessAddress: (data as any).businessAddress,
    businessPhone: (data as any).businessPhone,
    businessEmail: (data as any).businessEmail,
  };
  
  await settingsDataService.updateSettings(systemSettingsData);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const isUsingFirebase = (): boolean => {
  return isFirebaseConfigured;
};

export const getStorageMode = (): 'firebase' => {
  return 'firebase'; // Firebase only mode
};

// ============================================================================
// UTILITY EXPORTS - PRODUCTION-SAFE
// ============================================================================
// ✅ Feb 14, 2026: Import from clean utils export instead of demo data

export {
  getWeekRange,
  getCurrentWeekNumber,
  getWeekDayDate,
  getWeekStartDate,
  getISOWeekInfo,
  getWeekInfoByNumber,
} from '../utils/weekUtilsExport';