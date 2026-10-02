/**
 * Order revisions: unpaid edits, paid reductions, partial / full
 * cancellations, and how they reach the final invoice. Run with `npm test`.
 */
import { describe, it, expect } from 'vitest';
import {
  RevisionError,
  activeDays,
  diffItems,
  effectiveGstRate,
  normalizeItems,
  orderTotals,
  parseRequestedItems,
  planCancellation,
  reduceItems,
} from '../orderRevision';
import { buildFinalInvoice } from '../orderCompletion';
import { buildCreditNote } from '../creditNotes';
import {
  creditIssuedNotification,
  orderReducedNotification,
  orderUpdatedNotification,
  paymentReminderNotification,
  payoutRequestedNotification,
} from '../accountNotifications';

const zero = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };

// Bread $5 × (Mon 10 + Wed 10), Cake $20 × (Mon 5). Subtotal 200.
const items = [
  { productId: 'bread', productName: 'Bread', price: 5, ...zero, monday: 10, wednesday: 10, total: 20 },
  { productId: 'cake', productName: 'Cake', price: 20, ...zero, monday: 5, total: 5 },
];
// 5% GST, $10 delivery, $3.99 service charge.
const order = {
  items,
  subtotal: 200,
  gst: 10,
  deliveryFee: 10,
  serviceCharge: 3.99,
  total: 223.99,
  creditApplied: 0,
  amountDue: 223.99,
};

describe('orderTotals', () => {
  it('prices exactly like placement: subtotal − discount + GST + fees', () => {
    expect(orderTotals(normalizeItems(items), order, 0.05)).toEqual({
      subtotal: 200,
      discountAmount: 0,
      gst: 10,
      deliveryFee: 10,
      serviceCharge: 3.99,
      cancellationFee: 0,
      total: 223.99,
    });
  });

  it('applies flat + percentage discounts before GST, never below zero', () => {
    const t = orderTotals(normalizeItems(items), { ...order, discount: 10, discountPercentage: 10 }, 0.05);
    expect(t.discountAmount).toBe(30);
    expect(t.gst).toBe(8.5);
    expect(t.total).toBe(200 - 30 + 8.5 + 10 + 3.99);
    expect(orderTotals(normalizeItems(items), { ...order, discount: 999 }, 0.05).discountAmount).toBe(200);
  });

  it('a waived service charge is not charged; an explicit delivery fee overrides', () => {
    const t = orderTotals(normalizeItems(items), { ...order, serviceChargeWaived: true }, 0.05, { deliveryFee: 0 });
    expect(t.serviceCharge).toBe(0);
    expect(t.total).toBe(210);
  });

  it('uses the GST rate the order was charged at', () => {
    expect(effectiveGstRate(order, 0.12)).toBeCloseTo(0.05);
    expect(effectiveGstRate({ ...order, gst: 0 }, 0.12)).toBe(0.12);
  });
});

describe('parseRequestedItems', () => {
  it('validates ids, duplicates and whole-number quantities', () => {
    expect(parseRequestedItems([{ productId: 'a', quantities: { monday: 2 } }])[0].quantities.monday).toBe(2);
    expect(() => parseRequestedItems([{ productId: 'a/b', quantities: {} }])).toThrow(RevisionError);
    expect(() => parseRequestedItems([{ productId: 'a' }, { productId: 'a' }])).toThrow(/only once/);
    expect(() => parseRequestedItems([{ productId: 'a', quantities: { monday: 1.5 } }])).toThrow(/monday/);
    expect(() => parseRequestedItems([{ productId: 'a', quantities: { monday: -1 } }])).toThrow(/monday/);
  });
});

describe('reduceItems (paid-order edits)', () => {
  const base = normalizeItems(items);

  it('allows reductions per day and records the change', () => {
    const r = reduceItems(base, [
      { productId: 'bread', quantities: { ...zero, monday: 10, wednesday: 4 } },
      { productId: 'cake', quantities: { ...zero, monday: 5 } },
    ]);
    expect(r.items.find((i) => i.productId === 'bread')!.total).toBe(14);
    expect(r.changes).toEqual([
      { productId: 'bread', productName: 'Bread', originalQuantity: 20, newQuantity: 14, quantityChange: -6, priceChange: -30 },
    ]);
  });

  it('rejects increases, even when the weekly total is unchanged', () => {
    expect(() =>
      reduceItems(base, [
        { productId: 'bread', quantities: { ...zero, monday: 15, wednesday: 5 } },
        { productId: 'cake', quantities: { ...zero, monday: 5 } },
      ])
    ).toThrow(/only be reduced/);
  });

  it('a product left out is removed; unknown products are refused', () => {
    const r = reduceItems(base, [{ productId: 'bread', quantities: { ...zero, monday: 10, wednesday: 10 } }]);
    expect(r.items.map((i) => i.productId)).toEqual(['bread']);
    expect(r.changes[0]).toMatchObject({ productId: 'cake', newQuantity: 0 });
    expect(() => reduceItems(base, [{ productId: 'pie', quantities: zero }])).toThrow(/already on the order/);
  });

  it('credit for a reduction = old total − new total, GST at the original rate', () => {
    const r = reduceItems(base, [
      { productId: 'bread', quantities: { ...zero, monday: 10, wednesday: 10 } },
      { productId: 'cake', quantities: { ...zero, monday: 3 } },
    ]);
    const t = orderTotals(r.items, order, effectiveGstRate(order, 0.12));
    expect(t.subtotal).toBe(160);
    expect(t.gst).toBe(8);
    expect(order.total - t.total).toBeCloseTo(42); // 40 + 2 GST
  });
});

describe('diffItems (unpaid edits)', () => {
  it('lists added, removed and changed products', () => {
    const after = normalizeItems([
      { ...items[0], wednesday: 0 },
      { productId: 'pie', productName: 'Pie', price: 8, ...zero, friday: 2 },
    ]);
    const d = diffItems(normalizeItems(items), after);
    expect(d.map((c) => [c.productId, c.originalQuantity, c.newQuantity])).toEqual([
      ['bread', 20, 10],
      ['cake', 5, 0],
      ['pie', 0, 2],
    ]);
  });
});

describe('planCancellation', () => {
  it('full cancel of a PAID order: credit = total − fee', () => {
    const p = planCancellation({ ...order, paymentReceived: true }, ['monday', 'wednesday'], 10, 0.05);
    expect(p.full).toBe(true);
    expect(p.fee).toBeCloseTo(22.4);
    expect(p.credit).toBeCloseTo(201.59);
  });

  it('full cancel of an UNPAID order: no fee, only the store credit used comes back', () => {
    const p = planCancellation({ ...order, creditApplied: 50, amountDue: 173.99 }, ['monday', 'wednesday'], 25, 0.05);
    expect(p).toMatchObject({ full: true, credit: 50, fee: 0, creditReturned: 50, creditApplied: 0, amountDue: 0 });
    expect(planCancellation(order, ['monday', 'wednesday'], 0, 0.05).credit).toBe(0);
  });

  it('partial cancel of an UNPAID order: smaller order, credit kept while it still fits', () => {
    const p = planCancellation({ ...order, creditApplied: 50 }, ['wednesday'], 0, 0.05);
    expect(p.full).toBe(false);
    expect(p.items.find((i) => i.productId === 'bread')!.total).toBe(10);
    expect(p.totals!.total).toBe(150 + 7.5 + 10 + 3.99);
    expect(p).toMatchObject({ credit: 0, creditApplied: 50, amountDue: 121.49 });
  });

  it('partial cancel of an UNPAID order returns credit the smaller order no longer needs', () => {
    const p = planCancellation({ ...order, creditApplied: 200 }, ['wednesday'], 0, 0.05);
    expect(p.creditApplied).toBe(171.49);
    expect(p.creditReturned).toBe(28.51);
    expect(p.amountDue).toBe(0);
  });

  it('partial cancel of a PAID order: credit for the cancelled part minus the fee, fee kept on the order', () => {
    const p = planCancellation({ ...order, paymentReceived: true }, ['wednesday'], 10, 0.05);
    // Wednesday = 10 bread = $50 + $2.50 GST = 52.50; fee 5.25
    expect(p.fee).toBe(5.25);
    expect(p.credit).toBe(47.25);
    expect(p.totals!.cancellationFee).toBe(5.25);
    expect(p.totals!.total).toBeCloseTo(order.total - 47.25);
  });

  it('refuses days that have nothing to cancel', () => {
    expect(() => planCancellation(order, ['sunday'], 0, 0.05)).toThrow(/at least one/);
    expect(activeDays(normalizeItems(items))).toEqual(['monday', 'wednesday']);
  });
});

describe('final invoice after changes to a paid order', () => {
  it('a paid order reduced by $42 still shows the full payment and the credit issued', () => {
    const paid = { ...order, total: order.total - 42, creditIssued: 42, paymentReceived: true, customerId: 'c1', year: 2026, week: 40 };
    const inv = buildFinalInvoice(paid, 'o1', 'DBH-1', new Date('2026-10-01T00:00:00Z'));
    expect(inv.finalTotal).toBeCloseTo(181.99);
    expect(inv.snapshots.totals.totalPaid).toBeCloseTo(223.99);
    expect(inv.snapshots.totals.creditsIssued).toBe(42);
    expect(inv.snapshots.totals.balanceDue).toBe(0);
    expect(inv.invoiceStatus).toBe('paid');
  });

  it('a paid partial cancellation with a fee balances too', () => {
    const p = planCancellation({ ...order, paymentReceived: true }, ['wednesday'], 10, 0.05);
    const after = { ...order, ...p.totals, items: p.items, creditIssued: p.credit, paymentReceived: true, customerId: 'c1' };
    const inv = buildFinalInvoice(after, 'o1', 'DBH-1', new Date('2026-10-01T00:00:00Z'));
    expect(inv.snapshots.totals.totalPaid).toBeCloseTo(223.99);
    expect(inv.snapshots.totals.balanceDue).toBe(0);
  });
});

describe('credit notes and account notifications', () => {
  it('a credit note splits GST and is fully available', () => {
    const n = buildCreditNote({
      id: 'abcdef123',
      customerId: 'c1',
      amount: 105,
      type: 'refund',
      reason: 'Goodwill',
      createdBy: 'admin@x.com',
      gstRate: 0.05,
      now: new Date('2026-10-01T12:00:00Z'),
    });
    expect(n).toMatchObject({
      orderId: 'abcdef123',
      creditNoteNumber: 'CN-20261001-ABCDEF',
      amount: 105,
      subtotal: 100,
      gst: 5,
      remainingBalance: 105,
      status: 'available',
      fullyApplied: false,
    });
  });

  const ref = { orderId: 'o1', orderNumber: 'ORD-1', weekRange: 'Week 40, 2026', customerId: 'c1', customerName: 'Cafe' };

  it('ids are deterministic per action, so retries cannot duplicate', () => {
    expect(paymentReminderNotification(ref, 2, 10).id).toBe('order_o1_reminder_2');
    expect(orderUpdatedNotification(ref, 'h1', 10, 0).id).toBe('order_o1_edit_h1');
    expect(orderReducedNotification(ref, 'h2', { credit: 5, reason: 'x' }).id).toBe('order_o1_edit_h2');
    expect(creditIssuedNotification({ creditNoteId: 'n1', customerId: 'c1', customerName: '', amount: 5, reason: '' }).id).toBe('credit_n1');
    const payout = payoutRequestedNotification({ creditNoteId: 'n1', customerId: 'c1', customerName: 'Cafe', amount: 5 });
    expect(payout).toMatchObject({ audience: 'admin', id: 'payout_n1' });
  });

  it('a reminder states the amount due (after store credit), not the order total', () => {
    const w = paymentReminderNotification(ref, 1, 73.99);
    expect(w.content.message).toContain('$73.99');
    expect(w.content.amount).toBe(73.99);
  });
});
