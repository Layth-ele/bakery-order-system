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
 * - ❌ Order writes (all in Cloud Functions — services/firebase/cloudFunctions.ts)
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
import { cancelOrderAction } from '../../services/orderActionService'; // ✅ MAR 17: Fixed import (removed getAdminInfo)
import { completeOrderNow } from '../../services/orderCompletion/completeOrderNow';
import { describeEmailResult } from '../../services/emailService';
import { callableErrorMessage } from '../../services/firebase/cloudFunctions';
import { saveOrderEdit, type AdminOrderChanges } from '../../services/orders/orderEdits';
import { remindCustomerToPay } from '../../services/orders/paymentReminders';
import { toast } from 'sonner';
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

interface UseOrderActionsReturn {
  cancelOrder: (order: Order, data: CancelOrderData) => Promise<void>;
  completeOrder: (order: Order, adminUser: User) => Promise<void>;
  editOrder: (order: Order, changes: AdminOrderChanges) => Promise<void>;
  sendPaymentReminder: (order: Order) => Promise<void>;
  approveOrder: (order: Order, adminUser: User) => Promise<void>;
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
      debug.log('🚫 Cancelling order:', order.id);
      
      const result = await cancelOrderAction(
        order,
        admin,
        data.reason,
        undefined,
        data.cancellationFeePercentage ? parseFloat(data.cancellationFeePercentage) : undefined
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
   * Edit an unpaid (approved) order — the editOrder Cloud Function reprices
   * it and tells the customer the new amount due.
   */
  const editOrder = useCallback(async (
    order: Order,
    changes: AdminOrderChanges
  ): Promise<void> => {
    try {
      debug.log('📝 Editing order:', order.id);
      const result = await saveOrderEdit(order, changes);
      await invalidateCache.orders();
      const emailNote =
        result.email && result.email.state !== 'sent'
          ? ` The customer was notified in the app, but the email was not sent: ${describeEmailResult(result.email)}`
          : ' The customer has been notified.';
      toast.success('Order updated', {
        description: `New amount due: $${result.amountDue.toFixed(2)}.${emailNote}`,
        duration: 5000,
      });
    } catch (error) {
      debug.error('❌ Failed to edit order:', error);
      showAlert({ title: 'Edit Failed', message: callableErrorMessage(error, 'save the order changes'), icon: 'error' as const });
      throw error;
    }
  }, [showAlert]);
  
  /**
   * Send a payment reminder (sendPaymentReminder Cloud Function: in-app
   * notification + email, reminder count kept on the order).
   */
  const sendPaymentReminder = useCallback(async (
    order: Order
  ): Promise<void> => {
    try {
      await remindCustomerToPay(order);
      await invalidateCache.orders();
    } catch (error) {
      debug.error('❌ Failed to send payment reminder:', error);
      throw error;
    }
  }, []);
  
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
  
  
  return {
    cancelOrder,
    completeOrder,
    editOrder,
    sendPaymentReminder,
    approveOrder,
  };
}