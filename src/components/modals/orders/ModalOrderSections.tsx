import React from 'react';
/**
 * ModalOrderSections — Shared 3-section layout for all order modals.
 *
 * Section 1: ORDER INFORMATION  — customer, week, address, order date
 * Section 2: ORDER ITEMS        — day-grid table matching screenshot
 * Section 3: ORDER SUMMARY      — items subtotal, service charge, GST, amount due
 *
 * All sections use the exact card style from the design screenshots:
 *  - cream bg-[#FFF8F0], border-[#E8C4A2], rounded-xl, shadow-sm
 *  - Section title: bold uppercase, bakery brown
 *  - Consistent spacing: space-y-4 between sections
 */

import { FileText, Calendar, MapPin, User } from 'lucide-react';
import type { Order, Product } from '../../../types';
import { displayOrderNumber } from '../../../utils/displayId';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getItemQty(item: Order['items'][number]): number {
  return DAYS.reduce((s, d) => s + ((item as any)[d] || 0), 0);
}

function getWeekDates(order: Order): string[] {
  // Try deliveryDays array first
  const days = (order as any).deliveryDays as Array<{day: string; date: string}> | undefined;
  if (days && days.length === 7) return days.map(d => d.date);
  if (days && days.length > 0) {
    const map: Record<string, string> = {};
    days.forEach(d => { map[d.day.toLowerCase()] = d.date; });
    const result = DAYS.map(d => map[d] || '');
    if (result.some(d => d)) return result;
  }
  // Derive from weekRange: "Mon 30 - Sun 5, Apr 2026" or "Mar 23 – Mar 29, 2026"
  // Use week number + year if available
  const week = order.week;
  const weekRange = order.weekRange || '';
  if (week) {
    // Try to extract year from weekRange
    const yearMatch = weekRange.match(/(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
    // ISO week: get Monday date
    const jan4 = new Date(year, 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const monday = new Date(startOfWeek1);
    monday.setDate(startOfWeek1.getDate() + (week - 1) * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
  }
  return Array(7).fill('');
}

// ─── Section Card wrapper ────────────────────────────────────────────────────
function SectionCard({ icon, title, children }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#FFF8F0] border border-[#E8C4A2] rounded-xl shadow-sm overflow-hidden">
      {/* Section title bar */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#E8C4A2]">
        <span className="text-[#D4A574] text-sm sm:text-base">{icon}</span>
        <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#8B6F47]">
          {title}
        </h3>
      </div>
      <div className="px-3 sm:px-4 py-3 sm:py-4">
        {children}
      </div>
    </div>
  );
}

// ─── Info row ────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-[#D4A574]">
        {label}
      </span>
      <span className="text-xs sm:text-sm font-bold text-[#2d2416] leading-snug">
        {value || <span className="text-[#8B6F47]/40 font-normal text-[10px]">—</span>}
      </span>
    </div>
  );
}

// ─── Section 1: Order Information ────────────────────────────────────────────
export function OrderInformationSection({ order }: { order: Order }) {
  const orderDate = (order as any).createdAt
    ? new Date((order as any).createdAt?.seconds
        ? (order as any).createdAt.seconds * 1000
        : (order as any).createdAt
      ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  // Build a proper week label with date range
  // If weekRange is already "Week N, YYYY" (redundant), derive the date range from week number
  const buildWeekDateRange = () => {
    if (!order.week) return order.weekRange || '—';
    try {
      const yearMatch = (order.weekRange || '').match(/(20\d{2})/);
      const yr = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      const jan4 = new Date(yr, 0, 4);
      const jan4Day = jan4.getDay() || 7;
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - (jan4Day - 1) + (order.week - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fmt(monday)} – ${fmt(sunday)}, ${yr}`;
    } catch { return order.weekRange || '—'; }
  };
  const dateRange = order.weekRange && !order.weekRange.startsWith('Week')
    ? order.weekRange  // already a proper date range like "Mon 23 - Sun 29, Mar 2026"
    : buildWeekDateRange();
  const weekLabel = order.week
    ? `Week ${order.week} (${dateRange})`
    : order.weekRange || '—';

  return (
    <SectionCard icon={<FileText className="w-4 h-4" />} title="Order Information">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <InfoRow label="Customer" value={
          <div>
            <div>{order.customerName || '—'}</div>
            {order.customerContactPerson && order.customerContactPerson !== order.customerName && (
              <div className="text-xs text-[#8B6F47]/70 font-normal mt-0.5">{order.customerContactPerson}</div>
            )}
          </div>
        } />
        <InfoRow label="Week" value={weekLabel} />
        <InfoRow label="Delivery Address" value={order.deliveryAddress || order.customerAddress || '—'} />
        <InfoRow label="Order Date" value={orderDate} />
        {(order.orderNumber || order.invoiceNumber) && (
          <InfoRow label="Order ID" value={order.orderNumber || order.invoiceNumber || ''} />
        )}
        {(order.customerPhone || (order as any).phone || (order as any).customerContactPhone || (order as any).customerInfo?.phone) && (
          <InfoRow label="Phone" value={
            order.customerPhone
            || (order as any).phone
            || (order as any).customerContactPhone
            || (order as any).customerInfo?.phone
            || ''
          } />
        )}
      </div>
      {(order as any).notes && (
        <div className="mt-3 pt-3 border-t border-[#E8C4A2]">
          <InfoRow label="Notes" value={(order as any).notes} />
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 2: Order Items (day grid) ──────────────────────────────────────
export function OrderItemsSection({ order, products = [] }: { order: Order; products?: Product[] }) {
  const items = order.items ?? [];
  if (items.length === 0) return null;

  const weekDates = getWeekDates(order);
  const productCount = items.length;

  return (
    <SectionCard
      icon={<FileText className="w-4 h-4" />}
      title={`Order Items (${productCount})`}
    >
      <div className="overflow-x-auto -mx-4 sm:-mx-5">
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="border-b border-[#E8C4A2]">
              <th className="px-4 sm:px-5 py-2 text-left font-bold text-[#8B6F47] uppercase tracking-wide text-[10px]">
                Product
              </th>
              {DAY_LABELS.map((label, i) => (
                <th key={label} className="px-1 py-2 text-center font-bold text-[#8B6F47] text-[10px]">
                  <div className="font-bold">{label}</div>
                  {weekDates[i] && (
                    <div className="text-[#8B6F47]/50 font-normal">{weekDates[i]}</div>
                  )}
                </th>
              ))}
              <th className="px-4 sm:px-5 py-2 text-center font-bold text-[#8B6F47] uppercase tracking-wide text-[10px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8C4A2]/60">
            {items.map((item, idx) => {
              const product = products.find(p => p.id === item.productId);
              const name = item.productName || product?.name || 'Unknown';
              const total = getItemQty(item);

              return (
                <tr key={idx} className="hover:bg-[#D4A574]/5">
                  <td className="px-4 sm:px-5 py-3 font-semibold text-[#2d2416]">{name}</td>
                  {DAYS.map((day) => {
                    const qty = (item as any)[day] || 0;
                    return (
                      <td key={day} className="px-1 py-3 text-center">
                        {qty > 0
                          ? <span className="font-bold text-emerald-600">{qty}</span>
                          : <span className="text-[#8B6F47]/30">—</span>
                        }
                      </td>
                    );
                  })}
                  <td className="px-4 sm:px-5 py-3 text-center font-bold text-[#D4A574]">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Section 3: Order Summary (financials) ──────────────────────────────────
export function OrderFinancialSummary({
  order,
  label = 'Amount Due',
}: {
  order: Order;
  label?: string;
}) {
  const subtotal    = order.subtotal ?? 0;
  const gst         = order.gst ?? 0;
  const deliveryFee = order.deliveryFee ?? 0;
  const service     = (!order.serviceChargeWaived && order.serviceCharge) ? order.serviceCharge : 0;
  const discount    = order.discount ?? 0;
  const credit      = order.creditApplied ?? 0;
  const total       = order.total ?? 0;

  const Row = ({ lbl, val, green = false, bold = false }: { lbl: string; val: string; green?: boolean; bold?: boolean }) => (
    <div className={`flex items-center justify-between py-2 ${bold ? '' : 'border-b border-[#E8C4A2]/60'}`}>
      <span className={`text-[11px] sm:text-xs ${bold ? 'font-bold text-[#8B6F47]' : 'text-[#5a4535]'}`}>{lbl}</span>
      <span className={`text-[11px] sm:text-xs font-semibold tabular-nums ${green ? 'text-emerald-600' : bold ? 'text-[#8B6F47] font-bold' : 'text-[#2d2416]'}`}>{val}</span>
    </div>
  );

  return (
    <SectionCard icon={<FileText className="w-4 h-4" />} title="Order Summary">
      <Row lbl="Items Subtotal"  val={`$${subtotal.toFixed(2)}`} />
      {service > 0    && <Row lbl="Service Charge"  val={`$${service.toFixed(2)}`} />}
      {deliveryFee > 0 && <Row lbl="Delivery Fee"   val={`$${deliveryFee.toFixed(2)}`} />}
      {discount > 0   && <Row lbl="Discount"        val={`-$${discount.toFixed(2)}`} green />}
      {gst > 0        && <Row lbl="GST (5%)"        val={`$${gst.toFixed(2)}`} />}
      {credit > 0     && <Row lbl="💳 Credit Applied" val={`-$${credit.toFixed(2)}`} green />}
      <div className="h-px bg-[#E8C4A2] my-1" />
      {credit > 0 ? (
        <>
          <Row lbl="Invoice Total" val={`$${total.toFixed(2)}`} bold />
          <div className="mt-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex justify-between">
            <span className="text-sm font-bold text-emerald-900">AMOUNT DUE (After Credit)</span>
            <span className="text-sm font-bold text-emerald-900">${Math.max(0, total - credit).toFixed(2)}</span>
          </div>
        </>
      ) : (
        <Row lbl={label} val={`$${total.toFixed(2)}`} bold />
      )}
    </SectionCard>
  );
}

// ─── Combined 3-section export (convenience) ─────────────────────────────────
export function ModalThreeSections({
  order,
  products = [],
  summaryLabel = 'Amount Due',
  children,
}: {
  order: Order;
  products?: Product[];
  summaryLabel?: string;
  children?: React.ReactNode; // optional extra content (status banners, payment forms, etc.)
}) {
  return (
    <div className="space-y-5">
      {children}
      <OrderInformationSection order={order} />
      <OrderItemsSection order={order} products={products} />
      <OrderFinancialSummary order={order} label={summaryLabel} />
    </div>
  );
}
