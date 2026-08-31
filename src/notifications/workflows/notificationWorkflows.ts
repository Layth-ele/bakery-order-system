/**
 * 🔔 Notification Workflows
 * 
 * ✅ DOMAIN LOGIC: High-level notification workflows for order operations
 * ✅ MIGRATED: March 7, 2026 from /services/notificationWorkflowsV3.ts
 * 
 * PURPOSE:
 * - Complete business logic for notification-triggering actions
 * - Coordinates between order updates and notifications
 * - Handles both Cloud Functions and service layer fallbacks
 * 
 * ARCHITECTURE:
 * - Domain behavior lives here in /notifications/workflows/
 * - Persistence delegated to /services/notifications/
 * - Pure calculations in /services/calculators/
 * 
 * VERSION: 3.2 - Fully migrated to V3.2 orderNotificationService
 * ✅ Writes to: notifications/user_{userId}/items (customer)
 * ✅ Writes to: notifications/admin/items (admin)
 * ✅ CANONICAL: Uses ordersDataService for all CRUD operations
 */

import type { Customer } from '../../types';
import { updateOrder } from '../../services/data/ordersDataService';
import { 
  notifyPaymentConfirmed,
  notifyPaymentSubmitted,
  notifyPaymentSubmittedTracking,
  updateCustomerNotification
} from '../domain/orderNotifications'; // ✅ PHASE 5: Updated to use consolidated domain logic
import { isFirebaseConfigured } from '../../firebase/config';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '../../firebase/config';
import {getCustomers, updateCustomer} from '../../services/dataService'
import { transformPaymentSubmittedToConfirmed } from '../transformations/notificationTransform';
import { getServerTimestamp } from '../../utils/timestamps';
import { createAndSaveInvoiceSnapshot } from '../../services/orders/invoiceSnapshotService';
import { invalidateCache } from '../../hooks/useCachedFirebase';
import { logger } from '../../utils/logger';


// Initialize Cloud Functions (lazy, non-fatal)
let functions: ReturnType<typeof getFunctions> | null = null;
try { functions = getFunctions(app); } catch { functions = null; }

const DEBUG = false;
let demoModeLogged = false;
function logDemoModeOnce() {
  if (!demoModeLogged) {
    demoModeLogged = true;
  }
}

/**
 * WORKFLOW 1: Submit Payment (Customer → Admin)
 * 
 * Customer submits payment proof/invoice number.
 * Creates admin notification to review payment.
 * 
 * Cloud Function (preferred): Atomic transaction via submitPaymentCF
 * - Updates order (paymentSubmitted=true, invoiceNumber, transferPassword)
 * - Creates admin notification
 * - All in one atomic transaction
 * 
 * FALLBACK: If Cloud Functions not configured OR fails, uses service layer:
 * 1. Update order with payment info
 * 2. Create admin notification
 * 3. Create invoice snapshot (for payment records)
 * 
 * @param orderId - Order to update
 * @param customerId - Customer submitting payment
 * @param invoiceNumber - Invoice/reference number
 * @param transferPassword - Transfer password (optional)
 * @returns Promise that resolves when complete
 */
export async function submitPaymentWorkflow(
  orderId: string,
  customerId: string,
  invoiceNumber: string,
  transferPassword?: string
): Promise<void> {
  // ✅ PASS 2: Try the new submitPaymentProof Cloud Function first.
  // This replaces the previously-referenced 'submitPaymentCF' which never existed
  // on the server side (the call always failed silently and fell back to service layer).
  if (isFirebaseConfigured && functions) {
    try {
      // The new server-side function performs:
      //   - Auth check (approved customer only)
      //   - Order ownership check (must be owner of the order)
      //   - Status check (must be approved)
      //   - Atomic update of payment fields
      //   - Admin notification (created with Admin SDK so it actually delivers)
      //   - Payment audit log entry
      const submitPaymentProofCF = httpsCallable(functions!, 'submitPaymentProof');
      await submitPaymentProofCF({
        orderId,
        // Map invoiceNumber -> paymentReference for the new function signature
        paymentMethod: 'etransfer',
        paymentReference: invoiceNumber,
        transferPassword: transferPassword || '',
      });

      // Invalidate cache
      await invalidateCache.orders();
      await invalidateCache.customerOrders(customerId);
      return;
    } catch (error: any) {
      // Only fall back on transport errors. Real business errors should propagate.
      const code = error?.code as string | undefined;
      const isTransportError =
        code === 'functions/internal' ||
        code === 'functions/unavailable' ||
        code === 'functions/deadline-exceeded' ||
        code === 'functions/not-found';
      if (!isTransportError) {
        // Real error from server (e.g. status check failed) — surface it
        throw error;
      }
      logger.warn('⚠️ submitPaymentProof Cloud Function unavailable, falling back to service layer:', error);
    }
  } else {
    logDemoModeOnce();
  }

  // FALLBACK: Service layer implementation
  // Step 1: Update order with payment info
  await updateOrder(orderId, {
    paymentSubmitted: true,
    invoiceNumber,
    transferPassword: transferPassword || '',
    paymentSubmittedAt: getServerTimestamp() as any,
  });

  // Step 2: Create admin notification
  // ⚠️ Non-critical: wrapped in try/catch because clients writing to admin notification
  // path will get a permission denied error (only Cloud Functions can do this).
  // The payment has already been saved in Step 1 — this must never block the customer.
  try {
    const { getOrder } = await import('../../services/data/ordersDataService');
    const order = await getOrder(orderId);

    if (order) {
      // Call with correct signature: (order, paymentProofUrl, paymentRef)
      await notifyPaymentSubmitted(order, '', invoiceNumber);
      
      // ✅ Add tracking notification for admin order management
      try {
        await notifyPaymentSubmittedTracking(order, '', invoiceNumber);
      } catch (trackingError) {
        logger.warn('⚠️ [submitPaymentWorkflow] Admin tracking notification failed (non-critical):', trackingError);
      }
    } else {
      logger.warn('⚠️ [submitPaymentWorkflow] Order not found for admin notification:', orderId);
    }
  } catch (error) {
    // Permission denied is expected when running from client (not Cloud Function)
    logger.warn('⚠️ [submitPaymentWorkflow] Admin notification skipped (non-critical):', (error as any)?.code || error);
  }

  // Step 3: Create invoice snapshot for payment records
  try {
    await createAndSaveInvoiceSnapshot(orderId);
  } catch (error) {
    console.error('⚠️ Failed to create invoice snapshot:', error);
    // Don't fail the whole workflow if snapshot fails
  }

  // Step 4: Invalidate cache
  await invalidateCache.orders();
  await invalidateCache.customerOrders(customerId);

}

/**
 * WORKFLOW 2: Confirm Payment (Admin → Customer)
 * 
 * Admin confirms payment was received.
 * Updates order and notifies customer.
 * 
 * Cloud Function (preferred): Atomic transaction via confirmPaymentCF
 * - Updates order (paymentReceived=true)
 * - Transforms admin notification (PAYMENT_SUBMITTED → PAYMENT_CONFIRMED_ADMIN)
 * - Creates customer notification (PAYMENT_CONFIRMED)
 * - All in one atomic transaction
 * 
 * FALLBACK: If Cloud Functions not configured OR fails, uses service layer:
 * 1. Update order payment status
 * 2. Transform admin notification (audit trail)
 * 3. Create customer notification
 * 4. Update customer balance/credit if applicable
 * 
 * @param orderId - Order to confirm
 * @param customerId - Customer who submitted payment
 * @param adminId - Admin confirming payment (for audit)
 * @param adminNotificationId - Notification ID to transform (for audit trail)
 * @returns Promise that resolves when complete
 */
export async function confirmPaymentWorkflow(
  orderId: string,
  customerId: string,
  adminId: string,
  adminNotificationId?: string
): Promise<void> {
  // Try Cloud Function first (if configured)
  if (isFirebaseConfigured && functions) {
    try {
      const confirmPaymentCF = httpsCallable(functions!, 'confirmPaymentCF');
      await confirmPaymentCF({
        orderId,
        adminNotificationId: adminNotificationId || '',
        adminId,
      });
      
      // Invalidate cache
      await invalidateCache.orders();
      await invalidateCache.customerOrders(customerId);
      return;
    } catch (error) {
      logger.warn('⚠️ Cloud Function failed, falling back to service layer:', error);
    }
  } else {
    logDemoModeOnce();
  }

  // FALLBACK: Service layer implementation
  // Step 1: Update order payment status
  await updateOrder(orderId, {
    paymentReceived: true,
    paymentReceivedAt: getServerTimestamp() as any,
  });

  // Step 2: Transform admin notification (audit trail)
  if (adminNotificationId) {
    try {
      await transformPaymentSubmittedToConfirmed(adminNotificationId, orderId, adminId);
    } catch (error) {
      console.error('⚠️ Failed to transform admin notification:', error);
      // Continue workflow even if transformation fails
    }
  }

  // Step 3: Create customer notification
 // CRITICAL FIX - Fetch full order and pass correct arguments
  const { getOrder } = await import('../../services/data/ordersDataService');
  const order = await getOrder(orderId);
  
  if (!order) {
    console.error('❌ [confirmPaymentWorkflow] Order not found after update:', orderId);
    throw new Error(`Order ${orderId} not found`);
  }
  
  // Call with correct signature: (order)
  await notifyPaymentConfirmed(order);

  // Step 4: Invalidate cache
  await invalidateCache.orders();
  await invalidateCache.customerOrders(customerId);

}

/**
 * WORKFLOW 3: Update Customer Notification
 * 
 * Generic workflow to update any customer notification.
 * Used for marking notifications as read, updating metadata, etc.
 * 
 * @param customerId - Customer ID
 * @param notificationId - Notification to update
 * @param updates - Fields to update
 * @returns Promise that resolves when complete
 */
export async function updateNotificationWorkflow(
  customerId: string,
  notificationId: string,
  updates: any
): Promise<void> {
  await updateCustomerNotification(customerId, notificationId, updates);

}

/**
 * WORKFLOW 4: Apply Credit to Order
 * 
 * When customer has available credit, apply it to reduce order balance.
 * This workflow ensures credit is properly tracked and notifications sent.
 * 
 * @param orderId - Order to apply credit to
 * @param customerId - Customer with credit
 * @param creditAmount - Amount of credit to apply
 * @returns Promise that resolves when complete
 */
export async function applyCreditToOrderWorkflow(
  orderId: string,
  customerId: string,
  creditAmount: number
): Promise<void> {
  // Step 1: Update order with credit applied
  await updateOrder(orderId, {
    creditApplied: creditAmount,
    creditAppliedAt: getServerTimestamp() as any,
  });

  // Step 2: Update customer's available credit
  const customers = await getCustomers();
  const customer = customers.find((c: Customer) => c.id === customerId);
  
  if (customer) {
    const newCreditBalance = (customer.availableCredit || 0) - creditAmount;
    await updateCustomer(customerId, {
      availableCredit: Math.max(0, newCreditBalance),
    });

  }

  // Step 3: Invalidate cache
  await invalidateCache.orders();
  await invalidateCache.customerOrders(customerId);

}

// Re-export for backward compatibility
export {
  submitPaymentWorkflow as submitPayment,
  confirmPaymentWorkflow as confirmPayment,
  updateNotificationWorkflow as updateNotification,
  applyCreditToOrderWorkflow as applyCreditToOrder,
};