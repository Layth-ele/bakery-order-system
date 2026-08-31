/**
 * 🎯 usePendingOrderActions Hook
 * 
 * ✅ PHASE 1 APPROVED: Thin Service Wrapper (Acceptable Pattern)
 * ✅ MAR 14, 2026: ENHANCED - Integrated cache invalidation
 * 
 * PURPOSE:
 * - Provide pending order actions interface
 * - Handle UI notifications (toasts)
 * - Coordinate with orderActionService
 * - Automatic cache invalidation after mutations (NEW)
 * 
 * PERFORMANCE IMPROVEMENTS (MAR 14, 2026):
 * - Before: Manual cache invalidation required
 * - After: Automatic invalidation via useInvalidateOrders()
 * - Ensures UI updates immediately after order changes
 * 
 * STATUS: ✅ GOOD - Minimal business logic, delegates to services
 * 
 * USAGE:
 * ```typescript
 * const { 
 *   approveOrder,
 *   rejectOrder,
 *   editOrder
 * } = usePendingOrderActions(user);
 * 
 * await approveOrder(order, deliveryFee);
 * ```
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { 
  approveOrderAction, 
  rejectOrderAction,
  getAdminInfo 
} from '../../services/orderActionService';
import { updateOrder } from '../../services/data/ordersDataService';
import { invalidateCache } from '../useCachedFirebase';
import { useInvalidateOrders } from '../useOptimizedQueries'; // Auto cache invalidation
import { getServerTimestamp } from '../../utils/timestamps';
import { debug } from '../../utils/debug';
import type {Order, User} from '../../types'

interface ApproveOrderData {
  deliveryFee: number;
}

interface RejectOrderData {
  reason: string;
}

interface EditOrderData {
  updatedItems: any[];
  updatedTotal: number;
  editedItems?: any[];
  deliveryFee?: number;
  discount?: number;
  discountNote?: string;
  discountType?: string;
  [key: string]: unknown; // allow additional fields
}

interface UsePendingOrderActionsReturn {
  /**
   * Approve an order
   */
  approveOrder: (order: Order, deliveryFee: number) => Promise<void>;
  
  /**
   * Reject an order with reason
   */
  rejectOrder: (order: Order, reason: string) => Promise<void>;
  
  /**
   * Edit a pending order
   */
  editOrder: (order: Order, data: EditOrderData) => Promise<void>;
  
  /**
   * Notification message (for success toasts)
   */
  notification: string;
  
  /**
   * Clear notification
   */
  clearNotification: () => void;
}

/**
 * Hook for pending order business actions
 * 
 * @param user - Current admin user
 * @returns Object with pending order action functions
 * 
 * @example
 * ```typescript
 * const { approveOrder, rejectOrder, notification } = usePendingOrderActions(user);
 * 
 * // Approve order
 * await approveOrder(order, 5.00);
 * 
 * // Reject order
 * await rejectOrder(order, 'Out of stock');
 * 
 * // Show notification
 * {notification && <Toast>{notification}</Toast>}
 * ```
 */
export function usePendingOrderActions(user: User): UsePendingOrderActionsReturn {
  const [notification, setNotification] = useState<string>('');
  
 // Cache invalidation hook
  const invalidateOrders = useInvalidateOrders();
  
  /**
   * Clear notification
   */
  const clearNotification = useCallback(() => {
    setNotification('');
  }, []);
  
  /**
   * Approve an order
   */
  const approveOrder = useCallback(async (
    order: Order,
    deliveryFee: number
  ): Promise<void> => {
    try {
      debug.log('✅ [usePendingOrderActions] Approving order:', order.id);
      
      const admin = getAdminInfo(user);
      const result = await approveOrderAction(order, admin, deliveryFee);
      
      if (result.success) {
        setNotification(result.message || 'Order approved successfully!');
        setTimeout(() => setNotification(''), 3000);
        
 // Auto invalidate caches
        await invalidateCache.orders();
        invalidateOrders(order.customerId);
        
        debug.log('✅ [usePendingOrderActions] Order approved successfully');
      } else {
        toast.error(result.message || 'Failed to approve order');
        throw new Error(result.message || 'Failed to approve order');
      }
    } catch (error) {
      debug.error('❌ [usePendingOrderActions] Failed to approve order:', error);
      toast.error((error as any).message || 'Failed to approve order');
      throw error;
    }
  }, [user, invalidateOrders]);
  
  /**
   * Reject an order
   */
  const rejectOrder = useCallback(async (
    order: Order,
    reason: string
  ): Promise<void> => {
    try {
      debug.log('❌ [usePendingOrderActions] Rejecting order:', order.id);
      
      if (!reason || !reason.trim()) {
        toast.error('Rejection reason is required');
        throw new Error('Rejection reason is required');
      }
      
      const admin = getAdminInfo(user);
      const result = await rejectOrderAction(order, admin, reason);
      
      if (result.success) {
        setNotification(result.message || 'Order rejected');
        setTimeout(() => setNotification(''), 3000);
        
 // Auto invalidate caches
        await invalidateCache.orders();
        invalidateOrders(order.customerId);
        
        debug.log('✅ [usePendingOrderActions] Order rejected successfully');
      } else {
        toast.error(result.message || 'Failed to reject order');
        throw new Error(result.message || 'Failed to reject order');
      }
    } catch (error) {
      debug.error('❌ [usePendingOrderActions] Failed to reject order:', error);
      toast.error((error as any).message || 'Failed to reject order');
      throw error;
    }
  }, [user, invalidateOrders]);
  
  /**
   * Edit a pending order
   */
  const editOrder = useCallback(async (
    order: Order,
    data: EditOrderData
  ): Promise<void> => {
    try {
      debug.log('📝 [usePendingOrderActions] Editing order:', order.id);
      
 // Support both old format (updatedItems) and new format (editedItems)
      const updates: any = {};
      
      // Handle items (support both field names)
      if (data.editedItems || data.updatedItems) {
        updates.items = data.editedItems || data.updatedItems;
      }
      
      // Handle total (if provided)
      if (data.updatedTotal !== undefined) {
        updates.total = data.updatedTotal;
      }
      
      // Handle delivery fee (if provided by admin)
      if (data.deliveryFee !== undefined) {
        updates.deliveryFee = data.deliveryFee;
      }
      
      // Handle discount fields (if provided by admin)
      if (data.discount !== undefined) {
        updates.discount = data.discount;
      }
      if (data.discountNote !== undefined) {
        updates.discountNote = data.discountNote;
      }
      if (data.discountType !== undefined) {
        updates.discountType = data.discountType;
      }
      
      // Add timestamp
      updates.updatedAt = getServerTimestamp();
      
      
      await updateOrder(order.id, updates);
      
 // Auto invalidate caches
      await invalidateCache.orders();
      invalidateOrders(order.customerId);
      
      setNotification('Order updated successfully');
      setTimeout(() => setNotification(''), 3000);
      debug.log('✅ [usePendingOrderActions] Order edited successfully');
    } catch (error) {
      debug.error('❌ [usePendingOrderActions] Failed to edit order:', error);
      toast.error((error as any).message || 'Failed to edit order');
      throw error;
    }
  }, [invalidateOrders]);
  
  return {
    approveOrder,
    rejectOrder,
    editOrder,
    notification,
    clearNotification,
  };
}