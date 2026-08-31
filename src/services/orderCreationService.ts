import type { Order, OrderItem } from '../types';
import { addOrder, getOrder, deleteOrder } from './data/ordersDataService';
import { applyCreditToOrder } from './creditService';
import { notifyOrderPlacedTracking } from '../notifications';
import { generateOrderNumber, computeCheckDigit } from './idCounterService';
import { getAllProducts } from './data/productsDataService';
// PASS 10 FIX: Read GST rate from settings instead of hardcoding 0.05.
import { getSettings } from './data/settingsDataService';
// FIX BUG 5: Pre-generate a stable Firestore document ID before the retryable write.
// Using doc(collection(...)) gives us a random ID client-side without writing to Firestore.
import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logger } from '../utils/logger';

/**
 * PASS 10 FIX: Resolve the active GST/tax rate from system settings.
 *
 * Previously this file hardcoded `const GST_RATE = 0.05`. That created three
 * different sources of truth for the same value:
 *   - settings.gstRate (admin UI writes here)
 *   - settings.taxRate (legacy alias documented in SystemSettings)
 *   - 0.05 hardcoded in this file (and creditService.ts)
 *
 * Symptoms: an admin who lowers the rate via System Settings would see
 * customer orders priced with the old rate. Once the Pass 2 server-
 * authoritative order creation flips on, this drift would fail
 * `recalculateOrder`'s 1¢ tolerance and trip PRICE_TAMPERING_ATTEMPT alerts
 * on every order with a non-trivial subtotal.
 *
 * Fix: read settings, prefer `gstRate`, fall back to legacy `taxRate`, then
 * to the 0.05 baseline only if both are missing/invalid. Mirrors the same
 * helper added to `functions/src/orders.ts` so client and server agree.
 */
const FALLBACK_GST_RATE = 0.05;
async function resolveGstRate(): Promise<number> {
  try {
    const settings = await getSettings();
    const candidates = [settings.gstRate, settings.taxRate];
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c) && c >= 0 && c < 1) {
        return c;
      }
    }
  } catch (e) {
    logger.warn('[orderCreationService] Could not load settings for GST rate, using fallback:', e);
  }
  return FALLBACK_GST_RATE;
}

/**
 * Create order with CLIENT-SIDE ID generation
 * 
 * ✅ Works immediately (no deployment needed)
 * ✅ Format: ORD-1710172800000-x7k2m9p1q
 * ✅ Perfect for MVP/demos
 */
async function createOrderClientSide(params: CreateOrderParams): Promise<CreateOrderResult> {
  try {
    const weekRange = getWeekRange(params.week, params.year);

    // FIX C2: Fetch authoritative product prices from Firestore before building
    // order items.  The client-submitted `item.price` cannot be trusted — a
    // customer could intercept the request and set price: 0.01 for a $50 item.
    // The Firestore rule only validates subtotal > 0 and total ≥ subtotal, which
    // would still pass with a manipulated price.  We re-price every item here
    // using the server catalog and the customer's account type.
    let catalogProducts: Awaited<ReturnType<typeof getAllProducts>> = [];
    try {
      catalogProducts = await getAllProducts();
    } catch (e) {
      logger.warn('[orderCreationService] Could not load product catalog for price validation:', e);
      // If the catalog is unavailable we fail the order rather than trust
      // client-submitted prices.
      return {
        success: false,
        error: 'Could not load product catalog. Please try again.',
      };
    }

    const customerType: 'commercial' | 'individual' =
      params.customer.customerType === 'commercial' ? 'commercial' : 'individual';

    // Re-price items from catalog — throw if a product is no longer available
    const pricedCartItems = params.cartItems.map(item => {
      const product = catalogProducts.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Product ${item.productName} (${item.productId}) not found in catalog`);
      }
      const serverPrice: number =
        customerType === 'commercial'
          ? (product.wholesale ?? (product as any).price ?? 0)
          : (product.retail   ?? (product as any).price ?? 0);
      if (serverPrice <= 0) {
        throw new Error(`Product ${item.productName} has no valid price in catalog`);
      }
      return { ...item, price: serverPrice };
    });

    const orderItems = buildOrderItems(pricedCartItems);

    // ─── BUG 1 FIX (CRITICAL): Recalculate financials from server-authoritative prices ───
    // Previously params.subtotal / gst / total were client-submitted values that were
    // NEVER recalculated after server-side repricing. A price change between cart-fill and
    // submission, or a deliberate price manipulation, would persist undetected.
    // PASS 10: GST rate now comes from settings (was hardcoded 0.05).
    const gstRate = await resolveGstRate();
    const serverSubtotal = pricedCartItems.reduce((sum, item) => {
      const qty = Object.values(item.quantities).reduce((s, q) => s + q, 0);
      return sum + item.price * qty;
    }, 0);
    const serverGst = Math.round((serverSubtotal * gstRate + Number.EPSILON) * 100) / 100;
    const deliveryFee = params.deliveryFee ?? 0;
    const serviceCharge = params.serviceCharge ?? 0;
    const creditToApply = params.creditToApply ?? 0;
    const serverTotal = Math.max(
      0,
      Math.round((serverSubtotal + serverGst + deliveryFee + serviceCharge - creditToApply + Number.EPSILON) * 100) / 100,
    );
    // ─── End BUG 1 FIX ───────────────────────────────────────────────────────────────────

    // Build complete order object (without ID - addOrder will generate it)
    const orderData = {
      customerId: params.customer.id,
      customerCode: (params.customer as any).customerCode || undefined,
      customerName: (params.customer.storeName ?? ""),
      customerEmail: (params.customer.email ?? ""),
      // Use storeAddress OR address, fall back to a placeholder so schema passes
      customerAddress: params.customer.storeAddress || params.customer.address || 'Address not provided',
      customerContactPerson: params.customer.contactPerson || params.customer.storeName || "",
      customerPhone: params.customer.phone || "",

      // Week information
      week: params.week,
      year: params.year,
      weekRange,

      // Searchable metadata
      yearMonth: `${params.year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,

      // Items & pricing — ALL values are server-authoritative (BUG 1 FIX)
      items: orderItems,
      subtotal: serverSubtotal,   // ✅ recalculated from server prices
      gst: serverGst,             // ✅ recalculated from server subtotal
      deliveryFee,                // ✅ from params (set by admin rules)
      serviceCharge,
      serviceChargeWaived: false,
      total: serverTotal,         // ✅ recalculated — client total is ignored

      // Order status & lifecycle
      status: 'pending',
      note: params.note || '',
      
      // Order source tracking
      placedByCustomer: true,
      // ✅ PASS 6: Cast through `unknown` because the literal shape and
      // Omit<Order, 'id'> have non-overlapping optional fields. The runtime
      // shape is correct (it's exactly what addOrder() expects); the type
      // system can't see that the literal omits all the legacy optionals
      // Order declares.
    } as unknown as Omit<Order, 'id'>;

    // Assign human-readable order number from Firestore atomic counter
    // e.g. ORD-2026-03-26-001, grows to ORD-2026-03-26-1000 after 999
    try {
      (orderData as any).orderNumber = await generateOrderNumber();
    } catch (e) {
      logger.warn('Could not get order number from Firestore counter:', e);
      // FIX BUG 5 (MEDIUM): Previous fallback produced IDs without a MOD-97
      // check digit (making verifyId() return false for these orders) and used
      // Date.now().slice(-3) which collides when two orders are placed in the
      // same millisecond. Fixed: append a 4-char random hex suffix for
      // collision resistance, then compute and append the correct check digit
      // so downstream ID-validation code treats these IDs consistently.
      //
      // FIX T2R4-H3 (HIGH — predictable random in security-relevant ID):
      // Was Math.random().toString(16).slice(2, 5) for the random portion
      // of the fallback. Math.random() in V8 is reverse-engineerable, and
      // two near-simultaneous fallbacks could collide. Now uses
      // crypto.getRandomValues for a 3-char hex suffix.
      //
      // CAVEAT: This fallback ID does NOT participate in the daily counter
      // sequence. If the Firestore counter is consistently unavailable and
      // this branch fires often, the resulting orders will have non-
      // sequential numbers (a CRA-compliance concern at the invoice stage,
      // when these orders later become invoices). Treat the warn log above
      // as an alert: investigate the counter issue immediately. Do NOT
      // assume this fallback is "fine" because the IDs look valid.
      const d = new Date().toISOString().slice(0, 10);
      const buf = new Uint8Array(2);
      crypto.getRandomValues(buf);
      const hexSuffix = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 3);
      const seq = String(Date.now()).slice(-3).padStart(3, '0') + hexSuffix;
      const base = `ORD-${d}-${seq}`;
      (orderData as any).orderNumber = `${base}-${computeCheckDigit(base)}`;
    }
    // FIX BUG 5: Generate a stable Firestore document ID before the write.
    // addOrder(data, stableId) uses setDoc (idempotent) under the hood.
    // If the network drops after the Firestore write succeeds but before the
    // function returns, the retry re-calls setDoc with the same ID — which is
    // a no-op, not a duplicate insert.
    const stableOrderDocId = doc(collection(db!, 'orders')).id;
    const orderId = await addOrder(orderData, stableOrderDocId);

    // Fetch the created order to return full object
    const order = await getOrder(orderId);

    // ✅ Notify admin of new order — single notification only
    try {
      if (order) {
        await notifyOrderPlacedTracking(order);
      } else {
        logger.warn('⚠️ [orderCreationService] Order is null, skipping admin notification');
      }
    } catch (notifErr) {
      logger.warn('⚠️ Admin notification failed (non-fatal):', notifErr);
    }

    // FIX M1: Apply credit BEFORE returning success, and roll back the order
    // if it fails.  Previously, credit was applied after the order was committed
    // as a "non-fatal" step — if it failed the order existed without the
    // expected credit deduction, and the customer would be charged the full
    // amount despite the UI showing credit applied.
    // Now: if credit application fails we delete the just-created order and
    // return an error so the customer can retry cleanly.
    let creditApplied = 0;
    if (params.creditToApply && params.creditToApply > 0) {
      try {
        await applyCreditToOrder(orderId, params.customer.id, params.creditToApply);
        creditApplied = params.creditToApply;
      } catch (creditErr) {
        // PASS 11: Structured event — credit-rollback path. Critical for
        // financial audit: this is the path where an order is created but
        // credit application fails. The orphaned order is deleted below;
        // if THAT fails the orphan is logged separately so ops can manually
        // reconcile it from the security_alerts dashboard.
        logger.exception('order.credit.rollback', creditErr as Error, {
          orderId,
          customerId: params.customer.id,
          attemptedCredit: params.creditToApply,
        });
        // Attempt to delete the orphaned order document
        try {
          await deleteOrder(orderId);
        } catch (deleteErr) {
          logger.exception('order.credit.rollback_failed', deleteErr as Error, {
            orderId,
            customerId: params.customer.id,
            note: 'Order document is orphaned — manual cleanup required',
          });
        }
        return {
          success: false,
          error: creditErr instanceof Error
            ? creditErr.message
            : 'Failed to apply credit. Please try again.',
        };
      }
    }

    logger.event('order.created', 'info', {
      orderId,
      customerId: params.customer.id,
      total: serverTotal,
      creditApplied,
      itemCount: orderItems.length,
    });

    return {
      success: true,
      orderId,
      order,
      creditApplied,
    };
  } catch (error) {
    logger.exception('order.creation.failed', error as Error, {
      customerId: params.customer.id,
      week: params.week,
      year: params.year,
    });
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Failed to create order',
    };
  }
}
// ─── Types ────────────────────────────────────────────────────────────────────

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
}

export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  order?: Order | null;
  creditApplied?: number;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekRange(week: number, year: number): string {
  // Simple week range string: e.g. "Week 12, 2026"
  return `Week ${week}, ${year}`;
}

function buildOrderItems(cartItems: OrderCartItem[]): OrderItem[] {
  return cartItems.map((item) => {
    const q = item.quantities;
    // Always recompute total from quantities to satisfy schema validation
    const computedTotal =
      (q.monday || 0) + (q.tuesday || 0) + (q.wednesday || 0) +
      (q.thursday || 0) + (q.friday || 0) + (q.saturday || 0) + (q.sunday || 0);
    return {
      productId: item.productId,
      productName: item.productName,
      price: item.price,
      monday: q.monday || 0,
      tuesday: q.tuesday || 0,
      wednesday: q.wednesday || 0,
      thursday: q.thursday || 0,
      friday: q.friday || 0,
      saturday: q.saturday || 0,
      sunday: q.sunday || 0,
      total: computedTotal,
    };
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

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

/**
 * Main entry point for customer order creation.
 * Delegates to createOrderClientSide internally.
 */
export async function createCustomerOrder(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  return createOrderClientSide(params);
}
