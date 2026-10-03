/**
 * Account actions that aren't order status changes. Each one changes the
 * data and writes its notification in ONE transaction, so a notification
 * never announces something that didn't happen (and vice versa).
 *
 *   sendPaymentReminder  Admin: remind a customer to pay an approved order
 *                        (in-app notification + email; counts reminders).
 *   issueStoreCredit     Admin: add store credit to a customer's account.
 *   requestCreditPayout  Customer: ask for a credit note to be paid out.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAdmin, requireApprovedCustomer } from "./_shared";
import { WITH_EMAIL, emailPaymentReminder, type EmailCallResult } from "./emails";
import { allowSend } from "./lib/mailer";
import { createNotificationInTx } from "./notify";
import { orderRefFields } from "./orderRevisions";
import {
  creditIssuedNotification,
  payoutRequestedNotification,
  payoutResolvedNotification,
  payoutAlertId,
  paymentReminderNotification,
} from "./lib/accountNotifications";
import { buildCreditNote, type CreditNoteType } from "./lib/creditNotes";
import { round2 } from "./lib/orderRevision";
import { passedDeliveryDays, passedDaysMessage } from "./lib/orderPlacement";

const db = getFirestore();

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const docId = (v: unknown, field: string): string => {
  if (typeof v !== "string" || !v || v.includes("/")) throw new HttpsError("invalid-argument", `${field} is required.`);
  return v;
};

// ─────────────────────────────────────────────────────────────────────────────
// sendPaymentReminder
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentReminderResult {
  reminderNumber: number;
  amountDue: number;
  email: EmailCallResult;
}

export const sendPaymentReminder = onCall(WITH_EMAIL, async (request): Promise<PaymentReminderResult> => {
  const admin = await requireAdmin(request);
  const orderId = docId((request.data as any)?.orderId, "orderId");

  // One reminder per order per minute — absorbs double-clicks.
  if (!(await allowSend(`reminder_${orderId}`, 60_000, 1))) {
    throw new HttpsError("resource-exhausted", "A reminder was just sent for this order. Please wait a minute.");
  }

  const orderRef = db.doc(`orders/${orderId}`);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snap.data() ?? {};
    if (order.status !== "approved" || order.paymentReceived === true) {
      throw new HttpsError("failed-precondition", "Reminders can only be sent for approved orders that are not paid yet.");
    }
    if (order.paymentSubmitted === true) {
      throw new HttpsError("failed-precondition", "The customer already submitted payment — review and confirm it instead.");
    }
    const passedDays = passedDeliveryDays(order, new Date());
    if (passedDays.length > 0) throw new HttpsError("failed-precondition", passedDaysMessage(passedDays, "paid"));
    const amountDue = round2(typeof order.amountDue === "number" ? order.amountDue : Math.max(0, num(order.total) - num(order.creditApplied)));
    if (amountDue <= 0) throw new HttpsError("failed-precondition", "Nothing is due on this order.");
    if (!str(order.customerId)) throw new HttpsError("failed-precondition", "This order has no customer.");

    const reminderNumber = Math.max(0, Math.trunc(num(order.paymentReminderCount))) + 1;
    tx.update(orderRef, {
      paymentReminderCount: reminderNumber,
      lastReminderSentAt: FieldValue.serverTimestamp(),
      lastReminderSentBy: admin.email,
      updatedAt: FieldValue.serverTimestamp(),
    });
    createNotificationInTx(tx, paymentReminderNotification(orderRefFields(orderId, order), reminderNumber, amountDue));
    return { order, reminderNumber, amountDue };
  });

  const email = await emailPaymentReminder(orderId, result.order, result.reminderNumber, admin.email);
  if (email.state === "sent") {
    await orderRef
      .update({ emailReminderCount: FieldValue.increment(1), lastEmailReminderSentAt: FieldValue.serverTimestamp() })
      .catch((err) => console.error(`[sendPaymentReminder] ${orderId} counter update failed:`, err));
  }
  console.log(`[sendPaymentReminder] ${orderId} #${result.reminderNumber} by ${admin.email}; email ${email.state}`);
  return { reminderNumber: result.reminderNumber, amountDue: result.amountDue, email };
});

// ─────────────────────────────────────────────────────────────────────────────
// issueStoreCredit
// ─────────────────────────────────────────────────────────────────────────────

const MANUAL_CREDIT_TYPES: ReadonlyArray<CreditNoteType> = ["refund", "overpayment", "admin_edit", "cancellation"];
export const MAX_MANUAL_CREDIT = 10_000;

export const issueStoreCredit = onCall(async (request): Promise<{ creditNoteId: string; amount: number }> => {
  const admin = await requireAdmin(request);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const customerId = docId(data.customerId, "customerId");
  const amount = round2(Number(data.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_MANUAL_CREDIT) {
    throw new HttpsError("invalid-argument", `Credit must be between $0.01 and $${MAX_MANUAL_CREDIT.toLocaleString("en-CA")}.`);
  }
  const reason = str(data.reason).slice(0, 500);
  if (!reason) throw new HttpsError("invalid-argument", "Please give a reason for the credit.");
  const type = MANUAL_CREDIT_TYPES.includes(data.type as CreditNoteType) ? (data.type as CreditNoteType) : "refund";
  const noteRef = db.collection("creditNotes").doc();
  await db.runTransaction(async (tx) => {
    const customerSnap = await tx.get(db.doc(`customers/${customerId}`));
    if (!customerSnap.exists) throw new HttpsError("not-found", "Customer not found.");
    const customer = customerSnap.data() ?? {};
    if (customer.customerType === "admin") throw new HttpsError("failed-precondition", "Store credit is for customer accounts.");

    tx.set(noteRef, {
      ...buildCreditNote({ id: noteRef.id, customerId, amount, type, reason, createdBy: admin.email, gstShare: 0, now: new Date() }),
      createdAt: FieldValue.serverTimestamp(),
    });
    createNotificationInTx(
      tx,
      creditIssuedNotification({
        creditNoteId: noteRef.id,
        customerId,
        customerName: str(customer.storeName) || str(customer.contactPerson),
        amount,
        reason,
      })
    );
  });

  console.log(`[issueStoreCredit] ${amount} to ${customerId} by ${admin.email} (${noteRef.id})`);
  return { creditNoteId: noteRef.id, amount };
});

// ─────────────────────────────────────────────────────────────────────────────
// requestCreditPayout
// ─────────────────────────────────────────────────────────────────────────────

export const requestCreditPayout = onCall(async (request): Promise<{ creditNoteId: string; amount: number }> => {
  const customer = await requireApprovedCustomer(request);
  const creditNoteId = docId((request.data as any)?.creditNoteId, "creditNoteId");
  const noteRef = db.doc(`creditNotes/${creditNoteId}`);

  const amount = await db.runTransaction(async (tx) => {
    const snap = await tx.get(noteRef);
    const note = snap.data();
    if (!snap.exists || !note || note.customerId !== customer.uid) throw new HttpsError("not-found", "Credit note not found.");
    if (note.payoutRequested === true) throw new HttpsError("already-exists", "A payout was already requested for this credit.");
    const balance = round2(num(note.remainingBalance ?? note.amount));
    if (balance <= 0) throw new HttpsError("failed-precondition", "This credit has no remaining balance.");
    if (note.status === "paid_out") throw new HttpsError("failed-precondition", "This credit was already paid out.");
    // Numbered so a request after a decline gets its own alert.
    const requestNumber = Math.floor(num(note.payoutRequestCount)) + 1;

    tx.update(noteRef, {
      payoutRequested: true,
      payoutRequestCount: requestNumber,
      payoutRequestedAt: FieldValue.serverTimestamp(),
      payoutRequestedAmount: balance,
      updatedAt: FieldValue.serverTimestamp(),
    });
    createNotificationInTx(
      tx,
      payoutRequestedNotification({
        creditNoteId,
        customerId: customer.uid,
        customerName: str(customer.storeName) || customer.email,
        amount: balance,
        requestNumber,
      })
    );
    return balance;
  });

  console.log(`[requestCreditPayout] ${customer.uid} requested ${amount} from ${creditNoteId}`);
  return { creditNoteId, amount };
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveCreditPayout — admin finishes a payout request
//   paid      the credit was sent to the customer: the note is used up
//   declined  the credit stays on the account and can be spent again
// ─────────────────────────────────────────────────────────────────────────────

const PAYOUT_METHODS = ["bank_transfer", "cash", "check"] as const;

export const resolveCreditPayout = onCall(async (request): Promise<{ creditNoteId: string; outcome: "paid" | "declined"; amount: number }> => {
  const admin = await requireAdmin(request);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const creditNoteId = docId(data.creditNoteId, "creditNoteId");
  const outcome = data.outcome === "paid" ? "paid" : data.outcome === "declined" ? "declined" : null;
  if (!outcome) throw new HttpsError("invalid-argument", "outcome must be paid or declined.");
  const method = (PAYOUT_METHODS as readonly unknown[]).includes(data.method) ? (data.method as string) : "bank_transfer";
  const note = str(data.note).slice(0, 300);
  const noteRef = db.doc(`creditNotes/${creditNoteId}`);

  const amount = await db.runTransaction(async (tx) => {
    const snap = await tx.get(noteRef);
    const credit = snap.data();
    if (!snap.exists || !credit) throw new HttpsError("not-found", "Credit note not found.");
    if (credit.payoutRequested !== true) throw new HttpsError("failed-precondition", "There's no open payout request on this credit.");
    const customerSnap = await tx.get(db.doc(`customers/${str(credit.customerId) || "_"}`));
    const requestNumber = Math.max(1, Math.floor(num(credit.payoutRequestCount)));
    const alertRef = db.doc(`notifications/admin/items/${payoutAlertId(creditNoteId, requestNumber)}`);
    const alertSnap = await tx.get(alertRef);
    const balance = round2(num(credit.remainingBalance ?? credit.amount));

    if (outcome === "paid") {
      tx.update(noteRef, {
        remainingBalance: 0,
        status: "paid_out",
        payoutRequested: false,
        payoutApproved: true,
        payoutApprovedAt: FieldValue.serverTimestamp(),
        payoutApprovedBy: admin.email,
        payoutCompletedAt: FieldValue.serverTimestamp(),
        payoutMethod: method,
        payoutAmount: balance,
        ...(note ? { payoutNote: note } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(noteRef, {
        payoutRequested: false,
        payoutRequestedAmount: FieldValue.delete(),
        ...(note ? { payoutNote: note } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    // The admin's "payout requested" alert is dealt with.
    if (alertSnap.exists) tx.update(alertRef, { read: true, isRead: true, readAt: FieldValue.serverTimestamp() });
    createNotificationInTx(
      tx,
      payoutResolvedNotification({
        creditNoteId,
        customerId: str(credit.customerId),
        customerName: str(customerSnap.data()?.storeName) || str(customerSnap.data()?.contactPerson),
        amount: balance,
        outcome,
        note,
        requestNumber,
      })
    );
    return balance;
  });

  console.log(`[resolveCreditPayout] ${admin.email} ${outcome} ${creditNoteId} (${amount})`);
  return { creditNoteId, outcome, amount };
});
