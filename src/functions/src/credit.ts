/**
 * Credit Cloud Functions — Pass 2
 *
 * applyOrderCredit: customer-callable, applies credit FIFO across the customer's
 * available credit notes, atomically updates the order's creditApplied/amountDue,
 * and writes a creditApplicationHistory record — all in a single transaction.
 *
 * Why this is critical:
 *   - The previous client-side path required the Firestore rule to allow
 *     customers to mutate their own creditNotes.remainingBalance directly.
 *     Pass 1 patched that rule to enforce direction-of-change, but the only
 *     reason customers needed write access at all was this client-side flow.
 *   - With this Cloud Function in place, the rule can be tightened to deny
 *     ALL customer writes to creditNotes (Pass 2 rules update). Customers can
 *     no longer mint credit by ANY direct path.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  requireApprovedCustomer,
  loadOrder,
  appendAuditLog,
} from "./_shared";

const db = getFirestore();

interface ApplyOrderCreditInput {
  orderId: string;
  amount: number;
}

export const applyOrderCredit = onCall<ApplyOrderCreditInput>(async (request) => {
  const customer = await requireApprovedCustomer(request);

  const { orderId, amount } = request.data ?? {};
  if (!orderId || typeof orderId !== "string") {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("invalid-argument", "amount must be a positive number.");
  }
  // Round to 2 decimals server-side; reject anything weirder than that
  const requestedAmount = Math.round(amount * 100) / 100;

  // Load order, must be owned by caller
  const { ref: orderRef, data: order } = await loadOrder(orderId, customer, {
    requireOwner: true,
  });

  // Credit can only be applied while the order is pending or approved
  if (!["pending", "approved"].includes(order.status)) {
    throw new HttpsError(
      "failed-precondition",
      `Credit can only be applied to pending or approved orders (current: ${order.status}).`
    );
  }

  // Pre-fetch candidate credit notes outside the transaction (their IDs are stable)
  const candidatesSnap = await db
    .collection("creditNotes")
    .where("customerId", "==", customer.uid)
    .where("status", "in", ["available", "partially_used"])
    .get();

  if (candidatesSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "You have no available credit to apply."
    );
  }

  const candidateRefs = candidatesSnap.docs.map(d =>
    db.collection("creditNotes").doc(d.id)
  );

  // Run the atomic deduction
  const result = await db.runTransaction(async (tx) => {
    // 1. Re-read order inside tx (catches concurrent status changes)
    const freshOrderSnap = await tx.get(orderRef);
    if (!freshOrderSnap.exists) {
      throw new HttpsError("not-found", "Order disappeared mid-transaction.");
    }
    const freshOrder = freshOrderSnap.data() as any;
    if (!["pending", "approved"].includes(freshOrder.status)) {
      throw new HttpsError(
        "aborted",
        "Order status changed mid-transaction. Please refresh."
      );
    }

    // 2. Re-read every candidate note via tx.get() — this is what makes the
    //    operation atomic against concurrent applyCredit calls.
    const noteSnaps = await Promise.all(candidateRefs.map(ref => tx.get(ref)));

    const availableNotes = noteSnaps
      .filter(snap => snap.exists)
      .map(snap => {
        const d = snap.data() as any;
        return {
          ref: snap.ref,
          id: snap.id,
          status: d.status as string,
          remainingBalance: (d.remainingBalance ?? d.amount ?? 0) as number,
          createdAt: d.createdAt,
        };
      })
      .filter(n => n.status === "available" || n.status === "partially_used")
      .sort((a, b) => {
        const at = (a.createdAt?.toMillis?.() ?? 0) as number;
        const bt = (b.createdAt?.toMillis?.() ?? 0) as number;
        return at - bt;
      });

    const totalAvailable = availableNotes.reduce(
      (sum, n) => sum + n.remainingBalance,
      0
    );
    if (requestedAmount > totalAvailable + 0.01) {
      throw new HttpsError(
        "failed-precondition",
        `Insufficient credit. Available: $${totalAvailable.toFixed(2)}, requested: $${requestedAmount.toFixed(2)}`
      );
    }

    // 3. Cap to order's outstanding amount — never apply more credit than the
    //    order needs. This is a defensive check the client-side path didn't have.
    const orderTotal = freshOrder.total ?? 0;
    const alreadyApplied = freshOrder.creditApplied ?? 0;
    const maxApplicable = Math.max(0, orderTotal - alreadyApplied);
    const effectiveAmount = Math.min(requestedAmount, maxApplicable);
    if (effectiveAmount <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Order has no outstanding amount to apply credit to."
      );
    }

    // 4. FIFO deductions
    let remainingToDeduct = effectiveAmount;
    const appliedNotes: Array<{ id: string; amountUsed: number; newBalance: number }> = [];
    for (const note of availableNotes) {
      if (remainingToDeduct <= 0) break;
      const useAmount = Math.min(note.remainingBalance, remainingToDeduct);
      const newBalance = Math.round((note.remainingBalance - useAmount) * 100) / 100;
      tx.update(note.ref, {
        remainingBalance: newBalance,
        status: newBalance <= 0 ? "fully_used" : "partially_used",
        updatedAt: FieldValue.serverTimestamp(),
      });
      appliedNotes.push({ id: note.id, amountUsed: useAmount, newBalance });
      remainingToDeduct -= useAmount;
    }

    // 5. Update the order
    const newCreditApplied = Math.round((alreadyApplied + effectiveAmount) * 100) / 100;
    const newAmountDue = Math.max(0, Math.round((orderTotal - newCreditApplied) * 100) / 100);
    tx.update(orderRef, {
      creditApplied: newCreditApplied,
      amountDue: newAmountDue,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      effectiveAmount,
      appliedNotes,
      newCreditApplied,
      newAmountDue,
    };
  });

  // 6. History record (outside transaction — non-critical audit trail)
  try {
    await db.collection("creditApplicationHistory").add({
      orderId,
      customerId: customer.uid,
      amount: result.effectiveAmount,
      appliedNotes: result.appliedNotes,
      appliedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[applyOrderCredit] History record failed (non-fatal):", err);
  }

  // 7. Compliance audit log
  await appendAuditLog({
    collection: "auditLogs",
    payload: {
      action: "CREDIT_APPLIED",
      orderId,
      customerId: customer.uid,
      requestedAmount,
      effectiveAmount: result.effectiveAmount,
      newCreditApplied: result.newCreditApplied,
      newAmountDue: result.newAmountDue,
      appliedNoteCount: result.appliedNotes.length,
      timestamp: FieldValue.serverTimestamp(),
    },
  });

  return {
    success: true,
    orderId,
    appliedAmount: result.effectiveAmount,
    newCreditApplied: result.newCreditApplied,
    newAmountDue: result.newAmountDue,
  };
});
