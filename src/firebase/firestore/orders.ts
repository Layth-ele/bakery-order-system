/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - ORDERS DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the Orders collection.
 * 
 * EXPORTS:
 * - getOrders: Fetch all orders
 * - getOrder: Fetch single order by ID
 * - getOrdersByCustomer: Fetch all orders for a customer
 * - createOrder: Create new order
 * - updateOrder: Update order
 * - deleteOrder: Delete order
 * - subscribeToOrders: Real-time orders list
 * - subscribeToCustomerOrders: Real-time customer orders
 * - subscribeToOrder: Real-time single order
 * 
 * ✅ All operations are schema-validated
 * ✅ All operations use wrapFirestoreOperation for error handling
 * ✅ Last updated: March 16, 2026 - File restored with all exports
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';

import {
  orderSchema,
  createOrderInputSchema,
  updateOrderInputSchema,
  parseOrThrow,
  parseArrayPartial,
  parseSafe,
  type Order,
} from '../../schemas';

import { db, serverTimestamp, wrapFirestoreOperation } from './shared';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get orders (one-time fetch).
 *
 * ✅ PASS 4: Now enforces a default limit of 500 docs to prevent runaway
 * reads as the dataset grows. Pre-Pass-4 this was unbounded and would scan
 * the entire collection on every page load — at 5k+ orders this becomes
 * slow and expensive, at 50k+ it times out.
 *
 * For paginated UIs (admin order tables) use getOrdersPaginated below
 * with a cursor instead. The unbounded behavior is still available by
 * passing { limit: 0 } but this should only be used by export jobs.
 *
 * @param options.limit - Max docs to fetch (default 500; 0 = unbounded)
 * @param options.status - Optional status filter
 * ✅ VALIDATED: All order documents are validated
 */
export const getOrders = async (
  options: { limit?: number; status?: string | string[] } = {}
): Promise<Order[]> => {
  return wrapFirestoreOperation(async () => {
    const { limit: limitCount = 500, status } = options;

    let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    if (status) {
      q = query(
        collection(db, 'orders'),
        Array.isArray(status)
          ? where('status', 'in', status)
          : where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
    }
    if (limitCount > 0) {
      q = query(q, limit(limitCount));
    }

    const snapshot = await getDocs(q);

    const rawOrders: any[] = [];
    snapshot.forEach((doc) => {
      rawOrders.push({ id: doc.id, ...(doc.data() ?? {}) });
    });

    // ✅ SCHEMA PROTECTION: Validate all orders, skip invalid ones
    const validatedOrders = parseArrayPartial(orderSchema, rawOrders, 'Order');

    if (validatedOrders.length < rawOrders.length) {
      logger.warn(
        `⚠️ Firestore: ${rawOrders.length - validatedOrders.length} invalid orders skipped`
      );
    }

    return validatedOrders;
  }, 'getOrders');
};

/**
 * Paginated orders fetch using cursor-based pagination.
 *
 * ✅ PASS 4: Use this in admin tables and any UI that may need to display
 * orders past the first page. Cursor-based pagination scales linearly
 * regardless of dataset size.
 *
 * @param options.cursor - Last doc ID from previous page (or null for first page)
 * @param options.pageSize - Docs per page (default 50, max 200)
 * @param options.status - Optional status filter
 *
 * @returns { orders, nextCursor, hasMore }
 */
export const getOrdersPaginated = async (
  options: {
    cursor?: string | null;
    pageSize?: number;
    status?: string | string[];
  } = {}
): Promise<{ orders: Order[]; nextCursor: string | null; hasMore: boolean }> => {
  return wrapFirestoreOperation(async () => {
    const { cursor = null, pageSize = 50, status } = options;
    const safePageSize = Math.min(Math.max(pageSize, 1), 200);

    // Build the base query
    let baseQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    if (status) {
      baseQuery = query(
        collection(db, 'orders'),
        Array.isArray(status)
          ? where('status', 'in', status)
          : where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
    }

    // Resume from cursor if provided
    let q = query(baseQuery, limit(safePageSize + 1)); // +1 to detect hasMore
    if (cursor) {
      const cursorSnap = await getDoc(doc(db, 'orders', cursor));
      if (cursorSnap.exists()) {
        const { startAfter } = await import('firebase/firestore');
        q = query(baseQuery, startAfter(cursorSnap), limit(safePageSize + 1));
      }
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > safePageSize;
    const pageDocs = hasMore ? docs.slice(0, safePageSize) : docs;

    const rawOrders: any[] = pageDocs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));
    const validatedOrders = parseArrayPartial(orderSchema, rawOrders, 'Order');

    return {
      orders: validatedOrders,
      nextCursor: hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null,
      hasMore,
    };
  }, 'getOrdersPaginated');
};

/**
 * Get single order by ID
 * ✅ VALIDATED: Order document is validated
 */
export const getOrder = async (orderId: string): Promise<Order | null> => {
  return wrapFirestoreOperation(async () => {
    const docRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const rawData = { id: docSnap.id, ...(docSnap.data() ?? {}) };
    
    // ✅ SCHEMA PROTECTION: Validate order document
    const result = parseSafe(orderSchema, rawData);
    if (!result.success) {
      const errorMessage = 'error' in result ? result.error : 'Unknown validation error';
      console.error(`❌ Invalid order document [${orderId}]:`, errorMessage);
      return null;
    }
    
    return result.data;
  }, `getOrder(${orderId})`);
};

/**
 * Get all production-relevant (active) orders from Firestore — NO client-side cap.
 *
 * BUG 2 FIX: The generic getOrders() hook sliced results to limitCount=100 after a
 * full table scan, so any in-process order beyond position 100 was invisible to
 * the Production Sheet, Weekly Invoices, and badge counts.
 * This function pushes the status filter into Firestore so only the required
 * documents are transferred, and imposes no artificial cap.
 *
 * Active statuses: pending | approved | in_process
 * Terminal statuses (completed / cancelled / rejected) are excluded.
 *
 * @returns All active orders, sorted by createdAt desc
 */
export const getActiveOrders = async (): Promise<Order[]> => {
  return wrapFirestoreOperation(async () => {
    // Firestore 'in' operator supports up to 10 values — 3 statuses is safe.
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'approved', 'in_process']),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(q);

    const rawOrders: any[] = [];
    snapshot.forEach((doc) => {
      rawOrders.push({ id: doc.id, ...(doc.data() ?? {}) });
    });

    const validatedOrders = parseArrayPartial(orderSchema, rawOrders, 'Order');

    if (validatedOrders.length < rawOrders.length) {
      logger.warn(
        `⚠️ Firestore [getActiveOrders]: ${rawOrders.length - validatedOrders.length} invalid orders skipped`,
      );
    }

    return validatedOrders;
  }, 'getActiveOrders');
};

/**
 * Get orders by customer
 * ✅ VALIDATED: All order documents are validated
 */
export const getOrdersByCustomer = async (customerId: string): Promise<Order[]> => {
  return wrapFirestoreOperation(async () => {
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    const rawOrders: any[] = [];
    snapshot.forEach((doc) => {
      rawOrders.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all orders
    return parseArrayPartial(orderSchema, rawOrders, 'Order');
  }, `getOrdersByCustomer(${customerId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create order with a caller-supplied document ID (idempotent)
 * FIX BUG 5: Using setDoc(doc(ref, id)) instead of addDoc means retrying with
 * the same pre-generated ID is safe — the write is idempotent and will not
 * create a duplicate document even if the network drops mid-flight.
 * ✅ INPUT VALIDATED: Input is validated before write
 */
export const createOrderWithId = async (
  orderId: string,
  order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  return wrapFirestoreOperation(async () => {
    try {
      const validatedInput = parseOrThrow(createOrderInputSchema, order, 'CreateOrderInput');
      const docRef = doc(collection(db, 'orders'), orderId);
      await setDoc(docRef, {
        ...validatedInput,
        id: orderId,
        status: 'pending',
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      });
      return orderId;
    } catch (validationError) {
      console.error('❌ [fbCreateOrderWithId] Validation failed:', validationError);
      throw validationError;
    }
  }, `createOrderWithId(${orderId})`);
};

/**
 * Create order
 * ✅ INPUT VALIDATED: Input is validated before write
 */
export const createOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  return wrapFirestoreOperation(async () => {
    
    // ✅ SCHEMA PROTECTION: Validate input before write
    try {
      const validatedInput = parseOrThrow(createOrderInputSchema, order, 'CreateOrderInput');
      
      const docRef = await addDoc(collection(db, 'orders'), {
        ...validatedInput,
        status: 'pending',
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      });
      
      return docRef.id;
    } catch (validationError) {
      console.error('❌ [fbCreateOrder] Validation failed:', validationError);
      console.error('❌ [fbCreateOrder] Failed order data:', JSON.stringify(order, null, 2));
      throw validationError;
    }
  }, 'createOrder');
};

/**
 * Update order
 * ✅ INPUT VALIDATED: Partial update is validated
 */
export const updateOrder = async (orderId: string, data: Partial<Order>): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid update data: must be an object');
    }
    
    // ✅ SCHEMA PROTECTION: Validate partial update
    const validatedInput = parseOrThrow(updateOrderInputSchema, data, 'UpdateOrderInput');
    
    const cleanData = Object.entries(validatedInput).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    // Always update the timestamp
    cleanData.updatedAt = serverTimestamp();
    
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, cleanData);
  }, `updateOrder(${orderId})`);
};

/**
 * Delete order
 */
export const deleteOrder = async (orderId: string): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    const docRef = doc(db, 'orders', orderId);
    await deleteDoc(docRef);
  }, `deleteOrder(${orderId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to all orders (real-time)
 * ✅ VALIDATED: All order documents are validated
 */
export const subscribeToOrders = (
  callback: (orders: Order[]) => void,
  errorCallback?: (error: Error) => void
): (() => void) => {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const rawOrders: any[] = [];
      snapshot.forEach((doc) => {
        rawOrders.push({ id: doc.id, ...(doc.data() ?? {}) });
      });
      
      // ✅ SCHEMA PROTECTION: Validate all orders
      const validatedOrders = parseArrayPartial(orderSchema, rawOrders, 'Order');
      
      if (validatedOrders.length < rawOrders.length) {
        logger.warn(
          `⚠️ Firestore: ${rawOrders.length - validatedOrders.length} invalid orders skipped`
        );
      }
      
      callback(validatedOrders);
    },
    (error) => {
      console.error('🔥 Firestore subscription error [subscribeToOrders]:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
    }
  );
};

/**
 * Subscribe to customer orders (real-time)
 * ✅ VALIDATED: All order documents are validated
 */
export const subscribeToCustomerOrders = (
  customerId: string,
  callback: (orders: Order[]) => void,
  errorCallback?: (error: Error) => void
): (() => void) => {
  const q = query(
    collection(db, 'orders'),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const rawOrders: any[] = [];
      snapshot.forEach((doc) => {
        rawOrders.push({ id: doc.id, ...(doc.data() ?? {}) });
      });
      
      // ✅ SCHEMA PROTECTION: Validate all orders
      const validatedOrders = parseArrayPartial(orderSchema, rawOrders, 'Order');
      callback(validatedOrders);
    },
    (error) => {
      console.error(
        `🔥 Firestore subscription error [subscribeToCustomerOrders(${customerId})]`,
        error
      );
      if (errorCallback) {
        errorCallback(error as Error);
      }
    }
  );
};

/**
 * Subscribe to single order (real-time)
 * ✅ VALIDATED: Order document is validated
 */
export const subscribeToOrder = (
  orderId: string,
  callback: (order: Order | null) => void,
  errorCallback?: (error: Error) => void
): (() => void) => {
  const docRef = doc(db, 'orders', orderId);
  
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        callback(null);
        return;
      }
      
      const rawData = { id: docSnap.id, ...(docSnap.data() ?? {}) };
      
      // ✅ SCHEMA PROTECTION: Validate order document
      const result = parseSafe(orderSchema, rawData);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : 'Unknown validation error';
        console.error(`❌ Invalid order document [${orderId}]:`, errorMessage);
        callback(null);
        return;
      }
      
      callback(result.data);
    },
    (error) => {
      console.error(`🔥 Firestore subscription error [subscribeToOrder(${orderId})]`, error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
    }
  );
};