/**
 * ===================================================================
 * Order Update Helper Module
 * ===================================================================
 * 
 * Centralized utility functions for order state updates across the application.
 * 
 * Benefits:
 * - Single source of truth for order updates
 * - Consistent cache invalidation
 * - Type-safe updates
 * - Easier debugging (all updates go through here)
 * 
 * Usage:
 * ```typescript
 * // Update order status
 * await updateOrderStatus(orderId, 'approved', 'admin@bakery.com');
 * 
 * // Mark payment as received
 * await markPaymentReceived(orderId);
 * 
 * // Cancel order
 * await cancelOrder(orderId, 'Customer request', 'admin@bakery.com');
 * ```
 * 
 * - saveOrdersAndInvalidateCache() now uses bulkUpdateOrders() from data service
 * - updateSingleOrderAndInvalidateCache() now uses getOrder()/updateOrder()
 * - getAllOrders() is now async (returns Promise<Order[]>)
 * - getOrderById() is now async (returns Promise<Order | undefined>)
 */

import { getServerTimestamp } from './timestamps'; // ✅ TIMESTAMP FIX

import type { Order } from '../types';
import type { OrderStatus } from '../schemas';
import { invalidateCache } from '../hooks/useCachedFirebase';
import {
  getOrders,
  getOrder,
  updateOrder,
  bulkUpdateOrders,
} from '../services/data/ordersDataService'; // ✅ MAR 17: Use data service

/**
 * 
 * Saves a full orders array by bulk-updating all orders.
 * Use this when you have the complete updated array.
 * 
 * @param orders - The complete updated orders array
 */
export async function saveOrdersAndInvalidateCache(orders: Order[]): Promise<void> {
  try {
    // Build bulk update payload from the orders array
    const updates = orders.map(order => ({
      orderId: order.id || "",
      data: order,
    }));
    
    if (updates.length > 0) {
      await bulkUpdateOrders(updates);
    }
    
    // ✅ CRITICAL: Invalidate cache to refresh ALL UI components
    await invalidateCache.orders();
    
  } catch (error) {
    console.error('❌ Failed to save orders and invalidate cache:', error);
    throw error;
  }
}

/**
 * 
 * Update a single order field AND invalidate cache.
 * 
 * @param orderId - Order ID to update
 * @param updateFn - Function that receives the order and returns updated order
 */
export async function updateSingleOrderAndInvalidateCache(
  orderId: string,
  updateFn: (order: Order) => Order
): Promise<void> {
  try {
    // ✅ MAR 17: Use data service to get current order
    const currentOrder = await getOrder(orderId);
    
    if (!currentOrder) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    // Apply update function
    const updatedOrder = updateFn(currentOrder);
    
    // ✅ MAR 17: Use data service to persist update
    await updateOrder(orderId, updatedOrder);
    
    // Invalidate cache for UI refresh
    await invalidateCache.orders();
    
  } catch (error) {
    console.error(`❌ Failed to update order ${orderId}:`, error);
    throw error;
  }
}

/**
 * 
 * Get all orders.
 * NOTE: For reactive components, use useCachedOrders hook instead.
 */
export async function getAllOrders(): Promise<Order[]> {
  try {
    return await getOrders();
  } catch (error) {
    console.error('❌ Failed to get orders:', error);
    return [];
  }
}

/**
 * 
 * Get a single order by ID.
 * 
 * @param orderId - Order ID to find
 * @returns Order or undefined if not found
 */
export async function getOrderById(orderId: string): Promise<Order | undefined> {
  try {
    const order = await getOrder(orderId);
    return order ?? undefined;
  } catch (error) {
    console.error(`❌ Failed to get order ${orderId}:`, error);
    return undefined;
  }
}

/**
 * Update order status
 * 
 * @param orderId - Order ID to update
 * @param status - New status ('approved', 'completed', 'cancelled', etc.)
 * @param updatedBy - Email of the user who updated the status
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus, updatedBy: string): Promise<void> {
  await updateSingleOrderAndInvalidateCache(orderId, (order) => ({
    ...order,
    status,
    updatedBy,
    updatedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
  }));
}

/**
 * Mark payment as received
 * 
 * @param orderId - Order ID to update
 */
export async function markPaymentReceived(orderId: string): Promise<void> {
  await updateSingleOrderAndInvalidateCache(orderId, (order) => ({
    ...order,
    paymentStatus: 'received',
    paymentDate: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
  }));
}

/**
 * Cancel order
 * 
 * @param orderId - Order ID to update
 * @param reason - Reason for cancellation
 * @param updatedBy - Email of the user who cancelled the order
 */
export async function cancelOrder(orderId: string, reason: string, updatedBy: string): Promise<void> {
  await updateSingleOrderAndInvalidateCache(orderId, (order) => ({
    ...order,
    status: 'cancelled',
    cancellationReason: reason,
    updatedBy,
    updatedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
  }));
}
