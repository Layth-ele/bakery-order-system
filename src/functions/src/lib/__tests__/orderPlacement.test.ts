/**
 * placeOrder rules: input validation, delivery-day cutoff, pricing and
 * store credit. Run with `npm test`.
 */
import { describe, it, expect } from 'vitest';
import {
  PlacementError,
  allocateCredit,
  amountDueOf,
  closedDaysInOrder,
  dayCutoff,
  parsePlaceOrderInput,
  priceOrder,
  unitPriceFor,
} from '../orderPlacement';

const zero = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };
const valid = {
  requestId: 'a1b2c3d4e5f6a7b8c9d0',
  week: 42,
  year: 2026,
  items: [{ productId: 'bread', quantities: { ...zero, monday: 10 } }],
};

describe('parsePlaceOrderInput', () => {
  it('accepts a valid order and drops items with no quantities', () => {
    const r = parsePlaceOrderInput({ ...valid, items: [...valid.items, { productId: 'cake', quantities: zero }], note: '  hi ' });
    expect(r.items.map((i) => i.productId)).toEqual(['bread']);
    expect(r.note).toBe('hi');
    expect(r.creditToApply).toBe(0);
  });

  it.each([
    ['short requestId', { ...valid, requestId: 'abc' }],
    ['bad week', { ...valid, week: 54 }],
    ['no items', { ...valid, items: [] }],
    ['all zero', { ...valid, items: [{ productId: 'bread', quantities: zero }] }],
    ['fractional qty', { ...valid, items: [{ productId: 'bread', quantities: { ...zero, monday: 1.5 } }] }],
    ['duplicate product', { ...valid, items: [valid.items[0], valid.items[0]] }],
    ['negative credit', { ...valid, creditToApply: -5 }],
  ])('rejects %s', (_label, input) => {
    expect(() => parsePlaceOrderInput(input)).toThrow(PlacementError);
  });
});

describe('cutoff', () => {
  it('a day closes 48 h before noon Vancouver that day', () => {
    // ISO week 42 of 2026: Monday 12 Oct; noon PDT = 19:00Z; −48 h = Sat 10 Oct 19:00Z.
    expect(dayCutoff(2026, 42, 'monday').toISOString()).toBe('2026-10-10T19:00:00.000Z');
  });

  it('only days with quantities that are past cutoff are closed', () => {
    const input = { ...valid, items: [{ productId: 'b', quantities: { ...zero, monday: 1, friday: 1 } }] };
    expect(closedDaysInOrder(input, new Date('2026-10-10T18:59:00Z'))).toEqual([]);
    expect(closedDaysInOrder(input, new Date('2026-10-10T19:00:00Z'))).toEqual(['monday']);
  });
});

describe('pricing', () => {
  const bread = { name: 'Bread', retail: 6, wholesale: 4, price: 5, discount: 25 };

  it('wholesale for commercial, retail for individual, with product discount', () => {
    expect(unitPriceFor(bread, 'commercial')).toBe(3);
    expect(unitPriceFor(bread, 'individual')).toBe(4.5);
    expect(unitPriceFor({ price: 5 }, 'commercial')).toBe(5);
  });

  const catalog = new Map([['bread', { name: 'Bread', wholesale: 4 }]]);
  const opts = { tier: 'commercial' as const, gstRate: 0.05, serviceCharge: 3.99, deliveryFee: 10, freeDeliveryMin: 250 };

  it('total = subtotal + GST + service charge + delivery (below free-delivery minimum)', () => {
    const p = priceOrder(parsePlaceOrderInput(valid), catalog, opts);
    expect(p).toMatchObject({ subtotal: 40, gst: 2, serviceCharge: 3.99, deliveryFee: 10, total: 55.99 });
    expect(p.items[0]).toMatchObject({ price: 4, monday: 10, total: 10 });
  });

  it('free delivery at or above the minimum', () => {
    const big = { ...valid, items: [{ productId: 'bread', quantities: { ...zero, monday: 70 } }] };
    expect(priceOrder(parsePlaceOrderInput(big), catalog, opts).deliveryFee).toBe(0);
  });

  it('refuses missing, unavailable or unpriced products', () => {
    const input = parsePlaceOrderInput(valid);
    expect(() => priceOrder(input, new Map(), opts)).toThrow(/no longer available/);
    expect(() => priceOrder(input, new Map([['bread', { name: 'Bread', wholesale: 4, available: false }]]), opts)).toThrow(/unavailable/);
    expect(() => priceOrder(input, new Map([['bread', { name: 'Bread' }]]), opts)).toThrow(/no price/);
  });
});

describe('store credit', () => {
  const notes = [
    { id: 'new', remaining: 30, createdAtMs: 2 },
    { id: 'old', remaining: 20, createdAtMs: 1 },
  ];

  it('spends oldest credit first and never more than the order total', () => {
    expect(allocateCredit(notes, 25, 100)).toEqual({
      applied: 25,
      deductions: [
        { id: 'old', used: 20, newBalance: 0 },
        { id: 'new', used: 5, newBalance: 25 },
      ],
    });
    expect(allocateCredit(notes, 50, 40).applied).toBe(40);
  });

  it('refuses more credit than available', () => {
    expect(() => allocateCredit(notes, 51, 100)).toThrow(/Not enough store credit/);
  });

  it('amount due = total − credit, never negative', () => {
    expect(amountDueOf(55.99, 20)).toBe(35.99);
    expect(amountDueOf(10, 20)).toBe(0);
  });
});
