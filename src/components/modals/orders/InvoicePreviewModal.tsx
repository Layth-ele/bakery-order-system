/**
 * InvoicePreviewModal - Clean invoice preview before payment / download
 *
 * ✅ MAR 28 2026: Full rebuild
 * - Invoice number: uses displayInvoiceNumber (never raw Firestore UID)
 * - Product price: uses retail/wholesale based on customerType (not legacy price=0)
 * - Day columns: show actual calendar dates (Mar 31, Apr 1 …)
 * - Layout: generous spacing between every section
 * - Category/items table: clean, readable with proper column widths
 */

import { discountOn, round2 } from '../../../functions/src/lib/orderRevision';
import { gstLabel } from '../../../utils/orderMoney';
import { orderAmountDue } from '../../../utils/orderMoney';
import React from 'react';
import { changeNotices, documentDays, documentLines, documentTotals, noticeDate, type OrderChange } from '../../../utils/documents/orderDocument';
import { fetchOrderChanges } from '../../../utils/documents/orderChanges';
import { downloadCompleteOrderPDF, downloadOrderPDF, downloadRejectedOrderPDF, generateCancelledOrderPDF } from '../../../utils/pdf';
import { useCachedSettings } from '../../../hooks/useCachedFirebase';
import {
  FileText, Download, Printer, Calendar,
  User, Mail, Phone, MapPin, Package,
  CheckCircle, Clock, Building2, Hash,
} from 'lucide-react';
import type { Order, Product, Category } from '../../../types';
import { formatCurrency } from '../../../utils/helpers';
// ✅ PASS 3: invoicePDFAlternative intentionally NOT imported at the top —
// it pulls in jspdf (~280KB) and html-to-image which are only needed when the
// user actually clicks "Download PDF". Dynamic import keeps these out of the
// modal's chunk and any chunk that imports this modal.
import { toast } from 'sonner';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { toDate } from '../../../utils/timestampFormatting';
import { displayOrderNumber, displayInvoiceNumber } from '../../../utils/displayId';
import { getWeekDayDate, formatShortDate } from '../../../utils/weekUtils';

interface InvoicePreviewModalProps {
  onClose: () => void;
  order: Order;
  products: Product[];
  categories: Category[];
}

// Day keys in order
const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_LABELS: Record<DayKey, string> = {
  monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu',
  friday:'Fri', saturday:'Sat', sunday:'Sun',
};

export function InvoicePreviewModal({
  onClose, order, products, categories,
}: InvoicePreviewModalProps): JSX.Element | null {
  if (!order) return null;

  // ── Business settings (live from Firestore) ──────────────────────────────
  const { data: liveSettings } = useCachedSettings();
  const bizName     = liveSettings?.businessName     || 'Your Bakery Name';
  const bizAddress  = liveSettings?.businessLocation || '123 Example St, City, BC V0V 0V0';
  const bizPhone    = liveSettings?.businessPhone    || '604-555-0100';
  const bizEmail    = liveSettings?.businessEmail    || 'orders@example.com';
  const bizGST      = liveSettings?.businessNumber   || '';

  // ── Friendly invoice/order numbers (never raw Firestore UID) ─────────────
  const invoiceNum = displayInvoiceNumber(order);
  const orderNum   = displayOrderNumber(order);

  // ── Customer masked code ─────────────────────────────────────────────────
  // Show the human-readable customerCode — never show the raw Firestore UID
  const customerCode = (order as any).customerCode
    || (order.customerId && order.customerId.length > 20
        ? `CUST-···${order.customerId.slice(-6).toUpperCase()}`
        : order.customerId)
    || 'N/A';

  const weekNum  = order.week ?? 0;
  const weekYear = (order as any).year ?? new Date().getFullYear();
  const grandTotal = Number(order.total) || 0;

  // ── Shared document description (same as PDF / Excel) ─────────────────────
  const docDays = React.useMemo(() => documentDays(order as any), [order]);
  const docLines = React.useMemo(() => documentLines(order as any, products, categories), [order, products, categories]);
  const docTotals = React.useMemo(() => documentTotals(order as any), [order]);
  const [history, setHistory] = React.useState<OrderChange[]>([]);
  React.useEffect(() => {
    let alive = true;
    fetchOrderChanges(order as any).then((h) => { if (alive) setHistory(h); });
    return () => { alive = false; };
  }, [order]);
  const notices = React.useMemo(() => changeNotices(order as any, history), [order, history]);

  // ── Dates ─────────────────────────────────────────────────────────────────
  const fmtDate = (d: any) =>
    (toDate(d) ?? new Date()).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  const invoiceDate = fmtDate(order.completedAt || order.updatedAt || order.createdAt);
  const orderDate   = fmtDate(order.createdAt);
  const paidDate    = order.paymentReceivedAt ? fmtDate(order.paymentReceivedAt) : null;

  // ── Week label ────────────────────────────────────────────────────────────
  const weekLabel = React.useMemo(() => {
    if (!weekNum) return order.weekRange || '';
    try {
      const start = getWeekDayDate(weekNum, 0, weekYear);
      const end   = getWeekDayDate(weekNum, 6, weekYear);
      return `Week ${weekNum} · ${formatShortDate(start)} – ${formatShortDate(end)}, ${weekYear}`;
    } catch { return order.weekRange || ''; }
  }, [weekNum, weekYear, order.weekRange]);

  // ── Payment status ────────────────────────────────────────────────────────
  const ps =
    (order as any).paymentReceived === true || order.status === 'completed' || order.status === 'in_process'
      ? 'paid'
      : (order as any).paymentSubmitted === true ? 'in_review' : 'unpaid';
  const psMap = {
    paid:      { label: 'Paid',      cls: 'text-green-700 bg-green-50 border-green-200', icon: CheckCircle },
    unpaid:    { label: 'Unpaid',    cls: 'text-red-700   bg-red-50   border-red-200',   icon: Clock },
    in_review: { label: 'In Review', cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: Clock },
  };
  const psConf = psMap[ps as keyof typeof psMap] || psMap.unpaid;
  const PSIcon = psConf.icon;

  // ── Download / Print ──────────────────────────────────────────────────────
  const handlePDF = () => {
    // Same text PDF as everywhere else (Print / Save as PDF / Share on phones).
    if (order.status === 'cancelled') generateCancelledOrderPDF(order, products, categories);
    else if (order.status === 'rejected') downloadRejectedOrderPDF(order, products, categories);
    else if (order.status === 'completed') downloadCompleteOrderPDF(order, products, categories);
    else downloadOrderPDF(order, products, categories);
  };


  return (
    <StyleModalShell
      width="4xl"
      skinType="info"
      onClose={onClose}
      title="Invoice Preview"
      subtitle={invoiceNum}
      icon={<FileText className="w-5 h-5" />}
      headerRight={
        <div className="flex items-center gap-2">
          <button onClick={handlePDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button onClick={handlePDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-[#D4A574] hover:bg-[#C4956A] text-black rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>
      }
    >
      <div className="bg-[#f5f3ef] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 px-3 sm:px-5 py-5">
        <div id="invoice-preview-content" className="bg-white shadow-lg rounded-2xl overflow-hidden max-w-3xl mx-auto">

          {/* ══ BUSINESS HEADER ══════════════════════════════════════════ */}
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2c2416] px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              {/* Business info */}
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white mb-2">{bizName}</h1>
                <div className="space-y-1">
                  {([
                    [MapPin,    bizAddress],
                    [Phone,     bizPhone],
                    [Mail,      bizEmail],
                    [Building2, `GST/HST: ${bizGST}`],
                  ] as const).map(([Icon, txt]) => (
                    <div key={String(txt)} className="flex items-start gap-2 text-gray-400">
                      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#D4A574]" />
                      <span className="text-xs leading-snug">{txt}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Invoice badge */}
              <div className="flex-shrink-0">
                <div className="bg-gradient-to-br from-[#D4A574] to-[#B8935E] rounded-xl px-5 py-3 text-right min-w-[140px]">
                  <p className="text-[11px] text-white/70 uppercase tracking-widest mb-1">Invoice</p>
                  <p className="text-sm font-bold text-white font-mono">{invoiceNum}</p>
                  <p className="text-[11px] text-white/60 mt-1">{invoiceDate}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ══ ORDER INFO + BILL TO ═════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 border-b border-gray-200">
            {/* Order Details */}
            <div className="bg-white px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-3.5 h-3.5 text-[#D4A574]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#D4A574]">Order Details</span>
              </div>
              <dl className="space-y-2">
                {[
                  ['Order #',    orderNum],
                  ['Order Date', orderDate],
                  ['Delivery',   weekLabel || '—'],
                ].map(([lbl, val]) => (
                  <div key={lbl} className="flex items-start justify-between gap-3">
                    <dt className="text-xs text-gray-500 flex-shrink-0">{lbl}</dt>
                    <dd className="text-xs font-semibold text-gray-900 text-right font-mono">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {/* Bill To */}
            <div className="bg-white px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-3.5 h-3.5 text-[#D4A574]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#D4A574]">Bill To</span>
              </div>
              <p className="text-sm font-bold text-gray-900 mb-2 leading-snug">{order.customerName || '—'}</p>
              <div className="space-y-1.5">
                {order.customerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#D4A574] flex-shrink-0" />
                    <span className="text-xs text-gray-600 truncate">{order.customerEmail}</span>
                  </div>
                )}
                {((order as any).customerPhone || (order as any).customerContactPhone) && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#D4A574] flex-shrink-0" />
                    <span className="text-xs text-gray-600">{(order as any).customerPhone || (order as any).customerContactPhone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-[#D4A574] flex-shrink-0" />
                  <span className="text-xs text-gray-500 font-mono">Customer {customerCode}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ PAYMENT STATUS BAR ══════════════════════════════════════ */}
          <div className={`flex items-center justify-between px-6 py-2.5 border-b ${psConf.cls}`}>
            <div className="flex items-center gap-2">
              <PSIcon className="w-4 h-4" />
              <span className="text-xs font-bold">Payment: {psConf.label}</span>
              {paidDate && <span className="text-xs opacity-70">· Paid {paidDate}</span>}
            </div>
            {ps === 'paid' && (
              <span className="text-sm font-bold">{formatCurrency(grandTotal)}</span>
            )}
          </div>

          {/* ══ ORDER ITEMS — only the days ordered, at the price charged ══ */}
          <div className="px-4 sm:px-6 py-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-[#D4A574]" />
              <span className="text-xs font-bold uppercase tracking-widest text-gray-700">Order Items</span>
            </div>

            {/* Phone: one card per product */}
            <div className="sm:hidden space-y-2">
              {docLines.map((l, i) => (
                <div key={l.productId + i} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-snug">{l.name}</p>
                      <p className="text-[11px] text-gray-500">{l.categoryName}</p>
                    </div>
                    <p className="font-bold text-gray-900 text-sm tabular-nums">{formatCurrency(l.amount)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {docDays.filter((d) => l.qty[d.key] > 0).map((d) => (
                      <span key={d.key} className="rounded-md bg-[#f5f1eb] px-2 py-0.5 text-[11px] text-[#5a4535]">
                        {d.short} {d.date} · <strong>{l.qty[d.key]}</strong>
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500">{l.total} × {formatCurrency(l.price)}</p>
                </div>
              ))}
            </div>

            {/* Tablet / desktop: table with only the ordered days */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#2c2416] text-white">
                    <th className="text-left py-2.5 px-3 font-semibold">Product</th>
                    {docDays.map((d) => (
                      <th key={d.key} className="text-center py-2.5 px-1 font-semibold">
                        <span className="block text-[11px] text-[#D4A574]">{d.short}</span>
                        <span className="block text-[11px] text-gray-400 mt-0.5">{d.date}</span>
                      </th>
                    ))}
                    <th className="text-center py-2.5 px-2 font-semibold">Qty</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Price</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {docLines.map((l, i) => (
                    <React.Fragment key={l.productId + i}>
                      {(i === 0 || docLines[i - 1].categoryName !== l.categoryName) && (
                        <tr className="bg-[#f0ebe2]">
                          <td colSpan={docDays.length + 4} className="py-1.5 px-3 text-[11px] font-bold uppercase tracking-widest text-[#8B6F47]">
                            {l.categoryName}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-100">
                        <td className="py-2.5 px-3 font-medium text-gray-900">{l.name}</td>
                        {docDays.map((d) => (
                          <td key={d.key} className="text-center py-2.5 px-1">
                            {l.qty[d.key] > 0 ? <span className="font-semibold text-gray-800">{l.qty[d.key]}</span> : <span className="text-gray-300">–</span>}
                          </td>
                        ))}
                        <td className="text-center py-2.5 px-2 font-bold text-gray-900">{l.total}</td>
                        <td className="text-right py-2.5 px-3 text-gray-500">{formatCurrency(l.price)}</td>
                        <td className="text-right py-2.5 px-3 font-semibold text-gray-900">{formatCurrency(l.amount)}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1a1a1a]">
                    <td className="py-3 px-3 text-[11px] font-bold text-[#D4A574] uppercase tracking-wider">Total</td>
                    {docDays.map((d) => (
                      <td key={d.key} className="text-center py-3 px-1 text-xs font-bold text-white">
                        {docLines.reduce((s, l) => s + l.qty[d.key], 0) || ''}
                      </td>
                    ))}
                    <td className="text-center py-3 px-2 text-xs font-bold text-[#D4A574]">{docLines.reduce((s, l) => s + l.total, 0)}</td>
                    <td />
                    <td className="text-right py-3 px-3 text-sm font-bold text-[#D4A574]">{formatCurrency(docLines.reduce((s, l) => s + l.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ══ TOTALS — same rows as the PDF and Excel ════════════════════ */}
          <div className="border-t-2 border-[#D4A574]/30 px-4 sm:px-6 py-5">
            <div className="sm:ml-auto sm:max-w-xs space-y-2">
              {docTotals.map((r) => (
                <div
                  key={r.label}
                  className={
                    r.kind === 'total'
                      ? 'flex justify-between pt-2 border-t-2 border-[#D4A574]/40 text-base font-bold text-gray-900'
                      : r.kind === 'due'
                        ? 'flex justify-between rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm font-bold text-red-700'
                        : r.kind === 'paid'
                          ? 'flex justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm font-bold text-green-700'
                          : r.kind === 'discount' || r.kind === 'credit'
                            ? 'flex justify-between text-sm text-emerald-700'
                            : 'flex justify-between text-sm text-gray-600'
                  }
                >
                  <span>{r.label}</span>
                  <span className="tabular-nums font-semibold">{r.amount < 0 ? '−' : ''}{formatCurrency(Math.abs(r.amount))}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ══ CHANGES TO THIS ORDER ══════════════════════════════════════ */}
          {notices.length > 0 && (
            <div className="border-t border-gray-100 px-4 sm:px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#8B6F47] mb-3">Changes to this order</p>
              <ol className="space-y-2.5">
                {notices.map((n, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${{ info: 'bg-blue-500', credit: 'bg-emerald-500', fee: 'bg-amber-500', warn: 'bg-red-500', ok: 'bg-green-600' }[n.tone]}`} />
                    <div className="text-sm">
                      <p className="font-semibold text-gray-900">
                        {n.title}
                        {n.at && <span className="ml-2 text-xs font-normal text-gray-500">{noticeDate(n.at)}</span>}
                      </p>
                      <p className="text-gray-600 text-[13px]">{n.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ══ FOOTER ═══════════════════════════════════════════════════ */}
          <div className="bg-[#f0ebe2] px-6 py-4 text-center border-t border-[#D4A574]/20">
            <p className="text-sm font-semibold text-gray-800 mb-1">Thank you for your business!</p>
            <p className="text-xs text-gray-500">Questions? <span className="font-medium">{bizEmail}</span></p>
            <p className="text-[11px] text-gray-400 mt-1">Computer-generated · Valid without signature</p>
          </div>

        </div>
      </div>
    </StyleModalShell>
  );
}
