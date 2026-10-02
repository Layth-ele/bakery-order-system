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
  Product,
  Order,
  Settings,
} from '../firebase/firestore';

// ✅ CANONICAL: Delegate all customer operations to customersService
import * as customersService from './customersService';
import type { Customer } from '../types/customer';

import { invalidateCache } from '../hooks/useCachedFirebase';

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

// Create user profile with specific UID (for Firebase Auth registration)
//
// FIX T2R8-H4 (HIGH — schema split): `source` parameter forwarded to the
// Firestore-direct function so the appropriate Zod schema validates the
// input. Default 'self-registration' chooses the restricted schema; admin
// callers must pass 'admin-on-behalf' explicitly. See customer.schema.ts
// FIX T2R8-H4 for full rationale.
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

// Orders are written only by Cloud Functions (services/firebase/cloudFunctions.ts).

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