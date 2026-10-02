/**
 * notify — the only code that writes in-app notifications
 * (notifications/admin/items/* and notifications/user_{uid}/items/*).
 *
 * Callers: the onOrderLifecycle trigger (order status events) and the admin
 * action Cloud Functions (reminders, credit, edits). The browser never writes
 * notifications; Firestore rules deny it.
 *
 * `create` writes at most once per id (a retry is a no-op); `update` is a
 * no-op when the notification doesn't exist.
 */
import { getFirestore, FieldValue, type Transaction } from "firebase-admin/firestore";
import type { NotificationWrite } from "./lib/orderNotifications";

const db = getFirestore();

// gRPC status codes surfaced by the Admin SDK.
const ALREADY_EXISTS = 6;
const NOT_FOUND = 5;

/** Firestore rejects `undefined` values; drop them (shallow is enough here). */
function defined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function notificationRef(w: NotificationWrite) {
  const parent = w.audience === "admin" ? "admin" : `user_${w.customerId}`;
  return db.collection("notifications").doc(parent).collection("items").doc(w.id);
}

function createData(w: NotificationWrite) {
  const { read, ...content } = w.content;
  return defined({
    id: w.id,
    ...content,
    read: read ?? false,
    source: "server",
    createdAt: FieldValue.serverTimestamp(),
    timestamp: FieldValue.serverTimestamp(),
  });
}

export async function writeNotification(w: NotificationWrite): Promise<void> {
  const ref = notificationRef(w);
  try {
    if (w.mode === "create") {
      await ref.create(createData(w));
    } else {
      const { read, ...content } = w.content;
      await ref.update(defined({ ...content, ...(read !== undefined ? { read } : {}), updatedAt: FieldValue.serverTimestamp() }));
    }
  } catch (err: any) {
    // create(): already written by an earlier attempt.
    // update(): nothing to update.
    if (err?.code === ALREADY_EXISTS || err?.code === NOT_FOUND) return;
    throw err;
  }
}

/**
 * Create a notification inside a transaction, so it commits together with
 * the change it announces. The id must be unique to that change.
 */
export function createNotificationInTx(tx: Transaction, w: NotificationWrite): void {
  if (w.mode !== "create") throw new Error("createNotificationInTx only creates");
  tx.create(notificationRef(w), createData(w));
}
