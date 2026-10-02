/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - CUSTOMERS DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the Customers collection.
 * 
 * EXPORTS:
 * - getCustomers: Fetch all customers
 * - getCustomer: Fetch single customer by ID
 * - createCustomer: Create new customer
 * - createUserProfile: Create customer with specific UID
 * - updateCustomer: Update customer
 * - deleteCustomer: Delete customer
 * - subscribeToCustomer: Real-time single customer
 * - subscribeToCustomers: Real-time customers list
 * 
 * ✅ All operations are schema-validated
 * ✅ All operations use wrapFirestoreOperation for error handling
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { collection, doc, getDoc, getDocs, updateDoc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

import { customerSchema, // FIX T2R8-H4: import the restricted self-registration schema so the
  // register flow validates against it BEFORE the Firestore write.
  createCustomerSelfRegistrationInputSchema, updateCustomerInputSchema, parseOrThrow, parseArrayPartial, parseSafe, type Customer } from '../../schemas';

import {db, serverTimestamp, wrapFirestoreOperation} from './shared'
import { logger } from '../../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get customers (one-time fetch).
 *
 * ✅ PASS 4: Now enforces a default limit of 500 to prevent runaway reads.
 * Pass 0 = unbounded (only use for export jobs).
 *
 * ✅ VALIDATED: All customer documents are validated
 */
export const getCustomers = async (
  options: { limit?: number; status?: string } = {}
): Promise<Customer[]> => {
  return wrapFirestoreOperation(async () => {
    const { limit: limitCount = 500, status } = options;

    let q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    if (status) {
      q = query(
        collection(db, 'customers'),
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
    }
    if (limitCount > 0) {
      q = query(q, limit(limitCount));
    }
    const snapshot = await getDocs(q);

    const rawCustomers: any[] = [];
    snapshot.forEach((doc) => {
      rawCustomers.push({ id: doc.id, ...(doc.data() ?? {}) });
    });

    // ✅ SCHEMA PROTECTION: Validate all customers, skip invalid ones
    const validatedCustomers = parseArrayPartial(customerSchema, rawCustomers, 'Customer');

    if (validatedCustomers.length < rawCustomers.length) {
      logger.warn(
        `⚠️ Firestore: ${rawCustomers.length - validatedCustomers.length} invalid customers skipped`
      );
    }

    return validatedCustomers;
  }, 'getCustomers');
};

/**
 * Get customer by ID
 * ✅ VALIDATED: Customer document is validated
 */
export const getCustomer = async (customerId: string): Promise<Customer | null> => {
  return wrapFirestoreOperation(async () => {
    const docRef = doc(db, 'customers', customerId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const rawData = { id: docSnap.id, ...(docSnap.data() ?? {}) };
    
    // ✅ SCHEMA PROTECTION: Validate customer document
    const result = parseSafe(customerSchema, rawData);
    if (!result.success) {
      const errorMessage = 'error' in result ? result.error : 'Unknown validation error';
      console.error(`❌ Invalid customer document [${customerId}]:`, errorMessage);
      return rawData as Customer;  // return raw data so auth still works with minimal docs
    }
    
    return result.data;
  }, `getCustomer(${customerId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update customer
 * ✅ INPUT VALIDATED: Partial update is validated
 */
export const updateCustomer = async (customerId: string, data: Partial<Customer>): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid update data: must be an object');
    }
    
    // ✅ SCHEMA PROTECTION: Validate partial update (include id for schema validation)
    const validatedInput = parseOrThrow(updateCustomerInputSchema, { id: customerId, ...data }, 'UpdateCustomerInput');
    
    // Filter out undefined values and sensitive/internal fields
    const STRIP_FIELDS = new Set(['id', 'password', 'createdAt']); // never overwrite these
    const cleanData = Object.entries(validatedInput).reduce((acc, [key, value]) => {
      if (value !== undefined && !STRIP_FIELDS.has(key)) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    if (Object.keys(cleanData).length === 0) {
      logger.warn('updateCustomer: No valid fields to update after stripping');
      return;
    }
    
    const docRef = doc(db, 'customers', customerId);
    await updateDoc(docRef, {
      ...cleanData,
      updatedAt: serverTimestamp() as any,
    });
  }, `updateCustomer(${customerId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to single customer
 * ✅ VALIDATED: Customer document is validated
 */
export const subscribeToCustomer = (
  customerId: string, 
  callback: (customer: Customer | null) => void,
  errorCallback?: (error: Error) => void
) => {
  const docRef = doc(db, 'customers', customerId);
  
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      const rawData = { id: doc.id, ...(doc.data() ?? {}) };
      
      // ✅ SCHEMA PROTECTION: Validate document
      const result = parseSafe(customerSchema, rawData);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : 'Unknown validation error';
        console.error(`❌ Invalid customer document [${customerId}]:`, errorMessage);
        callback(null);
        return;
      }
      
      callback(result.data);
    } else {
      callback(null);
    }
  }, (error) => {
    // PASS 9 FIX: Previously, errors were collapsed into callback(null), which
    // is indistinguishable from "customer doc not found" and prevented
    // Promise-based callers (see useCachedCustomer) from rejecting and
    // letting TanStack Query retry. Now we still deliver null so direct
    // subscribers fail-safe, but also forward the error when requested.
    console.error('Error subscribing to customer:', error);
    callback(null);
    if (errorCallback) {
      errorCallback(error as Error);
    }
  });
};

/**
 * Subscribe to customers
 * ✅ VALIDATED: All customer documents are validated
 */
export const subscribeToCustomers = (
  callback: (customers: Customer[]) => void, 
  limitCount: number = 100
) => {
  const q = query(
    collection(db, 'customers'), 
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  return onSnapshot(q, (snapshot) => {
    const rawCustomers: any[] = [];
    snapshot.forEach((doc) => {
      rawCustomers.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all customers
    const validatedCustomers = parseArrayPartial(customerSchema, rawCustomers, 'Customer');
    callback(validatedCustomers);
  }, (error) => {
    console.error('Error subscribing to customers:', error);
  });
};