/**
 * 🎯 useUnpaidOrderActions Hook
 * 
 * ✅ MAR 18, 2026: Fixed React 18 Suspense errors by wrapping openModal calls in startTransition
 * ✅ PHASE 1 APPROVED: Thin Service Wrapper (Acceptable Pattern)
 * 
 * PURPOSE:
 * - Provide unpaid order actions interface
 * - Handle UI modals and alerts
 * - Coordinate with payment services
 * 
 * STATUS: ✅ GOOD - Minimal business logic, delegates to services
 * 
 * USAGE:
 * ```typescript
 * const { 
 *   confirmPayment,
 *   sendReminder,
 *   cancelOrder,
 *   downloadOrder
 * } = useUnpaidOrderActions(user, products, categories);
 * 
 * await confirmPayment(order);
 * await sendReminder(order);
 * ```
 */

import { useCallback, useState, useRef, useEffect, startTransition } from 'react';
import { useAlert } from '../../contexts/AlertContext';
import { useModal } from '../../contexts/ModalContextNew';
import { updateOrder } from '../../services/data/ordersDataService';
import { toast } from 'sonner';
import { getAllCustomers } from '../../services/customersService';
import { cancelOrderAction, getAdminInfo } from '../../services/orderActionService';
import { notifyPaymentReminder } from '../../notifications';
import { sendPaymentReminderEmail } from '../../services/emailService';
// ✅ PASS 3: excelExport intentionally NOT imported at top — pulls in
// xlsx-js-style (~750KB). Dynamic import below at the call site.
import { serverTimestamp } from 'firebase/firestore';
import { debug } from '../../utils/debug';
import { invalidateCache } from '../useCachedFirebase'; // ✅ FIX: Add missing import
import type { Order, User, Product, Category } from '../../types';
import { displayOrderNumber, orderFilename } from '../../utils/displayId';
import { canConfirmPayment } from '../../utils/orderSelectors';

interface UseUnpaidOrderActionsReturn {
  /**
   * Confirm payment received for an order
   * Opens admin password modal for authentication
   */
  confirmPayment: (order: Order) => Promise<void>;
  
  /**
   * Send payment reminder (notification or email based on count)
   * - First 2 reminders: Notification reminders
   * - After 2: Email reminders
   */
  sendReminder: (order: Order) => Promise<void>;
  
  /**
   * Cancel an unpaid order with reason
   * Opens cancel order modal
   */
  cancelOrder: (order: Order) => void;
  
  /**
   * Download order as CSV
   */
  downloadOrder: (order: Order) => void;
  
  /**
   * Toast notification state
   */
  notification: string;
  
  /**
   * Clear toast notification
   */
  clearNotification: () => void;
}

/**
 * Hook for unpaid order business actions
 * 
 * @param user - Current admin user
 * @param products - Products list for CSV export
 * @param categories - Categories list for CSV export
 * @returns Object with unpaid order action functions
 * 
 * @example
 * ```typescript
 * const { 
 *   confirmPayment, 
 *   sendReminder, 
 *   cancelOrder,
 *   downloadOrder
 * } = useUnpaidOrderActions(user, products, categories);
 * 
 * // Confirm payment
 * await confirmPayment(order);
 * 
 * // Send reminder
 * await sendReminder(order);
 * 
 * // Cancel order
 * cancelOrder(order);
 * 
 * // Download CSV
 * downloadOrder(order);
 * ```
 */
export function useUnpaidOrderActions(
  user: User,
  products: Product[],
  categories: Category[]
): UseUnpaidOrderActionsReturn {
  const { showAlert } = useAlert();
  const { openModal, closeModal } = useModal();
  
  // Extract stable user properties
  const userId = user.id;
  const userEmail = user.email;
  const userName = user.name || user.email || 'Admin';
  
  // ✅ PERFORMANCE FIX MAR 12, 2026: Store products/categories in ref to avoid callback re-creation
  const productsRef = useRef(products);
  const categoriesRef = useRef(categories);
  const userRef = useRef(user);
  
  useEffect(() => {
    productsRef.current = products;
    categoriesRef.current = categories;
    userRef.current = user;
  }, [products, categories, user]);
  
  // State for toast notification
  const [notification, setNotification] = useState('');
  
  /**
   * Clear toast notification
   */
  const clearNotification = useCallback(() => {
    setNotification('');
  }, []);
  
  /**
   * Confirm payment received for an order
   * Requires admin password authentication
   */
  const confirmPayment = useCallback(
    async (order: Order): Promise<void> => {
      debug.log('🔍 [useUnpaidOrderActions] Confirming payment for order:', order.id);
      
      // Defensive check
      if (!order || !order.id) {
        debug.error('❌ [useUnpaidOrderActions] Invalid order:', order);
        showAlert({
          title: 'Error',
          message: 'Invalid order data. Please refresh and try again.',
          icon: 'error',
        });
        return;
      }

      if (!canConfirmPayment(order)) {
        showAlert({
          title: 'Action unavailable',
          message: 'Only approved orders with payment submitted can be confirmed.',
          icon: 'warning',
        });
        return;
      }
      
 // Wrap in startTransition to fix React 18 Suspense error
      startTransition(() => {
        // Require admin password authentication
        openModal('AUTH_GUARD', {
          title: 'Confirm Payment Received',
          description: `Confirm payment received for Order #${displayOrderNumber(order)} from ${order.customerName}.`,
          actionLabel: 'Confirm Payment',
          checklistItems: [
            {
              id: 'order-number',
              label: 'Order Number',
              value: displayOrderNumber(order),
              icon: 'order' as const,
            },
            {
              id: 'customer',
              label: 'Customer Name',
              value: order.customerName || 'Unknown',
              icon: 'customer' as const,
            },
            // FIX T2R1-F10 (HIGH — resolved by T2R6-C2): The admin needs
            // the e-transfer security answer (transferPassword) shown here
            // to verify the payment in their banking app. Originally this
            // was flagged because the field persisted on the order doc
            // indefinitely — a PIPEDA data-minimization concern. T2R6-C2
            // (in functions/src/orderActions.ts) and R5-S5-F16 (in
            // payments.ts) now delete `transferPassword` from the order
            // doc on terminal status transitions (payment confirmed,
            // cancelled, rejected). At THIS point in the flow, the field
            // is still on the doc (the order is unpaid/approved); the
            // admin reads it, confirms payment, and the deletion happens
            // server-side as part of confirmOrderPayment. This is the
            // correct lifecycle.
            ...(order.transferPassword ? [{
              id: 'transfer-password',
              label: 'E-Transfer Password',
              value: order.transferPassword,
              icon: 'password' as const,
            }] : []),
            ...(order.total ? [{
              id: 'amount',
              label: 'Amount to Confirm',
              value: `$${(order.amountDue || order.total).toFixed(2)}`,
              icon: 'amount' as const,
            }] : []),
          ],
          onConfirm: async () => {
            debug.log('✅ [useUnpaidOrderActions] Password verified - confirming payment');
            closeModal();
            
            try {
              const adminId = userId || userEmail || 'admin';
              const adminName = userName || userEmail || 'Admin';
              
              // Use orderActionService
              const { confirmPaymentAction } = await import('../../services/orderActionService');
              
              const adminInfo = {
                id: adminId,
                email: adminId,
                name: adminName,
                storeName: adminName,
              };
              
              // Call the canonical payment confirmation entry point
              await confirmPaymentAction(order, adminInfo);
              
              debug.log('✅ [useUnpaidOrderActions] Payment confirmed successfully');
              
              // Refresh data
              invalidateCache.orders();
              
              // ✅ Show toast notification after successful confirmation
              const { toast } = await import('sonner');
              toast.success('Payment confirmed successfully!');
            } catch (error) {
              debug.error('❌ [useUnpaidOrderActions] Failed to confirm payment:', error);
              showAlert({
                title: 'Error',
                message: 'Failed to confirm payment. Please try again.',
                icon: 'error',
              });
            }
          },
          onCancel: () => {
            debug.log('❌ [useUnpaidOrderActions] Payment confirmation cancelled');
            closeModal(); // ✅ Close the modal when user cancels
          },
        });
      });
    },
    [userId, userEmail, userName, openModal, closeModal, showAlert]
  );
  
  /**
   * Send payment reminder
   * - First 2 reminders: Notification reminders
   * - After 2: Email reminders
   */
  const sendReminder = useCallback(
    async (order: Order): Promise<void> => {
      const currentReminderCount = order.paymentReminderCount || 0;
      const currentEmailReminderCount = order.emailReminderCount || 0;
      
      // First 2 reminders: Notification reminders
      if (currentReminderCount < 2) {
        const reminderNumber = currentReminderCount + 1;
        
        showAlert({
          title: '🔔 Send Payment Reminder',
          message: `Send notification reminder #${reminderNumber} to ${order.customerName} for Order #${displayOrderNumber(order)}?\n\nAmount Due: $${order.total.toFixed(2)}\n\nThis is a notification reminder. After 2 notifications, the system will send email reminders.`,
          icon: 'info',
          confirmText: 'SEND REMINDER',
          cancelText: 'CANCEL',
          onConfirm: async () => {
            try {
              await updateOrder(order.id, {
                paymentReminderCount: reminderNumber,
                lastReminderSentAt: serverTimestamp() as any,
              });
              await notifyPaymentReminder(order, reminderNumber);
              
              // ✅ Invalidate cache to refresh UI with updated reminder count
              await invalidateCache.orders();
              
 // Replaced modal with toast notification
              toast.success('✅ Reminder Sent', {
                description: `Notification reminder #${reminderNumber} sent to ${order.customerName}. ${2 - reminderNumber} reminder(s) remaining before email.`,
                duration: 5000,
              });
            } catch (error) {
              debug.error('❌ [useUnpaidOrderActions] Failed to send payment reminder:', error);
              showAlert({
                title: 'Error',
                message: 'Failed to send payment reminder. Please try again.',
                icon: 'error',
              });
            }
          },
        });
      } else {
        // After 2 notifications: Email reminders
        const emailReminderNumber = currentEmailReminderCount + 1;
        
        showAlert({
          title: '📧 Send Email Reminder',
          message: `Send email reminder #${emailReminderNumber} to ${order.customerName} for Order #${displayOrderNumber(order)}?\n\nAmount Due: $${order.total.toFixed(2)}\n\nThe customer will receive a payment reminder email with order details and payment instructions.`,
          icon: 'warning',
          confirmText: 'SEND EMAIL',
          cancelText: 'CANCEL',
          onConfirm: async () => {
            try {
              // Get customer email
              const allCustomers = await getAllCustomers();
              const customer = allCustomers.find((c) => c.id === order.customerId);
              
              if (!customer || !(customer.email ?? "")) {
                showAlert({
                  title: 'Error',
                  message: 'Could not find customer email address.',
                  icon: 'error',
                });
                return;
              }
              
              await updateOrder(order.id, {
                emailReminderCount: emailReminderNumber,
                lastEmailReminderSentAt: serverTimestamp() as any,
              });
              await sendPaymentReminderEmail(order, (customer.email ?? ""), emailReminderNumber);
              await notifyPaymentReminder(order, emailReminderNumber);
              
              // ✅ Invalidate cache to refresh UI with updated reminder count
              await invalidateCache.orders();
              
 // Replaced modal with toast notification
              toast.success('✅ Email Sent!', {
                description: `Email reminder #${emailReminderNumber} sent to ${customer.email}. Customer should receive it shortly.`,
                duration: 5000,
              });
            } catch (error) {
              debug.error('❌ [useUnpaidOrderActions] Failed to send email reminder:', error);
              showAlert({
                title: 'Error',
                message: 'Failed to send email reminder. Please try again.',
                icon: 'error',
              });
            }
          },
        });
      }
    },
    [showAlert]
  );
  
  /**
   * Cancel an unpaid order
   * Opens cancel order modal for reason input
   */
  const cancelOrder = useCallback(
    (order: Order): void => {
      debug.log('❌ [useUnpaidOrderActions] Opening cancel order modal for:', order.id);
      
 // Wrap in startTransition to fix React 18 Suspense error
      startTransition(() => {
        openModal('CANCEL_ORDER', {
          order,
          products: productsRef.current,
          categories: categoriesRef.current,
          adminEmail: userEmail,
          onConfirm: async (reason: string, cancelledDays?: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>, cancellationData?: { cancellationFeePercentage: number; creditAmount: number }) => {
            try {
              const admin = getAdminInfo(userRef.current);
              
              // Extract credit details from cancellationData
              const creditAmount = cancellationData?.creditAmount;
              const cancellationFeePercentage = cancellationData?.cancellationFeePercentage;
              
              const result = await cancelOrderAction(
                order, 
                admin, 
                reason,
                cancelledDays,
                cancellationFeePercentage,
                creditAmount
              );
              
              if (result.success) {
                closeModal();
 // Use toast notification instead of modal
                toast.success('Order cancelled successfully', {
                  description: `Order ${displayOrderNumber(order)} cancelled — Reason: ${reason}. Customer notified.`,
                  duration: 5000,
                });
              } else {
                showAlert({
                  title: 'Error',
                  message: result.message || 'Failed to cancel order. Please try again.',
                  icon: 'error',
                });
              }
            } catch (error) {
              debug.error('❌ [useUnpaidOrderActions] Failed to cancel order:', error);
              showAlert({
                  title: 'Error',
                  message: 'Failed to cancel order. Please try again.',
                  icon: 'error',
              });
            }
          },
          onClose: closeModal,
        });
      });
    },
    [userEmail, openModal, closeModal, showAlert]
  );
  
  /**
   * Download order as CSV
   */
  const downloadOrder = useCallback(
    async (order: Order): Promise<void> => {
      debug.log('📥 [useUnpaidOrderActions] Downloading order:', order.id);

      // ✅ PASS 3: Dynamic import — xlsx-js-style only loaded on demand.
      const { exportOrderToExcel, downloadCSV } = await import('../../utils/excelExport');
      const csv = exportOrderToExcel(order, productsRef.current, categoriesRef.current);
      // ✅ PASS 6: Guard the Blob | undefined return.
      if (!csv) {
        showAlert({
          title: 'Empty order',
          message: 'This order has no items to export.',
          icon: 'warning',
        });
        return;
      }
      downloadCSV(
        csv,
        orderFilename(order, order.customerName, 'csv')
      );
      
      showAlert({
        title: 'Success',
        message: 'Order exported successfully',
        icon: 'success',
      });
    },
    [showAlert]
  );
  
  return {
    confirmPayment,
    sendReminder,
    cancelOrder,
    downloadOrder,
    notification,
    clearNotification,
  };
}