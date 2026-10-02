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
 * Update customer
 */
export async function updateCustomer(updateData: Partial<Customer> & { id: string }): Promise<Customer> {
  // Errors propagate — a failed write must never look like a successful one.
  const { id, ...data } = updateData;
  await fbUpdateCustomer(id, data);
  await invalidateCache.customers();
  const updated = await getCustomerById(id);
  return updated!;
}

/**
 * Archive (default) or permanently delete an account — deleteCustomerAccount
 * Cloud Function only. Returns what actually happened.
 */
export async function deleteCustomer(customerId: string, hardDelete = false): Promise<'archived' | 'deleted'> {
  const { deleteCustomerAccountViaCloudFunction, callableErrorMessage } = await import('./firebase/cloudFunctions');
  try {
    const { mode } = await deleteCustomerAccountViaCloudFunction(customerId, hardDelete);
    await invalidateCache.customers();
    return mode;
  } catch (error) {
    throw new Error(callableErrorMessage(error, hardDelete ? 'delete this account' : 'archive this account'));
  }
}

// ============================================================================
// STATISTICS & FILTERING
// ============================================================================

// ── Customer Management list ──────────────────────────────────────────────
// The list shows real accounts: approved and suspended. Pending / rejected
// requests live on the Accounts page; archived (closed) accounts appear only
// under the "archived" filter. Every card's number equals the rows its
// filter shows.
const MANAGED = new Set(['approved', 'suspended']);
const isManaged = (c: Customer) => MANAGED.has(c.status as string);

/**
 * Account counts — one definition for both admin account pages.
 */
export function calculateCustomerStats(customers: Customer[]): CustomerStats {
  const now = new Date();
  const thisMonth = (v: unknown): boolean => {
    const d = (v as any)?.toDate?.() ?? (v ? new Date(v as any) : null);
    return !!d && !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const count = (pred: (c: Customer) => boolean) => customers.filter(pred).length;
  return {
    total: count(isManaged),
    active: count((c) => c.status === 'approved' && c.customerType !== 'admin'),
    approved: count((c) => c.status === 'approved'),
    pending: count((c) => c.status === 'pending'),
    rejected: count((c) => c.status === 'rejected'),
    suspended: count((c) => c.status === 'suspended'),
    archived: count((c) => c.status === 'archived'),
    commercial: count((c) => isManaged(c) && c.customerType === 'commercial'),
    individual: count((c) => isManaged(c) && c.customerType === 'individual'),
    admin: count((c) => isManaged(c) && c.customerType === 'admin'),
    thisMonth: count((c) => c.status === 'approved' && thisMonth((c as any).approvedAt)),
  };
}

/**
 * Filter the Customer Management list (see the note above).
 */
export function filterCustomers(customers: Customer[], filters: CustomerFilters): Customer[] {
  const status = filters.status ?? 'all';
  const q = (filters.searchTerm ?? '').trim().toLowerCase();
  return customers.filter((customer) => {
    if (status === 'all') {
      if (!isManaged(customer)) return false;
    } else if (status === 'active') {
      if (customer.status !== 'approved' || customer.customerType === 'admin') return false;
    } else if (customer.status !== status) {
      return false;
    }
    if (filters.customerType && filters.customerType !== 'all' && customer.customerType !== filters.customerType) {
      return false;
    }
    if (q) {
      const hay = [
        customer.businessName, customer.storeName, customer.contactPerson, customer.email,
        customer.phone, (customer as any).customerCode,
      ].map((v) => String(v ?? '').toLowerCase());
      if (!hay.some((v) => v.includes(q))) return false;
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

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { Customer, CustomerStats, CustomerFilters };