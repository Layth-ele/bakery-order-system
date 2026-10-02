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
