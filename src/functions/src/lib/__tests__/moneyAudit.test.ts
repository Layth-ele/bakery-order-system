/**
 * Money rules fixed in the money audit (2026-10): each one is checked against
 * the alternative path that used to disagree with it.
 */
import { describe, it, expect } from 'vitest';
import { autoDeliveryFee, normalizeItems, planCancellation, reducedTotals, reduceItems } from '../orderRevision';
import { PlacementError, deliveryNoon, passedDaysMessage, passedDeliveryDays, priceOrder, unitPriceFor } from '../orderPlacement';
import { buildCreditNote, gstShareOf } from '../creditNotes';

const zero = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };
const opts = { tier: 'commercial' as const, gstRate: 0.05, serviceCharge: 3.99, deliveryFee: 10, freeDeliveryMin: 250 };

function paidOrder(extra: Record<string, unknown> = {}) {
  const catalog = new Map([['p', { name: 'Croissant', wholesale: 3.15, retail: 4, discount: 5 }]]);
  const p = priceOrder({ items: [{ productId: 'p', quantities: { ...zero, monday: 40, tuesday: 40 } }] }, catalog, opts);
  return { ...p, creditApplied: 0, amountDue: p.total, paymentReceived: true, serviceChargeWaived: false, ...extra } as any;
}

describe('unit prices are in cents', () => {
  it('a discounted price is rounded, so price × quantity = subtotal', () => {
    expect(unitPriceFor({ wholesale: 3.15, discount: 5 }, 'commercial')).toBe(2.99);
    const o = paidOrder();
    expect(o.items[0].price).toBe(2.99);
    expect(o.subtotal).toBe(239.2);
  });
});

describe('daily minimum is enforced by the server', () => {
  it('rejects a day below the product minimum', () => {
    const catalog = new Map([['p', { name: 'Loaf', wholesale: 5, dailyMinOrder: 6 }]]);
    expect(() => priceOrder({ items: [{ productId: 'p', quantities: { ...zero, monday: 3 } }] }, catalog, opts)).toThrow(PlacementError);
    expect(() => priceOrder({ items: [{ productId: 'p', quantities: { ...zero, monday: 6 } }] }, catalog, opts)).not.toThrow();
  });
});

describe('cancelling in steps = cancelling at once', () => {
  it('a fee kept by an earlier partial cancellation is never refunded', () => {
    const o = paidOrder();
    const once = planCancellation(o, ['monday', 'tuesday'], 10, 0.05);
    const step1 = planCancellation(o, ['monday'], 10, 0.05);
    const after1 = { ...o, items: step1.items, ...step1.totals, discount: step1.discount };
    const step2 = planCancellation(after1, ['tuesday'], 10, 0.05);
    expect(step1.credit + step2.credit).toBeCloseTo(once.credit, 2);
    expect(step2.feeKept).toBeCloseTo(once.feeKept, 2);
    // order total = credit issued + fees kept
    expect(o.total).toBeCloseTo(once.credit + once.feeKept, 2);
  });
});

describe('a flat discount shrinks with the order', () => {
  it('cancelling half the items keeps half the discount', () => {
    const o = paidOrder({ discount: 100 });
    const r = planCancellation(o, ['monday'], 0, 0.05);
    expect(r.discount).toBe(50);
    expect(r.totals!.discountAmount).toBe(50);
  });
  it('a paid reduction prorates it the same way', () => {
    const o = paidOrder({ discount: 100 });
    const { items } = reduceItems(normalizeItems(o.items), [{ productId: 'p', quantities: { ...zero, monday: 40 } }]);
    expect(reducedTotals(o, items, 0.05).discount).toBe(50);
  });
});

describe('automatic delivery fee for edited orders', () => {
  const s = { freeDeliveryMin: 250, deliveryFee: 10 };
  it('free at the minimum, otherwise the order fee or the standard fee', () => {
    expect(autoDeliveryFee(300, 10, s)).toBe(0);
    expect(autoDeliveryFee(100, 0, s)).toBe(10);
    expect(autoDeliveryFee(100, 15, s)).toBe(15);
  });
});

describe('credit note GST', () => {
  it('uses the order’s GST share, not 5% of everything', () => {
    const o = paidOrder(); // delivery + service charge carry no GST
    const n = buildCreditNote({ id: 'abc', customerId: 'c', amount: o.total, type: 'cancellation', reason: '', createdBy: 'a', gstShare: gstShareOf(o), now: new Date() });
    expect(n.gst).toBe(o.gst);
    const manual = buildCreditNote({ id: 'abd', customerId: 'c', amount: 20, type: 'refund', reason: '', createdBy: 'a', gstShare: 0, now: new Date() });
    expect(manual.gst).toBe(0);
  });
});

describe('delivery days that are already over', () => {
  const order = { year: 2026, week: 40, items: [{ productId: 'p', ...zero, monday: 2, thursday: 3 }] };
  it('a day is over at noon Vancouver on that day', () => {
    expect(deliveryNoon(2026, 40, 'monday').toISOString()).toBe('2026-09-28T19:00:00.000Z');
  });
  it('lists only ordered days whose noon has passed', () => {
    expect(passedDeliveryDays(order, new Date('2026-09-28T18:59:00Z'))).toEqual([]);
    expect(passedDeliveryDays(order, new Date('2026-09-29T00:00:00Z'))).toEqual(['monday']);
    expect(passedDeliveryDays(order, new Date('2026-10-05T00:00:00Z'))).toEqual(['monday', 'thursday']);
  });
  it('explains what to do', () => {
    expect(passedDaysMessage(['monday', 'thursday'], 'approved')).toMatch(/^Monday and Thursday have already passed, so this order can't be approved\. Cancel those days/);
  });
});
