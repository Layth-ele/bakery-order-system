/**
 * Complete an order — runs ONLY on the server (completeOrder Cloud Function).
 *
 * The server sets the order to completed + locked, assigns the sequential
 * invoice number, writes invoices/{orderId} and the completion snapshot in
 * a single transaction, so nothing is half-written and no invoice number is
 * skipped. The customer's "order complete" notification and email come from
 * the onOrderLifecycle trigger.
 *
 * Paid orders also complete automatically every Friday at 12:05 Vancouver
 * (autoCompleteOrders schedule) once their delivery week has closed.
 */
import type { Order } from '../../types';
import { invalidateCache } from '../../hooks/useCachedFirebase';
import { completeOrderViaCloudFunction, callableErrorMessage } from '../firebase/cloudFunctions';

export interface CompleteOrderResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}

export interface CompleteOrderOptions {
  /** Who is completing (kept for call-site compatibility; the server records the signed-in admin). */
  actor: string;
}

export async function completeOrderNow(order: Order, _options?: CompleteOrderOptions): Promise<CompleteOrderResult> {
  if (!order?.id) return { success: false, error: 'Invalid order: missing order ID' };
  try {
    const result = await completeOrderViaCloudFunction({ orderId: order.id });
    await invalidateCache.orders();
    return { success: true, invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber };
  } catch (error) {
    return { success: false, error: callableErrorMessage(error, 'complete this order') };
  }
}
