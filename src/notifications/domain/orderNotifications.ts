/**
 * 📦 Order Notifications - Domain Logic
 * 
 * ✅ DOMAIN LOGIC: Business logic for order-related notifications
 * ✅ CREATED: March 7, 2026 - Split from /services/orderNotificationService.ts
 * 
 * PURPOSE:
 * - High-level notification functions for order lifecycle events
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
import {
  createCustomerNotification,
  createAdminNotification,
  updateAdminNotification,
  deleteCustomerNotifications,
  updateCustomerNotification as updateCustomerNotificationPersistence,
} from '../../services/notifications/notificationPersistence';
import { logger } from '../../utils/logger';


const DEBUG = false;

// ============================================================================
// ORDER LIFECYCLE NOTIFICATIONS
// ============================================================================

/**
 * Notify customer that their order has been approved
 * 
 * Triggered when admin approves a pending order.
 * Customer needs to submit payment to proceed.
 * 
 * @param order - The approved order
 * @param total - Total amount to pay
 */
export async function notifyOrderApproved(order: Order, total: number): Promise<void> {
  const notificationId = `order-${order.id}-approved`;

  await createCustomerNotification(
    order.customerId,
    notificationId,
    NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED,
    '✅ Order Approved - Payment Required',
    `Your order ${displayOrderNumber(order)} (${order.weekRange}) has been approved!\n\nTotal Amount: $${total.toFixed(2)}\n\nPlease submit your payment to proceed with production.`,
    order.id,
    [
      {
        type: 'SUBMIT_PAYMENT',
        label: 'Submit Payment',
        payload: { orderId: order.id || "" }
      }
    ]
  );

}

/**
 * Notify customer that their order has been rejected
 * 
 * Triggered when admin rejects a pending order.
 * Customer should contact support or revise order.
 * 
 * @param order - The rejected order
 * @param reason - Reason for rejection
 */
export async function notifyOrderRejected(order: Order, reason: string): Promise<void> {
  const notificationId = `order-${order.id}-rejected`;

  await createCustomerNotification(
    order.customerId,
    notificationId,
    NOTIFICATION_TYPES.ORDER_REJECTED,
    '❌ Order Rejected',
    `Your order ${displayOrderNumber(order)} (${order.weekRange}) has been rejected.\n\nReason: ${reason}\n\nPlease contact us if you have any questions.`,
    order.id,
    [
      {
        type: 'VIEW_ORDER',
        label: 'View Details',
        payload: { orderId: order.id || "" }
      }
    ]
  );
}

/**
 * Notify customer that their order has been cancelled
 * 
 * Triggered when admin cancels an order (at any stage).
 * May include refund information.
 * 
 * @param order - The cancelled order
 * @param reason - Reason for cancellation
 */
export async function notifyOrderCancelled(order: Order, reason: string): Promise<void> {
  const notificationId = `order-${order.id}-cancelled`;

  await createCustomerNotification(
    order.customerId,
    notificationId,
    NOTIFICATION_TYPES.ORDER_CANCELLED,
    '🚫 Order Cancelled',
    `Your order ${displayOrderNumber(order)} (${order.weekRange}) has been cancelled.\n\nReason: ${reason}\n\nPlease contact us if you have any questions.`,
    order.id,
    [
      {
        type: 'VIEW_ORDER',
        label: 'View Details',
        payload: { orderId: order.id || "" }
      }
    ]
  );
}

/**
 * Notify customer that their order has been completed
 * 
 * Triggered when order auto-completes on Friday or manually completed.
 * Deletes "in production" notification and creates completion notification.
 * 
 * @param order - The completed order
 * @param invoiceId - Final invoice ID for customer
 */
export async function notifyOrderAutoCompleted(order: Order, invoiceId: string): Promise<void> {
  // 1. Delete old "in production" notification
  await deleteCustomerNotifications(order.customerId, {
    orderId: order.id || "",
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
  });

  // 2. Create completion notification
  const notificationId = `order-${order.id}-completed`;

  await createCustomerNotification(
    order.customerId,
    notificationId,
    NOTIFICATION_TYPES.ORDER_COMPLETED,
    '✅ Order Complete - Invoice Available',
    `Your order ${displayOrderNumber(order)} (${order.weekRange}) has been completed!\n\n✓ All items prepared and delivered\n✓ Final invoice is ready for review\n\nThank you for your business!`,
    order.id,
    [
      {
        type: 'VIEW_INVOICE',
        label: 'View Invoice',
        payload: { orderId: order.id || "", invoiceId }
      }
    ],
    {
      invoiceId,
    }
  );
}

// ============================================================================
// PAYMENT NOTIFICATIONS
// ============================================================================

/**
 * Notify admin that customer has submitted payment proof
 * 
 * Triggered when customer uploads payment proof and reference.
 * Admin needs to review and confirm payment.
 * 
 * @param order - Order with submitted payment
 * @param paymentProofUrl - URL to payment proof image
 * @param paymentRef - Payment reference number
 */
export async function notifyPaymentSubmitted(
  order: Order,
  paymentProofUrl: string,
  paymentRef: string
): Promise<void> {
  const notificationId = `payment-${order.id}-submitted`;


  await createAdminNotification(
    notificationId,
    NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
    '💰 Payment Submitted - Review Required',
    `${order.customerName} submitted payment for order ${displayOrderNumber(order)} (${order.weekRange}).\n\nReference: ${paymentRef}\n\nPlease review and confirm payment.`,
    order.id,
    [
      {
        type: 'CONFIRM_PAYMENT',
        label: 'Confirm Payment',
        payload: {
          orderId: order.id || "",
          paymentProofUrl,
          paymentRef,
        }
      }
    ],
    {
      paymentProofUrl,
      paymentRef,
      customerName: order.customerName,
    }
  );
}

/**
 * Notify customer that payment has been confirmed
 * 
 * Triggered when admin confirms payment received.
 * Also transforms admin notification from "review required" to "confirmed".
 * 
 * @param order - Order with confirmed payment
 */
export async function notifyPaymentConfirmed(order: Order): Promise<void> {
  const notificationId = `payment-${order.id}-confirmed`;

  // 1. Notify Customer
  await createCustomerNotification(
    order.customerId,
    notificationId,
    NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    '🎉 Payment Confirmed - Order in Production',
    `Your payment for order ${displayOrderNumber(order)} (${order.weekRange}) has been confirmed!\n\n✓ Payment received in full\n✓ Order is now in production\n✓ Your items are being prepared by our bakery team\n\nThank you for your business!`,
    order.id,
    [
      {
        type: 'VIEW_ORDER',
        label: 'View Production Status',
        payload: { orderId: order.id || "" }
      }
    ]
  );

  // 2. Transform Admin Notification (Instead of deleting)
  // This satisfies the requirement: "the alert should listen to the action and change from Payment Proof Submitted to invoice details"
  const adminNotificationId = `payment-${order.id}-submitted`;
  await updateAdminNotification(adminNotificationId, {
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN,
    title: '✅ Payment Confirmed - Order in Production',
    message: `${order.customerName}'s payment for order ${displayOrderNumber(order)} has been confirmed. Order is now in production.`,
    actions: [
      {
        type: 'VIEW_ORDER',
        label: 'View Order',
        payload: { orderId: order.id || "" }
      }
    ]
  });
}

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

// ============================================================================
// NOTIFICATION UPDATES
// ============================================================================

/**
 * Update an existing customer notification
 * 
 * Generic utility for updating notification metadata.
 * Used to mark notifications as read, transform them, etc.
 * 
 * @param customerId - Customer who owns the notification
 * @param notificationId - Notification to update
 * @param updates - Fields to update
 */
export async function updateCustomerNotification(
  customerId: string,
  notificationId: string,
  updates: Partial<{
    type: string;
    title: string;
    message: string;
    actions: Array<{ type: string; label: string; payload?: any }>;
    read: boolean;
  }>
): Promise<void> {
  await updateCustomerNotificationPersistence(customerId, notificationId, updates);

}

// ============================================================================
// TRACKING NOTIFICATIONS (Admin Order Tracking)
// ============================================================================

/**
 * Notify admin when order is placed - tracking focused
 * 
 * Triggered when customer places a new order.
 * Provides admin with direct access to track and manage the order.
 * 
 * @param order - The newly placed order
 */
export async function notifyOrderPlacedTracking(order: Order): Promise<void> {
  logger.log('🔔 [notifyOrderPlacedTracking] Called with order:', order.id, order.orderNumber);
  const notificationId = `order-${order.id}-placed-tracking`;

  await createAdminNotification(
    notificationId,
    NOTIFICATION_TYPES.ORDER_PLACED_TRACKING,
    '📦 Order Placed - Track Now',
    `New order ${displayOrderNumber(order)} placed by ${order.customerName}. Ready for processing.`,
    order.id,
    [
      {
        type: 'VIEW_ORDER',
        label: 'Track Order',
        payload: { orderId: order.id || "" }
      }
    ],
    {
      customerId: order.customerId,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      weekRange: order.weekRange,
      total: order.total,
      status: order.status,
    }
  );
  logger.log('✅ [notifyOrderPlacedTracking] Notification created successfully');
}

/**
 * Notify admin when payment is submitted - tracking focused
 * 
 * Triggered when customer submits payment proof.
 * Provides admin with direct access to track payment processing.
 * 
 * @param order - The order for which payment was submitted
 * @param paymentProofUrl - URL to payment proof
 * @param invoiceNumber - Invoice/reference number
 */
export async function notifyPaymentSubmittedTracking(
  order: Order,
  paymentProofUrl: string,
  invoiceNumber: string
): Promise<void> {
  logger.log('🔔 [notifyPaymentSubmittedTracking] Called with order:', order.id, order.orderNumber);
  const notificationId = `order-${order.id}-payment-tracking`;

  await createAdminNotification(
    notificationId,
    NOTIFICATION_TYPES.PAYMENT_SUBMITTED_TRACKING,
    '💳 Payment Submitted - Process Now',
    `Payment proof received for order ${displayOrderNumber(order)} from ${order.customerName}. Ready for verification.`,
    order.id,
    [
      {
        type: 'VIEW_PAYMENT_PROOF',
        label: 'Review Payment',
        payload: { orderId: order.id || "" }
      }
    ],
    {
      customerId: order.customerId,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      paymentProofUrl,
      invoiceNumber,
      amount: order.total,
      weekRange: order.weekRange,
    }
  );
}

// ============================================================================
// LEGACY EXPORTS (Backward Compatibility)
// ============================================================================

// Re-export with original function names for backward compatibility
export {
  notifyOrderApproved as notifyOrderApprovedV3,
  notifyPaymentSubmitted as notifyPaymentSubmittedV3,
  notifyPaymentConfirmed as notifyPaymentConfirmedV3,
};