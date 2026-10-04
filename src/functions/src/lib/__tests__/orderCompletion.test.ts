/**
 * Order completion rules: due date, auto-complete eligibility, final invoice
 * math and the completion snapshot.
 */
import { describe, it, expect } from 'vitest';
import {
  deliveryWeekCloseAt,
  deliveryWeekEndDate,
  isDueForAutoComplete,
  orderDeliveredAt,
  completionBlocker,
  buildFinalInvoice,
  buildCompletionSnapshot,
  AUTO_COMPLETE_WINDOW_DAYS,
  isDueForAutoCancelUnpaid,
  UNPAID_EXPIRED_REASON,
} from '../orderCompletion';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('deliveryWeekCloseAt — Friday 12:00 Vancouver of the ISO week', () => {
  it('summer (PDT, UTC-7)', () => {
    // ISO 2026-W40 = Mon Sep 28 – Sun Oct 4 → Friday Oct 2, 12:00 PDT = 19:00Z
    expect(deliveryWeekCloseAt(2026, 40)?.toISOString()).toBe('2026-10-02T19:00:00.000Z');
  });

  it('winter (PST, UTC-8)', () => {
    // ISO 2026-W02 = Mon Jan 5 → Friday Jan 9, 12:00 PST = 20:00Z
    expect(deliveryWeekCloseAt(2026, 2)?.toISOString()).toBe('2026-01-09T20:00:00.000Z');
  });

  it('ISO week 1 that starts in the previous calendar year', () => {
    // ISO 2026-W01 = Mon Dec 29 2025 → Friday Jan 2 2026
    expect(deliveryWeekCloseAt(2026, 1)?.toISOString()).toBe('2026-01-02T20:00:00.000Z');
  });

  it('rejects missing or invalid week/year', () => {
    expect(deliveryWeekCloseAt(undefined, 40)).toBeNull();
    expect(deliveryWeekCloseAt(2026, 0)).toBeNull();
    expect(deliveryWeekCloseAt(2026, 54)).toBeNull();
    expect(deliveryWeekCloseAt('2026', 40)).toBeNull();
  });

  it('delivery date is the Sunday of that week', () => {
    expect(deliveryWeekEndDate(2026, 40)).toBe('2026-10-04');
  });
});

describe('isDueForAutoComplete', () => {
  const closeAt = deliveryWeekCloseAt(2026, 40)!;
  const paid = { status: 'in_process', paymentReceived: true, year: 2026, week: 40 };

  it('due from Friday noon of its week, for up to 7 days', () => {
    expect(isDueForAutoComplete(paid, new Date(closeAt.getTime() - 1))).toBe(false);
    expect(isDueForAutoComplete(paid, closeAt)).toBe(true);
    expect(isDueForAutoComplete(paid, new Date(closeAt.getTime() + 5 * 60_000))).toBe(true); // the 12:05 run
    expect(isDueForAutoComplete(paid, new Date(closeAt.getTime() + AUTO_COMPLETE_WINDOW_DAYS * DAY))).toBe(true);
  });

  it('leaves older leftovers for an admin (no mass backlog completion)', () => {
    expect(isDueForAutoComplete(paid, new Date(closeAt.getTime() + AUTO_COMPLETE_WINDOW_DAYS * DAY + 1))).toBe(false);
  });

  it('only completes paid, active, not-yet-invoiced, unlocked orders', () => {
    const at = new Date(closeAt.getTime() + HOUR);
    expect(isDueForAutoComplete({ ...paid, paymentReceived: false }, at)).toBe(false);
    expect(isDueForAutoComplete({ ...paid, status: 'pending' }, at)).toBe(false);
    expect(isDueForAutoComplete({ ...paid, status: 'cancelled' }, at)).toBe(false);
    expect(isDueForAutoComplete({ ...paid, status: 'completed' }, at)).toBe(false);
    expect(isDueForAutoComplete({ ...paid, locked: true }, at)).toBe(false);
    expect(isDueForAutoComplete({ ...paid, finalInvoiceId: 'x' }, at)).toBe(false);
    expect(isDueForAutoComplete({ ...paid, week: undefined }, at)).toBe(false);
    expect(isDueForAutoComplete({ ...paid, status: 'approved' }, at)).toBe(true); // paid but never moved to in_process
  });
});

describe('completionBlocker (manual "Mark complete")', () => {
  it('allows approved / in_process / legacy delivered', () => {
    for (const status of ['approved', 'in_process', 'delivered']) expect(completionBlocker({ status })).toBeNull();
  });
  it('explains why other orders cannot be completed', () => {
    expect(completionBlocker({ status: 'completed' })).toBe('already_completed');
    expect(completionBlocker({ status: 'pending' })).toBe('not_allowed_from_status');
    expect(completionBlocker({ status: 'rejected' })).toBe('not_allowed_from_status');
    expect(completionBlocker({ status: 'in_process', locked: true })).toBe('locked');
  });
});

describe('buildFinalInvoice', () => {
  const now = new Date('2026-10-02T19:05:00Z');
  const order = {
    customerId: 'c1',
    customerName: 'Corner Café',
    customerEmail: 'sam@corner.test',
    items: [{ productName: 'Sourdough', total: 10, price: 6.5 }],
    subtotal: 100,
    gst: 5,
    total: 120,
    year: 2026,
    week: 40,
    paymentReceived: true,
  };

  it('a fully paid order produces a paid invoice keyed by the order id', () => {
    const inv = buildFinalInvoice(order, 'o1', 'DBH-2026-10-02-001-55', now);
    expect(inv).toMatchObject({
      id: 'o1',
      orderId: 'o1',
      invoiceNumber: 'DBH-2026-10-02-001-55',
      customerName: 'Corner Café',
      finalTotal: 120,
      invoiceStatus: 'paid',
      paymentReceived: true,
      weekKey: '2026-W40',
      yearMonth: '2026-10',
      isoWeek: 40,
    });
    expect(inv.snapshots.totals).toMatchObject({ baseTotal: 120, totalPaid: 120, balanceDue: 0 });
  });

  it('unpaid and partially-covered orders', () => {
    expect(buildFinalInvoice({ ...order, paymentReceived: false }, 'o1', 'N', now).invoiceStatus).toBe('unpaid');
    const partial = buildFinalInvoice({ ...order, paymentReceived: false, creditApplied: 20 }, 'o1', 'N', now);
    expect(partial.invoiceStatus).toBe('partial');
    expect(partial.snapshots.totals.balanceDue).toBe(100);
  });

  it('accounts for adjustments (confirmed increases paid, decreases as credit)', () => {
    const inv = buildFinalInvoice(
      {
        ...order,
        adjustments: [
          { type: 'increase', deltaTotal: 15, paid: { status: 'confirmed', amount: 15 } },
          { type: 'increase', deltaTotal: 8 },
          { type: 'decrease', deltaTotal: -12 },
        ],
      },
      'o1',
      'N',
      now
    );
    expect(inv.snapshots.totals).toMatchObject({ adjPaidConfirmed: 15, adjUnpaid: 8, creditsIssued: 12, totalPaid: 135 });
    expect(inv.snapshots.adjustments).toHaveLength(3);
  });
});

describe('buildCompletionSnapshot', () => {
  it('records who completed it and links the invoice', () => {
    const s = buildCompletionSnapshot({ customerId: 'c1', total: 120, items: [], adjustments: [{ deltaTotal: 5 }] }, 'o1', 'auto-scheduler', 'o1');
    expect(s).toMatchObject({
      orderId: 'o1',
      trigger: 'complete',
      status: 'completed',
      reason: 'Auto-completed by system',
      finalInvoiceId: 'o1',
      locked: true,
      adjustmentsCount: 1,
      totalAdjustmentsDelta: 5,
    });
    expect(buildCompletionSnapshot({}, 'o1', 'admin@bakery.test', 'o1').reason).toBe('Manually completed by admin@bakery.test');
  });
});

describe('buildFinalInvoice with store credit (credit counted once)', () => {
  it('paid order with credit: cash paid = total − credit, balance 0, status paid', () => {
    const inv = buildFinalInvoice(
      { total: 120, subtotal: 100, gst: 5, creditApplied: 20, paymentReceived: true, year: 2026, week: 40 },
      'o1',
      'N',
      new Date('2026-10-02T19:05:00Z')
    );
    expect(inv.snapshots.totals).toMatchObject({ baseTotal: 120, creditsApplied: 20, totalPaid: 100, balanceDue: 0 });
    expect(inv.invoiceStatus).toBe('paid');
  });
});

describe('orderDeliveredAt — noon Vancouver on the last delivery day', () => {
  const z = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };
  const item = (days: Record<string, number>) => ({ productId: 'p', ...z, ...days });
  it('a weekend order is due Sunday noon, not Friday', () => {
    // 2026-W40: Sun Oct 4 12:00 PDT = 19:00Z
    const order = { status: 'in_process', paymentReceived: true, year: 2026, week: 40, items: [item({ monday: 2, sunday: 3 })] };
    expect(orderDeliveredAt(order)?.toISOString()).toBe('2026-10-04T19:00:00.000Z');
    const fridayRun = new Date('2026-10-02T19:05:00.000Z');
    expect(isDueForAutoComplete(order, fridayRun)).toBe(false); // still to be baked Sunday
    expect(isDueForAutoComplete(order, new Date('2026-10-04T19:05:00.000Z'))).toBe(true);
  });
  it('a Monday-only order is due Monday noon', () => {
    const order = { year: 2026, week: 40, items: [item({ monday: 5 })] };
    expect(orderDeliveredAt(order)?.toISOString()).toBe('2026-09-28T19:00:00.000Z');
  });
  it('falls back to Friday noon when the order has no item days', () => {
    expect(orderDeliveredAt({ year: 2026, week: 40, items: [] })?.toISOString()).toBe(deliveryWeekCloseAt(2026, 40)?.toISOString());
  });
});

describe('isDueForAutoCancelUnpaid — unpaid orders past every delivery day', () => {
  // ISO 2026-W40: Mon Sep 28 … Wed Sep 30. Last delivery Wednesday noon PDT = 19:00Z.
  const wedNoon = new Date('2026-09-30T19:00:00.000Z').getTime();
  const unpaid = (extra: Record<string, unknown> = {}) => ({
    status: 'approved',
    year: 2026,
    week: 40,
    items: [{ productId: 'p', monday: 8, wednesday: 8 }],
    ...extra,
  });

  it('waits out the rest of the last delivery day (grace for a late e-transfer)', () => {
    expect(isDueForAutoCancelUnpaid(unpaid(), new Date(wedNoon + 1 * HOUR))).toBe(false);
    expect(isDueForAutoCancelUnpaid(unpaid(), new Date(wedNoon + 11.9 * HOUR))).toBe(false);
    expect(isDueForAutoCancelUnpaid(unpaid(), new Date(wedNoon + 12 * HOUR))).toBe(true);
  });

  it('cancels long-forgotten unpaid orders too (no time window)', () => {
    expect(isDueForAutoCancelUnpaid(unpaid(), new Date(wedNoon + 180 * DAY))).toBe(true);
  });

  it('never while a delivery day is still to come', () => {
    // Monday passed, Wednesday still ahead → admin decides (cancel days / chase payment).
    expect(isDueForAutoCancelUnpaid(unpaid(), new Date(wedNoon - 1 * DAY))).toBe(false);
  });

  it('never when the customer has sent a payment awaiting confirmation', () => {
    expect(isDueForAutoCancelUnpaid(unpaid({ paymentSubmitted: true }), new Date(wedNoon + 30 * DAY))).toBe(false);
  });

  it('never for paid, pending, completed, cancelled or locked orders', () => {
    const later = new Date(wedNoon + 30 * DAY);
    expect(isDueForAutoCancelUnpaid(unpaid({ paymentReceived: true }), later)).toBe(false);
    for (const status of ['pending', 'in_process', 'delivered', 'completed', 'cancelled', 'rejected']) {
      expect(isDueForAutoCancelUnpaid(unpaid({ status }), later)).toBe(false);
    }
    expect(isDueForAutoCancelUnpaid(unpaid({ locked: true }), later)).toBe(false);
  });

  it('ignores orders without a valid week', () => {
    expect(isDueForAutoCancelUnpaid(unpaid({ week: undefined }), new Date(wedNoon + 30 * DAY))).toBe(false);
  });

  it('gives the customer a plain reason', () => {
    expect(UNPAID_EXPIRED_REASON).toBe('Not paid by the delivery date');
  });
});
