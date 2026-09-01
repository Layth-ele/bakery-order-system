/**
 * 🎯 useOrderActions Hook
 * 
 * ✅ PHASE 1 REFACTORED: Thin Service Wrapper
 * 
 * PURPOSE:
 * - Provide React hooks interface to order workflow services
 * - Handle UI notifications (alerts, toasts)
 * - Manage cache invalidation coordination
 * 
 * DOES NOT CONTAIN:
 * - ❌ Business logic (moved to services)
 * - ❌ Complex workflows (moved to orderWorkflowService)
 * - ❌ Validation rules (moved to services)
 * 
 * RESPONSIBILITIES:
 * - ✅ Call service layer functions
 * - ✅ Display UI feedback (alerts)
 * - ✅ Invalidate caches
 * - ✅ Error handling for UI
 * 
 * Version: 2.0.0 - Refactored March 8, 2026
 */

import { useCallback } from 'react';
import { useAlert } from '../../contexts/AlertContext';
import { invalidateCache } from '../useCachedFirebase';
import { updateOrder, bulkUpdateOrders } from '../../services/data/ordersDataService';
import { cancelOrderAction } from '../../services/orderActionService'; // ✅ MAR 17: Fixed import (removed getAdminInfo)
import { completeOrderNow } from '../../services/orderCompletion/completeOrderNow';
import {notifyPaymentReminder} from '../../notifications'
import { sendPaymentReminderEmail } from '../../services/emailService';
import { toast } from 'sonner';
import { getServerTimestamp } from '../../utils/timestamps';
import { debug } from '../../utils/debug';
import type { Order, User } from '../../types';
import { displayOrderNumber } from '../../utils/displayId';

interface CancelOrderData {
  reason: string;
  cancellationFee: string;
  cancellationFeePercentage: string;
  adminEmail: string;
  adminPassword: string;
}

interface EditOrderData {
  updatedItems: any[];
  updatedTotal?: number;
  deliveryFee?: number;
  discount?: number;
  discountNote?: string;
  discountType?: string;
}

interface UseOrderActionsReturn {
  cancelOrder: (order: Order, data: CancelOrderData) => Promise<void>;
  completeOrder: (order: Order, adminUser: User) => Promise<void>;
  editOrder: (order: Order, data: EditOrderData) => Promise<void>;
  sendPaymentReminder: (order: Order) => Promise<void>;
  approveOrder: (order: Order, adminUser: User) => Promise<void>;
  rejectOrder: (order: Order, reason: string, adminUser: User) => Promise<void>;
  migrateOrders: (orders: Order[]) => Promise<void>;
}

/**
 * Thin wrapper hook for order actions
 * 
 * Delegates to service layer, provides UI feedback
 */
export function useOrderActions(): UseOrderActionsReturn {
  const { showAlert } = useAlert();
  
  /**
   * Cancel an order with validation
   * ✅ MAR 17: Fixed cancelOrderAction call - now passes (order, admin, reason) correctly
   */
  const cancelOrder = useCallback(async (
    order: Order,
    data: CancelOrderData
  ): Promise<void> => {
    try {
      // Validation
      if (!data.adminEmail || !data.adminEmail.trim()) {
        showAlert({ title: 'Alert', message: 'Admin email is required for cancellation', icon: 'error' as const });
        throw new Error('Admin email required');
      }
      
      if (!data.adminPassword || !data.adminPassword.trim()) {
        showAlert({ title: 'Alert', message: 'Admin password is required for cancellation', icon: 'error' as const });
        throw new Error('Admin password required');
      }
      
      if (!data.reason || !data.reason.trim()) {
        showAlert({ title: 'Alert', message: 'Cancellation reason is required', icon: 'error' as const });
        throw new Error('Cancellation reason required');
      }
      
      // Build admin info object
      const admin = {
        email: data.adminEmail,
        name: data.adminEmail,
        storeName: data.adminEmail || "",
        role: 'admin' as const,
      };

      // Execute cancellation via service
      // ✅ MAR 17: Fixed call signature - (order, admin, reason, cancelledDays, feePercentage, creditAmount)
      debug.log('🚫 Cancelling order:', order.id);
      
      const result = await cancelOrderAction(
        order,
        admin,
        data.reason,
        undefined,
        data.cancellationFeePercentage ? parseFloat(data.cancellationFeePercentage) : undefined,
        undefined
      );
      
      if (!result.success) {
        showAlert({ title: 'Alert', message: result.message || 'Failed to cancel order', icon: 'error' as const });
        throw new Error(result.message || 'Failed to cancel order');
      }
      
      // Invalidate cache
      await invalidateCache.orders();
      
 // Replaced modal with toast notification
      toast.success('Order cancelled successfully!', {
        description: `Order ${displayOrderNumber(order)} has been cancelled. ${data.reason ? `Reason: ${data.reason}` : ''} The customer has been notified.`,
        duration: 5000,
      });
      debug.log('✅ Order cancelled successfully');
    } catch (error) {
      debug.error('❌ Failed to cancel order:', error);
      showAlert({ title: 'Alert', message: (error as any).message || 'Failed to cancel order', icon: 'error' as const });
      throw error;
    }
  }, [showAlert]);
  
  /**
   * Complete an order
   * ✅ MAR 17: Fixed completeOrderNow call - now passes { actor: string } as second arg
   */
  const completeOrder = useCallback(async (
    order: Order,
    adminUser: User
  ): Promise<void> => {
    try {
      debug.log('✅ Completing order:', order.id);
      
      // ✅ MAR 17: Fixed - completeOrderNow takes (order, { actor: string })
      const result = await completeOrderNow(order, {
        actor: adminUser.email || 'admin',
      });
      
      if (!result.success) {
        showAlert({ title: 'Alert', message: result.error || 'Failed to complete order', icon: 'error' as const });
        throw new Error(result.error || 'Failed to complete order');
      }
      
      await invalidateCache.orders();

      toast.success(`Order ${displayOrderNumber(order)} marked as completed`, { duration: 4000 });
      debug.log('✅ Order completed successfully');
    } catch (error) {
      debug.error('❌ Failed to complete order:', error);
      showAlert({ title: 'Alert', message: (error as any).message || 'Failed to complete order', icon: 'error' as const });
      throw error;
    }
  }, [showAlert]);
  
  /**
   * Edit an order (simple update)
   * Note: For complex editing, use orderWorkflowService directly
   */
  const editOrder = useCallback(async (
    order: Order,
    data: EditOrderData
  ): Promise<void> => {
    try {
      debug.log('📝 Editing order:', order.id);

      // FIX T2R1-F2 sibling (CRITICAL): editOrder previously did a raw
      // updateOrder() with no validation, no audit event, no notification.
      // Route through editOrderItemsWorkflow which validates, persists, logs,
      // and notifies in a single coordinated path.
      const { editOrderItemsWorkflow } = await import('../../services/orderWorkflowService');
      const workflowResult = await editOrderItemsWorkflow(
        order.id || '',
        data.updatedItems,
        { email: 'admin', name: 'Admin', role: 'admin' as const /* caller hook lacks admin context here; UI passes via order edit modal */ },
        {
          deliveryFee: data.deliveryFee,
          discount: data.discount,
          discountNote: data.discountNote,
          discountType: data.discountType,
          updatedTotal: data.updatedTotal,
        } as any
      );

      if (!workflowResult || (workflowResult as any).success === false) {
        const msg = (workflowResult as any)?.error ?? 'Failed to edit order';
        showAlert({ title: 'Edit Failed', message: msg, icon: 'error' as const });
        throw new Error(msg);
      }

      await invalidateCache.orders();
      toast.success('Order updated successfully', { duration: 4000 });
      debug.log('✅ Order edited successfully');
    } catch (error) {
      debug.error('❌ Failed to edit order:', error);
      throw error;
    }
  }, [showAlert]);
  
  /**
   * Send payment reminder
   */
  const sendPaymentReminder = useCallback(async (
    order: Order
  ): Promise<void> => {
    try {
      debug.log('📧 Sending payment reminder for order:', order.id);
      
      const currentReminderCount = order.paymentReminderCount || 0;
      const newReminderCount = currentReminderCount + 1;
      
      // Send email — awaited so counter only increments on success
      // ✅ PASS 6: customerEmail may be undefined on legacy orders.
      if (!order.customerEmail) {
        throw new Error('Order has no customer email; cannot send reminder.');
      }
      try {
        await sendPaymentReminderEmail(order, order.customerEmail, newReminderCount);
      } catch (emailError) {
        throw new Error('Failed to send payment reminder email. Counter not updated.');
      }

      // Update order (only reached if email succeeded)
      await updateOrder(order.id, {
        paymentReminderCount: newReminderCount,
        lastReminderSentAt: getServerTimestamp() as any, // ✅ MAR 17: Fixed field name (was lastPaymentReminderSent, schema uses lastReminderSentAt)
      });
      
      // Send notification
      await notifyPaymentReminder(order, newReminderCount);
      
      await invalidateCache.orders();
      
 // Replaced alert with toast notification
      toast.success('✅ Reminder Sent', {
        description: `Payment reminder #${newReminderCount} sent to ${order.customerName}`,
        duration: 5000,
      });
      debug.log('✅ Payment reminder sent successfully');
    } catch (error) {
      debug.error('❌ Failed to send payment reminder:', error);
      showAlert({ title: 'Alert', message: (error as any).message || 'Failed to send payment reminder', icon: 'error' as const });
      throw error;
    }
  }, [showAlert]);
  
  /**
   * Approve an order
   *
   * FIX T2R1-F2 (CRITICAL): Was a raw Firestore status flip via updateOrder()
   * that bypassed:
   *   - the Cloud Function path (no atomic CF + audit + notification)
   *   - delivery-fee validation against settings (free-delivery threshold)
   *   - the customer notification (customer never knew their order was approved)
   *   - the audit-event logging (no record of who approved when)
   * Now delegates to approveOrderAction in orderActionService which is the
   * canonical workflow.  This is the same pattern the cancelOrder action uses
   * (line 78-150 above).
   */
  const approveOrder = useCallback(async (
    order: Order,
    adminUser: User
  ): Promise<void> => {
    try {
      debug.log('✅ Approving order:', order.id);

      const { approveOrderAction } = await import('../../services/orderActionService');
      const result = await approveOrderAction(order, {
        id: adminUser.id || '',
        email: adminUser.email ?? '',
        name: (adminUser as any).name ?? adminUser.email ?? 'Admin',
        storeName: (adminUser as any).storeName ?? '',
      });

      if (!result.success) {
        showAlert({
          title: 'Approval Failed',
          message: result.message ?? 'Failed to approve order',
          icon: 'error' as const,
        });
        throw new Error(result.error ?? 'approve failed');
      }

      await invalidateCache.orders();
      toast.success(`Order ${displayOrderNumber(order)} approved`, { duration: 4000 });
      debug.log('✅ Order approved successfully');
    } catch (error) {
      debug.error('❌ Failed to approve order:', error);
      // showAlert was already called above for service failures; re-throwing
      // here lets the caller (UI) react (e.g. close confirmation modal).
      throw error;
    }
  }, [showAlert]);
  
  /**
   * Reject an order (simple status update)
   * Note: For complex rejection workflow, use orderWorkflowService
   */
  const rejectOrder = useCallback(async (
    order: Order,
    reason: string,
    adminUser: User
  ): Promise<void> => {
    try {
      debug.log('❌ Rejecting order:', order.id);
      
      await updateOrder(order.id, {
        status: 'rejected',
        rejectionReason: reason,
        rejectedBy: (adminUser.email ?? ""),
        rejectedAt: getServerTimestamp() as any,
        updatedAt: getServerTimestamp() as any,
      });
      
      await invalidateCache.orders();

      toast.success(`Order ${displayOrderNumber(order)} rejected`, { duration: 4000 });
      debug.log('✅ Order rejected successfully');
    } catch (error) {
      debug.error('❌ Failed to reject order:', error);
      showAlert({ title: 'Alert', message: (error as any).message || 'Failed to reject order', icon: 'error' as const });
      throw error;
    }
  }, [showAlert]);
  
  /**
   * Migrate orders (background task - add missing fields)
   * ✅ MAR 17: Fixed bulkUpdateOrders call - uses { orderId, data } not { id, data }
   */
  const migrateOrders = useCallback(async (orders: Order[]): Promise<void> => {
    try {
      const ordersToUpdate = orders
        .filter(order => order.status === 'approved' && !order.approvedBy)
        .map(order => ({
          orderId: order.id || "", // ✅ Fixed: was `id`, bulkUpdateOrders expects `orderId`
          data: {
            approvedBy: (import.meta.env.VITE_ADMIN_EMAIL || 'admin@bakery.com'),
            approvedAt: order.updatedAt || order.createdAt,
          },
        }));
      
      if (ordersToUpdate.length > 0) {
        debug.log(
          `🔄 Migrating ${ordersToUpdate.length} orders with approvedBy field...`
        );
        await bulkUpdateOrders(ordersToUpdate);
        await invalidateCache.orders();
        debug.log(
          `✅ Successfully migrated ${ordersToUpdate.length} orders`
        );
      }
    } catch (error) {
      debug.error('❌ Failed to migrate orders:', error);
      // Don't show alert to user - this is a background migration
    }
  }, []);
  
  return {
    cancelOrder,
    completeOrder,
    editOrder,
    sendPaymentReminder,
    approveOrder,
    rejectOrder,
    migrateOrders,
  };
}