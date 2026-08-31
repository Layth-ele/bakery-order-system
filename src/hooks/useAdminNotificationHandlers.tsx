/**
 * useAdminNotificationHandlers.tsx
 * ✅ PHASE 2 APPROVED: UI Coordination Layer (Acceptable Pattern)
 * 
 * PURPOSE:
 * - Coordinate notification UI interactions
 * - Handle modal opening for notification actions
 * - Manage toast notification state
 * - Delegate payment confirmation to service
 * 
 * STATUS: ✅ GOOD - Delegates to orderActionService, minimal business logic
 * 
 * RESPONSIBILITIES:
 * - ✅ Notification UI state
 * - ✅ Modal coordination
 * - ✅ Alert display
 * - ✅ Service delegation (confirmPaymentAction)
 */

import { useState, useCallback } from 'react';
import { useAlert } from '../contexts/AlertContext';
import { useModal } from '../contexts/ModalContextNew';
import { useAdminNotificationsSafe } from '../notifications/contexts'; // Direct import (Phase 3)
import { confirmPaymentAction, getAdminInfo } from '../services/orderActionService';
import type { NotificationItem } from '../types/notification-contract';
import type { User } from '../hooks/useAuth';
import type { Order } from '../types';

// Debug flag - only log in development
const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

interface UseAdminNotificationHandlersProps {
  user: User;
  allOrders: Order[];
}

export function useAdminNotificationHandlers({ user, allOrders }: UseAdminNotificationHandlersProps) {
  // Notification context for admin notifications
  const adminNotificationContext = useAdminNotificationsSafe();
  
  // Alert and modal hooks
  const { showAlert } = useAlert();
  const { openModal, closeModal } = useModal();
  
  // Toast notification state
  const [notification, setNotification] = useState<string>('');

  /**
   * Show a temporary toast notification
   * @param message - The message to display
   * @param duration - How long to show the message (default: 3000ms)
   */
  const showNotification = useCallback((message: string, duration: number = 3000) => {
    setNotification(message);
    setTimeout(() => setNotification(''), duration);
  }, []);

  /**
   * Clear the current toast notification
   */
  const clearNotification = useCallback(() => {
    setNotification('');
  }, []);

  /**
   * Handle payment confirmation from notification bell - V3 WORKFLOW
   * Uses confirmPayment() from notificationWorkflowsV3.ts
   * 
   * This handler:
   * 1. Validates the notification has an orderId
   * 2. Finds the order in allOrders
   * 3. Opens password confirmation modal
   * 4. On confirmation, calls confirmPaymentAction service
   * 5. Shows success/error alerts
   */
  const handleConfirmPaymentFromNotification = useCallback(async (notification: NotificationItem) => {
    // Get admin info
    const admin = getAdminInfo(user);
    const adminName = admin.storeName || admin.name || admin.email;

    // Find the order from allOrders
    const order = allOrders.find(o => o.id === (notification as any).orderId);
    const orderTotal = Number(order?.total || 0);

    // ✅ PASS 6: Bail early if the order isn't in the local cache — every
    // downstream branch needs `order` to be defined.
    if (!order) {
      showAlert({
        title: 'Order not found',
        message: `Order ${notification.orderId} is not in the current view; refresh and try again.`,
        icon: 'error',
      });
      return;
    }

    // Open password confirmation modal
    
    openModal(
      'AUTH_GUARD',
      {
        title: 'Confirm Payment Received',
        description: `${adminName} is confirming that payment has been received for Order #${notification.orderId}.`,
        actionLabel: 'Confirm Payment',
        onConfirm: async () => {

          try {
            // ✅ REFACTOR: Use centralized order action service
            // This handles:
            // - Update order status to in_process
            // - Update payment status to paid
            // - Send customer notification
            // - Create audit event
            // - Create invoice snapshot
            const result = await confirmPaymentAction(order, admin);

            if (!result.success) {
              throw new Error(result.message || 'Failed to confirm payment');
            }


            // Close the modal
            closeModal();

            // Show success message
            showAlert({
              title: '✅ Payment Confirmed',
              message:
                `Payment received in full.\n\n` +
                `Order: ${notification.orderId}\n` +
                `Customer: ${notification.data?.customerName || order.customerName}\n` +
                `Amount: $${orderTotal.toFixed(2)}\n\n` +
                `✓ Payment marked as received\n` +
                `✓ Customer has been notified\n` +
                `✓ Order moved to In Process\n\n` +
                `Thank you for confirming this payment!`,
              icon: 'success',
            });

          } catch (error) { // Removed 'any' type
            console.error('❌ Error confirming payment:', error);
            const errorMessage = error instanceof Error ? (error as any).message : 'Error confirming payment. Please try again.';
            showAlert({
              title: 'Error',
              message: errorMessage,
              icon: 'error',
            });
          }
        },

      },
      'sm'
    );
  }, [user, allOrders, showAlert, openModal, closeModal]);

  return {
    // State
    notification,
    adminNotificationContext,
    
    // Handlers
    showNotification,
    clearNotification,
    handleConfirmPaymentFromNotification,
  };
}