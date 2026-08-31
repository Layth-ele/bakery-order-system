/**
 * Invoice Cloud Functions — HARDENED (Pass 1)
 *
 * Fixes from audit:
 *   - C2: Admin check is now ENFORCED (was commented out).
 *   - C4: Function now RETURNS { id, invoiceNumber } as documented.
 *   - Added: validation that customerId exists in customers collection.
 *   - Added: orderIds (if provided) verified to exist and belong to customerId.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getNextDailyId } from "./idGenerator";

const db = getFirestore();

interface CreateInvoiceInput {
  customerId: string;
  customerName: string;
  subtotal: number;
  gst: number;
  total: number;
  orderIds?: string[];
  week?: number;
  year?: number;
}

function assertValidInput(data: any): asserts data is CreateInvoiceInput {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request body is required.");
  }
  if (typeof data.customerId !== "string" || !data.customerId) {
    throw new HttpsError("invalid-argument", "customerId is required.");
  }
  if (typeof data.customerName !== "string" || !data.customerName) {
    throw new HttpsError("invalid-argument", "customerName is required.");
  }
  if (typeof data.subtotal !== "number" || data.subtotal < 0) {
    throw new HttpsError("invalid-argument", "subtotal must be a non-negative number.");
  }
  if (typeof data.gst !== "number" || data.gst < 0) {
    throw new HttpsError("invalid-argument", "gst must be a non-negative number.");
  }
  if (typeof data.total !== "number" || data.total < 0) {
    throw new HttpsError("invalid-argument", "total must be a non-negative number.");
  }
  if (data.orderIds !== undefined) {
    if (!Array.isArray(data.orderIds)) {
      throw new HttpsError("invalid-argument", "orderIds must be an array if provided.");
    }
    for (const id of data.orderIds) {
      if (typeof id !== "string" || !id) {
        throw new HttpsError("invalid-argument", "Each orderId must be a non-empty string.");
      }
    }
  }
}

export const createInvoiceWithCustomId = onCall(async (request) => {
  // ── 1. Authentication ────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to create invoices.");
  }

  // ── 2. Admin check — FIX C2: was commented out, NOW ENFORCED ─────────────
  const callerSnap = await db.collection("customers").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.customerType !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only administrators can create invoices."
    );
  }

  // ── 3. Input validation ──────────────────────────────────────────────────
  assertValidInput(request.data);
  const data = request.data;

  // ── 4. Verify target customer exists ─────────────────────────────────────
  const targetSnap = await db.collection("customers").doc(data.customerId).get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", `Customer ${data.customerId} does not exist.`);
  }

  // ── 5. Verify referenced orders belong to this customer ──────────────────
  if (data.orderIds && data.orderIds.length > 0) {
    const orderSnaps = await Promise.all(
      data.orderIds.map(id => db.collection("orders").doc(id).get())
    );
    for (let i = 0; i < orderSnaps.length; i++) {
      const snap = orderSnaps[i];
      if (!snap.exists) {
        throw new HttpsError(
          "not-found",
          `Order ${data.orderIds[i]} does not exist.`
        );
      }
      const order = snap.data() as { customerId?: string };
      if (order.customerId !== data.customerId) {
        throw new HttpsError(
          "failed-precondition",
          `Order ${data.orderIds[i]} does not belong to customer ${data.customerId}.`
        );
      }
    }
  }

  // ── 6. Generate sequential invoice number ────────────────────────────────
  const invoiceNumber = await getNextDailyId("DBH");

  // ── 7. Create invoice document ───────────────────────────────────────────
  const invoiceRef = db.collection("invoices").doc(invoiceNumber);

  await invoiceRef.set({
    id: invoiceNumber,
    invoiceNumber,
    customerId: data.customerId,
    customerName: data.customerName,
    subtotal: data.subtotal,
    gst: data.gst,
    total: data.total,
    orderIds: data.orderIds ?? [],
    week: data.week ?? null,
    year: data.year ?? null,
    status: "unpaid",
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // FIX C4: Return the generated invoice number.
  return {
    id: invoiceNumber,
    invoiceNumber,
  };
});
