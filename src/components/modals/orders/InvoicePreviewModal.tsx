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

import React from 'react';
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

  // ── Price helper — use retail or wholesale based on customer type ─────────
  const getItemPrice = (product: Product | undefined): number => {
    if (!product) return 0;
    const isCommercial = order.customerType === 'commercial';
    return (isCommercial ? product.wholesale : product.retail)
      ?? product.retail
      ?? product.wholesale
      ?? (product as any).price
      ?? 0;
  };

  // ── Day column date labels ────────────────────────────────────────────────
  const weekNum  = order.week ?? 0;
  const weekYear = (order as any).year ?? new Date().getFullYear();
  const dayDates: string[] = DAY_KEYS.map((_, idx) => {
    if (!weekNum) return DAY_LABELS[DAY_KEYS[idx]];
    try {
      return formatShortDate(getWeekDayDate(weekNum, idx, weekYear));
    } catch { return DAY_LABELS[DAY_KEYS[idx]]; }
  });

  // ── Item quantity per day ─────────────────────────────────────────────────
  const getDayQty = (item: any, day: DayKey): number =>
    (typeof item[day] === 'number' ? item[day] : 0);

  const getItemTotalQty = (item: any): number =>
    DAY_KEYS.reduce((s, d) => s + getDayQty(item, d), 0);

  // ── Grouped items by category ─────────────────────────────────────────────
  const categoryGroups = categories
    .map(cat => ({
      cat,
      items: order.items.filter(item => {
        const p = products.find(p => p.id === item.productId);
        return p?.categoryId === cat.id;
      }),
    }))
    .filter(g => g.items.length > 0);

  // Custom / admin-added items whose productId isn't in the products list
  const customItems = order.items.filter(item => !products.find(p => p.id === item.productId));
  // All items that appear in the table (category + custom)
  const tableItems = [...categoryGroups.flatMap(g => g.items), ...customItems];

  // ── Totals — use order fields first, recompute only if missing ─────────────
  // ✅ FIX: Never fall back to order.total as subtotal — total includes GST/fees
  // If subtotal is missing, recompute it from items
  const subtotal = order.subtotal || (() => {
    return order.items.reduce((sum, item) => {
      const totalQty = DAY_KEYS.reduce((s, d) => s + ((item as any)[d] || 0), 0);
      return sum + totalQty * (item.price || 0);
    }, 0);
  })();
  const deliveryFee   = order.deliveryFee   || 0;
  const serviceCharge = order.serviceCharge || 0;
  const discount      = order.discount      || 0;
  const creditApplied = order.creditApplied || 0;
  // ✅ FIX: GST on (subtotal - discount), not raw subtotal
  const discountedBase = Math.max(0, subtotal - discount);
  const gst = order.gst || Math.round((discountedBase * 0.05 + Number.EPSILON) * 100) / 100;
  // ✅ FIX: amountDue = total - credit (what customer actually pays)
  const amountDue = order.amountDue || Math.max(0, (order.total || 0) - creditApplied);
  const grandTotal = order.total || (discountedBase + gst + deliveryFee + serviceCharge);

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
  const ps = order.paymentStatus || (order.status === 'completed' ? 'paid' : 'unpaid');
  const psMap = {
    paid:      { label: 'Paid',      cls: 'text-green-700 bg-green-50 border-green-200', icon: CheckCircle },
    unpaid:    { label: 'Unpaid',    cls: 'text-red-700   bg-red-50   border-red-200',   icon: Clock },
    in_review: { label: 'In Review', cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: Clock },
  };
  const psConf = psMap[ps as keyof typeof psMap] || psMap.unpaid;
  const PSIcon = psConf.icon;

  // ── Download / Print ──────────────────────────────────────────────────────
  const handlePDF = async () => {
    try {
      toast.info('Generating PDF…');
      // ✅ PASS 3: Dynamic import — jspdf + html-to-image only loaded when needed.
      const { downloadInvoiceAsPDFAlt } = await import('../../../utils/invoicePDFAlternative');
      await downloadInvoiceAsPDFAlt(
        'invoice-preview-content',
        `Invoice_${invoiceNum}_${order.customerName?.replace(/\s+/g,'_') ?? 'order'}.pdf`
      );
      toast.success('Invoice downloaded!');
    } catch {
      toast.error('PDF failed — please try again.');
    }
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
          <button onClick={() => window.print()}
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
      <div className="bg-[#f5f3ef] -mx-6 -mb-6 px-3 sm:px-5 py-5">
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
                  <p className="text-[10px] text-white/70 uppercase tracking-widest mb-1">Invoice</p>
                  <p className="text-sm font-bold text-white font-mono">{invoiceNum}</p>
                  <p className="text-[10px] text-white/60 mt-1">{invoiceDate}</p>
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4A574]">Order Details</span>
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4A574]">Bill To</span>
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

          {/* ══ ORDER ITEMS TABLE ════════════════════════════════════════ */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-[#D4A574]" />
              <span className="text-xs font-bold uppercase tracking-widest text-gray-700">Order Items</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-xs border-collapse" style={{ minWidth: '520px' }}>

                {/* Column headers with day dates */}
                <thead>
                  <tr className="bg-[#2c2416] text-white">
                    <th className="text-left py-2.5 px-3 font-semibold rounded-tl-xl" style={{ width: '26%' }}>Product</th>
                    {DAY_KEYS.map((day, idx) => (
                      <th key={day} className="text-center py-2.5 px-1 font-semibold" style={{ width: '8%' }}>
                        <span className="block text-[10px] text-[#D4A574]">{DAY_LABELS[day]}</span>
                        <span className="block text-[9px] text-gray-400 mt-0.5">{dayDates[idx]}</span>
                      </th>
                    ))}
                    <th className="text-center py-2.5 px-2 font-semibold" style={{ width: '6%' }}>Qty</th>
                    <th className="text-right py-2.5 px-3 font-semibold" style={{ width: '10%' }}>Price</th>
                    <th className="text-right py-2.5 px-3 font-semibold rounded-tr-xl" style={{ width: '12%' }}>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {categoryGroups.map((group) => {
                    const groupQty = group.items.reduce((s, item) => s + getItemTotalQty(item), 0);
                    const groupAmt = group.items.reduce((s, item) => {
                      const p = products.find(p => p.id === item.productId);
                      return s + getItemTotalQty(item) * getItemPrice(p);
                    }, 0);

                    return (
                      <React.Fragment key={group.cat.id}>
                        {/* Category header */}
                        <tr className="bg-[#f0ebe2]">
                          <td colSpan={DAY_KEYS.length + 3} className="py-2 px-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B6F47]">
                              {group.cat.name}
                            </span>
                          </td>
                        </tr>

                        {/* Item rows */}
                        {group.items.map((item) => {
                          const prod  = products.find(p => p.id === item.productId);
                          const price = getItemPrice(prod);
                          const qty   = getItemTotalQty(item);
                          const amt   = qty * price;
                          return (
                            <tr key={item.productId} className="border-b border-gray-100 hover:bg-[#faf8f5] transition-colors">
                              <td className="py-2.5 px-3 font-medium text-gray-900 leading-snug">
                                {prod?.name || 'Unknown product'}
                              </td>
                              {DAY_KEYS.map(day => {
                                const dq = getDayQty(item, day);
                                return (
                                  <td key={day} className="text-center py-2.5 px-1">
                                    {dq > 0
                                      ? <span className="font-semibold text-gray-800">{dq}</span>
                                      : <span className="text-gray-300">–</span>}
                                  </td>
                                );
                              })}
                              <td className="text-center py-2.5 px-2 font-bold text-gray-900">{qty}</td>
                              <td className="text-right py-2.5 px-3 text-gray-500">
                                {price > 0 ? formatCurrency(price) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="text-right py-2.5 px-3 font-semibold text-gray-900">
                                {amt > 0 ? formatCurrency(amt) : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Category subtotal */}
                        <tr className="bg-[#f5f1eb] border-t border-[#D4A574]/20">
                          <td className="py-2 px-3 text-[10px] font-bold text-[#8B6F47] italic">
                            Subtotal — {group.cat.name}
                          </td>
                          {DAY_KEYS.map(day => {
                            const dTotal = group.items.reduce((s, item) => s + getDayQty(item, day), 0);
                            return (
                              <td key={day} className="text-center py-2 px-1 text-[10px] font-semibold text-[#8B6F47]">
                                {dTotal > 0 ? dTotal : ''}
                              </td>
                            );
                          })}
                          <td className="text-center py-2 px-2 text-[10px] font-bold text-[#8B6F47]">{groupQty}</td>
                          <td />
                          <td className="text-right py-2 px-3 text-[10px] font-bold text-[#8B6F47]">
                            {groupAmt > 0 ? formatCurrency(groupAmt) : ''}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {/* Custom / admin-added items */}
                  {customItems.length > 0 && (() => {
                    const groupQty = customItems.reduce((s, item) => s + getItemTotalQty(item), 0);
                    const groupAmt = customItems.reduce((s, item) =>
                      s + getItemTotalQty(item) * ((item as any).price || 0), 0);
                    return (
                      <React.Fragment key="custom-items">
                        <tr className="bg-[#f0ebe2]">
                          <td colSpan={DAY_KEYS.length + 3} className="py-2 px-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B6F47]">
                              Custom Items
                            </span>
                          </td>
                        </tr>
                        {customItems.map((item, idx) => {
                          const price = (item as any).price || 0;
                          const qty   = getItemTotalQty(item);
                          const amt   = qty * price;
                          return (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-[#faf8f5] transition-colors">
                              <td className="py-2.5 px-3 font-medium text-gray-900 leading-snug">
                                {(item as any).productName || (item as any).name || 'Custom item'}
                              </td>
                              {DAY_KEYS.map(day => {
                                const dq = getDayQty(item, day);
                                return (
                                  <td key={day} className="text-center py-2.5 px-1">
                                    {dq > 0 ? <span className="font-semibold text-gray-800">{dq}</span>
                                            : <span className="text-gray-300">–</span>}
                                  </td>
                                );
                              })}
                              <td className="text-center py-2.5 px-2 font-bold text-gray-900">{qty}</td>
                              <td className="text-right py-2.5 px-3 text-gray-500">
                                {price > 0 ? formatCurrency(price) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="text-right py-2.5 px-3 font-semibold text-gray-900">
                                {amt > 0 ? formatCurrency(amt) : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-[#f5f1eb] border-t border-[#D4A574]/20">
                          <td className="py-2 px-3 text-[10px] font-bold text-[#8B6F47] italic">Subtotal — Custom Items</td>
                          {DAY_KEYS.map(day => {
                            const dTotal = customItems.reduce((s, item) => s + getDayQty(item, day), 0);
                            return <td key={day} className="text-center py-2 px-1 text-[10px] font-semibold text-[#8B6F47]">{dTotal > 0 ? dTotal : ''}</td>;
                          })}
                          <td className="text-center py-2 px-2 text-[10px] font-bold text-[#8B6F47]">{groupQty}</td>
                          <td />
                          <td className="text-right py-2 px-3 text-[10px] font-bold text-[#8B6F47]">{groupAmt > 0 ? formatCurrency(groupAmt) : ''}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })()}
                </tbody>

                {/* Grand total footer */}
                <tfoot>
                  <tr className="bg-[#1a1a1a]">
                    <td className="py-3 px-3 text-[10px] font-bold text-[#D4A574] uppercase tracking-wider">
                      Grand Total
                    </td>
                    {DAY_KEYS.map(day => {
                      const dt = tableItems.reduce((s, item) => s + getDayQty(item as any, day), 0);
                      return (
                        <td key={day} className="text-center py-3 px-1 text-xs font-bold text-white">
                          {dt > 0 ? dt : <span className="text-gray-700">–</span>}
                        </td>
                      );
                    })}
                    <td className="text-center py-3 px-2 text-xs font-bold text-[#D4A574]">
                      {tableItems.reduce((s, item) => s + getItemTotalQty(item as any), 0)}
                    </td>
                    <td />
                    <td className="text-right py-3 px-3 text-sm font-bold text-[#D4A574]">
                      {formatCurrency(order.subtotal || tableItems.reduce((s, item) => {
                        const p = products.find(pr => pr.id === item.productId);
                        return s + getItemTotalQty(item) * (p ? getItemPrice(p) : ((item as any).price || 0));
                      }, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ══ TOTALS ═══════════════════════════════════════════════════ */}
          <div className="border-t-2 border-[#D4A574]/30 px-6 py-5">
            <div className="ml-auto max-w-xs space-y-2.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(deliveryFee)}</span>
                </div>
              )}
              {serviceCharge > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Service Charge</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(serviceCharge)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span className="font-semibold">−{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600">
                <span>GST (5%)</span>
                <span className="font-semibold text-gray-900">{formatCurrency(gst)}</span>
              </div>
              {creditApplied > 0 && (
                <>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Credit Applied</span>
                    <span className="font-semibold">−{formatCurrency(creditApplied)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">
                    <span>Amount Due (After Credit)</span>
                    <span>{formatCurrency(amountDue)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-3 border-t-2 border-[#D4A574]/40 items-baseline">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-[#D4A574]">{formatCurrency(grandTotal)}</span>
              </div>
              {ps === 'paid' && (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mt-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-green-700">
                    <CheckCircle className="w-4 h-4" /> Paid in Full
                  </span>
                  <span className="text-sm font-bold text-green-700">{formatCurrency(grandTotal)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ══ FOOTER ═══════════════════════════════════════════════════ */}
          <div className="bg-[#f0ebe2] px-6 py-4 text-center border-t border-[#D4A574]/20">
            <p className="text-sm font-semibold text-gray-800 mb-1">Thank you for your business!</p>
            <p className="text-xs text-gray-500">Questions? <span className="font-medium">{bizEmail}</span></p>
            <p className="text-[10px] text-gray-400 mt-1">Computer-generated · Valid without signature</p>
          </div>

        </div>
      </div>
    </StyleModalShell>
  );
}
