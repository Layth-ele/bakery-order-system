/**
 * Shared helpers for Cloud Functions — Pass 2
 *
 * Reused across order-action / credit / payment Cloud Functions.
 * Centralizes: caller authorization, profile lookup, order ownership checks,
 * and immutable audit log writing.
 */

import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CallerProfile {
  uid: string;
  email: string;
  customerType: "admin" | "commercial" | "individual";
  status: string;
  storeName?: string;
  isAdmin: boolean;
  isApprovedCustomer: boolean;
}

export interface OrderDoc {
  id: string;
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  status: string;
  subtotal: number;
  gst: number;
  total: number;
  deliveryFee?: number;
  serviceCharge?: number;
  serviceChargeWaived?: boolean;
  discount?: number;
  discountPercentage?: number;
  creditApplied?: number;
  amountDue?: number;
  paymentReceived?: boolean;
  paymentSubmitted?: boolean;
  paymentMethod?: string;
  paymentReference?: string;
  invoiceNumber?: string;
  paidAt?: any;
  approvedAt?: any;
  approvedBy?: string;
  rejectedAt?: any;
  rejectedBy?: string;
  rejectionReason?: string;
  cancelledAt?: any;
  cancelledBy?: string;
  cancellationReason?: string;
  items?: any[];
  [k: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authorization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the caller's profile and require auth. Throws HttpsError on failure.
 */
export async function requireAuth(
  request: CallableRequest<unknown>
): Promise<CallerProfile> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const uid = request.auth.uid;
  const snap = await db.collection("customers").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "User profile not found.");
  }
  const data = snap.data() as Partial<CallerProfile>;
  const customerType = (data.customerType ?? "individual") as CallerProfile["customerType"];
  const status = data.status ?? "pending";
  return {
    uid,
    email: (request.auth.token as any)?.email ?? data.email ?? "",
    customerType,
    status,
    storeName: data.storeName,
    isAdmin: customerType === "admin",
    isApprovedCustomer: customerType !== "admin" && status === "approved",
  };
}

/** Require the caller to be an admin. */
export async function requireAdmin(
  request: CallableRequest<unknown>
): Promise<CallerProfile> {
  const caller = await requireAuth(request);
  if (!caller.isAdmin) {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
  return caller;
}

/** Require the caller to be an approved customer (not admin, not pending). */
export async function requireApprovedCustomer(
  request: CallableRequest<unknown>
): Promise<CallerProfile> {
  const caller = await requireAuth(request);
  if (!caller.isApprovedCustomer) {
    throw new HttpsError(
      "permission-denied",
      "Your account must be approved before you can take this action."
    );
  }
  return caller;
}

// ─────────────────────────────────────────────────────────────────────────────
// Order helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load an order or throw 404. If `requireOwner` is true and the caller is not
 * an admin, also verifies the caller owns the order.
 */
export async function loadOrder(
  orderId: string,
  caller: CallerProfile,
  options: { requireOwner?: boolean } = {}
): Promise<{ ref: FirebaseFirestore.DocumentReference; data: OrderDoc }> {
  if (!orderId || typeof orderId !== "string") {
    throw new HttpsError("invalid-argument", "Order ID is required.");
  }
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `Order ${orderId} not found.`);
  }
  const data = { id: snap.id, ...(snap.data() ?? {}) } as OrderDoc;
  if (options.requireOwner && !caller.isAdmin && data.customerId !== caller.uid) {
    throw new HttpsError("permission-denied", "You do not own this order.");
  }
  return { ref, data };
}

/**
 * Allowed status transitions. Server is the single source of truth.
 *
 * pending     → approved | rejected | cancelled
 * approved    → in_process | cancelled                 (customer can submit payment proof at this stage)
 * in_process  → delivered | cancelled                  (admin moves orders forward)
 * delivered   → completed | cancelled
 * completed   → (terminal)
 * rejected    → (terminal)
 * cancelled   → (terminal)
 */
const ALLOWED_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  pending: ["approved", "rejected", "cancelled"],
  approved: ["in_process", "cancelled"],
  in_process: ["delivered", "cancelled"],
  delivered: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function assertTransitionAllowed(from: string, to: string) {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HttpsError(
      "failed-precondition",
      `Cannot transition order from "${from}" to "${to}".`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append an entry to an immutable audit collection. Audit collections have
 * `update, delete: if false` rules so this is the only legitimate writer (via
 * Admin SDK).
 */
export async function appendAuditLog(params: {
  collection: "auditLogs" | "statusChangeAudits" | "payment_audit_logs";
  payload: Record<string, unknown>;
}): Promise<void> {
  await db.collection(params.collection).add({
    ...params.payload,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Record a status change in the statusChangeAudits collection.
 */
export async function logStatusChange(params: {
  orderId: string;
  fromStatus: string;
  toStatus: string;
  actorUid: string;
  actorEmail: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await appendAuditLog({
    collection: "statusChangeAudits",
    payload: {
      orderId: params.orderId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      reason: params.reason ?? null,
      metadata: params.metadata ?? {},
      timestamp: FieldValue.serverTimestamp(),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification helpers (server-side admin notifications)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an admin notification (server-side, uses Admin SDK so rules don't apply).
 * Used to replace dead client-side calls that failed because the caller was
 * unauthenticated (post-signOut) or unapproved (status: 'pending').
 */
export async function createAdminNotificationServer(params: {
  notifId: string;
  type: string;
  title: string;
  message: string;
  orderId?: string;
  actions?: Array<{ type: string; label: string; payload?: any }>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db
      .collection("notifications")
      .doc("admin")
      .collection("items")
      .doc(params.notifId)
      .set({
        id: params.notifId,
        type: params.type,
        title: params.title,
        message: params.message,
        orderId: params.orderId ?? "",
        actions: params.actions ?? [],
        metadata: params.metadata ?? {},
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        timestamp: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.warn("[createAdminNotificationServer] Failed:", err);
    // Non-fatal — caller's primary action should still succeed
  }
}

/**
 * Create a customer notification (server-side).
 */
export async function createCustomerNotificationServer(params: {
  customerId: string;
  notifId: string;
  type: string;
  title: string;
  message: string;
  orderId?: string;
  actions?: Array<{ type: string; label: string; payload?: any }>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db
      .collection("notifications")
      .doc(`user_${params.customerId}`)
      .collection("items")
      .doc(params.notifId)
      .set({
        id: params.notifId,
        type: params.type,
        title: params.title,
        message: params.message,
        orderId: params.orderId ?? "",
        actions: params.actions ?? [],
        metadata: params.metadata ?? {},
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        timestamp: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.warn("[createCustomerNotificationServer] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

let _cachedTaxRate: { value: number; fetchedAt: number } | null = null;
let _cachedFreeDeliveryMin: { value: number; fetchedAt: number } | null = null;
// FIX T2R6-H2 (HIGH — settings staleness on warm CF instances):
// Was 60_000ms (1 minute). When admin updated the tax rate in Settings,
// warm Cloud Function instances continued using the old rate for up to a
// full minute. Orders created during that window applied the wrong tax.
// Reducing to 10s cuts the drift window 6× while still absorbing the
// burst-read pattern (CFs typically receive batches of related calls
// within a few seconds — the cache still de-duplicates those).
//
// A future settings-change Firestore trigger can call
// `invalidateTaxRateCache()` (exported below) to drop the cache to zero
// and pick up the new rate on the next CF invocation. That's the
// "gold-standard" fix; this TTL reduction is the safe interim.
const TAX_RATE_TTL_MS = 10_000;

/**
 * Read GST/tax rate from settings, defaulting to 5%. Cached to avoid hammering
 * Firestore on every order action.
 */
export async function getTaxRate(): Promise<number> {
  if (_cachedTaxRate && Date.now() - _cachedTaxRate.fetchedAt < TAX_RATE_TTL_MS) {
    return _cachedTaxRate.value;
  }
  let value = 0.05;
  try {
    const snap = await db.collection("settings").doc("default").get();
    if (snap.exists) {
      const taxRate = (snap.data() as any)?.taxRate;
      if (typeof taxRate === "number" && taxRate >= 0 && taxRate < 1) {
        value = taxRate;
      }
    }
  } catch {
    // fall back to default
  }
  _cachedTaxRate = { value, fetchedAt: Date.now() };
  return value;
}

/**
 * Drop the cached tax rate so the next call re-reads from Firestore.
 *
 * FIX T2R6-H2: Exported for use by a future settings-change Firestore
 * trigger (onUpdate /settings/default → invalidateTaxRateCache()).  Until
 * that trigger is wired up, the 10-second TTL above is the bound on
 * staleness.
 */
export function invalidateTaxRateCache(): void {
  _cachedTaxRate = null;
  _cachedFreeDeliveryMin = null;
}

/**
 * Read free-delivery threshold from settings, defaulting to 250.
 */
export async function getFreeDeliveryMin(): Promise<number> {
  if (_cachedFreeDeliveryMin && Date.now() - _cachedFreeDeliveryMin.fetchedAt < TAX_RATE_TTL_MS) {
    return _cachedFreeDeliveryMin.value;
  }
  let value = 250;
  try {
    const snap = await db.collection("settings").doc("default").get();
    if (snap.exists) {
      const v = (snap.data() as any)?.freeDeliveryMin;
      if (typeof v === "number" && v >= 0) value = v;
    }
  } catch {
    // fall back to default
  }
  _cachedFreeDeliveryMin = { value, fetchedAt: Date.now() };
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Money utilities
// ─────────────────────────────────────────────────────────────────────────────

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const PRICE_TOLERANCE_CENTS = 1;
