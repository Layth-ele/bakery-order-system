import { recordVoidedInvoice } from '../invoicing/voidedInvoiceService';
/**
 * ORDERS DATA SERVICE
 *
 * Firestore-first with automatic localStorage fallback for DEMO MODE.
 *
 * ✅ Firestore-first with automatic localStorage fallback
 * ✅ Uses Firebase operations from /firebase/firestore/orders.ts
 * ✅ Handles timestamp conversion for legacy localStorage data
 * ✅ MAR 15, 2026: Added invalid order filtering for corrupted data
 * ✅ MAR 16, 2026: Fixed demo mode hang - checks isFirebaseConfigured not db
 */

import { db, isFirebaseConfigured } from '../../firebase/config';
import type { Order } from '../../types';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

import {
  getOrders as fbGetOrders,
  getActiveOrders as fbGetActiveOrders,
  getOrder as fbGetOrder,
  getOrdersByCustomer as fbGetOrdersByCustomer,
  createOrder as fbCreateOrder,
  createOrderWithId as fbCreateOrderWithId,
  updateOrder as fbUpdateOrder,
  deleteOrder as fbDeleteOrder,
} from '../../firebase/firestore/orders';

import {
  orderSchema,
  parseArrayPartial,
  parseSafe,
  parseOrThrow,
  
} from '../../schemas';
import { logger } from '../../utils/logger';


// ============================================================================
// HELPER FUNCTIONS - TIMESTAMP CONVERSION
// ============================================================================

function convertToTimestamp(value: unknown): Timestamp | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    return new Timestamp((value as any).seconds, (value as any).nanoseconds);
  }
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return Timestamp.fromDate(date);
    } catch (_e) {
      // ignore
    }
  }
  if (typeof value === 'number') return Timestamp.fromMillis(value);
  return null;
}

function normalizeOrderTimestamps(order: any): any {
  return {
    ...order,
    createdAt: convertToTimestamp(order.createdAt) || Timestamp.now(),
    updatedAt: convertToTimestamp(order.updatedAt) || Timestamp.now(),
  };
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get orders.
 *
 * ✅ PASS 4: Now forwards options to the Firestore-layer getOrders, which
 * applies a default 500-doc cap. Pass options.limit = 0 to fetch unbounded
 * (only for export jobs).
 */
export async function getOrders(
  options: { limit?: number; status?: string | string[] } = {}
): Promise<Order[]> {
  if (isFirebaseConfigured) {
    try {
      const orders = await fbGetOrders(options);
      return orders;
    } catch (error) {
      console.error('❌ [ordersDataService] Firestore read failed:', error);
      throw error;
    }
  }
  try {
    const ordersJson = localStorage.getItem('bakery_orders');
    if (!ordersJson) return [];
    const rawOrders = JSON.parse(ordersJson);
    const normalized = rawOrders.map(normalizeOrderTimestamps);
    const validated = parseArrayPartial(orderSchema, normalized, 'Order');
    return validated;
  } catch (error) {
    console.error('❌ [ordersDataService] localStorage read failed:', error);
    return [];
  }
}

/**
 * Get active orders only (pending | approved | in_process) — NO client-side cap.
 *
 * BUG 2 FIX: The generic getOrders() was sliced to 100 records after fetch,
 * silently dropping in-process orders from production planning.
 * This function filters at the Firestore query level (one round-trip, no waste)
 * and returns all matching documents without any artificial limit.
 */
export async function getActiveOrders(): Promise<Order[]> {
  if (isFirebaseConfigured) {
    try {
      return await fbGetActiveOrders();
    } catch (error) {
      console.error('❌ [ordersDataService] getActiveOrders Firestore read failed:', error);
      throw error;
    }
  }
  // localStorage fallback (demo mode) — filter client-side
  try {
    const ordersJson = localStorage.getItem('bakery_orders');
    if (!ordersJson) return [];
    const rawOrders = JSON.parse(ordersJson);
    const active = rawOrders.filter((o: any) =>
      ['pending', 'approved', 'in_process'].includes(o.status),
    );
    const normalized = active.map(normalizeOrderTimestamps);
    return parseArrayPartial(orderSchema, normalized, 'Order');
  } catch (error) {
    console.error('❌ [ordersDataService] getActiveOrders localStorage read failed:', error);
    return [];
  }
}

export async function getOrder(orderId: string): Promise<Order | null> {
  if (isFirebaseConfigured) {
    try {
      const order = await fbGetOrder(orderId);
      if (order) {
        return order; // Found in Firestore
      }
      // Not found in Firestore, try localStorage fallback
      logger.warn(`⚠️ [ordersDataService] Order ${orderId} not in Firestore, trying localStorage fallback...`);
    } catch (error) {
      const isNotFound = 
        (error as any)?.message?.includes('not found') ||
        (error as any)?.message?.includes('No document') ||
        (error as any)?.code === 'not-found';
      
      if (!isNotFound) {
        // Real error, not just "not found"
        console.error(`❌ [ordersDataService] Firestore read failed for ${orderId}:`, error);
        throw error;
      }
      logger.warn(`⚠️ [ordersDataService] Order ${orderId} not in Firestore, trying localStorage fallback...`);
    }
  }
  try {
    const ordersJson = localStorage.getItem('bakery_orders');
    if (!ordersJson) return null;
    const rawOrders = JSON.parse(ordersJson);
    const rawOrder = rawOrders.find((o: any) => o.id === orderId);
    if (!rawOrder) return null;
    const normalized = normalizeOrderTimestamps(rawOrder);
    const result = parseSafe(orderSchema, normalized);
    if (!result.success) {
      logger.warn(`⚠️ [ordersDataService] Order ${orderId} failed validation: ${'error' in result ? result.error : 'Unknown error'}`);
      return null;
    }
    return result.data;
  } catch (error) {
    console.error(`❌ [ordersDataService] localStorage read failed for ${orderId}:`, error);
    return null;
  }
}

export async function getOrderRaw(orderId: string): Promise<any | null> {
  if (isFirebaseConfigured) {
    try {
      return await fbGetOrder(orderId);
    } catch (error) {
      console.error(`❌ [ordersDataService] Firestore RAW read failed for ${orderId}:`, error);
      throw error;
    }
  }

  try {
    const ordersJson = localStorage.getItem('bakery_orders');
    if (!ordersJson) return null;
    const rawOrders = JSON.parse(ordersJson);
    return rawOrders.find((o: any) => o.id === orderId) ?? null;
  } catch (error) {
    console.error(`❌ [ordersDataService] localStorage RAW read failed for ${orderId}:`, error);
    return null;
  }
}

export async function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  if (isFirebaseConfigured) {
    try {
      const orders = await fbGetOrdersByCustomer(customerId);
      return orders;
    } catch (error) {
      console.error(`❌ [ordersDataService] Firestore read failed for ${customerId}:`, error);
      throw error;
    }
  }
  try {
    const ordersJson = localStorage.getItem('bakery_orders');
    if (!ordersJson) return [];
    const rawOrders = JSON.parse(ordersJson);
    const customerOrders = rawOrders.filter((o: any) => o.customerId === customerId);
    const normalized = customerOrders.map(normalizeOrderTimestamps);
    return parseArrayPartial(orderSchema, normalized, 'Order');
  } catch (error) {
    console.error(`❌ [ordersDataService] localStorage read failed for ${customerId}:`, error);
    return [];
  }
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

export async function addOrder(orderData: Omit<Order, 'id'>, preGeneratedId?: string): Promise<string> {
  if (isFirebaseConfigured) {
    try {
      const { createdAt, updatedAt, ...dataWithoutTimestamps } = orderData as any;
      // FIX BUG 5: Use a pre-generated ID with setDoc (idempotent) instead of addDoc.
      // If the retry mechanism re-calls addOrder with the same preGeneratedId,
      // setDoc is a no-op rather than creating a second Firestore document.
      const orderId = preGeneratedId
        ? await fbCreateOrderWithId(preGeneratedId, dataWithoutTimestamps)
        : await fbCreateOrder(dataWithoutTimestamps);
      
      return orderId;
    } catch (error) {
      console.error('❌ [ordersDataService] Firestore create failed:', error);
      throw error; // Never silently fall back — admin would never see the order
    }
  }

  // Firebase NOT configured — demo/localStorage mode only
  try {
    const ordersJson = localStorage.getItem('bakery_orders');
    const orders = ordersJson ? JSON.parse(ordersJson) : [];
    // Demo/localStorage mode: use date + 3-digit sequence (grows naturally)
    const d = new Date().toISOString().slice(0, 10);
    const seq = String(Date.now()).slice(-3).padStart(3, '0');
    const orderId = `ORD-${d}-${seq}`;
    
    const rawOrder = {
      ...orderData,
      id: orderId,
      createdAt: Timestamp.now() as any,
      updatedAt: Timestamp.now() as any,
    };
    const validatedOrder = parseOrThrow(orderSchema, rawOrder, 'Order');
    orders.push(validatedOrder);
    localStorage.setItem('bakery_orders', JSON.stringify(orders));
    
    // ✅ CRITICAL VERIFICATION: Ensure the order was actually saved
    const verifyJson = localStorage.getItem('bakery_orders');
    if (verifyJson) {
      const verifyOrders = ((() => { try { return JSON.parse(verifyJson); } catch { return null; } })());
      const savedOrder = verifyOrders.find((o: any) => o.id === orderId);
      if (savedOrder) {
      } else {
        console.error(`❌ [ordersDataService] CRITICAL: Order ${orderId} was NOT saved to localStorage!`);
        console.error(`🔍 [ordersDataService] DIAGNOSTIC: localStorage has ${verifyOrders.length} orders: ${verifyOrders.map((o: any) => o.id).join(', ')}`);
        throw new Error(`Order ${orderId} creation failed - not found in localStorage after save`);
      }
    } else {
      console.error(`❌ [ordersDataService] CRITICAL: localStorage was cleared after order creation!`);
      throw new Error(`Order ${orderId} creation failed - localStorage is empty`);
    }
    
    return orderId;
  } catch (error) {
    console.error('❌ [ordersDataService] localStorage create failed:', error);
    throw error;
  }
}

export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
  try {
    const { createdAt, updatedAt, id, ...cleanUpdates } = updates as any;
    await fbUpdateOrder(orderId, cleanUpdates);
  } catch (error) {
    console.error(`❌ [ordersDataService] Update failed for ${orderId}:`, error);
    throw error;
  }
}


export async function deleteOrder(orderId: string, deletedBy = 'system'): Promise<void> {
  try {
    // ✅ FIX 4: Record void BEFORE deleting so we still have order data
    const orderToVoid = await getOrder(orderId);
    if (orderToVoid?.invoiceNumber) {
      await recordVoidedInvoice(orderToVoid, 'deleted', deletedBy);
    }
    await fbDeleteOrder(orderId);
  } catch (error) {
    console.error(`❌ [ordersDataService] Delete failed for ${orderId}:`, error);
    throw error;
  }
}


export async function bulkUpdateOrders(
  updates: Array<{ orderId: string; data: Partial<Order> }>
): Promise<void> {
  if (isFirebaseConfigured) {
    try {
      const batch = writeBatch(db!);
      updates.forEach(({ orderId, data }) => {
        const { createdAt, updatedAt, id, ...cleanData } = data as any;
        const orderRef = doc(db!, 'orders', orderId);
        batch.update(orderRef, { ...cleanData, updatedAt: serverTimestamp() as any });
      });
      await batch.commit();
      
 // Also sync to localStorage to keep in sync
      try {
        const ordersJson = localStorage.getItem('bakery_orders');
        if (ordersJson) {
          const orders = JSON.parse(ordersJson);
          updates.forEach(({ orderId, data }) => {
            const idx = orders.findIndex((o: any) => o.id === orderId);
            if (idx !== -1) {
              orders[idx] = { ...orders[idx], ...data, updatedAt: Timestamp.now() as any };
            }
          });
          localStorage.setItem('bakery_orders', JSON.stringify(orders));
        }
      } catch (lsError) {
        logger.warn(`⚠️ [ordersDataService] Failed to sync bulk updates to localStorage (non-fatal):`, lsError);
      }
      
      return;
    } catch (error) {
      console.error(`❌ [ordersDataService] Firestore bulk update failed:`, error);
      throw error;
    }
  }
  try {
    const ordersJson = localStorage.getItem('bakery_orders');
    const orders = ordersJson ? JSON.parse(ordersJson) : [];
    updates.forEach(({ orderId, data }) => {
      const idx = orders.findIndex((o: any) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found in localStorage`);
      orders[idx] = { ...orders[idx], ...data };
    });
    localStorage.setItem('bakery_orders', JSON.stringify(orders));
  } catch (error) {
    console.error(`❌ [ordersDataService] localStorage bulk update failed:`, error);
    throw error;
  }
}
// Re-export Order type so callers that import functions from this module
// can also get the Order type from a single import.
export type { Order } from '../../schemas';