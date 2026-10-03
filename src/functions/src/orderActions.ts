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
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { amountDueOf, passedDeliveryDays, passedDaysMessage } from "./lib/orderPlacement";
import { buildCreditNote, gstShareOf } from "./lib/creditNotes";
import {
  DAYS,
  RevisionError,
  activeDays,
  diffItems,
  normalizeItems,
  orderTotals,
  planCancellation,
  type Day,
} from "./lib/orderRevision";
import { orderReducedNotification } from "./lib/accountNotifications";
import { createNotificationInTx } from "./notify";
import { orderRefFields } from "./orderRevisions";
import {
  requireAdmin,
  loadOrder,
  assertTransitionAllowed,
  logStatusChange,
  getFreeDeliveryMin,
  getTaxRate,
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
  // Only paid orders are baked: a day already over can't be approved.
  const passedDays = passedDeliveryDays(order, new Date());
  if (passedDays.length > 0) throw new HttpsError("failed-precondition", passedDaysMessage(passedDays, "approved"));

  // ─── Compute final totals server-side (lib/orderRevision rules) ──────────
  const gstRate = await getTaxRate();
  const items = normalizeItems(order.items);
  const beforeFee = orderTotals(items, order, gstRate, { deliveryFee: 0 });
  const discountedBase = round2(beforeFee.subtotal - beforeFee.discountAmount);

  // Resolve delivery fee
  let finalDeliveryFee: number;
  const freeDeliveryMin = await getFreeDeliveryMin();
  if (typeof providedFee === "number" && Number.isFinite(providedFee) && providedFee >= 0) {
    finalDeliveryFee = round2(providedFee);
  } else if (discountedBase >= freeDeliveryMin) {
    finalDeliveryFee = 0;
  } else {
    throw new HttpsError(
      "failed-precondition",
      `Order does not qualify for free delivery (subtotal $${discountedBase} < $${freeDeliveryMin}). Please provide deliveryFee.`
    );
  }
  const totals = orderTotals(items, order, gstRate, { deliveryFee: finalDeliveryFee });
  const newTotal = totals.total;

  // ─── Atomic update + audit log ───────────────────────────────────────────
  const fromStatus = order.status;
  const { amountDue, creditReturned, status: newStatus } = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) {
      throw new HttpsError("not-found", "Order disappeared mid-transaction.");
    }
    const freshData = fresh.data() as OrderDoc;
    if (freshData.status !== fromStatus) {
      throw new HttpsError(
        "aborted",
        `Order status changed concurrently (was "${fromStatus}", is now "${freshData.status}"). Please refresh.`
      );
    }

    // total is the invoice total; store credit reduces only amountDue (see
    // lib/orderPlacement.ts money rules). Credit beyond the final total goes
    // back to the customer.
    const creditBefore = round2(freshData.creditApplied ?? 0);
    const creditApplied = round2(Math.min(creditBefore, newTotal));
    const returned = round2(creditBefore - creditApplied);
    const creditNoteId =
      returned > 0 && freshData.customerId
        ? returnCreditNote(tx, {
            customerId: freshData.customerId,
            orderId,
            amount: returned,
            reason: "Order approved — store credit beyond the order total returned",
            type: "refund",
            createdBy: admin.email,
            gstShare: gstShareOf(freshData),
          })
        : null;
    const due = amountDueOf(newTotal, creditApplied);

    // Store credit covers everything → nothing to pay: paid, into production.
    const coveredByCredit = due <= 0;
    tx.update(ref, {
      status: coveredByCredit ? "in_process" : "approved",
      ...(coveredByCredit
        ? {
            paymentReceived: true,
            paymentSubmitted: true,
            paymentMethod: "credit",
            paidAt: FieldValue.serverTimestamp(),
            paymentConfirmedBy: "store-credit",
            paymentConfirmedAt: FieldValue.serverTimestamp(),
          }
        : {}),
      items,
      subtotal: totals.subtotal,
      gst: totals.gst,
      total: newTotal,
      creditApplied,
      amountDue: due,
      deliveryFee: finalDeliveryFee,
      ...(creditNoteId ? { creditReturnedNoteId: creditNoteId } : {}),
      approvedBy: admin.email,
      approvedAt: FieldValue.serverTimestamp(),
      updateRequested: false,
      updateRequestedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { amountDue: due, creditReturned: returned, status: coveredByCredit ? "in_process" : "approved" };
  });

  await logStatusChange({
    orderId,
    fromStatus,
    toStatus: newStatus,
    actorUid: admin.uid,
    actorEmail: admin.email,
    metadata: { deliveryFee: finalDeliveryFee, total: newTotal, gst: totals.gst, amountDue, creditReturned, ...(newStatus === "in_process" ? { paidWith: "store credit" } : {}) },
  });

  // Customer notification + email: onOrderLifecycle trigger.

  return {
    success: true,
    orderId,
    total: newTotal,
    gst: totals.gst,
    amountDue,
    deliveryFee: finalDeliveryFee,
    status: newStatus,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Store credit returned when an unpaid order is rejected or cancelled
// ─────────────────────────────────────────────────────────────────────────────

function returnCreditNote(
  tx: FirebaseFirestore.Transaction,
  input: { customerId: string; orderId: string; amount: number; reason: string; type: "refund" | "cancellation"; createdBy: string; gstShare: number }
): string {
  const ref = db.collection("creditNotes").doc();
  tx.set(ref, {
    ...buildCreditNote({ id: ref.id, ...input, now: new Date() }),
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

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
  const gstRate = await getTaxRate();

  const fromStatus = order.status;
  const creditReturned = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) {
      throw new HttpsError("not-found", "Order disappeared mid-transaction.");
    }
    const freshData = fresh.data() as OrderDoc;
    if (freshData.status !== fromStatus) {
      throw new HttpsError("aborted", `Order status changed concurrently. Please refresh.`);
    }
    // Store credit used on the order goes back to the customer.
    const credit = round2(freshData.creditApplied ?? 0);
    const creditNoteId =
      credit > 0 && freshData.customerId
        ? returnCreditNote(tx, {
            customerId: freshData.customerId,
            orderId,
            amount: credit,
            reason: "Order not accepted — store credit returned",
            type: "refund",
            createdBy: admin.email,
            gstShare: gstShareOf(freshData),
          })
        : null;
    tx.update(ref, {
      status: "rejected",
      rejectedBy: admin.email,
      rejectedAt: FieldValue.serverTimestamp(),
      rejectionReason: reason ?? null,
      ...(creditNoteId ? { creditAmount: credit, creditNoteId, creditApplied: 0, amountDue: 0 } : {}),
      // Data minimization: the e-transfer answer is never needed again.
      transferPassword: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return creditNoteId ? credit : 0;
  });

  await logStatusChange({
    orderId,
    fromStatus,
    toStatus: "rejected",
    actorUid: admin.uid,
    actorEmail: admin.email,
    reason,
    metadata: { creditReturned },
  });

  // Customer notification + email: onOrderLifecycle trigger.

  return { success: true, orderId, creditReturned };
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelOrder — whole order, or some of its delivery days
// ─────────────────────────────────────────────────────────────────────────────

interface CancelOrderInput {
  orderId: string;
  reason: string;
  /** Days to cancel; omitted = every day (the whole order). */
  cancelledDays?: string[];
  cancellationFeePercentage?: number;
  /** Ignored — the credit is computed here (lib/orderRevision.planCancellation). */
  creditAmount?: number;
}

export interface CancelOrderResult {
  success: true;
  orderId: string;
  full: boolean;
  credit: number;
  fee: number;
  creditNoteId: string | null;
}

export const cancelOrder = onCall<CancelOrderInput>(async (request): Promise<CancelOrderResult> => {
  const admin = await requireAdmin(request);

  const { orderId, reason: rawReason, cancelledDays, cancellationFeePercentage } = request.data ?? {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }
  const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 500) : "";
  if (!reason) {
    throw new HttpsError("invalid-argument", "Cancellation reason is required.");
  }
  if (
    cancellationFeePercentage !== undefined &&
    (typeof cancellationFeePercentage !== "number" ||
      !Number.isFinite(cancellationFeePercentage) ||
      cancellationFeePercentage < 0 ||
      cancellationFeePercentage > 100)
  ) {
    throw new HttpsError("invalid-argument", "cancellationFeePercentage must be a number between 0 and 100.");
  }
  if (cancelledDays !== undefined && (!Array.isArray(cancelledDays) || cancelledDays.some((d) => !DAYS.includes(d as Day)))) {
    throw new HttpsError("invalid-argument", "cancelledDays must be a list of weekday names.");
  }

  const { ref, data: order } = await loadOrder(orderId, admin);
  assertTransitionAllowed(order.status, "cancelled");
  const gstRate = await getTaxRate();
  const fromStatus = order.status;

  const outcome = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) {
      throw new HttpsError("not-found", "Order disappeared mid-transaction.");
    }
    const freshData = fresh.data() as OrderDoc;
    if (freshData.status !== fromStatus) {
      throw new HttpsError("aborted", "Order status changed concurrently. Please refresh.");
    }

    const days = (cancelledDays as Day[] | undefined) ?? activeDays(normalizeItems(freshData.items));
    let plan;
    try {
      plan = planCancellation(freshData, days, cancellationFeePercentage ?? 0, gstRate);
    } catch (err) {
      if (err instanceof RevisionError) throw new HttpsError(err.code, err.message);
      throw err;
    }
    const paid = freshData.paymentReceived === true;
    const customerId = freshData.customerId;

    // 1) Store credit — in the SAME transaction as the change it pays for.
    const creditNoteId =
      plan.credit > 0 && customerId
        ? returnCreditNote(tx, {
            customerId,
            orderId,
            amount: plan.credit,
            reason: `${plan.full ? "Order cancelled" : "Delivery days cancelled"}: ${reason}`,
            type: paid ? "cancellation" : "refund",
            createdBy: admin.email,
            gstShare: gstShareOf(freshData),
          })
        : null;

    if (plan.full) {
      // 2a) Whole order: status → cancelled (the lifecycle trigger notifies).
      tx.update(ref, {
        status: "cancelled",
        ...(creditNoteId && { creditNoteId }),
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: admin.email,
        cancellationReason: reason,
        cancelledDays: days,
        cancellationFeePercentage: paid ? cancellationFeePercentage ?? 0 : 0,
        // Every fee the bakery keeps on this order (earlier partial
        // cancellations included) — what the cancelled invoice shows.
        cancellationFee: plan.feeKept,
        creditAmount: plan.credit,
        ...(!paid && { creditApplied: plan.creditApplied, amountDue: 0 }),
        // Data minimization: the e-transfer answer is never needed again.
        transferPassword: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 3) Void the invoice number, atomically.
      if (freshData.invoiceNumber) {
        tx.set(db.collection("voidedInvoices").doc(freshData.invoiceNumber), {
          invoiceNumber: freshData.invoiceNumber,
          orderId,
          customerId,
          voidReason: "cancelled",
          adminEmail: admin.email,
          details: reason,
          originalTotal: freshData.total ?? 0,
          voidedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      // 2b) Some days: the order continues with fewer items.
      const t = plan.totals!;
      const historyRef = db.collection("orderEditHistory").doc();
      tx.update(ref, {
        items: plan.items,
        subtotal: t.subtotal,
        discount: plan.discount,
        gst: t.gst,
        total: t.total,
        ...(paid
          ? { creditIssued: round2((freshData.creditIssued ?? 0) + plan.credit), cancellationFee: t.cancellationFee }
          : { creditApplied: plan.creditApplied, amountDue: plan.amountDue }),
        cancelledDays: FieldValue.arrayUnion(...days),
        editedBy: admin.email,
        editedAt: FieldValue.serverTimestamp(),
        editCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(historyRef, {
        orderId,
        customerId,
        kind: "partial_cancel",
        status: freshData.status,
        editedBy: admin.email,
        editedAt: FieldValue.serverTimestamp(),
        reason,
        changesSummary: `Cancelled ${days.join(", ")}`,
        originalTotal: round2(freshData.total ?? 0),
        newTotal: t.total,
        creditIssued: plan.credit,
        cancellationFee: plan.fee,
        ...(creditNoteId ? { creditNoteId } : {}),
        itemsChanged: diffItems(normalizeItems(freshData.items), plan.items),
      });
      if (customerId) {
        createNotificationInTx(
          tx,
          orderReducedNotification(orderRefFields(orderId, freshData), historyRef.id, {
            credit: plan.credit,
            reason,
            cancelledDays: days,
          })
        );
      }
    }
    return { full: plan.full, credit: plan.credit, fee: plan.fee, creditNoteId, days };
  });

  if (outcome.full) {
    await logStatusChange({
      orderId,
      fromStatus,
      toStatus: "cancelled",
      actorUid: admin.uid,
      actorEmail: admin.email,
      reason,
      metadata: {
        cancelledDays: outcome.days,
        cancellationFeePercentage: cancellationFeePercentage ?? null,
        creditAmount: outcome.credit,
      },
    });
  }
  console.log(`[cancelOrder] ${orderId} ${outcome.full ? "cancelled" : `days ${outcome.days.join(",")} cancelled`}; credit ${outcome.credit}, fee ${outcome.fee}`);

  return { success: true, orderId, full: outcome.full, credit: outcome.credit, fee: outcome.fee, creditNoteId: outcome.creditNoteId };
});
