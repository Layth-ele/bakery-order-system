/**
 * Order Action Cloud Functions — Pass 2
 *
 * Server-enforced order state transitions. Replaces client-side logic in:
 *   - src/services/ordersService.ts:approveOrder, rejectOrder
 *   - src/services/orderActionService.ts:cancelOrderAction
 *
 * Why this matters:
 *   The previous client-side logic relied on Firestore rules to gate writes.
 *   Rules can't enforce business invariants — only structure. By moving these
 *   actions server-side and tightening the rules to deny direct status writes
 *   from clients, we close the trust-the-client gap.
 *
 * State transition matrix is enforced in _shared.ts/assertTransitionAllowed.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  requireAuth,
  requireAdmin,
  loadOrder,
  assertTransitionAllowed,
  logStatusChange,
  createCustomerNotificationServer,
  getFreeDeliveryMin,
  round2,
  type OrderDoc,
} from "./_shared";

const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// approveOrder
// ─────────────────────────────────────────────────────────────────────────────

interface ApproveOrderInput {
  orderId: string;
  deliveryFee?: number;
  reason?: string;
}

export const approveOrder = onCall<ApproveOrderInput>(async (request) => {
  const admin = await requireAdmin(request);

  const { orderId, deliveryFee: providedFee } = request.data ?? {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }

  const { ref, data: order } = await loadOrder(orderId, admin);
  assertTransitionAllowed(order.status, "approved");

  // ─── Compute final totals server-side ────────────────────────────────────
  // Mirrors the logic in services/ordersService.ts:approveOrder but with
  // server-authoritative settings.
  const flatDiscount = order.discount ?? 0;
  const pctDiscount = order.discountPercentage
    ? (order.subtotal ?? 0) * order.discountPercentage / 100
    : 0;
  const totalDiscount = flatDiscount + pctDiscount;
  const discountedBase = Math.max(0, (order.subtotal ?? 0) - totalDiscount);
  const gst = round2(discountedBase * 0.05);

  // Resolve delivery fee
  let finalDeliveryFee: number;
  const freeDeliveryMin = await getFreeDeliveryMin();
  if (typeof providedFee === "number" && providedFee >= 0) {
    finalDeliveryFee = round2(providedFee);
  } else if (discountedBase >= freeDeliveryMin) {
    finalDeliveryFee = 0;
  } else {
    throw new HttpsError(
      "failed-precondition",
      `Order does not qualify for free delivery (subtotal $${discountedBase} < $${freeDeliveryMin}). Please provide deliveryFee.`
    );
  }

  const effectiveServiceCharge = order.serviceChargeWaived ? 0 : (order.serviceCharge ?? 0);
  const creditApplied = order.creditApplied ?? 0;
  const newTotal = round2(
    Math.max(0, discountedBase + gst + finalDeliveryFee + effectiveServiceCharge - creditApplied)
  );

  // ─── Atomic update + audit log ───────────────────────────────────────────
  const fromStatus = order.status;
  await db.runTransaction(async (tx) => {
    // Re-read inside transaction to detect concurrent modifications
    const fresh = await tx.get(ref);
    if (!fresh.exists) {
      throw new HttpsError("not-found", "Order disappeared mid-transaction.");
    }
    const freshStatus = fresh.data()?.status as string;
    if (freshStatus !== fromStatus) {
      throw new HttpsError(
        "aborted",
        `Order status changed concurrently (was "${fromStatus}", is now "${freshStatus}"). Please refresh.`
      );
    }

    tx.update(ref, {
      status: "approved",
      gst,
      total: newTotal,
      deliveryFee: finalDeliveryFee,
      approvedBy: admin.email,
      approvedAt: FieldValue.serverTimestamp(),
      updateRequested: false,
      updateRequestedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await logStatusChange({
    orderId,
    fromStatus,
    toStatus: "approved",
    actorUid: admin.uid,
    actorEmail: admin.email,
    metadata: { deliveryFee: finalDeliveryFee, total: newTotal, gst },
  });

  // Customer notification
  await createCustomerNotificationServer({
    customerId: order.customerId,
    notifId: `order-approved-${orderId}-${Date.now()}`,
    type: "ORDER_APPROVED_PAY_REQUIRED", // FIX R5-S6-F7: was snake_case, schema rejects
    title: "✅ Order Approved",
    message: `Your order has been approved. Total: $${newTotal.toFixed(2)}`,
    orderId,
    actions: [{ type: "VIEW_ORDER", label: "View Order" }],
    metadata: { total: newTotal, gst, deliveryFee: finalDeliveryFee },
  });

  return {
    success: true,
    orderId,
    total: newTotal,
    gst,
    deliveryFee: finalDeliveryFee,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// rejectOrder
// ─────────────────────────────────────────────────────────────────────────────

interface RejectOrderInput {
  orderId: string;
  reason?: string;
}

export const rejectOrder = onCall<RejectOrderInput>(async (request) => {
  const admin = await requireAdmin(request);

  const { orderId, reason } = request.data ?? {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }

  const { ref, data: order } = await loadOrder(orderId, admin);
  assertTransitionAllowed(order.status, "rejected");

  const fromStatus = order.status;
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) {
      throw new HttpsError("not-found", "Order disappeared mid-transaction.");
    }
    const freshStatus = fresh.data()?.status as string;
    if (freshStatus !== fromStatus) {
      throw new HttpsError(
        "aborted",
        `Order status changed concurrently. Please refresh.`
      );
    }
    tx.update(ref, {
      status: "rejected",
      rejectedBy: admin.email,
      rejectedAt: FieldValue.serverTimestamp(),
      rejectionReason: reason ?? null,
      // FIX T2R6-C2 (CRITICAL — PIPEDA compliance): Delete e-transfer
      // security answer on terminal status transitions.  Same rationale as
      // the cancelOrder fix — if a customer submitted payment proof and
      // the admin then rejects the order without confirming payment, the
      // transferPassword must not persist indefinitely on the doc.
      transferPassword: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await logStatusChange({
    orderId,
    fromStatus,
    toStatus: "rejected",
    actorUid: admin.uid,
    actorEmail: admin.email,
    reason,
  });

  await createCustomerNotificationServer({
    customerId: order.customerId,
    notifId: `order-rejected-${orderId}-${Date.now()}`,
    type: "ORDER_REJECTED",
    title: "❌ Order Rejected",
    message: reason
      ? `Your order has been rejected: ${reason}`
      : `Your order has been rejected. Please contact support for details.`,
    orderId,
    metadata: { reason: reason ?? null },
  });

  return { success: true, orderId };
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelOrder
// ─────────────────────────────────────────────────────────────────────────────

interface CancelOrderInput {
  orderId: string;
  reason: string;
  cancelledDays?: string[];
  cancellationFeePercentage?: number;
  creditAmount?: number;
}

export const cancelOrder = onCall<CancelOrderInput>(async (request) => {
  const admin = await requireAdmin(request);

  const { orderId, reason, cancelledDays, cancellationFeePercentage, creditAmount } =
    request.data ?? {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }
  if (!reason || typeof reason !== "string") {
    throw new HttpsError("invalid-argument", "Cancellation reason is required.");
  }

  const { ref, data: order } = await loadOrder(orderId, admin);
  assertTransitionAllowed(order.status, "cancelled");

  // FIX T2R6-H1 (HIGH — defensive bounds on financial inputs): Was no
  // validation on creditAmount or cancellationFeePercentage. Admin (or one
  // with a typo: 100000 instead of 100) could issue credit far exceeding
  // the order total, or set a fee >100% / negative.
  //
  // Bounds:
  //   - creditAmount: 0 <= x <= order.total + small slack for taxes
  //   - cancellationFeePercentage: 0 <= x <= 100
  // Outside these, reject the call with a clear error rather than committing
  // a potentially-mistaken financial state.
  if (creditAmount !== undefined) {
    if (typeof creditAmount !== "number" || !Number.isFinite(creditAmount)) {
      throw new HttpsError("invalid-argument", "creditAmount must be a finite number.");
    }
    if (creditAmount < 0) {
      throw new HttpsError("invalid-argument", "creditAmount cannot be negative.");
    }
    // 1.05× order.total caps slack for any tax-included edge cases. Anything
    // larger is almost certainly a typo or attack.
    const maxAllowed = (order.total ?? 0) * 1.05;
    if (creditAmount > maxAllowed) {
      throw new HttpsError(
        "invalid-argument",
        `creditAmount ${creditAmount} exceeds order total ${order.total ?? 0}. ` +
        `Maximum permitted: ${maxAllowed.toFixed(2)}.`
      );
    }
  }
  if (cancellationFeePercentage !== undefined) {
    if (
      typeof cancellationFeePercentage !== "number" ||
      !Number.isFinite(cancellationFeePercentage) ||
      cancellationFeePercentage < 0 ||
      cancellationFeePercentage > 100
    ) {
      throw new HttpsError(
        "invalid-argument",
        "cancellationFeePercentage must be a number between 0 and 100."
      );
    }
  }

  const fromStatus = order.status;

  // Single transaction: status flip + voided invoice record (atomic)
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) {
      throw new HttpsError("not-found", "Order disappeared mid-transaction.");
    }
    const freshData = fresh.data() as OrderDoc;
    if (freshData.status !== fromStatus) {
      throw new HttpsError(
        "aborted",
        "Order status changed concurrently. Please refresh."
      );
    }

    // 1) Flip status
    tx.update(ref, {
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: admin.email,
      cancellationReason: reason,
      ...(cancelledDays && { cancelledDays }),
      ...(cancellationFeePercentage !== undefined && { cancellationFeePercentage }),
      ...(creditAmount !== undefined && { creditAmount }),
      // FIX T2R6-C2 (CRITICAL — PIPEDA compliance): If the customer had
      // submitted payment proof with `transferPassword` (the e-transfer
      // security answer), it must be deleted on terminal status transitions
      // — same data-minimization principle as R5-S5-F16 applied to payment
      // confirmation.  Previously, cancelling an order that had a payment
      // proof submitted left the transferPassword on the doc indefinitely.
      transferPassword: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2) If the order had an invoice number, record void atomically
    if (freshData.invoiceNumber) {
      const voidRef = db.collection("voidedInvoices").doc(freshData.invoiceNumber);
      tx.set(voidRef, {
        invoiceNumber: freshData.invoiceNumber,
        orderId,
        customerId: freshData.customerId,
        voidReason: "cancelled",
        adminEmail: admin.email,
        details: reason,
        originalTotal: freshData.total ?? 0,
        voidedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  // 3) Status change audit (immutable)
  await logStatusChange({
    orderId,
    fromStatus,
    toStatus: "cancelled",
    actorUid: admin.uid,
    actorEmail: admin.email,
    reason,
    metadata: {
      cancelledDays: cancelledDays ?? null,
      cancellationFeePercentage: cancellationFeePercentage ?? null,
      creditAmount: creditAmount ?? null,
    },
  });

  // 4) Optional credit note creation
  //
  // FIX T2R6-C1 (CRITICAL — silent loss of customer money): This was the
  // server-side equivalent of the bug T2R4-C3 fixed on the client.  If
  // `creditNotes.add(...)` failed, the cancellation was committed AND the
  // customer notification (step 5 below) told them about credit that didn't
  // exist.  Real money silently lost.  Now: surface the failure in the
  // result so admin retries can be triggered by the UI.
  let creditNoteIssued = false;
  let creditNoteError: string | undefined;
  if (creditAmount && creditAmount > 0 && order.customerId) {
    try {
      await db.collection("creditNotes").add({
        customerId: order.customerId,
        orderId,
        amount: creditAmount,
        remainingBalance: creditAmount,
        status: "available",
        reason: `Order cancellation: ${reason}`,
        sourceType: "cancellation",
        createdBy: admin.email,
        createdAt: FieldValue.serverTimestamp(),
      });
      creditNoteIssued = true;
    } catch (err: any) {
      creditNoteError = err?.message ?? "Unknown credit-note error";
      console.error(
        "[cancelOrder] CRITICAL: Credit note creation FAILED — credit was NOT issued:",
        { orderId, customerId: order.customerId, creditAmount, error: err }
      );
      // Surface the failure to admin via an audit row so it appears in the
      // security_alerts dashboard for follow-up reconciliation.
      try {
        await db.collection("security_alerts").add({
          type: "CREDIT_NOTE_ISSUANCE_FAILED",
          severity: "HIGH",
          orderId,
          customerId: order.customerId,
          adminEmail: admin.email,
          attemptedCreditAmount: creditAmount,
          error: creditNoteError,
          timestamp: FieldValue.serverTimestamp(),
        });
      } catch {
        // If alerts collection write also fails, the console.error above is
        // the only remaining trail.
      }
    }
  } else {
    // No credit owed — successful cancellation with nothing to issue.
    creditNoteIssued = true;
  }

  // 5) Customer notification.
  //
  // FIX T2R6-C1: notification message now reflects whether credit was
  // actually issued.  Previously claimed credit issuance unconditionally
  // even if the credit-note write had failed.
  await createCustomerNotificationServer({
    customerId: order.customerId,
    notifId: `order-cancelled-${orderId}-${Date.now()}`,
    type: "ORDER_CANCELLED",
    title: "🛑 Order Cancelled",
    message: creditAmount && creditAmount > 0
      ? (creditNoteIssued
          ? `Your order has been cancelled. Credit of $${creditAmount.toFixed(2)} has been issued. Reason: ${reason}`
          : `Your order has been cancelled. Reason: ${reason} (Note: credit issuance is pending — please contact support.)`)
      : `Your order has been cancelled. Reason: ${reason}`,
    orderId,
    metadata: {
      reason,
      creditAmount: creditAmount ?? null,
      creditNoteIssued,
    },
  });

  return {
    success: true,
    orderId,
    creditNoteIssued,
    ...(creditNoteError ? { creditNoteError } : {}),
  };
});
