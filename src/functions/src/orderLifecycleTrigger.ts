/**
 * onOrderLifecycle — the single place order side effects happen.
 *
 * Fires on every write to orders/{orderId} and runs
 * lib/orderSideEffects.runOrderSideEffects(), which derives lifecycle events
 * and for each one:
 *   1. writes the in-app notifications (lib/orderNotifications.ts)
 *   2. sends the customer email (emails.ts → sendOrderStatusEmail)
 *
 * Because it reacts to the order document itself, every path that changes
 * an order — approveOrder / rejectOrder / cancelOrder / confirmOrderPayment
 * Cloud Functions, admin completion, the force-status tool — produces the
 * same notifications and emails exactly once. Nothing else writes lifecycle
 * notifications.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { NotificationWrite } from "./lib/orderNotifications";
import { runOrderSideEffects } from "./lib/orderSideEffects";
import { sendOrderStatusEmail, WITH_EMAIL } from "./emails";

const db = getFirestore();

// gRPC status codes surfaced by the Admin SDK.
const ALREADY_EXISTS = 6;
const NOT_FOUND = 5;

/** Firestore rejects `undefined` values; drop them (shallow is enough here). */
function defined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function notificationRef(w: NotificationWrite) {
  const parent = w.audience === "admin" ? "admin" : `user_${w.customerId}`;
  return db.collection("notifications").doc(parent).collection("items").doc(w.id);
}

async function applyNotification(w: NotificationWrite): Promise<void> {
  const ref = notificationRef(w);
  const { read, ...content } = w.content;
  try {
    if (w.mode === "create") {
      await ref.create(
        defined({
          id: w.id,
          ...content,
          read: read ?? false,
          source: "server",
          createdAt: FieldValue.serverTimestamp(),
          timestamp: FieldValue.serverTimestamp(),
        })
      );
    } else {
      await ref.update(
        defined({ ...content, ...(read !== undefined ? { read } : {}), updatedAt: FieldValue.serverTimestamp() })
      );
    }
  } catch (err: any) {
    // create(): already written by an earlier delivery of this event.
    // update(): nothing to update (e.g. payment confirmed without a submission).
    if (err?.code === ALREADY_EXISTS || err?.code === NOT_FOUND) return;
    throw err;
  }
}

export const onOrderLifecycle = onDocumentWritten(
  { document: "orders/{orderId}", ...WITH_EMAIL },
  async (event) => {
    const orderId = event.params.orderId;
    const results = await runOrderSideEffects(event.data?.before?.data(), event.data?.after?.data(), orderId, {
      writeNotification: applyNotification,
      sendStatusEmail: sendOrderStatusEmail,
    });
    for (const r of results) {
      if (!r.ok) console.error(`[onOrderLifecycle] ${orderId} ${r.label} failed:`, r.error);
    }
  }
);
