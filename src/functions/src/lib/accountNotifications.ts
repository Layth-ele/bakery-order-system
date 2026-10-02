/**
 * accountNotifications — in-app notifications for admin actions that are not
 * an order status change: payment reminders, store credit, order edits,
 * partial cancellations and credit payout requests.
 *
 * Written by the Cloud Function that performs the action (never by the
 * browser), with deterministic ids so a retried call can't duplicate one.
 * Order status notifications live in ./orderNotifications (written by the
 * onOrderLifecycle trigger).
 *
 * `type` values must exist in the web app's NOTIFICATION_TYPES
 * (src/types/notification-contract.ts); a unit test enforces this.
 *
 * Pure: no Firebase imports.
 */
import { money } from "./emailLayout";
import type { NotificationWrite } from "./orderNotifications";
import type { ItemChange } from "./orderRevision";

export const ACCOUNT_NOTIFICATION_TYPES = [
  "PAYMENT_REMINDER",
  "CREDIT_ISSUED",
  "ORDER_EDITED",
  "CREDIT_PAYOUT_REQUESTED",
] as const;
export type AccountNotificationType = (typeof ACCOUNT_NOTIFICATION_TYPES)[number];

interface OrderRef {
  orderId: string;
  orderNumber: string;
  weekRange: string;
  customerId: string;
  customerName: string;
}

const describe = (o: OrderRef) => (o.weekRange ? `${o.orderNumber} (${o.weekRange})` : o.orderNumber);
const viewOrder = (orderId: string, label = "View Order") => ({ type: "VIEW_ORDER", label, payload: { orderId } });
const viewAccount = (label = "View Credit Balance") => ({ type: "view_account", label });

function changesSummary(changes: ItemChange[]): string {
  return changes
    .map((c) => `• ${c.productName}: ${c.originalQuantity} → ${c.newQuantity} (${c.quantityChange >= 0 ? "+" : ""}${c.quantityChange})`)
    .join("\n");
}

export function paymentReminderNotification(
  o: OrderRef,
  reminderNumber: number,
  amountDue: number
): NotificationWrite {
  return {
    audience: "customer",
    customerId: o.customerId,
    id: `order_${o.orderId}_reminder_${reminderNumber}`,
    mode: "create",
    content: {
      type: "PAYMENT_REMINDER",
      title: reminderNumber > 1 ? `⏰ Payment Reminder #${reminderNumber}` : "⏰ Payment Reminder",
      message:
        `Payment for order ${describe(o)} is still pending.\n\nAmount due: ${money(amountDue)}` +
        `\n\nPlease submit your payment so we can start production.`,
      orderId: o.orderId,
      customerId: o.customerId,
      customerName: o.customerName,
      amount: amountDue,
      actions: [{ type: "SUBMIT_PAYMENT", label: "Submit Payment Now", payload: { orderId: o.orderId } }],
      metadata: { orderNumber: o.orderNumber, weekRange: o.weekRange, reminderCount: reminderNumber, amountDue },
    },
  };
}

export function creditIssuedNotification(input: {
  creditNoteId: string;
  customerId: string;
  customerName: string;
  amount: number;
  reason: string;
}): NotificationWrite {
  return {
    audience: "customer",
    customerId: input.customerId,
    id: `credit_${input.creditNoteId}`,
    mode: "create",
    content: {
      type: "CREDIT_ISSUED",
      title: "💰 Store Credit Added",
      message: `You've been issued ${money(input.amount)} in store credit${input.reason ? `: ${input.reason}` : "."}`,
      orderId: "",
      customerId: input.customerId,
      customerName: input.customerName,
      amount: input.amount,
      actions: [viewAccount("View Account")],
      metadata: { creditNoteId: input.creditNoteId, creditAmount: input.amount, amount: input.amount, reason: input.reason, customerId: input.customerId },
    },
  };
}

/** Admin changed an unpaid (approved) order: new amount due. */
export function orderUpdatedNotification(o: OrderRef, editId: string, amountDue: number, creditReturned: number): NotificationWrite {
  return {
    audience: "customer",
    customerId: o.customerId,
    id: `order_${o.orderId}_edit_${editId}`,
    mode: "create",
    content: {
      type: "ORDER_EDITED",
      title: "✏️ Order Updated",
      message:
        `Your order ${describe(o)} was updated by our team.\n\nNew amount due: ${money(amountDue)}` +
        (creditReturned > 0 ? `\n\n💰 ${money(creditReturned)} store credit was returned to your account.` : ""),
      orderId: o.orderId,
      customerId: o.customerId,
      customerName: o.customerName,
      amount: amountDue,
      actions: [viewOrder(o.orderId)],
      metadata: { orderNumber: o.orderNumber, weekRange: o.weekRange, amountDue, creditAmount: creditReturned },
    },
  };
}

/** Admin reduced a paid order (or cancelled some of its days): credit issued. */
export function orderReducedNotification(
  o: OrderRef,
  editId: string,
  input: { credit: number; reason: string; changes?: ItemChange[]; cancelledDays?: string[] }
): NotificationWrite {
  const what = input.cancelledDays?.length
    ? `Cancelled delivery days: ${input.cancelledDays.map((d) => d[0].toUpperCase() + d.slice(1)).join(", ")}`
    : input.changes?.length
      ? `Changes:\n${changesSummary(input.changes)}`
      : "";
  return {
    audience: "customer",
    customerId: o.customerId,
    id: `order_${o.orderId}_edit_${editId}`,
    mode: "create",
    content: {
      type: "ORDER_EDITED",
      title: input.credit > 0 ? "✏️ Order Changed — Credit Issued" : "✏️ Order Changed",
      message:
        `Your order ${describe(o)} was changed by our team.` +
        (input.reason ? `\n\nReason: ${input.reason}` : "") +
        (what ? `\n\n${what}` : "") +
        (input.credit > 0 ? `\n\n💰 Store credit issued: ${money(input.credit)}. You can use it on future orders.` : ""),
      orderId: o.orderId,
      customerId: o.customerId,
      customerName: o.customerName,
      amount: input.credit,
      actions: [viewOrder(o.orderId), ...(input.credit > 0 ? [viewAccount()] : [])],
      metadata: {
        orderNumber: o.orderNumber,
        weekRange: o.weekRange,
        creditAmount: input.credit,
        reason: input.reason,
        ...(input.changes ? { itemsChanged: input.changes } : {}),
        ...(input.cancelledDays ? { cancelledDays: input.cancelledDays } : {}),
      },
    },
  };
}

export function payoutRequestedNotification(input: {
  creditNoteId: string;
  customerId: string;
  customerName: string;
  amount: number;
}): NotificationWrite {
  return {
    audience: "admin",
    id: `payout_${input.creditNoteId}`,
    mode: "create",
    content: {
      type: "CREDIT_PAYOUT_REQUESTED",
      title: "💸 Credit Payout Requested",
      message: `${input.customerName || "A customer"} asked to be paid out ${money(input.amount)} of store credit.`,
      orderId: "",
      customerId: input.customerId,
      customerName: input.customerName,
      amount: input.amount,
      actions: [{ type: "view_account", label: "View Customer", payload: { customerId: input.customerId } }],
      metadata: { creditNoteId: input.creditNoteId, amount: input.amount, customerId: input.customerId },
    },
  };
}
