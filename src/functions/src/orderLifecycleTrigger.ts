/**
 * onOrderLifecycle — the single place order side effects happen.
 *
 * Fires on every write to orders/{orderId}, derives lifecycle events with
 * lib/orderLifecycle.detectOrderEvents(), and for each event:
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
import { detectOrderEvents, type OrderEvent } from "./lib/orderLifecycle";
import { buildOrderNotifications, type NotificationWrite } from "./lib/orderNotifications";
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

function emailStatusFor(e: OrderEvent): string | null {
  if (e.kind === "placed") return "pending";
  if (e.kind === "status") return e.to;
  return null;
}

export const onOrderLifecycle = onDocumentWritten(
  { document: "orders/{orderId}", ...WITH_EMAIL },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const events = detectOrderEvents(before, after);
    if (!after || events.length === 0) return;

    const orderId = event.params.orderId;
    const tasks: Array<{ label: string; run: () => Promise<void> }> = [];
    for (const e of events) {
      const label = e.kind === "status" ? `status:${e.from}->${e.to}` : e.kind;
      for (const w of buildOrderNotifications(e, after, orderId)) {
        tasks.push({ label: `${label} notification ${w.id}`, run: () => applyNotification(w) });
      }
      const status = emailStatusFor(e);
      if (status) tasks.push({ label: `${label} email`, run: () => sendOrderStatusEmail(orderId, status, after) });
    }

    // Independent side effects: one failing must not block the others.
    const results = await Promise.allSettled(tasks.map((t) => t.run()));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[onOrderLifecycle] ${orderId} ${tasks[i].label} failed:`, r.reason);
      }
    });
  }
);
