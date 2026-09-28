/**
 * orderSideEffects — what the onOrderLifecycle trigger does for one order
 * write, with its I/O injected so the whole lifecycle can be tested without
 * Firestore or Resend (see __tests__/orderJourney.test.ts).
 *
 * Idempotency contract the real dependencies must honour:
 *   - writeNotification: `create` writes at most once per id; `update` is a
 *     no-op when the doc doesn't exist.
 *   - sendStatusEmail: sends at most once per orderStatusEmailLogId().
 */
import { detectOrderEvents, type OrderEvent } from "./orderLifecycle";
import { buildOrderNotifications, type NotificationWrite } from "./orderNotifications";
import { isEmailedStatus } from "./emailContent";

export interface OrderSideEffectDeps {
  writeNotification: (w: NotificationWrite) => Promise<void>;
  sendStatusEmail: (orderId: string, status: string, order: Record<string, unknown>) => Promise<void>;
}

export interface SideEffectResult {
  label: string;
  ok: boolean;
  error?: unknown;
}

/** Audit-log id (and Resend idempotency key) for an order status email. */
export const orderStatusEmailLogId = (orderId: string, status: string) => `order_${orderId}_${status}`;

/**
 * Customer email to send for an event ("pending" = order just placed), or
 * null when the event has no email (payment submitted, legacy statuses).
 */
export function emailStatusFor(e: OrderEvent): string | null {
  const status = e.kind === "placed" ? "pending" : e.kind === "status" ? e.to : null;
  return status && isEmailedStatus(status) ? status : null;
}

/**
 * Run every side effect for one order write. Side effects are independent:
 * one failing never blocks the others; failures are returned, not thrown.
 */
export async function runOrderSideEffects(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  orderId: string,
  deps: OrderSideEffectDeps
): Promise<SideEffectResult[]> {
  const events = detectOrderEvents(before, after);
  if (!after || events.length === 0) return [];

  const tasks: Array<{ label: string; run: () => Promise<void> }> = [];
  for (const e of events) {
    const label = e.kind === "status" ? `status:${e.from}->${e.to}` : e.kind;
    for (const w of buildOrderNotifications(e, after, orderId)) {
      tasks.push({ label: `${label} notification ${w.id}`, run: () => deps.writeNotification(w) });
    }
    const status = emailStatusFor(e);
    if (status) tasks.push({ label: `${label} email`, run: () => deps.sendStatusEmail(orderId, status, after) });
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? { label: tasks[i].label, ok: true }
      : { label: tasks[i].label, ok: false, error: r.reason }
  );
}
