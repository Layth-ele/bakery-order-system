/**
 * Order completion — the ONLY place an order becomes `completed`.
 *
 *   completeOrder        Admin callable ("Mark complete" button).
 *   autoCompleteOrders   Fridays 12:05 Vancouver: completes paid orders whose
 *                        delivery week closed (Friday noon) within the last
 *                        7 days. Replaces the legacy deployed function of the
 *                        same name and the old browser-side auto-completers.
 *
 * One Firestore transaction per order: status → completed + locked, invoice
 * number (from the daily DBH counter), invoices/{orderId}, completion
 * snapshot. Nothing is half-written, a failure consumes no invoice number,
 * and the onOrderLifecycle trigger sees a single `completed` write — so the
 * customer gets exactly one "order complete" notification and email.
 *
 * Rules live in lib/orderCompletion.ts (pure, tested).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAdmin, logStatusChange } from "./_shared";
import { reserveDailyId } from "./idGenerator";
import {
  AUTO_COMPLETE_STATUSES,
  COMPLETION_TIME_ZONE,
  buildCompletionSnapshot,
  buildFinalInvoice,
  completionBlocker,
  deliveryWeekEndDate,
  isDueForAutoComplete,
} from "./lib/orderCompletion";

const db = getFirestore();

export interface CompleteOrderResult {
  status: "completed" | "already_completed";
  orderId: string;
  invoiceId: string;
  invoiceNumber: string;
}

const BLOCKER_MESSAGES = {
  not_allowed_from_status: "Only approved or paid orders can be completed.",
  locked: "This order is locked and can't be completed.",
} as const;

/**
 * Complete one order atomically. Idempotent: an already-completed order
 * returns its existing invoice instead of creating another.
 */
export async function completeOrderTransaction(orderId: string, actor: string): Promise<CompleteOrderResult> {
  const orderRef = db.collection("orders").doc(orderId);
  const invoiceRef = db.collection("invoices").doc(orderId);

  const result = await db.runTransaction(async (tx) => {
    // Reads first (Firestore transactions require all reads before writes).
    const [orderSnap, invoiceSnap] = await Promise.all([tx.get(orderRef), tx.get(invoiceRef)]);
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = orderSnap.data() as Record<string, unknown>;

    const blocker = completionBlocker(order);
    if (blocker === "already_completed") {
      return {
        status: "already_completed" as const,
        fromStatus: "completed",
        orderId,
        invoiceId: String(order.finalInvoiceId ?? (invoiceSnap.exists ? orderId : "")),
        invoiceNumber: String(order.invoiceNumber ?? invoiceSnap.data()?.invoiceNumber ?? ""),
      };
    }
    if (blocker) throw new HttpsError("failed-precondition", BLOCKER_MESSAGES[blocker]);

    // Re-use an invoice number the order (or an earlier attempt's invoice)
    // already has; otherwise reserve the next one in this same transaction.
    const existingNumber =
      (typeof order.invoiceNumber === "string" && order.invoiceNumber) ||
      (invoiceSnap.exists && typeof invoiceSnap.data()?.invoiceNumber === "string" && invoiceSnap.data()!.invoiceNumber) ||
      "";
    const invoiceNumber = existingNumber || (await reserveDailyId(tx, "DBH"));

    const now = new Date();
    const invoice = buildFinalInvoice(order, orderId, invoiceNumber, now);
    tx.set(invoiceRef, {
      ...invoice,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdAtServer: now.toISOString(),
      updatedAtServer: now.toISOString(),
    });

    tx.set(orderRef.collection("snapshots").doc(), {
      ...buildCompletionSnapshot(order, orderId, actor, orderId),
      createdAt: FieldValue.serverTimestamp(),
    });

    const deliveryDate = order.deliveryDate || deliveryWeekEndDate(order.year, order.week);
    tx.update(orderRef, {
      status: "completed",
      locked: true,
      completedAt: FieldValue.serverTimestamp(),
      finalizedAt: FieldValue.serverTimestamp(),
      completedBy: actor,
      finalInvoiceId: orderId,
      invoiceNumber,
      ...(deliveryDate && !order.deliveryDate ? { deliveryDate } : {}),
      transferPassword: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { status: "completed" as const, fromStatus: String(order.status), orderId, invoiceId: orderId, invoiceNumber };
  });

  if (result.status === "completed") {
    await logStatusChange({
      orderId,
      fromStatus: result.fromStatus,
      toStatus: "completed",
      actorUid: actor === "auto-scheduler" ? "system" : actor,
      actorEmail: actor,
      metadata: { invoiceNumber: result.invoiceNumber, finalInvoiceId: result.invoiceId },
    }).catch((err) => console.error(`[completeOrder] audit log failed for ${orderId}:`, err));
  }

  const { fromStatus: _from, ...publicResult } = result;
  return publicResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: "Mark complete"
// ─────────────────────────────────────────────────────────────────────────────

export const completeOrder = onCall<{ orderId: string }>(async (request): Promise<CompleteOrderResult> => {
  const admin = await requireAdmin(request);
  const orderId = request.data?.orderId;
  if (typeof orderId !== "string" || !orderId || orderId.includes("/")) {
    throw new HttpsError("invalid-argument", "orderId is required.");
  }
  return completeOrderTransaction(orderId, admin.email || admin.uid);
});

// ─────────────────────────────────────────────────────────────────────────────
// Weekly schedule
// ─────────────────────────────────────────────────────────────────────────────

export const autoCompleteOrders = onSchedule(
  { schedule: "5 12 * * 5", timeZone: COMPLETION_TIME_ZONE, retryCount: 1 },
  async () => {
    const now = new Date();
    const snap = await db
      .collection("orders")
      .where("status", "in", [...AUTO_COMPLETE_STATUSES])
      .where("paymentReceived", "==", true)
      .get();

    const due = snap.docs.filter((d) => isDueForAutoComplete(d.data(), now));
    console.log(`[autoCompleteOrders] ${snap.size} paid active orders checked, ${due.length} due`);

    let completed = 0;
    for (const doc of due) {
      try {
        const r = await completeOrderTransaction(doc.id, "auto-scheduler");
        if (r.status === "completed") completed += 1;
      } catch (err) {
        console.error(`[autoCompleteOrders] ${doc.id} failed:`, err);
      }
    }
    console.log(`[autoCompleteOrders] completed ${completed}/${due.length}`);
  }
);
