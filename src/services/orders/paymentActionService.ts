/**
 * Payment Actions Service
 *
 * Payment actions — each runs ONLY in its Cloud Function:
 *   submitPaymentAction   customer → submitPaymentProof
 *   confirmPaymentAction  admin    → confirmOrderPayment
 * The resulting notifications and emails come from the onOrderLifecycle
 * trigger.
 */
import { invalidateCache } from '../../hooks/useCachedFirebase';
import type { Order } from '../../types';
import type { AdminInfo, OrderActionResult } from '../orderActionService';
import {
  confirmOrderPaymentViaCloudFunction,
  submitPaymentProofViaCloudFunction,
  callableErrorMessage,
} from '../firebase/cloudFunctions';
import { logger } from '../../utils/logger';

/**
 * Confirm an order's payment (approved → in_process) — confirmOrderPayment
 * Cloud Function only.
 *
 * The server atomically sets paymentReceived / paidAt / status, writes the
 * payment audit log and updates the customer's totalSpent. The customer
 * notification + email, and resolving the admin's "payment submitted"
 * alert, come from the onOrderLifecycle trigger. No client-side fallback:
 * re-running a payment confirmation in the browser after a server error
 * could apply it twice.
 */
export async function confirmPaymentAction(
  order: Order,
  _admin: AdminInfo
): Promise<OrderActionResult> {
  try {
    await confirmOrderPaymentViaCloudFunction({ orderId: order.id });
    await invalidateCache.orders();
    return {
      success: true,
      message: 'Payment confirmed successfully!',
      data: { orderId: order.id || '' },
    };
  } catch (error) {
    const message = callableErrorMessage(error, 'confirm this payment');
    logger.warn('[confirmPaymentAction] Cloud Function failed:', error);
    return { success: false, error: message, message };
  }
}

/**
 * Customer submits their e-transfer reference/password for an approved
 * order (submitPaymentProof Cloud Function: auth, ownership and status
 * checks, atomic update, payment audit log). The admin's "payment
 * submitted" notification comes from the onOrderLifecycle trigger.
 *
 * No client-side fallback: the Firestore rules don't let customers write
 * these fields directly, and retrying in the browser could double-submit.
 *
 * @throws Error with a user-facing message when the submission fails
 */
export async function submitPaymentAction(
  orderId: string,
  customerId: string,
  paymentReference: string,
  transferPassword?: string
): Promise<void> {
  try {
    await submitPaymentProofViaCloudFunction({
      orderId,
      paymentMethod: 'etransfer',
      paymentReference,
      transferPassword: transferPassword || '',
    });
  } catch (error) {
    throw new Error(callableErrorMessage(error, 'submit your payment'));
  }
  await invalidateCache.orders();
  await invalidateCache.customerOrders(customerId);
}
