/**
 * invoiceDocument — the one professional invoice/order document.
 *
 * Used for the PDF (print / save / share) and shown as-is inside the
 * on-screen invoice preview, so every place looks the same. Content comes
 * from:
 *   - Settings: business name/address/phone/email, GST/HST number, logo,
 *     payment methods + e-transfer address, policies
 *   - the order's real state (payment due / in review / paid / completed /
 *     cancelled / rejected) and its change history
 *   - utils/documents/orderDocument: only ordered days, charged prices,
 *     totals rows, change notices
 */
import type { Order } from '../../types';
import {
  changeNotices,
  documentDays,
  documentLines,
  documentTotals,
  noticeDate,
  type OrderChange,
} from '../documents/orderDocument';
import { DAYS, deliveryNoon } from '../../functions/src/lib/orderPlacement';
import { resolvePolicy } from '../../functions/src/lib/settingsValues';
import { toDate } from '../timestampFormatting';

export type DocumentKind = 'invoice' | 'production';

export interface InvoiceDocumentInput {
  order: Order;
  products: Array<{ id: string; name?: string; categoryId?: string }>;
  categories: Array<{ id: string; name?: string; order?: number }>;
  settings: Record<string, any>;
  changes?: OrderChange[];
  kind?: DocumentKind;
  /** false inside the in-app preview (it has its own buttons). */
  printButton?: boolean;
}

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;
const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const fmtDateTime = (d: Date) =>
  d.toLocaleString('en-CA', { timeZone: 'America/Vancouver', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The order's real state, for the title and status pill. */
function stateOf(o: any, kind: DocumentKind): { title: string; label: string; tone: string } {
  if (kind === 'production') return { title: 'Production Sheet', label: 'Internal copy', tone: 'neutral' };
  switch (o.status) {
    case 'pending': return { title: 'Order Confirmation', label: 'Pending review', tone: 'amber' };
    case 'rejected': return { title: 'Order Summary', label: 'Not accepted', tone: 'red' };
    case 'cancelled': return { title: 'Order Summary', label: 'Cancelled', tone: 'red' };
    case 'completed': return { title: 'Invoice', label: 'Paid · Completed', tone: 'green' };
    case 'in_process': return { title: 'Invoice', label: o.paymentMethod === 'credit' ? 'Paid with store credit' : 'Paid', tone: 'green' };
    default:
      return o.paymentReceived === true
        ? { title: 'Invoice', label: 'Paid', tone: 'green' }
        : o.paymentSubmitted === true
          ? { title: 'Invoice', label: 'Payment in review', tone: 'blue' }
          : { title: 'Invoice', label: 'Payment due', tone: 'amber' };
  }
}

/** Pay this many hours (Settings → payment due) before the first delivery day's noon. */
function paymentDueBy(o: any, dueHours: number): Date | null {
  const year = Number(o.year), week = Number(o.week);
  if (!Number.isInteger(year) || !Number.isInteger(week)) return null;
  const items = Array.isArray(o.items) ? o.items : [];
  const first = DAYS.find((d) => items.some((it: any) => Number(it?.[d]) > 0));
  return first ? new Date(deliveryNoon(year, week, first).getTime() - dueHours * 3_600_000) : null;
}

export function buildInvoiceDocument(input: InvoiceDocumentInput): string {
  const { order, products, categories, settings = {}, changes = [], kind = 'invoice', printButton = true } = input;
  const o = order as any;
  const state = stateOf(o, kind);
  const showPrices = kind !== 'production';
  const days = documentDays(order as any);
  const lines = documentLines(order as any, products, categories);
  const totals = documentTotals(order as any);
  const notices = kind === 'production' ? [] : changeNotices(order as any, changes);
  const unpaid = kind === 'invoice' && o.status === 'approved' && o.paymentReceived !== true;
  const policy = resolvePolicy(settings);
  const dueBy = unpaid ? paymentDueBy(o, policy.paymentDueHours) : null;

  const biz = {
    name: settings.businessName || settings.companyName || 'Bakery',
    address: [settings.businessLocation || settings.companyAddress, settings.businessCity && !String(settings.businessLocation || '').toLowerCase().includes(String(settings.businessCity).toLowerCase()) ? settings.businessCity : '']
      .filter(Boolean).join(', '),
    phone: settings.businessPhone || settings.companyPhone || '',
    email: settings.businessEmail || settings.companyEmail || '',
    gst: settings.businessNumber || settings.gstNumber || '',
    logo: settings.logoUrl || '',
  };
  const invoiceNo = o.invoiceNumber || o.orderNumber || (o.id ? `ORD-···${String(o.id).slice(-6).toUpperCase()}` : '');
  const created = toDate(o.createdAt);
  const paidOn = toDate(o.paidAt) ?? toDate(o.paymentConfirmedAt);
  const customerId = o.customerCode || (o.customerId ? `CUST-···${String(o.customerId).slice(-6).toUpperCase()}` : '');
  const deliveryDays = days.filter((d) => lines.some((l) => l.qty[d.key] > 0)).map((d) => `${d.short} ${d.date}`).join(' · ');

  // Items table (category rows only when there is more than one category)
  const multiCat = new Set(lines.map((l) => l.categoryName)).size > 1;
  const cols = 2 + days.length + (showPrices ? 2 : 0);
  let rows = '';
  lines.forEach((l, i) => {
    if (multiCat && (i === 0 || lines[i - 1].categoryName !== l.categoryName)) {
      rows += `<tr class="cat"><td colspan="${cols}">${esc(l.categoryName)}</td></tr>`;
    }
    rows += `<tr>
      <td class="item">${esc(l.name)}</td>
      ${days.map((d) => `<td class="c">${l.qty[d.key] || '<span class="muted">–</span>'}</td>`).join('')}
      <td class="c strong">${l.total}</td>
      ${showPrices ? `<td class="r">${money(l.price)}</td><td class="r strong">${money(l.amount)}</td>` : ''}
    </tr>`;
  });
  const dayTotals = days.map((d) => lines.reduce((s, l) => s + l.qty[d.key], 0));

  const payTo = settings.paymentAddress || biz.email;
  const methods = [settings.paymentMethod1 || 'Interac e-Transfer', settings.paymentMethod2].filter(Boolean);
  const terms =
    settings.cancellationPolicy ||
    `Orders close ${policy.orderCutoffHours} hours before noon (Vancouver time) on each delivery day. ` +
    `Payment is due ${policy.paymentDueHours} hours before noon on the first delivery day; orders are baked once payment is confirmed. ` +
    `To change or cancel, contact us at least ${policy.cancellationNoticeHours} hours before noon on the delivery day. ` +
    `The cancelled part of a paid order is returned as store credit` +
    (policy.lateCancellationFeePercent > 0 ? `; later cancellations have a ${policy.lateCancellationFeePercent}% fee.` : '.');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(state.title)} ${esc(invoiceNo)} — ${esc(biz.name)}</title>
<style>${INVOICE_CSS}</style>
</head><body>
${printButton ? `<div class="no-print bar"><button onclick="window.print()">Print / Save as PDF</button></div>` : ''}
<main class="doc">
  <header class="top">
    <div class="biz">
      ${biz.logo ? `<img class="logo" src="${esc(biz.logo)}" alt="">` : ''}
      <div class="biz-name">${esc(biz.name)}</div>
      ${biz.address ? `<div>${esc(biz.address)}</div>` : ''}
      <div>${[biz.phone, biz.email].filter(Boolean).map(esc).join(' · ')}</div>
      ${biz.gst ? `<div>GST/HST No. ${esc(biz.gst)}</div>` : ''}
    </div>
    <div class="meta">
      <div class="title">${esc(state.title)}</div>
      <span class="pill ${state.tone}">${esc(state.label)}</span>
      <table class="kv">
        <tr><th>${kind === 'invoice' && o.invoiceNumber ? 'Invoice #' : 'Order #'}</th><td>${esc(invoiceNo)}</td></tr>
        ${o.invoiceNumber && o.orderNumber && o.invoiceNumber !== o.orderNumber ? `<tr><th>Order #</th><td>${esc(o.orderNumber)}</td></tr>` : ''}
        <tr><th>Order date</th><td>${fmtDate(created)}</td></tr>
        ${dueBy ? `<tr><th>Payment due</th><td class="due">${esc(fmtDateTime(dueBy))}</td></tr>` : ''}
        ${paidOn && o.paymentReceived ? `<tr><th>Paid on</th><td>${fmtDate(paidOn)}</td></tr>` : ''}
      </table>
    </div>
  </header>

  <section class="parties">
    <div>
      <div class="label">Bill to</div>
      <div class="strong">${esc(o.customerName || '')}</div>
      ${o.customerContactPerson && o.customerContactPerson !== o.customerName ? `<div>${esc(o.customerContactPerson)}</div>` : ''}
      ${o.customerEmail ? `<div>${esc(o.customerEmail)}</div>` : ''}
      ${o.customerPhone ? `<div>${esc(o.customerPhone)}</div>` : ''}
      ${customerId ? `<div class="muted">Customer ${esc(customerId)}</div>` : ''}
    </div>
    <div>
      <div class="label">Deliver to</div>
      <div>${esc(o.customerAddress || '—')}</div>
      ${o.week ? `<div class="muted">Week ${esc(o.week)}, ${esc(o.year ?? '')}</div>` : ''}
      ${deliveryDays ? `<div>${esc(deliveryDays)}</div>` : ''}
      ${settings.deliveryTimeInfo ? `<div class="muted">${esc(settings.deliveryTimeInfo)}</div>` : ''}
    </div>
  </section>

  ${o.note ? `<section class="note"><span class="label">Customer note</span> ${esc(o.note)}</section>` : ''}

  <div class="table-wrap">
    <table class="items">
      <thead><tr>
        <th class="l">Item</th>
        ${days.map((d) => `<th class="c">${d.short}${d.date ? `<span>${d.date}</span>` : ''}</th>`).join('')}
        <th class="c">Qty</th>
        ${showPrices ? '<th class="r">Unit price</th><th class="r">Amount</th>' : ''}
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="${cols}" class="muted">No items.</td></tr>`}</tbody>
      <tfoot><tr>
        <td class="l">Total</td>
        ${dayTotals.map((t) => `<td class="c">${t || ''}</td>`).join('')}
        <td class="c">${lines.reduce((s, l) => s + l.total, 0)}</td>
        ${showPrices ? `<td></td><td class="r">${money(lines.reduce((s, l) => s + l.amount, 0))}</td>` : ''}
      </tr></tfoot>
    </table>
  </div>

  ${showPrices ? `
  <section class="bottom">
    <div class="left">
      ${unpaid && o.paymentSubmitted !== true ? `
      <div class="pay">
        <div class="label">How to pay</div>
        <div>${methods.map(esc).join(' or ')}${payTo ? ` to <strong>${esc(payTo)}</strong>` : ''}</div>
        <div>Message: <strong>${esc(invoiceNo)}</strong></div>
        ${dueBy ? `<div>Please pay by <strong>${esc(fmtDateTime(dueBy))}</strong> so your order can be baked.</div>` : ''}
      </div>` : ''}
    </div>
    <table class="totals">
      ${totals.map((r) => `<tr class="${r.kind}"><th>${esc(r.label)}</th><td>${money(r.amount)}</td></tr>`).join('')}
    </table>
  </section>` : ''}

  ${notices.length ? `
  <section class="changes">
    <div class="label">Changes to this order</div>
    <ol>${notices.map((n) => `<li class="${n.tone}"><div><strong>${esc(n.title)}</strong>${n.at ? `<span class="muted"> · ${noticeDate(n.at)}</span>` : ''}</div><div>${esc(n.detail)}</div></li>`).join('')}</ol>
  </section>` : ''}

  ${kind === 'invoice' ? `<section class="terms"><div class="label">Terms</div><p>${esc(terms)}</p>${[settings.lateCancellationFee, settings.weeklyOrderPolicy, settings.dailyOrderPolicy].filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('')}</section>` : ''}

  <footer class="foot">
    <div>${kind === 'production' ? 'For bakery use only.' : 'Thank you for your business.'}</div>
    <div>${esc(biz.name)}${biz.email ? ` · ${esc(biz.email)}` : ''}${biz.phone ? ` · ${esc(biz.phone)}` : ''}</div>
  </footer>
</main>
</body></html>`;
}

const INVOICE_CSS = `
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --ink: #1f2937; --muted: #6b7280; --line: #e5e7eb; --soft: #f9fafb; --accent: #8B6F47; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 10pt; line-height: 1.45; color: var(--ink); background: #fff; }
.doc { max-width: 800px; margin: 0 auto; padding: 28px 32px 24px; }
.bar { position: sticky; top: 0; background: #fff; padding: 10px; text-align: center; border-bottom: 1px solid var(--line); }
.bar button { font: inherit; font-weight: 600; padding: 8px 18px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: #fff; cursor: pointer; }
.muted { color: var(--muted); }
.strong { font-weight: 600; }
.label { font-size: 7.5pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }

.top { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid var(--ink); }
.biz { color: var(--muted); font-size: 9pt; }
.biz .logo { max-height: 44px; max-width: 160px; margin-bottom: 6px; }
.biz-name { font-size: 17pt; font-weight: 700; color: var(--ink); margin-bottom: 4px; letter-spacing: -.01em; }
.meta { text-align: right; }
.meta .title { font-size: 20pt; font-weight: 300; letter-spacing: .06em; text-transform: uppercase; color: var(--ink); }
.pill { display: inline-block; margin: 6px 0 8px; padding: 2px 10px; border-radius: 999px; font-size: 8pt; font-weight: 600; border: 1px solid; }
.pill.green { color: #166534; background: #f0fdf4; border-color: #bbf7d0; }
.pill.amber { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.pill.blue  { color: #1e40af; background: #eff6ff; border-color: #bfdbfe; }
.pill.red   { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
.pill.neutral { color: #374151; background: var(--soft); border-color: var(--line); }
.kv { margin-left: auto; border-collapse: collapse; font-size: 9pt; }
.kv th { text-align: left; font-weight: 500; color: var(--muted); padding: 1px 14px 1px 0; white-space: nowrap; }
.kv td { text-align: right; font-weight: 600; white-space: nowrap; }
.kv td.due { color: #92400e; }

.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 16px 0; font-size: 9.5pt; }
.note { padding: 8px 12px; margin-bottom: 12px; background: var(--soft); border-radius: 6px; font-size: 9pt; }
.note .label { display: inline; margin-right: 6px; }

.table-wrap { width: 100%; overflow-x: auto; }
.items { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.items thead th { background: var(--soft); color: #374151; font-size: 7.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  padding: 8px 8px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); white-space: nowrap; }
.items thead th span { display: block; font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--muted); }
.items td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
.items tr.cat td { padding: 10px 8px 4px; border-bottom: 0; font-size: 7.5pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.items .item { font-weight: 500; }
.items tfoot td { font-weight: 700; border-top: 1px solid var(--ink); border-bottom: 0; padding-top: 9px; }
.l { text-align: left; } .c { text-align: center; } .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.items .c { font-variant-numeric: tabular-nums; }

.bottom { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-top: 18px; }
.bottom .left { flex: 1; }
.pay { border-left: 3px solid var(--accent); padding: 8px 12px; background: var(--soft); font-size: 9pt; border-radius: 0 6px 6px 0; }
.totals { width: 300px; border-collapse: collapse; font-size: 9.5pt; font-variant-numeric: tabular-nums; }
.totals th { text-align: left; font-weight: 400; color: #374151; padding: 4px 0; }
.totals td { text-align: right; padding: 4px 0; }
.totals tr.discount td, .totals tr.credit td { color: #15803d; }
.totals tr.total th, .totals tr.total td { font-weight: 700; font-size: 11pt; border-top: 1px solid var(--ink); padding-top: 8px; }
.totals tr.due th, .totals tr.due td, .totals tr.paid th, .totals tr.paid td { font-weight: 700; padding: 8px 10px; }
.totals tr.due th, .totals tr.due td { background: #fffbeb; color: #92400e; }
.totals tr.paid th, .totals tr.paid td { background: #f0fdf4; color: #166534; }

.changes { margin-top: 22px; break-inside: avoid; }
.changes ol { list-style: none; border-left: 2px solid var(--line); margin-left: 4px; }
.changes li { position: relative; padding: 0 0 8px 14px; font-size: 9pt; }
.changes li::before { content: ""; position: absolute; left: -6px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: #9ca3af; border: 2px solid #fff; }
.changes li.credit::before, .changes li.ok::before { background: #16a34a; }
.changes li.fee::before { background: #d97706; }
.changes li.warn::before { background: #dc2626; }
.changes li.info::before { background: #2563eb; }

.terms { margin-top: 20px; font-size: 8pt; color: var(--muted); }
.terms p + p { margin-top: 4px; }
.foot { margin-top: 22px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; font-size: 8pt; color: var(--muted); }

@media print {
  .no-print { display: none !important; }
  .doc { max-width: none; padding: 0; }
  .items tr, .totals, .pay { break-inside: avoid; }
  thead { display: table-header-group; }
}
@media screen and (max-width: 640px) {
  .doc { padding: 18px 14px; }
  .top { flex-direction: column; gap: 14px; }
  .meta { text-align: left; }
  .kv { margin-left: 0; }
  .kv td { text-align: left; }
  .parties { grid-template-columns: 1fr; gap: 12px; }
  .bottom { flex-direction: column-reverse; }
  .totals { width: 100%; }
  .items { font-size: 9pt; }
  .items td, .items thead th { padding: 7px 5px; }
  .foot { flex-direction: column; }
}
`;
