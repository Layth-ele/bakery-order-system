/**
 * orderNotifications — the in-app notification for every order lifecycle
 * event (see ./orderLifecycle). The onOrderLifecycle trigger is the ONLY
 * writer of these; no Cloud Function or client screen writes lifecycle
 * notifications itself.
 *
 * Ids are deterministic (`order_{orderId}_{event}`) and written with
 * create(), so a retried trigger — or two paths changing the same status —
 * can never produce a duplicate.
 *
 * `type` values must exist in the web app's NOTIFICATION_TYPES
 * (src/types/notification-contract.ts); a unit test enforces this.
 *
 * Pure: no Firebase imports.
 */
import type { OrderEvent } from "./orderLifecycle";
import type { AccountNotificationType } from "./accountNotifications";
import { normalizeOrder, type EmailOrder } from "./emailContent";
import { money } from "./emailLayout";

export const ORDER_NOTIFICATION_TYPES = [
  "ORDER_PLACED_TRACKING",
  "ORDER_APPROVED_PAY_REQUIRED",
  "ORDER_REJECTED",
  "ORDER_CANCELLED",
  "PAYMENT_SUBMITTED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_CONFIRMED_ADMIN",
  "ORDER_COMPLETED",
] as const;
export type OrderNotificationType = (typeof ORDER_NOTIFICATION_TYPES)[number];

export interface NotificationAction {
  type: string;
  label: string;
  payload?: Record<string, unknown>;
}

export interface NotificationContent {
  type: OrderNotificationType | AccountNotificationType;
  title: string;
  message: string;
  orderId: string;
  customerId: string;
  customerName: string;
  amount?: number;
  invoiceId?: string;
  actions: NotificationAction[];
  metadata: Record<string, unknown>;
  read?: boolean;
}

export type NotificationWrite =
  | { audience: "admin"; id: string; mode: "create"; content: NotificationContent }
  | { audience: "customer"; customerId: string; id: string; mode: "create"; content: NotificationContent }
  /** Update an existing admin notification in place; skipped if it doesn't exist. */
  | { audience: "admin"; id: string; mode: "update"; content: NotificationContent };

export const notificationId = (orderId: string, event: string) => `order_${orderId}_${event}`;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function describe(o: EmailOrder): string {
  return o.weekRange ? `${o.number} (${o.weekRange})` : o.number;
}

export function buildOrderNotifications(
  event: OrderEvent,
  raw: Record<string, unknown>,
  orderId: string
): NotificationWrite[] {
  const o = normalizeOrder(raw, orderId);
  const customerId = str(raw.customerId);
  const base = {
    orderId,
    customerId,
    customerName: o.storeName,
  };
  const viewOrder = { type: "VIEW_ORDER", label: "View Order", payload: { orderId } };
  const orderMeta = { orderNumber: o.number, weekRange: o.weekRange, total: o.total, customerId, customerName: o.storeName };
  const toCustomer = (event: string, content: NotificationContent): NotificationWrite[] =>
    customerId ? [{ audience: "customer", customerId, id: notificationId(orderId, event), mode: "create", content }] : [];

  if (event.kind === "placed") {
    return [
      {
        audience: "admin",
        id: notificationId(orderId, "placed"),
        mode: "create",
        content: {
          ...base,
          type: "ORDER_PLACED_TRACKING",
          title: "📦 New Order Placed",
          message: `New order ${describe(o)} from ${o.storeName || "a customer"} — ${money(o.total)}. Ready for review.`,
          amount: o.total,
          actions: [{ type: "VIEW_ORDER", label: "Review Order", payload: { orderId } }],
          metadata: { ...orderMeta, status: "pending" },
        },
      },
    ];
  }

  if (event.kind === "payment_submitted") {
    const paymentRef = str(raw.paymentReference) || str(raw.invoiceNumber);
    return [
      {
        audience: "admin",
        id: notificationId(orderId, "payment"),
        mode: "create",
        content: {
          ...base,
          type: "PAYMENT_SUBMITTED",
          title: "💳 Payment Submitted — Review Required",
          message:
            `${o.storeName || "A customer"} submitted payment for order ${describe(o)}.` +
            (paymentRef ? `\n\nReference: ${paymentRef}` : "") +
            `\n\nPlease review and confirm payment.`,
          amount: o.amountDue,
          actions: [{ type: "CONFIRM_PAYMENT", label: "Confirm Payment", payload: { orderId, paymentRef } }],
          metadata: {
            ...orderMeta,
            amount: o.amountDue,
            paymentMethod: str(raw.paymentMethod),
            paymentRef,
            invoiceNumber: o.invoiceNumber,
          },
        },
      },
    ];
  }

  switch (event.to) {
    case "approved":
      return toCustomer("approved", {
        ...base,
        type: "ORDER_APPROVED_PAY_REQUIRED",
        title: "✅ Order Approved — Payment Required",
        message: `Your order ${describe(o)} has been approved!\n\nAmount due: ${money(o.amountDue)}\n\nPlease submit your payment to proceed with production.`,
        amount: o.amountDue,
        actions: [{ type: "SUBMIT_PAYMENT", label: "Submit Payment", payload: { orderId } }],
        metadata: { ...orderMeta, amountDue: o.amountDue, gst: o.gst, deliveryFee: o.deliveryFee },
      });

    case "rejected":
      return toCustomer("rejected", {
        ...base,
        type: "ORDER_REJECTED",
        title: "❌ Order Not Accepted",
        message:
          `Your order ${describe(o)} was not accepted.` +
          (o.rejectionReason ? `\n\nReason: ${o.rejectionReason}` : "") +
          (num(raw.creditAmount) > 0
            ? `\n\n💰 The ${money(num(raw.creditAmount))} store credit used on this order is back in your account.`
            : "") +
          `\n\nPlease contact us if you have any questions.`,
        actions: [{ ...viewOrder, label: "View Details" }],
        metadata: { ...orderMeta, reason: o.rejectionReason, creditAmount: num(raw.creditAmount) },
      });

    case "cancelled": {
      const credit = num(raw.creditAmount);
      return toCustomer("cancelled", {
        ...base,
        type: "ORDER_CANCELLED",
        title: "🚫 Order Cancelled",
        message:
          `Your order ${describe(o)} has been cancelled.` +
          (o.cancellationReason ? `\n\nReason: ${o.cancellationReason}` : "") +
          (credit > 0
            ? `\n\n💰 ${money(credit)} store credit has been added to your account.` +
              (num(raw.cancellationFee) > 0 ? ` A ${money(num(raw.cancellationFee))} cancellation fee was kept.` : "")
            : "") +
          `\n\nPlease contact us if you have any questions.`,
        amount: credit || undefined,
        actions: [{ ...viewOrder, label: "View Details" }],
        metadata: { ...orderMeta, reason: o.cancellationReason, creditAmount: credit },
      });
    }

    case "in_process":
      return [
        ...toCustomer("paid", {
          ...base,
          type: "PAYMENT_CONFIRMED",
          title: "🎉 Payment Confirmed — Order in Production",
          message:
            raw.paymentMethod === "credit"
              ? `Your order ${describe(o)} was approved and paid in full with your store credit.\n\n✓ Nothing to pay\n✓ Your order is now in production\n\nThank you for your business!`
              : `Your payment for order ${describe(o)} has been confirmed.\n\n✓ Payment received\n✓ Your order is now in production\n\nThank you for your business!`,
          amount: o.amountDue,
          actions: [{ ...viewOrder, label: "View Production Status" }],
          metadata: { ...orderMeta, amount: o.amountDue, invoiceNumber: o.invoiceNumber },
        }),
        // Resolve the admin's "review required" alert so it doesn't linger.
        {
          audience: "admin",
          id: notificationId(orderId, "payment"),
          mode: "update",
          content: {
            ...base,
            type: "PAYMENT_CONFIRMED_ADMIN",
            title: "✅ Payment Confirmed — Order in Production",
            message: `${o.storeName || "Customer"}'s payment for order ${describe(o)} has been confirmed. Order is now in production.`,
            // What the customer paid (the total less any store credit used).
            amount: o.amountDue,
            actions: [viewOrder],
            metadata: { ...orderMeta, amount: o.amountDue, invoiceNumber: o.invoiceNumber },
            read: true,
          },
        },
      ];

    case "completed": {
      const invoiceId = str(raw.finalInvoiceId);
      return toCustomer("completed", {
        ...base,
        type: "ORDER_COMPLETED",
        title: "✅ Order Complete — Invoice Available",
        message: `Your order ${describe(o)} is complete and your final invoice is ready.\n\nThank you for your business!`,
        amount: o.total,
        ...(invoiceId ? { invoiceId } : {}),
        actions: [{ type: "VIEW_INVOICE", label: "View Invoice", payload: { orderId, ...(invoiceId ? { invoiceId } : {}) } }],
        metadata: { ...orderMeta, invoiceId, invoiceNumber: o.invoiceNumber },
      });
    }

    default:
      // pending (never re-entered), delivered (legacy) — nothing to announce.
      return [];
  }
}
