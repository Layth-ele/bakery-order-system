/**
 * 📦 Order Notifications - Domain Logic
 * 
 * ✅ DOMAIN LOGIC: Business logic for order-related notifications
 * ✅ CREATED: March 7, 2026 - Split from /services/orderNotificationService.ts
 * 
 * Order LIFECYCLE notifications (placed / approved / rejected / cancelled /
 * payment submitted / paid / completed) are NOT written here — the
 * onOrderLifecycle Cloud Function trigger writes them from the order
 * document (src/functions/src/lib/orderNotifications.ts). Do not add
 * client-side lifecycle notifications; they would duplicate the trigger's.
 *
 * PURPOSE:
 * - Admin-initiated notifications not tied to a status change
 *   (payment reminder, store credit, paid-order edit)
 * - Determines WHAT to notify and WHEN
 * - Delegates persistence to /services/notifications/
 * 
 * ARCHITECTURE:
 * - Domain logic lives here in /notifications/domain/
 * - Persistence delegated to /services/notifications/notificationPersistence
 * - Pure calculations in /services/calculators/
 * 
 * VERSION: 1.0.0 - Initial split from orderNotificationService
 */

import { Order } from '../../types';
import { displayOrderNumber } from '../../utils/displayId';
import { NOTIFICATION_TYPES } from '../../types/notification-contract';
import { createCustomerNotification } from '../../services/notifications/notificationPersistence';

// ============================================================================
// PAYMENT NOTIFICATIONS
// ============================================================================

/**
 * Send payment reminder to customer
 * 
 * Triggered by scheduled job or manual admin action.
 * Reminds customer to submit payment for approved order.
 * 
 * @param order - Order awaiting payment
 * @param reminderCount - Which reminder this is (1st, 2nd, etc.)
 */
export async function notifyPaymentReminder(order: Order, reminderCount: number): Promise<void> {
  const notificationId = `payment-reminder-${order.id}-${reminderCount}`;

  await createCustomerNotification(
    order.customerId,
    notificationId,
    NOTIFICATION_TYPES.PAYMENT_REMINDER,
    '⏰ Payment Reminder',
    `Friendly reminder: Payment for order ${displayOrderNumber(order)} (${order.weekRange}) is still pending.\n\nPlease submit your payment at your earliest convenience to ensure timely production.`,
    order.id,
    [
      {
        type: 'SUBMIT_PAYMENT',
        label: 'Submit Payment Now',
        payload: { orderId: order.id || "" }
      }
    ],
    {
      reminderCount,
    }
  );
}

// ============================================================================
// CREDIT NOTIFICATIONS
// ============================================================================

/**
 * Notify customer that they've been issued store credit
 * 
 * Triggered when admin manually adds credit to customer account.
 * May be for refund, promotion, or compensation.
 * 
 * @param customerId - Customer receiving credit
 * @param customerName - Customer display name
 * @param orderId - Related order ID (if applicable)
 * @param creditAmount - Amount of credit issued
 * @param reason - Reason for credit issuance
 */
export async function notifyCreditIssued(
  customerId: string,
  customerName: string,
  orderId: string,
  creditAmount: number,
  reason: string
): Promise<void> {
  const notificationId = `credit-issued-${orderId}`;

  await createCustomerNotification(
    customerId,
    notificationId,
    NOTIFICATION_TYPES.CREDIT_ISSUED,
    '💰 Store Credit Added',
    `You've been issued $${creditAmount.toFixed(2)} in store credit${reason ? `: ${reason}` : '.'}`,
    orderId,
    [
      {
        type: 'view_account',
        label: 'View Account',
      },
    ],
    {
      creditAmount,   // in metadata for backward compat
      reason,
      amount: creditAmount,       // ✅ top-level so notification.amount is correct
      customerId,                 // ✅ top-level so resolveCreditReceivedProps can find it
    }
  );
}

/**
 * Notify customer that their paid order has been edited by admin
 * 
 * Triggered when admin reduces quantities on a paid order.
 * Customer receives store credit for the reduction.
 * 
 * @param customerId - Customer ID
 * @param customerName - Customer display name
 * @param orderId - Order that was edited
 * @param weekRange - Week range for the order
 * @param creditAmount - Amount of credit issued
 * @param reason - Reason for the edit
 * @param itemsChanged - List of items that were changed
 */
export async function notifyOrderEdited(
  customerId: string,
  customerName: string,
  orderId: string,
  weekRange: string,
  creditAmount: number,
  reason: string,
  itemsChanged: Array<{
    productName: string;
    originalQuantity: number;
    newQuantity: number;
    quantityChange: number;
    priceChange: number;
  }>
): Promise<void> {
  const notificationId = `order-${orderId}-edited`;

  // Build items summary
  const itemsSummary = itemsChanged
    .map(item => `• ${item.productName}: ${item.originalQuantity} → ${item.newQuantity} (${item.quantityChange >= 0 ? '+' : ''}${item.quantityChange})`)
    .join('\n');

  await createCustomerNotification(
    customerId,
    notificationId,
    NOTIFICATION_TYPES.ORDER_EDITED,
    '✏️ Order Edited - Credit Issued',
    `Your order ${orderId} (${weekRange}) has been edited by admin.\n\nReason: ${reason}\n\nChanges:\n${itemsSummary}\n\n💰 Store Credit Issued: $${creditAmount.toFixed(2)}\n\nYour credit balance has been updated and can be used on future orders.`,
    orderId,
    [
      {
        type: 'VIEW_ORDER',
        label: 'View Order',
        payload: { orderId }
      },
      {
        type: 'view_account',
        label: 'View Credit Balance',
      }
    ],
    {
      creditAmount,
      reason,
      itemsChanged,
    }
  );
}
