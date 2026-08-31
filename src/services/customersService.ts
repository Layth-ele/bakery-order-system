/**
 * Customers Service
 * 
 * ✅ CANONICAL SERVICE: Single source of truth for customer operations
 * 
 * Centralized service for customer CRUD operations with Firestore/localStorage fallback.
 * Provides a unified interface for customer data access across the application.
 * 
 * ARCHITECTURE:
 * - Firestore-first approach with localStorage fallback
 * - Schema validation for all reads/writes
 * - Cache invalidation integration
 * - Helper functions for filtering, sorting, statistics
 * 
 * @author Bakery Order Management System
 * @date March 2026
 */

import { isFirebaseConfigured } from '../firebase/config';
import type { Customer, CustomerStats, CustomerFilters } from '../types/customer';
import { invalidateCache } from '../hooks/useCachedFirebase';

// Import Firebase Firestore operations
import { toDate } from '../utils/timestampFormatting';
import {
  getCustomers as fbGetCustomers,
  getCustomer as fbGetCustomer,
  createCustomer as fbCreateCustomer,
  updateCustomer as fbUpdateCustomer,
} from '../firebase/firestore';

// Import helper functions from utils
export {
  getCustomerTypeBadge,
  isCustomerSuspended,
  formatCustomerDate,
} from '../utils/customerHelpers';

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get all customers
 * Handles Firestore + localStorage fallback
 */
export async function getAllCustomers(): Promise<Customer[]> {
  
  try {
    if (isFirebaseConfigured) {
      const customers = await fbGetCustomers();
      return customers;
    }
  } catch (error) {
    console.error('❌ [customersService] Firestore failed, falling back to localStorage:', error);
  }
  
  // Fallback to localStorage
  try {
        const customers: Customer[] = [];
    return customers;
  } catch (error) {
    console.error('❌ [customersService] localStorage read failed:', error);
    return [];
  }
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string): Promise<Customer | null> {
  
  try {
    if (isFirebaseConfigured) {
      return await fbGetCustomer(customerId);
    }
  } catch (error) {
    console.error('❌ [customersService] Firestore failed, falling back to localStorage:', error);
  }
  
  // Fallback to localStorage
  const customers = await getAllCustomers();
  return customers.find(c => c.id === customerId) || null;
}

/**
 * Get customer by email
 * Used for authentication and user profile
 */
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  
  const customers = await getAllCustomers();
  return customers.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Get customer for authentication
 * Returns minimal customer data needed for auth.
 *
 * ✅ PASS 4 (M3): Previously this function bypassed schema validation
 * entirely and cast raw Firestore data to Customer. That meant a malformed
 * `customerType` field (e.g. "admin " with a trailing space, or any other
 * unexpected value) could grant admin access to a non-admin user — the auth
 * path had no validation precisely on the doc that decides authorization.
 *
 * Now uses authCustomerSchema, which validates the security-critical fields
 * (status, customerType, email) strictly using the canonical enums but keeps
 * everything else optional. Validation failures fall back to "no profile",
 * which forces the app to treat the user as unauthenticated and re-auth them.
 */
export async function getCustomerForAuth(uid: string): Promise<Customer | null> {
  if (isFirebaseConfigured) {
    try {
      const { db } = await import('../firebase/firestore/shared');
      const { doc, getDoc } = await import('firebase/firestore');
      const { authCustomerSchema } = await import('../schemas');
      const docRef = doc(db, 'customers', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const raw = { id: docSnap.id, ...docSnap.data() };
        // Validate the security-critical fields. Any malformed
        // status/customerType/email and we treat the doc as nonexistent
        // (forcing re-auth) rather than letting an unvalidated value through.
        const result = authCustomerSchema.safeParse(raw);
        if (!result.success) {
          console.error(
            '[getCustomerForAuth] Schema validation failed — treating as no profile',
            { uid, issues: result.error.issues },
          );
          return null;
        }
        return result.data as Customer;
      }
    } catch (e) {
      console.error('[getCustomerForAuth] raw read failed:', e);
    }
  }
  // Fallback: search by email (for demo mode)
  return getCustomerByEmail(uid);
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create new customer
 */
export async function createCustomer(customerData: Partial<Customer>): Promise<Customer> {
  
  try {
    if (isFirebaseConfigured) {
      const documentId = await fbCreateCustomer(customerData as any);
      await invalidateCache.customers();
      
      // Fetch the created customer to get the customerCode
      const createdCustomer = await getCustomerById(documentId);
      if (!createdCustomer) {
        throw new Error(`Customer created but not found with ID: ${documentId}`);
      }
      
      // FIX R7-S6-F20 (CRITICAL): Was returning `id: customerCode || documentId`
      // — overwriting the Firebase Auth UID (the documentId) with the human-readable
      // customer code.  Downstream code calling getOrdersByCustomer(customer.id)
      // queried Firestore with the customerCode, but orders are written with
      // customerId == auth.uid, so zero orders matched.  Result: every customer
      // appeared to have no orders the moment they registered, and admin-created
      // customers had their orders permanently orphaned.
      // The fix is simple: keep `id` as the documentId (Firebase Auth UID).
      // The customerCode is already preserved in createdCustomer.customerCode for
      // human-readable display (see displayCustomerCode in displayId.ts).
      return {
        ...createdCustomer,
        id: documentId,
      };
    }
  } catch (error) {
    console.error('❌ [customersService] Firestore failed, falling back to localStorage:', error);
  }
  
  // Fallback to localStorage
  const customers = await getAllCustomers();
  
  // Generate ID if not provided
  const id = customerData.id || `customer-${Date.now()}`;
  
  const newCustomer: Customer = {
    id,
    email: customerData.email || '',
    businessName: customerData.businessName || '',
    contactPerson: customerData.contactPerson || '',
    phone: customerData.phone || '',
    address: customerData.address || '',
    customerType: customerData.customerType || 'individual',
    status: customerData.status || 'pending',
    createdAt: new Date().toISOString(),
    notes: customerData.notes,
  } as Customer;
  
  customers.push(newCustomer);
  localStorage.setItem('bakery_customers', JSON.stringify(customers));
  await invalidateCache.customers();
  
  return newCustomer;
}

/**
 * Update customer
 */
export async function updateCustomer(updateData: Partial<Customer> & { id: string }): Promise<Customer> {
  
  const { id, ...data } = updateData;
  
  try {
    if (isFirebaseConfigured) {
      await fbUpdateCustomer(id, data);
      await invalidateCache.customers();
      
      // Return the updated customer
      const updated = await getCustomerById(id);
      return updated!;
    }
  } catch (error) {
    console.error('❌ [customersService] Firestore failed, falling back to localStorage:', error);
  }
  
  // Fallback to localStorage
  const customers = await getAllCustomers();
  const index = customers.findIndex(c => c.id === id);
  
  if (index === -1) {
    throw new Error(`Customer with id ${id} not found`);
  }
  
  // Update customer
  customers[index] = {
    ...customers[index],
    ...data,
  };
  
  localStorage.setItem('bakery_customers', JSON.stringify(customers));
  await invalidateCache.customers();
  
  return customers[index];
}

/**
 * Delete customer — removes from BOTH Firestore AND Firebase Authentication.
 *
 * Client-side Firebase Auth does NOT have an API to delete other users.
 * We call the `deleteCustomerAccount` Cloud Function (Admin SDK) which does:
 *   1. Verifies the caller is an admin
 *   2. Deletes the Firebase Auth account
 *   3. Deletes the Firestore customer document
 *
 * Falls back to Firestore-only deletion in demo/localStorage mode.
 */
export async function deleteCustomer(customerId: string): Promise<void> {
  
  try {
    if (isFirebaseConfigured) {
      // Call the Cloud Function — it handles Auth + Firestore atomically
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { app } = await import('../firebase/config');
      const functions = getFunctions(app);
      const deleteCustomerAccount = httpsCallable(functions, 'deleteCustomerAccount');
      await deleteCustomerAccount({ uid: customerId });
      await invalidateCache.customers();
      return;
    }
  } catch (error: any) {
    console.error('❌ [customersService] deleteCustomerAccount Cloud Function failed:', error);
    // Surface a friendly message — the raw Firebase error must not reach the UI
    const code = error?.code ?? '';
    if (code === 'functions/permission-denied') {
      throw new Error("You don't have permission to delete this customer.");
    }
    if (code === 'functions/failed-precondition') {
      throw new Error("You can't delete your own admin account.");
    }
    throw new Error('Failed to delete the customer. Please try again or contact support.');
  }
  
  // Fallback (demo / localStorage mode) — Firestore only
  const customers = await getAllCustomers();
  const index = customers.findIndex(c => c.id === customerId);
  
  if (index !== -1) {
    customers.splice(index, 1);
    localStorage.setItem('bakery_customers', JSON.stringify(customers));
    await invalidateCache.customers();
    return;
  }
  
  throw new Error(`Customer not found.`);
}

/**
 * Archive customer (soft delete)
 */
export async function archiveCustomer(customerId: string): Promise<Customer> {
  return await updateCustomer({
    id: customerId,
    status: 'archived',
  });
}

/**
 * Unarchive customer
 */
export async function unarchiveCustomer(customerId: string): Promise<Customer> {
  return await updateCustomer({
    id: customerId,
    status: 'approved',
  });
}

/**
 * Update customer status
 * Helper function to update customer status with optional note
 */
export async function updateCustomerStatus(
  customerId: string, 
  status: 'pending' | 'approved' | 'rejected' | 'suspended',
  note?: string
): Promise<Customer> {
  
  const updateData: Partial<Customer> = {
    id: customerId,
    status,
  };
  
  // Add status-specific timestamps and metadata
  if (status === 'approved') {
    updateData.approvedAt = new Date().toISOString() as any;
  }
  
  if (note) {
    updateData.notes = note;
  }
  
  return updateCustomer(updateData as any);
}

// ============================================================================
// STATISTICS & FILTERING
// ============================================================================

/**
 * Get customer statistics
 */
export async function getCustomerStats(): Promise<CustomerStats> {
  try {
    const customers = await getAllCustomers();
    
    return calculateCustomerStats(customers);
  } catch (error) {
    console.error('❌ [customersService] Failed to calculate stats:', error);
    return {
      total: 0,
      active: 0,
      commercial: 0,
      individual: 0,
      admin: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      suspended: 0,
      thisMonth: 0,
    };
  }
}

/**
 * Calculate customer statistics
 */
export function calculateCustomerStats(customers: Customer[]): CustomerStats {
  const stats: CustomerStats = {
    total: customers.length,
    active: 0,
    commercial: 0,
    individual: 0,
    admin: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    suspended: 0,
    thisMonth: 0,
  };
  
  customers.forEach(customer => {
    // Count by type (ONLY active/non-suspended customers)
    if (customer.customerType === 'commercial' && customer.status !== 'suspended') {
      stats.commercial++;
    }
    if (customer.customerType === 'individual' && customer.status !== 'suspended') {
      stats.individual++;
    }
    if (customer.customerType === 'admin' && customer.status !== 'suspended') {
      stats.admin++;
    }
    
    // Count by status
    if (customer.status === 'approved') stats.approved++;
    if (customer.status === 'pending') stats.pending++;
    if (customer.status === 'suspended' || customer.status === 'archived') stats.suspended++;
    
    // Active = not suspended
    if (customer.status !== 'suspended' && customer.status !== 'archived') stats.active++;
  });
  
  return stats;
}

/**
 * Filter customers
 */
export function filterCustomers(customers: Customer[], filters: CustomerFilters): Customer[] {
  return customers.filter(customer => {
    // Filter by type
    if (filters.customerType && filters.customerType !== 'all' && customer.customerType !== filters.customerType) {
      return false;
    }
    
    // Filter by status
    if (filters.status && filters.status !== 'all') {
      // Special case: 'active' means NOT suspended and NOT archived
      if (filters.status === 'active') {
        if (customer.status === 'suspended' || customer.status === 'archived') {
          return false;
        }
      } else if (filters.status === 'suspended') {
        // 'suspended' includes both suspended AND archived accounts
        if (customer.status !== 'suspended' && customer.status !== 'archived') {
          return false;
        }
      } else {
        // Regular status filtering (approved, pending, rejected)
        if (customer.status !== filters.status) {
          return false;
        }
      }
    }
    
    // Filter by search term
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = 
        customer.businessName?.toLowerCase().includes(searchLower) ||
        customer.storeName?.toLowerCase().includes(searchLower) ||
        customer.contactPerson?.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.phone?.includes(searchLower) ||
        ((customer as any).customerCode?.toLowerCase() || '').includes(searchLower);
      
      if (!matchesSearch) return false;
    }
    
    return true;
  });
}

/**
 * Sort customers
 */
export function sortCustomers(
  customers: Customer[],
  sortBy: 'name' | 'date' | 'status' = 'date',
  sortOrder: 'asc' | 'desc' = 'desc'
): Customer[] {
  const sorted = [...customers].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = (a.businessName || a.contactPerson || '').localeCompare(
          b.businessName || b.contactPerson || ''
        );
        break;
      case 'date':
        comparison = (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0);
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
    }
    return comparison;
  });
  return sorted;
}

/**
 * Deduplicate customers
 */
export function deduplicateCustomers(customers: Customer[]): Customer[] {
  const seen = new Set<string>();
  return customers.filter(customer => {
    if (seen.has(customer.id)) {
      return false;
    }
    seen.add(customer.id);
    return true;
  });
}

// ============================================================================
// LEGACY COMPATIBILITY (for localStorage-based code)
// ============================================================================

/**
 * Update customer in storage (legacy)
 * @deprecated Use updateCustomer instead
 */
export async function updateCustomerInStorage(customerId: string, updates: Partial<Customer>): Promise<void> {
  await updateCustomer({ id: customerId, ...updates });
}

/**
 * Delete customer from storage (legacy)
 * @deprecated Use deleteCustomer instead
 */
export async function deleteCustomerFromStorage(customerId: string): Promise<void> {
  await deleteCustomer(customerId);
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { Customer, CustomerStats, CustomerFilters };