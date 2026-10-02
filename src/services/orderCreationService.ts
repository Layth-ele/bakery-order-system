/**
 * Customer order creation — runs ONLY on the server (placeOrder Cloud
 * Function). The browser sends what the customer chose; the server checks
 * the account and cutoff, prices everything from the live catalogue and
 * Settings (the same prices the order screen shows), assigns the order
 * number and applies store credit in one transaction. The subtotal / GST /
 * total in CreateOrderParams are for display only and are not sent.
 */
import { placeOrderViaCloudFunction, callableErrorMessage } from './firebase/cloudFunctions';
import { logger } from '../utils/logger';

export interface OrderCartItem {
  productId: string;
  productName: string;
  price: number;
  quantities: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  };
  total: number;
}

export interface CreateOrderParams {
  customer: {
    id: string;
    storeName: string;
    storeAddress?: string;
    address?: string;
    contactPerson?: string;
    email: string;          // required — used for customerEmail field
    phone?: string;
    // FIX C6: customerType must be in the interface so the price-lookup code
    // in createOrderClientSide can read it without an `as any` cast.
    // Previously missing, so (params.customer as any).customerType was always
    // undefined — every commercial customer was silently priced at retail rate.
    customerType?: 'commercial' | 'individual' | 'admin';
  };
  week: number;
  year: number;
  cartItems: OrderCartItem[];
  subtotal: number;
  gst: number;
  deliveryFee?: number;
  serviceCharge: number;
  total: number;
  note?: string;
  creditToApply?: number;
  /**
   * Stable id for this submission (reuse it when retrying) — the server makes
   * it the order's id, so a retry can never create a second order.
   */
  requestId: string;
}

export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  total?: number;
  creditApplied?: number;
  amountDue?: number;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A random id for one order submission (16+ url-safe characters). */
export function newOrderRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate cart items before order submission
 */
export function validateCartForOrder(
  cartItems: OrderCartItem[],
  subtotal: number
): { valid: boolean; error?: string } {
  if (!cartItems || cartItems.length === 0) {
    return { valid: false, error: 'Cart is empty. Please add items before submitting.' };
  }
  if (subtotal <= 0) {
    return { valid: false, error: 'Order subtotal must be greater than zero.' };
  }
  const hasQuantities = cartItems.some((item) => item.total > 0);
  if (!hasQuantities) {
    return { valid: false, error: 'No items have quantities. Please add quantities before submitting.' };
  }
  return { valid: true };
}

/** Place a customer order on the server. */
export async function createCustomerOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  try {
    const result = await placeOrderViaCloudFunction({
      requestId: params.requestId,
      week: params.week,
      year: params.year,
      items: params.cartItems.map((item) => ({ productId: item.productId, quantities: item.quantities })),
      note: params.note ?? '',
      creditToApply: params.creditToApply ?? 0,
    });
    logger.event('order.created', 'info', {
      orderId: result.orderId,
      total: result.total,
      creditApplied: result.creditApplied,
      duplicate: result.duplicate,
    });
    return {
      success: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total,
      creditApplied: result.creditApplied,
      amountDue: result.amountDue,
    };
  } catch (error) {
    return { success: false, error: callableErrorMessage(error, 'place your order') };
  }
}
