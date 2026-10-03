/**
 * Amount the customer pays for an order — the one definition the screens
 * use (same rule as the server, functions/src/lib/orderPlacement.ts):
 *   amountDue = total − creditApplied (never below 0), stored by the server.
 */
import type { Order } from '../types';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function orderAmountDue(order: Pick<Order, 'total'> & { amountDue?: unknown; creditApplied?: unknown }): number {
  if (typeof order.amountDue === 'number' && Number.isFinite(order.amountDue)) return Math.max(0, order.amountDue);
  return Math.max(0, Math.round((num(order.total) - num(order.creditApplied)) * 100) / 100);
}

/**
 * "GST (5%)" label from the amounts actually charged, so it stays right when
 * the rate in Settings changes. Falls back to plain "GST".
 */
export function gstLabel(gst: unknown, taxableBase: unknown): string {
  const g = num(gst);
  const b = num(taxableBase);
  if (g <= 0 || b <= 0) return 'GST';
  const pct = Math.round((g / b) * 1000) / 10; // one decimal, e.g. 5 or 12.5
  return `GST (${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%)`;
}

// ── Revenue — one definition for analytics, reports and exports ────────────

/** Orders that are sales: accepted by the bakery and not cancelled. */
export const SALE_STATUSES = ['approved', 'in_process', 'completed'] as const;

export const isSaleOrder = (order: { status?: unknown }): boolean =>
  (SALE_STATUSES as readonly unknown[]).includes(order.status);

/**
 * What the bakery earns from an order: the invoice total for a sale (GST,
 * fees and any kept cancellation fee included), the cancellation fee kept on
 * a cancelled order, nothing for pending or rejected orders.
 */
export function orderRevenue(order: { status?: unknown; total?: unknown; cancellationFee?: unknown }): number {
  if (isSaleOrder(order)) return num(order.total);
  if (order.status === 'cancelled') return num(order.cancellationFee);
  return 0;
}

/** Money for one order line: unit price × quantity (item.total is the quantity). */
export const lineAmount = (item: { price?: unknown; total?: unknown }): number =>
  Math.round(num(item.price) * num(item.total) * 100) / 100;
