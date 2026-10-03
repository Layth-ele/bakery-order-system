/**
 * orderDocument — the ONE description of an order used by every document:
 * on-screen invoice preview, PDF (print / share) and Excel.
 *
 *   documentDays()   only the delivery days that have quantities (+ dates)
 *   documentLines()  items with per-day quantities at the price CHARGED
 *                    (item.price — never today's catalogue price)
 *   documentTotals() the totals rows, in the order every format shows them
 *   changeNotices()  "Changes to this order": credit, fees, cancellations,
 *                    bakery edits, payment … built from the order and its
 *                    change history (orderEditHistory, written by the server)
 *
 * Documents are always built from the live order when opened/downloaded, so
 * they reflect every change.
 */
import type { Order } from '../../types';
import { discountOn } from '../../functions/src/lib/orderRevision';
import { gstLabel, orderAmountDue } from '../orderMoney';
import { getWeekDayDate, formatShortDate } from '../weekUtils';
import { toDate } from '../timestampFormatting';

export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type DayKey = (typeof DAY_KEYS)[number];
const SHORT: Record<DayKey, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number) => Math.round(n * 100) / 100;

export interface DocDay {
  key: DayKey;
  /** "Wed" */
  short: string;
  /** "10/7" ('' when the order has no week) */
  date: string;
}

export interface DocLine {
  productId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  qty: Record<DayKey, number>;
  total: number;
  price: number;
  amount: number;
}

export interface DocTotalRow {
  label: string;
  amount: number;
  kind: 'line' | 'discount' | 'total' | 'credit' | 'due' | 'paid';
}

export interface ChangeNotice {
  at: Date | null;
  title: string;
  detail: string;
  tone: 'info' | 'credit' | 'fee' | 'warn' | 'ok';
}

/** Change-history record (orderEditHistory, written by Cloud Functions). */
export interface OrderChange {
  kind?: string;
  editedAt?: unknown;
  reason?: string;
  changesSummary?: string;
  originalTotal?: number;
  newTotal?: number;
  creditIssued?: number;
  cancellationFee?: number;
  itemsChanged?: Array<{ productName?: string; originalQuantity?: number; newQuantity?: number }>;
}

const itemQty = (item: any, day: DayKey): number => Math.max(0, num(item?.[day]));

/** Delivery days with any quantity (all 7 only if the order has none). */
export function documentDays(order: Pick<Order, 'items' | 'week' | 'year'>): DocDay[] {
  const items = Array.isArray(order.items) ? order.items : [];
  const active = DAY_KEYS.filter((d) => items.some((it) => itemQty(it, d) > 0));
  const days = active.length > 0 ? active : [...DAY_KEYS];
  const week = num(order.week);
  const year = num((order as any).year) || new Date().getFullYear();
  return days.map((key) => {
    let date = '';
    if (week > 0) {
      try { date = formatShortDate(getWeekDayDate(week, DAY_KEYS.indexOf(key), year)); } catch { date = ''; }
    }
    return { key, short: SHORT[key], date };
  });
}

/** Items at the charged price, grouped/sorted by category then name. */
export function documentLines(
  order: Pick<Order, 'items'>,
  products: Array<{ id: string; name?: string; categoryId?: string }> = [],
  categories: Array<{ id: string; name?: string; order?: number }> = []
): DocLine[] {
  const prod = new Map(products.map((p) => [p.id, p]));
  const cat = new Map(categories.map((c) => [c.id, c]));
  const items = Array.isArray(order.items) ? order.items : [];
  return items
    .map((it: any) => {
      const p = prod.get(it.productId);
      const c = p?.categoryId ? cat.get(p.categoryId) : undefined;
      const qty = Object.fromEntries(DAY_KEYS.map((d) => [d, itemQty(it, d)])) as Record<DayKey, number>;
      const total = DAY_KEYS.reduce((s, d) => s + qty[d], 0);
      const price = money(num(it.price));
      const rawName = it.productName;
      const name = (typeof rawName === 'string' && rawName) || rawName?.en || p?.name || it.name || 'Product';
      return {
        productId: String(it.productId ?? ''),
        name,
        categoryId: c?.id ?? '',
        categoryName: c?.name ?? 'Other items',
        categoryOrder: typeof c?.order === 'number' ? c.order : 999,
        qty,
        total,
        price,
        amount: money(price * total),
      };
    })
    .filter((l) => l.total > 0)
    .sort((a, b) => a.categoryOrder - b.categoryOrder || a.categoryName.localeCompare(b.categoryName) || a.name.localeCompare(b.name));
}

/** Totals rows exactly as charged (same rules as the server). */
export function documentTotals(order: Order): DocTotalRow[] {
  const o = order as any;
  const subtotal = num(o.subtotal);
  const discount = discountOn(subtotal, o);
  const gst = num(o.gst);
  const delivery = num(o.deliveryFee);
  const service = o.serviceChargeWaived ? 0 : num(o.serviceCharge);
  const fee = num(o.cancellationFee);
  const total = num(o.total);
  const credit = num(o.creditApplied);
  const paid = o.paymentReceived === true || o.status === 'completed' || o.status === 'in_process';
  const pct = num(o.discountPercentage);

  const rows: DocTotalRow[] = [{ label: 'Subtotal', amount: subtotal, kind: 'line' }];
  if (discount > 0) rows.push({ label: pct > 0 ? `Discount (${pct}%)` : 'Discount', amount: -discount, kind: 'discount' });
  rows.push({ label: delivery > 0 ? 'Delivery' : 'Delivery (free)', amount: delivery, kind: 'line' });
  if (service > 0) rows.push({ label: 'Service charge', amount: service, kind: 'line' });
  if (fee > 0) rows.push({ label: 'Cancellation fee', amount: fee, kind: 'line' });
  rows.push({ label: gstLabel(gst, subtotal - discount), amount: gst, kind: 'line' });
  rows.push({ label: 'Total', amount: total, kind: 'total' });
  if (credit > 0) rows.push({ label: 'Store credit applied', amount: -credit, kind: 'credit' });
  if (o.status !== 'cancelled' && o.status !== 'rejected') {
    rows.push(
      paid
        ? { label: credit > 0 && orderAmountDue(o) === 0 ? 'Paid with store credit' : 'Paid', amount: orderAmountDue(o), kind: 'paid' }
        : { label: 'Amount due', amount: orderAmountDue(o), kind: 'due' }
    );
    // Paid orders reduced later: the difference went back as store credit, so
    // total + returned = what was paid (cash + credit used).
    if (paid && num(o.creditIssued) > 0) {
      rows.push({ label: 'Returned as store credit (after changes)', amount: num(o.creditIssued), kind: 'credit' });
    }
  }
  return rows;
}

const fmt = (n: number) => `$${money(n).toFixed(2)}`;
const FULL: Record<DayKey, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};
/** "Cancelled tuesday, friday" → "Tuesday, Friday" */
const prettyDays = (text: string): string =>
  text.replace(/^Cancelled\s+/i, '').replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, (d) => FULL[d.toLowerCase() as DayKey]);
const dayList = (days: unknown): string =>
  Array.isArray(days) ? days.map((d) => SHORT[d as DayKey] ?? String(d)).join(', ') : '';

/** Everything that happened to the order's money/items, oldest first. */
export function changeNotices(order: Order, history: OrderChange[] = []): ChangeNotice[] {
  const o = order as any;
  const out: ChangeNotice[] = [];
  const credit = num(o.creditApplied);

  if (credit > 0) {
    out.push({ at: toDate(o.createdAt), title: 'Store credit applied', detail: `${fmt(credit)} of store credit taken off this order.`, tone: 'credit' });
  }
  if (o.approvedAt) {
    out.push({
      at: toDate(o.approvedAt),
      title: 'Approved by the bakery',
      detail: `Delivery fee confirmed: ${num(o.deliveryFee) > 0 ? fmt(num(o.deliveryFee)) : 'free'}.` +
        (o.creditReturnedNoteId ? ' Store credit beyond the order total was returned to your account.' : ''),
      tone: 'ok',
    });
  }
  if (num(o.discount) > 0 || num(o.discountPercentage) > 0) {
    const what = num(o.discountPercentage) > 0 ? `${num(o.discountPercentage)}%` : fmt(num(o.discount));
    out.push({ at: toDate(o.editedAt) ?? toDate(o.approvedAt), title: 'Discount', detail: `${what} off${o.discountNote ? ` — ${o.discountNote}` : ''}.`, tone: 'credit' });
  }

  for (const h of history) {
    const at = toDate(h.editedAt as any);
    const items = (h.itemsChanged ?? [])
      .filter((c) => c && num(c.newQuantity) !== num(c.originalQuantity))
      .map((c) => `${c.productName ?? 'Item'} ${num(c.originalQuantity)} → ${num(c.newQuantity)}`)
      .join(', ');
    const totals = h.originalTotal !== undefined && h.newTotal !== undefined ? ` Total ${fmt(num(h.originalTotal))} → ${fmt(num(h.newTotal))}.` : '';
    if (h.kind === 'partial_cancel') {
      out.push({
        at,
        title: `Delivery day${/,/.test(h.changesSummary ?? '') ? 's' : ''} cancelled`,
        detail: `${prettyDays(h.changesSummary ?? '')}${h.reason ? ` — ${h.reason}` : ''}.${totals}` +
          (num(h.creditIssued) > 0 ? ` ${fmt(num(h.creditIssued))} returned as store credit.` : '') +
          (num(h.cancellationFee) > 0 ? ` Cancellation fee ${fmt(num(h.cancellationFee))}.` : ''),
        tone: 'fee',
      });
    } else if (h.kind === 'paid_edit') {
      out.push({
        at,
        title: 'Changed after payment',
        detail: `${h.reason ? `${h.reason}. ` : ''}${items ? `${items}.` : ''}${totals}` +
          (num(h.creditIssued) > 0 ? ` ${fmt(num(h.creditIssued))} returned as store credit.` : ''),
        tone: 'credit',
      });
    } else {
      out.push({
        at,
        title: 'Changed by the bakery',
        detail: `${items ? `${items}.` : h.changesSummary ? `${h.changesSummary}.` : ''}${totals}` +
          (num(h.creditIssued) > 0 ? ` ${fmt(num(h.creditIssued))} store credit no longer needed — returned to your account.` : ''),
        tone: 'info',
      });
    }
  }

  if (o.paymentSubmitted === true && o.paymentSubmittedAt && !o.paymentReceived) {
    out.push({ at: toDate(o.paymentSubmittedAt), title: 'Payment submitted', detail: 'Waiting for the bakery to confirm the e-transfer.', tone: 'info' });
  }
  if (o.paymentReceived === true) {
    out.push({
      at: toDate(o.paidAt) ?? toDate(o.paymentConfirmedAt),
      title: o.paymentMethod === 'credit' ? 'Paid with store credit' : 'Payment confirmed',
      detail: o.paymentMethod === 'credit' ? 'Store credit covered the full amount.' : `${fmt(orderAmountDue(o))} received.`,
      tone: 'ok',
    });
  }
  if (o.status === 'cancelled') {
    const fee = num(o.cancellationFee);
    out.push({
      at: toDate(o.cancelledAt),
      title: 'Order cancelled',
      detail: `${o.cancellationReason ? `${o.cancellationReason}. ` : ''}` +
        (num(o.creditAmount) > 0 ? `${fmt(num(o.creditAmount))} returned as store credit.` : 'Nothing was charged.') +
        (fee > 0 ? ` Cancellation fee ${fmt(fee)}.` : '') +
        (o.cancelledDays ? ` Days: ${dayList(o.cancelledDays)}.` : ''),
      tone: 'warn',
    });
  }
  if (o.status === 'rejected') {
    out.push({
      at: toDate(o.rejectedAt),
      title: 'Order not accepted',
      detail: `${o.rejectionReason ? `${o.rejectionReason}. ` : ''}` +
        (num(o.creditAmount) > 0 ? `${fmt(num(o.creditAmount))} store credit returned.` : 'Nothing was charged.'),
      tone: 'warn',
    });
  }
  if (o.status === 'completed') {
    out.push({ at: toDate(o.completedAt), title: 'Completed', detail: 'Delivered — this is the final invoice.', tone: 'ok' });
  }

  return out.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
}

/** "Oct 3, 2026" — dates on notices. */
export const noticeDate = (d: Date | null): string =>
  d ? d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
