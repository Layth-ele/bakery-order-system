/**
 * Order Cloud Functions — HARDENED (Pass 1)
 *
 * Fixes from audit:
 *   - C3: Server now recalculates prices from products collection. Client-supplied
 *     subtotal/gst/total are validated against server-computed values; mismatch
 *     beyond rounding tolerance throws (and logs as suspicious_activity).
 *   - C4: Function now RETURNS { id } as documented.
 *   - Added: ownership check (customerId must match request.auth.uid unless admin).
 *   - Added: customer status check (must be approved).
 *   - Added: Zod-style runtime validation of items array.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getNextDailyId } from "./idGenerator";

const db = getFirestore();

// ─── Pricing tolerance ──────────────────────────────────────────────────────
// Allow up to 1 cent of drift between client and server total (legitimate
// floating-point differences from adding GST). Anything more is tampering.
const PRICE_TOLERANCE_CENTS = 1;

interface OrderItemInput {
  productId: string;
  quantity: number;
  // unitPrice from client is informational only; server recomputes from products.
  unitPrice?: number;
  // optional weekly breakdown for daily delivery scheduling
  daily?: Record<string, number>;
}

interface CreateOrderInput {
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItemInput[];
  subtotal: number;
  gst: number;
  total: number;
  status?: string;
  weekRange?: string;
  deliveryDays?: any[];
  orderNote?: string;
}

/**
 * Validate input shape and types defensively (no zod dep in CF runtime).
 */
function assertValidInput(data: any): asserts data is CreateOrderInput {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request body is required.");
  }
  if (typeof data.customerId !== "string" || !data.customerId) {
    throw new HttpsError("invalid-argument", "customerId is required.");
  }
  if (typeof data.customerName !== "string" || !data.customerName) {
    throw new HttpsError("invalid-argument", "customerName is required.");
  }
  if (typeof data.customerEmail !== "string" || !data.customerEmail) {
    throw new HttpsError("invalid-argument", "customerEmail is required.");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new HttpsError("invalid-argument", "items must be a non-empty array.");
  }
  if (typeof data.subtotal !== "number" || data.subtotal <= 0) {
    throw new HttpsError("invalid-argument", "subtotal must be a positive number.");
  }
  if (typeof data.total !== "number" || data.total <= 0) {
    throw new HttpsError("invalid-argument", "total must be a positive number.");
  }
  if (typeof data.gst !== "number" || data.gst < 0) {
    throw new HttpsError("invalid-argument", "gst must be a non-negative number.");
  }
  for (const item of data.items) {
    if (!item || typeof item !== "object") {
      throw new HttpsError("invalid-argument", "Each item must be an object.");
    }
    if (typeof item.productId !== "string" || !item.productId) {
      throw new HttpsError("invalid-argument", "Each item must have a productId.");
    }
    if (typeof item.quantity !== "number" || item.quantity <= 0 || !Number.isFinite(item.quantity)) {
      throw new HttpsError("invalid-argument", "Each item must have a positive quantity.");
    }
  }
}

/**
 * Look up the caller's customer profile (used for role check & price tier).
 */
async function getCallerProfile(uid: string) {
  const snap = await db.collection("customers").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Customer profile not found.");
  }
  return snap.data() as {
    customerType?: "admin" | "commercial" | "individual";
    status?: string;
  };
}

/**
 * Server-side recalculation of order totals.
 *
 * SECURITY: This is the authoritative source of truth for prices. Client values
 * are compared, NOT trusted.
 */
async function recalculateOrder(
  items: OrderItemInput[],
  customerType: "admin" | "commercial" | "individual",
  taxRate: number,
): Promise<{ subtotal: number; gst: number; total: number; resolvedItems: any[] }> {
  // Read products in parallel
  const productSnaps = await Promise.all(
    items.map(item => db.collection("products").doc(item.productId).get())
  );

  let subtotal = 0;
  const resolvedItems: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const snap = productSnaps[i];
    if (!snap.exists) {
      throw new HttpsError("not-found", `Product not found: ${item.productId}`);
    }
    const product = snap.data() as {
      name: string;
      retail: number;
      wholesale: number;
      cost: number;
      minQty?: number;
      // PASS 9 FIX: discount is a percentage (0-100) applied to retail/wholesale
      // on the customer side. Without including it here the server would
      // reject every discounted-product order as PRICE_TAMPERING_ATTEMPT.
      discount?: number;
    };

    // Pick price tier from customer type
    const basePrice = customerType === "commercial" ? product.wholesale : product.retail;
    if (typeof basePrice !== "number" || basePrice <= 0) {
      throw new HttpsError("internal", `Invalid price for product: ${item.productId}`);
    }

    // PASS 9 FIX: Apply percentage discount to mirror the client formula
    // (CustomerDashboardMain.calculatePrice). Discount must be a valid
    // percentage in [0, 100); anything else is treated as no discount.
    const rawDiscount = typeof product.discount === "number" ? product.discount : 0;
    const discountPct = rawDiscount > 0 && rawDiscount < 100 ? rawDiscount : 0;
    const unitPrice = discountPct > 0
      ? basePrice * (1 - discountPct / 100)
      : basePrice;

    // Enforce minimum quantity if set
    if (product.minQty && item.quantity < product.minQty) {
      throw new HttpsError(
        "invalid-argument",
        `Product ${product.name} requires minimum quantity of ${product.minQty}.`
      );
    }

    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;

    // FIX R5-S6-F4 / S6-F5 (CRITICAL): The CF was writing items in a custom shape
    // — unitPrice / lineTotal / quantity / daily — which does NOT match the
    // canonical orderItemSchema (price, monday..sunday, total).  Result:
    // every server-side-created order failed Zod validation on the next read,
    // got silently dropped by parseArrayPartial, and disappeared from admin
    // dashboards.  Now writes the schema-correct shape.
    //
    // The `daily` field on input is { mon: n, tue: n, ... } — convert to the
    // monday/tuesday/... keys the schema expects.  Sum daily into `total`.
    const daily = item.daily ?? {};
    const dayKey = (k: string): number => {
      const v = (daily as any)[k];
      return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
    };
    const monday = dayKey('monday') || dayKey('mon');
    const tuesday = dayKey('tuesday') || dayKey('tue');
    const wednesday = dayKey('wednesday') || dayKey('wed');
    const thursday = dayKey('thursday') || dayKey('thu');
    const friday = dayKey('friday') || dayKey('fri');
    const saturday = dayKey('saturday') || dayKey('sat');
    const sunday = dayKey('sunday') || dayKey('sun');
    const dailySum = monday + tuesday + wednesday + thursday + friday + saturday + sunday;
    // If caller provided no daily breakdown, treat the entire quantity as
    // delivered on Monday so the schema's "total === sum of days" invariant
    // holds.  Better-behaved clients should supply explicit per-day quantities.
    const totalQty = dailySum > 0 ? dailySum : item.quantity;
    const fillMonday = dailySum === 0 ? item.quantity : monday;

    resolvedItems.push({
      // Schema-required fields
      productId: item.productId,
      productName: product.name,
      price: unitPrice,
      monday: fillMonday,
      tuesday,
      wednesday,
      thursday,
      friday,
      saturday,
      sunday,
      total: totalQty,
      // Legacy convenience (kept for back-compat readers)
      quantity: totalQty,
      // Audit metadata — admin reports use these to show original list price
      // vs. what the customer paid.  Outside the canonical schema but tolerated
      // by Zod's default .strip() behavior (and useful for debugging).
      basePrice,
      discount: discountPct,
      lineTotal,
    });
  }

  // Round to 2 decimals
  subtotal = Math.round(subtotal * 100) / 100;
  const gst = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;

  return { subtotal, gst, total, resolvedItems };
}

/**
 * Read the GST/tax rate from settings, defaulting to 5% (Canadian GST baseline).
 *
 * PASS 10 FIX: Previously only checked `taxRate`. The admin Settings UI and
 * SystemSettings type write `gstRate`; `taxRate` is documented as a legacy
 * alias. Without this fallback, an admin updating gstRate in the UI would
 * have NO effect on this Cloud Function — it would silently keep using 5%
 * even though the client (post-Pass 10) reads gstRate first.
 *
 * Order of preference: gstRate → taxRate (legacy) → 0.05 fallback.
 */
async function getTaxRate(): Promise<number> {
  try {
    const snap = await db.collection("settings").doc("default").get();
    if (snap.exists) {
      const data = snap.data() as { gstRate?: number; taxRate?: number };
      for (const candidate of [data.gstRate, data.taxRate]) {
        if (typeof candidate === "number" && candidate >= 0 && candidate < 1) {
          return candidate;
        }
      }
    }
  } catch {
    // Fall through to default
  }
  return 0.05;
}

/**
 * Create order with server-generated sequential ID and server-computed totals.
 */
export const createOrderWithCustomId = onCall(async (request) => {
  // ── 1. Authentication ────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to create orders.");
  }
  const callerUid = request.auth.uid;

  // ── 2. Input validation ──────────────────────────────────────────────────
  assertValidInput(request.data);
  const data = request.data;

  // ── 3. Authorization & profile check ─────────────────────────────────────
  const profile = await getCallerProfile(callerUid);

  // FIX C3: Customers can only create orders for themselves.
  // Admins can create orders for any customer.
  const isAdmin = profile.customerType === "admin";
  if (!isAdmin && data.customerId !== callerUid) {
    throw new HttpsError(
      "permission-denied",
      "You can only create orders for your own account."
    );
  }
  if (!isAdmin && profile.status !== "approved") {
    throw new HttpsError(
      "permission-denied",
      "Your account must be approved before placing orders."
    );
  }

  // For admins acting on behalf of a customer, look up that customer's tier.
  let priceTier: "admin" | "commercial" | "individual" = profile.customerType ?? "individual";
  if (isAdmin && data.customerId !== callerUid) {
    const target = await db.collection("customers").doc(data.customerId).get();
    if (!target.exists) {
      throw new HttpsError("not-found", "Target customer not found.");
    }
    priceTier = (target.data() as any).customerType ?? "individual";
  }

  // ── 4. Server-side price recalculation ───────────────────────────────────
  const taxRate = await getTaxRate();
  const computed = await recalculateOrder(data.items, priceTier, taxRate);

  // FIX C3: Compare client-supplied totals against server-computed values.
  // Drift beyond tolerance is treated as tampering: reject and log.
  const subtotalDrift = Math.abs(computed.subtotal - data.subtotal) * 100;
  const totalDrift = Math.abs(computed.total - data.total) * 100;
  if (subtotalDrift > PRICE_TOLERANCE_CENTS || totalDrift > PRICE_TOLERANCE_CENTS) {
    // Log to security_alerts (admin-readable) for review
    try {
      await db.collection("security_alerts").add({
        type: "PRICE_TAMPERING_ATTEMPT",
        severity: "HIGH",
        callerUid,
        customerId: data.customerId,
        clientSubtotal: data.subtotal,
        serverSubtotal: computed.subtotal,
        clientTotal: data.total,
        serverTotal: computed.total,
        driftCents: { subtotal: subtotalDrift, total: totalDrift },
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch {
      // Non-fatal — still reject the order
    }
    throw new HttpsError(
      "failed-precondition",
      "Order totals do not match. Please refresh and try again."
    );
  }

  // ── 5. Generate sequential order ID ──────────────────────────────────────
  const orderId = await getNextDailyId("ORD");

  // ── 6. Create order document with SERVER-COMPUTED totals ─────────────────
  const orderRef = db.collection("orders").doc(orderId);

  await orderRef.set({
    id: orderId,
    orderNumber: orderId,
    customerId: data.customerId,
    customerName: data.customerName,
    customerEmail: data.customerEmail,

    // Items & pricing — using server-computed values, NOT client-supplied
    items: computed.resolvedItems,
    subtotal: computed.subtotal,
    gst: computed.gst,
    total: computed.total,

    // Status — always starts pending; admins approve via separate Cloud Function
    status: "pending",

    // Delivery
    weekRange: data.weekRange ?? "",
    deliveryDays: data.deliveryDays ?? [],

    // Optional
    orderNote: data.orderNote ?? "",

    // Audit
    createdBy: callerUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // FIX C4: Return the generated ID so callers don't have to scrape the doc.
  return {
    id: orderId,
    subtotal: computed.subtotal,
    gst: computed.gst,
    total: computed.total,
  };
});
