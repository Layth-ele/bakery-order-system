/**
 * Payment Cloud Functions — Pass 2
 *
 * - submitPaymentProof: customer-callable, posts payment proof for a paid order.
 *   Replaces direct customer updateOrder() writes for payment fields.
 * - confirmOrderPayment: admin-callable, confirms payment received.
 *   Replaces client-side paymentActionService.confirmPaymentAction.
 *
 * Both write to payment_audit_logs (immutable) for compliance.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  requireAuth,
  requireAdmin,
  requireApprovedCustomer,
  loadOrder,
  assertTransitionAllowed,
  logStatusChange,
  appendAuditLog,
  createAdminNotificationServer,
  createCustomerNotificationServer,
} from "./_shared";

const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// submitPaymentProof  (customer)
// ─────────────────────────────────────────────────────────────────────────────

interface SubmitPaymentProofInput {
  orderId: string;
  paymentMethod: "etransfer" | "credit" | "cash" | "cheque" | string;
  paymentReference?: string;
  transferPassword?: string;
}

const VALID_PAYMENT_METHODS = ["etransfer", "credit", "cash", "cheque"];

export const submitPaymentProof = onCall<SubmitPaymentProofInput>(async (request) => {
  const customer = await requireApprovedCustomer(request);

  const { orderId, paymentMethod, paymentReference, transferPassword } =
    request.data ?? {};

  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }
  if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new HttpsError(
      "invalid-argument",
      `paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(", ")}.`
    );
  }

  const { ref, data: order } = await loadOrder(orderId, customer, { requireOwner: true });

  // Payment proof can only be submitted on approved orders
  if (order.status !== "approved") {
    throw new HttpsError(
      "failed-precondition",
      `Payment proof can only be submitted on approved orders (current status: ${order.status}).`
    );
  }

  // Don't accept duplicate submissions
  if (order.paymentSubmitted) {
    throw new HttpsError(
      "already-exists",
      "Payment proof has already been submitted for this order."
    );
  }

  // Update the order with payment fields only — never touches status
  await ref.update({
    paymentSubmitted: true,
    paymentSubmittedAt: FieldValue.serverTimestamp(),
    paymentMethod,
    ...(paymentReference !== undefined && { paymentReference }),
    ...(transferPassword !== undefined && { transferPassword }),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Audit log
  await appendAuditLog({
    collection: "payment_audit_logs",
    payload: {
      action: "PAYMENT_PROOF_SUBMITTED",
      orderId,
      customerId: customer.uid,
      customerEmail: customer.email,
      paymentMethod,
      timestamp: FieldValue.serverTimestamp(),
    },
  });

  // Notify admin
  await createAdminNotificationServer({
    notifId: `payment-submitted-${orderId}-${Date.now()}`,
    type: "PAYMENT_SUBMITTED", // FIX R5-S6-F7: was snake_case, schema rejects
    title: "💳 Payment Proof Submitted",
    message: `Customer ${order.customerName ?? customer.email} submitted payment for order. Method: ${paymentMethod}`,
    orderId,
    actions: [{ type: "VIEW_ORDER", label: "Review Payment" }],
    metadata: {
      customerId: customer.uid,
      paymentMethod,
      total: order.total,
    },
  });

  return { success: true, orderId };
});

// ─────────────────────────────────────────────────────────────────────────────
// confirmOrderPayment  (admin)
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmOrderPaymentInput {
  orderId: string;
  invoiceNumber?: string;
}

export const confirmOrderPayment = onCall<ConfirmOrderPaymentInput>(async (request) => {
  const admin = await requireAdmin(request);

  const { orderId, invoiceNumber } = request.data ?? {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }

  const { ref, data: order } = await loadOrder(orderId, admin);

  // Confirm payment is only valid from 'approved' to 'in_process'
  assertTransitionAllowed(order.status, "in_process");

  if (order.paymentReceived) {
    throw new HttpsError(
      "already-exists",
      "Payment is already confirmed for this order."
    );
  }

  // If invoiceNumber provided, ensure it's not already set (write-once)
  if (invoiceNumber && order.invoiceNumber && invoiceNumber !== order.invoiceNumber) {
    throw new HttpsError(
      "failed-precondition",
      "Invoice number is already set on this order and cannot be changed."
    );
  }

  const fromStatus = order.status;

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) {
      throw new HttpsError("not-found", "Order disappeared mid-transaction.");
    }
    const freshData = fresh.data() as any;
    if (freshData.status !== fromStatus) {
      throw new HttpsError(
        "aborted",
        "Order status changed concurrently. Please refresh."
      );
    }
    if (freshData.paymentReceived) {
      throw new HttpsError("already-exists", "Payment already confirmed.");
    }

    tx.update(ref, {
      status: "in_process",
      paymentReceived: true,
      paidAt: FieldValue.serverTimestamp(),
      ...(invoiceNumber && !freshData.invoiceNumber && { invoiceNumber }),
      paymentConfirmedBy: admin.email,
      paymentConfirmedAt: FieldValue.serverTimestamp(),
      // FIX R5-S5-F16 (CRITICAL — PIPEDA compliance): The e-transfer security
      // answer is the customer's question/password used to receive the funds.
      // Storing it indefinitely (after the payment is already confirmed and the
      // money is in the bank) violates the principle of data minimization under
      // PIPEDA, and creates an unnecessary breach exposure surface.  We
      // affirmatively delete the field on confirmation — it has served its
      // purpose and must not persist on the order document.
      transferPassword: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  // Status change audit
  await logStatusChange({
    orderId,
    fromStatus,
    toStatus: "in_process",
    actorUid: admin.uid,
    actorEmail: admin.email,
    metadata: {
      paymentReceived: true,
      total: order.total,
      invoiceNumber: invoiceNumber ?? order.invoiceNumber ?? null,
    },
  });

  // Payment-specific audit
  await appendAuditLog({
    collection: "payment_audit_logs",
    payload: {
      action: "PAYMENT_CONFIRMED",
      orderId,
      customerId: order.customerId,
      adminUid: admin.uid,
      adminEmail: admin.email,
      total: order.total,
      paymentMethod: order.paymentMethod ?? null,
      invoiceNumber: invoiceNumber ?? order.invoiceNumber ?? null,
      timestamp: FieldValue.serverTimestamp(),
    },
  });

  // Customer notification
  await createCustomerNotificationServer({
    customerId: order.customerId,
    notifId: `payment-confirmed-${orderId}-${Date.now()}`,
    type: "PAYMENT_CONFIRMED",
    title: "✅ Payment Confirmed",
    message: `Your payment of $${(order.total ?? 0).toFixed(2)} has been confirmed. We'll start preparing your order.`,
    orderId,
    metadata: { total: order.total ?? 0 },
  });

  // Update customer totalSpent (best-effort, non-fatal)
  try {
    if (order.customerId && (order.total ?? 0) > 0) {
      const cref = db.collection("customers").doc(order.customerId);
      await db.runTransaction(async (tx) => {
        const csnap = await tx.get(cref);
        if (!csnap.exists) return;
        const cur = (csnap.data() as any)?.totalSpent ?? 0;
        const credit = (order.creditApplied ?? 0);
        const cashPaid = Math.max(0, (order.total ?? 0) - credit);
        tx.update(cref, {
          totalSpent: Number((cur + cashPaid).toFixed(2)),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }
  } catch (err) {
    console.warn("[confirmOrderPayment] totalSpent update failed:", err);
  }

  return { success: true, orderId };
});
