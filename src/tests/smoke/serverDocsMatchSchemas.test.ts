/**
 * Records written by Cloud Functions must pass the web app's schemas —
 * parseArrayPartial silently drops anything that doesn't, which would make
 * real orders / credit vanish from the customer's screens.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { orderSchema } from '../../schemas/order/order.schema';
import { creditNoteSchema } from '../../schemas/creditNote/creditNote.schema';
import { buildCreditNote } from '../../functions/src/lib/creditNotes';
import { priceOrder, parsePlaceOrderInput } from '../../functions/src/lib/orderPlacement';

const now = Timestamp.now();
const zero = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };

function placedOrder(extra: Record<string, unknown> = {}) {
  const input = parsePlaceOrderInput({ requestId: 'a1b2c3d4e5f6a7b8c9d0', week: 42, year: 2026, items: [{ productId: 'p1', quantities: { ...zero, monday: 4 } }] });
  const p = priceOrder(input, new Map([['p1', { name: 'Almond Croissant', wholesale: 3.69 }]]), { tier: 'commercial', gstRate: 0.05, serviceCharge: 3.99, deliveryFee: 10, freeDeliveryMin: 250 });
  // Same fields placeOrder (functions/src/orders.ts) writes.
  return {
    id: 'a1b2c3d4e5f6a7b8c9d0', orderNumber: 'ORD-2026-10-02-001-42', customerId: 'cust-1', customerName: 'Hamid',
    customerEmail: 'h@x.test', customerAddress: 'Address not provided', customerContactPerson: 'Hamidreza', customerPhone: '',
    week: 42, year: 2026, weekRange: 'Week 42, 2026', yearMonth: '2026-10', items: p.items, subtotal: p.subtotal, gst: p.gst,
    deliveryFee: p.deliveryFee, serviceCharge: p.serviceCharge, serviceChargeWaived: false, total: p.total, creditApplied: 0,
    amountDue: p.total, status: 'pending', paymentReceived: false, paymentSubmitted: false, note: '', placedByCustomer: true,
    createdBy: 'cust-1', createdAt: now, updatedAt: now, ...extra,
  };
}

describe('server-written records pass the client schemas', () => {
  it('a placed order', () => {
    const r = orderSchema.safeParse(placedOrder());
    expect(r.success ? 'ok' : JSON.stringify(r.error.issues.slice(0, 5))).toBe('ok');
  });
  it('an order fully paid with store credit (amountDue 0)', () => {
    const r = orderSchema.safeParse(placedOrder({ creditApplied: 25.48, amountDue: 0 }));
    expect(r.success ? 'ok' : JSON.stringify(r.error.issues.slice(0, 5))).toBe('ok');
  });
  it('an approved, a paid, and a partially-cancelled order', () => {
    for (const extra of [
      { status: 'approved', approvedAt: now, approvedBy: 'admin@x.test' },
      { status: 'in_process', paymentReceived: true, paymentSubmitted: true, paidAt: now, invoiceNumber: 'DBH-2026-10-02-000001-11' },
      { status: 'in_process', paymentReceived: true, creditIssued: 21, cancellationFee: 4.2, cancelledDays: ['wednesday'], editCount: 1 },
    ]) {
      const r = orderSchema.safeParse(placedOrder(extra));
      expect(r.success ? 'ok' : JSON.stringify(r.error.issues.slice(0, 5))).toBe('ok');
    }
  });
  it('a credit note', () => {
    const note = { id: 'n1', ...buildCreditNote({ id: 'n1abc', customerId: 'cust-1', amount: 21, type: 'admin_edit', reason: 'Short on flour', createdBy: 'admin@x.test', gstShare: 1 / 21, now: new Date() }), createdAt: now };
    const r = creditNoteSchema.safeParse(note);
    expect(r.success ? 'ok' : JSON.stringify(r.error.issues.slice(0, 5))).toBe('ok');
  });
});
