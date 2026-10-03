/**
 * Bakery Policies — what customers need to know, built live from Settings
 * (useCachedSettings is a real-time subscription: an admin change shows up
 * here immediately). Same rules the app enforces (functions/src/lib/
 * settingsValues.resolvePolicy).
 */
import React from 'react';
import { BookOpen, Building2, CalendarClock, CreditCard, Receipt, RotateCcw, Wallet } from 'lucide-react';
import { CustomerPageLayout } from './CustomerPageLayout';
import { useCachedSettings } from '../../hooks/useCachedFirebase';
import { resolvePolicy } from '../../functions/src/lib/settingsValues';
import { toDate } from '../../utils/timestampFormatting';

const money = (n: number) => `$${n.toFixed(2)}`;

/** "Saturday at 12:00 p.m." — when ordering for a Monday delivery closes. */
function mondayCutoffExample(hours: number): string {
  const monNoon = new Date(2026, 0, 5, 12, 0, 0); // any Monday, local wall time
  const at = new Date(monNoon.getTime() - hours * 3_600_000);
  const day = at.toLocaleDateString('en-CA', { weekday: 'long' });
  const time = at.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  return hours === 0 ? 'Monday at noon' : `${day} at ${time}`;
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E8C4A2]/60 bg-white p-4 sm:p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#8B6F47] mb-3">
        <Icon className="w-4 h-4" />
        {title}
      </h2>
      <div className="space-y-2 text-sm text-neutral-700 leading-relaxed">{children}</div>
    </section>
  );
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 border-b border-neutral-100 pb-1.5 last:border-0">
    <span className="text-neutral-500">{label}</span>
    <span className="font-semibold text-neutral-900 text-right">{value}</span>
  </div>
);

export function BakeryPolicies({ onBack }: { onBack?: () => void }): JSX.Element {
  const { data } = useCachedSettings();
  const s = (data ?? {}) as Record<string, any>;
  const p = resolvePolicy(s);
  const updated = toDate(s.updatedAt);
  const payTo = s.paymentAddress || s.businessEmail;
  const methods = [s.paymentMethod1 || 'Interac e-Transfer', s.paymentMethod2].filter(Boolean).join(' or ');
  const gstPct = Math.round(p.taxRate * 1000) / 10;

  return (
    <CustomerPageLayout icon={BookOpen} title="Bakery Policies" subtitle="How ordering, payment and changes work" sectionTitle="Our Policies">
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Section icon={Building2} title="Contact us">
          <p className="font-semibold text-neutral-900">{s.businessName || 'The bakery'}</p>
          {s.businessLocation && <p>{s.businessLocation}</p>}
          {s.businessPhone && <p>Phone: <a className="text-[#8B6F47] underline" href={`tel:${s.businessPhone}`}>{s.businessPhone}</a></p>}
          {s.businessEmail && <p>Email: <a className="text-[#8B6F47] underline" href={`mailto:${s.businessEmail}`}>{s.businessEmail}</a></p>}
          {s.businessNumber && <p className="text-neutral-500">GST/HST No. {s.businessNumber}</p>}
        </Section>

        <Section icon={CalendarClock} title="Ordering">
          <p>Order by week and pick the delivery days you need.</p>
          <p>
            Ordering for each delivery day closes <strong>{p.orderCutoffHours} hours before noon</strong> (Vancouver time) that day
            (Monday delivery: order by <strong>{mondayCutoffExample(p.orderCutoffHours)}</strong>)
          </p>
          {s.deliveryTimeInfo && <p>Delivery: {s.deliveryTimeInfo}</p>}
          <p>New orders are reviewed by the bakery; you'll be notified when your order is approved.</p>
        </Section>

        <Section icon={Receipt} title="Prices & charges">
          <Row label="GST" value={`${gstPct}%`} />
          <Row label="Delivery fee" value={p.deliveryFee > 0 ? `${money(p.deliveryFee)} per order` : 'Free'} />
          <Row
            label="Free delivery"
            value={p.freeDeliveryEnabled && p.freeDeliveryMin < 1_000_000 ? `Orders from ${money(p.freeDeliveryMin)}` : 'Not offered'}
          />
          {p.serviceCharge > 0 && <Row label="Service charge" value={`${money(p.serviceCharge)} per order`} />}
          <p className="text-neutral-500 text-xs pt-1">Business accounts see wholesale prices; individual accounts see retail prices.</p>
        </Section>

        <Section icon={CreditCard} title="Payment">
          <p>
            Pay by <strong>{methods}</strong>{payTo ? <> to <strong>{payTo}</strong></> : null}, with your order number as the message.
          </p>
          <p>
            Payment is due <strong>{p.paymentDueHours} hours before noon</strong> on your first delivery day. Orders are baked once the
            bakery confirms your payment.
          </p>
          <p>Store credit on your account can be used when you place an order.</p>
        </Section>

        <Section icon={RotateCcw} title="Changes & cancellations">
          <p>To change or cancel an order, contact the bakery.</p>
          <p>
            Free cancellation until <strong>{p.cancellationNoticeHours} hours before noon</strong> on the delivery day.
            {p.lateCancellationFeePercent > 0 ? (
              <> After that, a <strong>{p.lateCancellationFeePercent}% fee</strong> applies to the cancelled part of a paid order.</>
            ) : (
              <> No cancellation fee.</>
            )}
          </p>
          <p>Unpaid orders can be cancelled without a fee. For paid orders, the cancelled part is returned as store credit.</p>
          {s.cancellationPolicy && <p className="rounded-lg bg-[#FFF8EE] p-2.5">{s.cancellationPolicy}</p>}
          {s.lateCancellationFee && <p className="rounded-lg bg-[#FFF8EE] p-2.5">{s.lateCancellationFee}</p>}
        </Section>

        <Section icon={Wallet} title="Store credit">
          <p>Refunds for paid orders (cancellations, reduced quantities) are added to your account as store credit.</p>
          <p>Use it on your next order, or ask for a payout from your credit history.</p>
        </Section>

        {(s.weeklyOrderPolicy || s.dailyOrderPolicy) && (
          <Section icon={BookOpen} title="More from the bakery">
            {s.weeklyOrderPolicy && <p>{s.weeklyOrderPolicy}</p>}
            {s.dailyOrderPolicy && <p>{s.dailyOrderPolicy}</p>}
          </Section>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>{updated ? `Last updated ${updated.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}</span>
        {onBack && (
          <button type="button" onClick={onBack} className="rounded-lg border border-[#D4A574] px-4 py-2 font-semibold text-[#8B6F47] hover:bg-[#FFF8EE]">
            Back
          </button>
        )}
      </div>
    </CustomerPageLayout>
  );
}
