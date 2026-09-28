/**
 * orderLifecycle — THE single definition of the order lifecycle.
 *
 * Imported by the Cloud Functions (transition enforcement, notification and
 * email triggers) AND by the web app (src/utils/stateTransitionRules.ts,
 * src/schemas/order/orderEnums.schema.ts), so server and client can never
 * disagree. Pure: no Firebase imports.
 *
 *   pending ──► approved ──► in_process ──► completed
 *      │           │  └──(already paid)──────►┘
 *      │           │              │
 *      ├─► rejected └─► cancelled ◄┘
 *      └─► cancelled
 *
 *   pending     customer placed the order; waiting for admin review
 *   approved    admin approved; customer owes payment
 *   in_process  admin confirmed payment; order is in production
 *   completed   order finalized and invoiced (manually or by the weekly
 *               auto-complete). Terminal.
 *   rejected    admin declined a pending order. Terminal.
 *   cancelled   order cancelled at any non-terminal stage. Terminal.
 *
 *   delivered   LEGACY. Nothing sets it any more; accepted when reading old
 *               documents, and those orders can still complete or cancel.
 */

export const ORDER_STATUSES = [
  "pending",
  "approved",
  "in_process",
  "completed",
  "rejected",
  "cancelled",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlyArray<OrderStatus> = ["completed", "rejected", "cancelled"];

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = {
  pending: ["approved", "rejected", "cancelled"],
  // approved → completed covers orders whose payment was recorded without
  // passing through in_process (auto-complete requires paymentReceived).
  approved: ["in_process", "completed", "cancelled"],
  in_process: ["completed", "cancelled"],
  delivered: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

export function canTransitionOrderStatus(from: unknown, to: unknown): boolean {
  return isOrderStatus(from) && isOrderStatus(to) && ORDER_TRANSITIONS[from].includes(to);
}

// ── Events ──────────────────────────────────────────────────────────────────

/**
 * What happened to an order, derived from its before/after snapshots. The
 * lifecycle trigger turns each event into notifications and emails, so every
 * writer (Cloud Function, admin screen, force-status tool) produces exactly
 * the same side effects.
 */
export type OrderEvent =
  | { kind: "placed" }
  | { kind: "status"; from: OrderStatus | null; to: OrderStatus }
  | { kind: "payment_submitted" };

type Doc = Record<string, unknown> | null | undefined;

export function detectOrderEvents(before: Doc, after: Doc): OrderEvent[] {
  if (!after) return []; // deleted
  const events: OrderEvent[] = [];
  const to = after.status;

  if (!before) {
    if (to === "pending") events.push({ kind: "placed" });
    return events;
  }

  const from = before.status;
  if (from !== to && isOrderStatus(to)) {
    events.push({ kind: "status", from: isOrderStatus(from) ? from : null, to });
  }
  if (before.paymentSubmitted !== true && after.paymentSubmitted === true) {
    events.push({ kind: "payment_submitted" });
  }
  return events;
}
