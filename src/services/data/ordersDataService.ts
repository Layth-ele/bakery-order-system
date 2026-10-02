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
// WRITES
// ============================================================================
// None. Orders are created and changed only by Cloud Functions
// (services/firebase/cloudFunctions.ts); Firestore rules deny browser writes.

// Re-export Order type so callers that import functions from this module
// can also get the Order type from a single import.
export type { Order } from '../../schemas';