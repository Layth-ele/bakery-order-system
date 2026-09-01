/**
 * Payment Actions Service
 *
 * Handles payment confirmation workflow for orders.
 * Extracted from orderActionService.ts to reduce its size.
 */
import { updateOrder } from '../data/ordersDataService';
import { invalidateCache } from '../../hooks/useCachedFirebase';
import { getServerTimestamp } from '../../utils/timestamps';
import { notifyPaymentConfirmed } from '../../notifications';
import type { Order } from '../../types';
import type { AdminInfo, OrderActionResult } from '../orderActionService';
import { Timestamp } from 'firebase/firestore';
import { logOrderEvent } from './orderAuditService';
import { ErrorSeverity } from '../../components/errors/ErrorLogger';
// FIX T2R4-H1 (HIGH): No longer importing `getAllCustomers as getCustomers`
// or top-level `getOrders` — both were used only for the fan-out reads we
// just replaced with direct customerId-keyed lookups inside the function.
import { updateCustomer } from '../customersService';
import { logger } from '../../utils/logger';


const DEBUG = false;

export async function confirmPaymentAction(
  order: Order,
  admin: AdminInfo
): Promise<OrderActionResult> {
  // ✅ PASS 2: Prefer Cloud Function path. Server enforces:
  //  - Status transition (approved → in_process)
  //  - Atomic update of paymentReceived/paidAt/status
  //  - Payment audit log entry
  //  - Customer notification
  //  - Customer totalSpent update
  // All in one server-side flow with proper auth checks.
  try {
    const { confirmOrderPaymentViaCloudFunction } = await import('../firebase/cloudFunctions');
    await confirmOrderPaymentViaCloudFunction({ orderId: order.id });
    await invalidateCache.orders();
    return {
      success: true,
      message: 'Payment confirmed successfully!',
      data: { orderId: order.id || '' },
    };
  } catch (cfError: any) {
    const isTransportError =
      cfError?.code === 'functions/internal' ||
      cfError?.code === 'functions/unavailable' ||
      cfError?.code === 'functions/deadline-exceeded' ||
      cfError?.code === 'functions/not-found';
    if (!isTransportError) {
      if (import.meta.env.DEV) console.error('[confirmPaymentAction] Cloud Function rejected:', cfError);
      return {
        success: false,
        error: cfError?.message ?? 'Unknown error',
        message: cfError?.message ?? 'Failed to confirm payment. Please try again.',
      };
    }
    logger.warn('⚠️ [confirmPaymentAction] Cloud Function unavailable, falling back to client logic');
    // Fall through to legacy
  }

  // ─── Legacy client-side path (fallback only) ──────────────────────────────
  // Capture original status for rollback on notification failure,
  // mirroring the pattern used by approveOrderAction / rejectOrderAction / cancelOrderAction.
  const originalStatus = order.status;
  const originalPaymentReceived = order.paymentReceived ?? false;

  try {
    // Update order status to in_process when payment is confirmed
    await updateOrder(order.id, {
      status: 'in_process' as const, // ✅ Move to "In Process" after payment confirmed
      paymentReceived: true,
      paidAt: getServerTimestamp() as any
    });

    // Log event
    const paidOrder = {
      ...order,
      status: 'in_process' as const, // ✅ Update local copy with correct status
      paymentReceived: true,
      paidAt: Timestamp.now() as any
    };
    logOrderEvent(paidOrder, 'payment', (admin.email ?? ""), `Payment confirmed by ${admin.email}`);

    // Update customer balance if applicable
    //
    // FIX T2R4-H1 (HIGH — fan-out reads + collision-prone email lookup):
    // Was reading the entire orders collection AND the entire customers
    // collection (`getOrders()` + `getCustomers()`) just to update one
    // customer's totalSpent — multi-megabyte download for a write that
    // only needs ONE customer's order history.  Plus the customer lookup
    // used `c.email === order.customerEmail` which fails if:
    //   - The customer changed their email after placing the order
    //   - Two customers share an email (rare but possible: shared family
    //     accounts pointing at the same household address)
    //
    // The canonical key is `customerId` (Firebase Auth UID), set on the
    // order at creation time and never mutated.  Now we look up the
    // customer by ID directly (single doc read), then read only THAT
    // customer's orders (Firestore-side filter via getOrdersByCustomer).
    // O(1) doc reads instead of O(N) collection scans.
    if (order.customerId) {
      try {
        const { getCustomerById: getCustomer } = await import('../customersService');
        const { getOrdersByCustomer } = await import('../data/ordersDataService');
        const customer = await getCustomer(order.customerId);
        if (customer) {
          const customerOrders = await getOrdersByCustomer(order.customerId);
          // ✅ FIX #18: Use amountDue (actual cash paid) not total (which may include un-paid credit amounts)
          // amountDue = total - creditApplied; fall back to total if not set
          const totalSpent = customerOrders
            .filter(o => o.paymentReceived)
            .reduce((sum, o) => {
              const credit = (o as any).creditApplied || 0;
              const paid = Math.max(0, o.total - credit);
              return sum + paid;
            }, 0);

          await updateCustomer({ id: customer.id, totalSpent } as any);
        }
      } catch (err) {
        // Non-fatal: payment is already confirmed; totalSpent update is
        // an analytics-only refresh and the canonical CF path
        // (confirmOrderPaymentViaCloudFunction) handles it server-side
        // when available.
        logger.warn('[confirmPaymentAction] Legacy totalSpent update failed:', err);
      }
    }

    // Invalidate cache
    await invalidateCache.orders();

    // FIX BUG 4 (HIGH): Wrap notification in try/catch with rollback.
    // Previously, if notifyPaymentConfirmed() threw, the order was left with
    // status:'in_process' and paymentReceived:true but the customer received no
    // notification — a partial state with no recovery path. Every other action
    // (approve, reject, cancel) has rollback logic for notification failures.
    // Payment confirmation now follows the same pattern.
    try {
      await notifyPaymentConfirmed(paidOrder);
    } catch (notificationError) {
      if (import.meta.env.DEV) console.error('[paymentActionService] Notification failed — rolling back:', notificationError);

      // Rollback: restore order to its pre-confirmation state
      await updateOrder(order.id, {
        status: originalStatus,
        paymentReceived: originalPaymentReceived,
        paidAt: undefined,
      } as any);
      await invalidateCache.orders();

      throw new Error(`Payment confirmed but notification failed: ${(notificationError as any).message}`);
    }

    return {
      success: true,
      message: 'Payment confirmed successfully!',
      data: { orderId: order.id || "" }
    };

  } catch (error) {
    if (import.meta.env.DEV) console.error('[paymentActionService]', error, {
      context: 'confirmPaymentAction',
      orderId: order.id || "",
      severity: ErrorSeverity.HIGH
    });
    
    return {
      success: false,
      error: (error as any).message || 'Unknown error',
      message: 'Failed to confirm payment. Please try again.'
    };
  }
}