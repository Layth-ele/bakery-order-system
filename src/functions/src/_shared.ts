/**
 * Shared helpers for Cloud Functions — Pass 2
 *
 * Reused across order-action / credit / payment Cloud Functions.
 * Centralizes: caller authorization, profile lookup, order ownership checks,
 * and immutable audit log writing.
 */

import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { canTransitionOrderStatus } from "./lib/orderLifecycle";
import { resolveTaxRate, resolveFreeDeliveryMin, resolveDeliveryFee } from "./lib/settingsValues";

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

/** How an admin is named on records customers see ("Received by …"). */
export const adminDisplayName = (admin: CallerProfile): string =>
  (admin.storeName && admin.storeName.trim()) || admin.email;

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
 * Allowed status transitions — defined once in lib/orderLifecycle.ts and
 * shared with the web app.
 */
export function assertTransitionAllowed(from: string, to: string) {
  if (!canTransitionOrderStatus(from, to)) {
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

// Notifications: order lifecycle notifications are written ONLY by the
// onOrderLifecycle trigger (orderLifecycleTrigger.ts). Don't add per-function
// notification writes here — they would duplicate the trigger's.

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

// Settings are read from settings/general — the document Admin → System
// Settings edits — with settings/default as a legacy fallback (see
// lib/settingsValues.ts). Cached briefly so a burst of order actions doesn't
// re-read them; an admin change takes effect within SETTINGS_TTL_MS.
const SETTINGS_TTL_MS = 10_000;
let _settingsCache: { general: Record<string, unknown>; legacy: Record<string, unknown>; fetchedAt: number } | null = null;

async function loadBusinessSettings() {
  if (_settingsCache && Date.now() - _settingsCache.fetchedAt < SETTINGS_TTL_MS) return _settingsCache;
  const [general, legacy] = await Promise.all(
    ["general", "default"].map((id) =>
      db.collection("settings").doc(id).get()
        .then((snap) => (snap.data() ?? {}) as Record<string, unknown>)
        .catch(() => ({}) as Record<string, unknown>)
    )
  );
  _settingsCache = { general, legacy, fetchedAt: Date.now() };
  return _settingsCache;
}

/** GST rate as a fraction (0.05 = 5%). */
export async function getTaxRate(): Promise<number> {
  const { general, legacy } = await loadBusinessSettings();
  return resolveTaxRate(general, legacy);
}

/** Subtotal (after discounts) that qualifies for free delivery. */
export async function getFreeDeliveryMin(): Promise<number> {
  const { general, legacy } = await loadBusinessSettings();
  return resolveFreeDeliveryMin(general, legacy);
}

/** Standard delivery fee below the free-delivery minimum. */
export async function getDeliveryFee(): Promise<number> {
  const { general, legacy } = await loadBusinessSettings();
  return resolveDeliveryFee(general, legacy);
}

// ─────────────────────────────────────────────────────────────────────────────
// Money utilities
// ─────────────────────────────────────────────────────────────────────────────

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const PRICE_TOLERANCE_CENTS = 1;
