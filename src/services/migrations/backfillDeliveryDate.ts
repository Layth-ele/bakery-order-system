/**
 * 🔧 Backfill deliveryDate for Completed Orders
 * 
 * ✅ MAR 12, 2026: Migration utility to add deliveryDate to completed orders
 * 
 * PURPOSE:
 * - Backfill missing deliveryDate field for completed orders
 * - Calculate deliveryDate from week/year using getWeekInfoByNumber
 * - Required for invoice grouping functionality
 * 
 * USAGE:
 * - Automatically runs when CompleteOrdersPage loads
 * - Only processes orders missing deliveryDate
 * - Skips orders without week/year data
 */

import { getWeekInfoByNumber } from '../../utils/weekUtils';
import type { Order } from '../../types';
import { updateOrder } from '../data/ordersDataService';
import { logger } from '../../utils/logger';
 // ✅ MAR 17: Use data service

/**
 * Backfill deliveryDate for completed orders that are missing it
 * 
 * @param orders - Array of completed orders to check and update
 * @returns Array of updated orders (or original if no updates needed)
 */
export async function backfillDeliveryDate(orders: Order[]): Promise<Order[]> {
  let updatedCount = 0;
  const updatePromises: Promise<void>[] = [];
  
  const updatedOrders = orders.map((order) => {
    // Skip if order already has deliveryDate
    if (order.deliveryDate) {
      return order;
    }
    
    // Skip if order doesn't have week/year data
    if (!order.week || !order.year) {
      logger.warn(`⚠️ [backfillDeliveryDate] Order ${order.id} missing week/year, cannot calculate deliveryDate`);
      return order;
    }
    
    // Calculate deliveryDate from week/year
    try {
      const { weekEnd } = getWeekInfoByNumber(order.week, order.year);
      const deliveryDate = weekEnd.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      updatedCount++;
      
      updatePromises.push(
        updateOrder(order.id, { deliveryDate }).catch(error => {
          logger.warn(`⚠️ [backfillDeliveryDate] Failed to persist deliveryDate for order ${order.id}:`, error);
        })
      );
      
      return {
        ...order,
        deliveryDate,
      };
    } catch (error) {
      logger.warn(`⚠️ [backfillDeliveryDate] Failed to calculate deliveryDate for order ${order.id}:`, error);
      return order;
    }
  });
  
  // Persist updated orders if any were modified
  if (updatedCount > 0) {
    
    try {
      // ✅ MAR 17: Wait for all data service updates to complete
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('❌ [backfillDeliveryDate] Failed to persist some updated orders:', error);
    }
  } else {
  }
  
  return updatedOrders;
}
