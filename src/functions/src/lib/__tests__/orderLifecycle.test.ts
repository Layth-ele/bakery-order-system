/**
 * Order lifecycle + lifecycle notifications (pure modules shared by the
 * Cloud Functions and the web app). Run with the root `npm test`.
 */
import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  TERMINAL_STATUSES,
  canTransitionOrderStatus,
  detectOrderEvents,
  type OrderEvent,
} from '../orderLifecycle';
import { buildOrderNotifications, ORDER_NOTIFICATION_TYPES, notificationId } from '../orderNotifications';
import { EMAILED_STATUSES } from '../emailContent';
import { NOTIFICATION_TYPES } from '../../../../types/notification-contract';
import { orderStatusSchema } from '../../../../schemas/order/orderEnums.schema';

const order = {
  orderNumber: 'ORD-2026-09-28-001',
  customerId: 'cust1',
  customerName: 'Corner Café',
  weekRange: 'Sep 28 – Oct 4',
  subtotal: 100,
  gst: 5,
  total: 120,
  status: 'pending',
};

describe('lifecycle definition', () => {
  it('web app schema accepts exactly the shared statuses', () => {
    for (const s of ORDER_STATUSES) expect(orderStatusSchema.safeParse(s).success).toBe(true);
    expect(orderStatusSchema.safeParse('complete').success).toBe(false);
  });

  it('terminal statuses have no exits; every target is a known status', () => {
    for (const t of TERMINAL_STATUSES) expect(ORDER_TRANSITIONS[t]).toEqual([]);
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const t of targets) expect(ORDER_STATUSES).toContain(t);
    }
  });

  it('every non-terminal status can reach completed or cancelled', () => {
    for (const s of ORDER_STATUSES) {
      if (TERMINAL_STATUSES.includes(s)) continue;
      expect(canTransitionOrderStatus(s, 'cancelled')).toBe(true);
    }
    expect(canTransitionOrderStatus('in_process', 'completed')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(canTransitionOrderStatus('pending', 'shipped')).toBe(false);
    expect(canTransitionOrderStatus(undefined, 'approved')).toBe(false);
  });
});

describe('detectOrderEvents', () => {
  it('new pending order → placed', () => {
    expect(detectOrderEvents(undefined, order)).toEqual([{ kind: 'placed' }]);
  });

  it('status change → status event', () => {
    expect(detectOrderEvents(order, { ...order, status: 'approved' })).toEqual([
      { kind: 'status', from: 'pending', to: 'approved' },
    ]);
  });

  it('payment submitted flag flip → payment_submitted', () => {
    const approved = { ...order, status: 'approved' };
    expect(detectOrderEvents(approved, { ...approved, paymentSubmitted: true })).toEqual([
      { kind: 'payment_submitted' },
    ]);
  });

  it('unrelated edits and deletes produce nothing', () => {
    expect(detectOrderEvents(order, { ...order, note: 'extra rye' })).toEqual([]);
    expect(detectOrderEvents(order, undefined)).toEqual([]);
    expect(detectOrderEvents(order, { ...order, status: 'bogus' })).toEqual([]);
  });
});

describe('lifecycle notifications', () => {
  const clientTypes = Object.values(NOTIFICATION_TYPES) as string[];

  it('every server notification type exists in the web app contract', () => {
    for (const t of ORDER_NOTIFICATION_TYPES) expect(clientTypes).toContain(t);
    // Written by createCustomerWithCode (customers.ts).
    expect(clientTypes).toContain('NEW_REGISTRATION');
  });

  const cases: Array<[OrderEvent, Record<string, unknown>, string[]]> = [
    [{ kind: 'placed' }, order, ['admin:ORDER_PLACED_TRACKING']],
    [{ kind: 'status', from: 'pending', to: 'approved' }, { ...order, status: 'approved' }, ['customer:ORDER_APPROVED_PAY_REQUIRED']],
    [{ kind: 'status', from: 'pending', to: 'rejected' }, { ...order, rejectionReason: 'Past cutoff' }, ['customer:ORDER_REJECTED']],
    [{ kind: 'status', from: 'approved', to: 'cancelled' }, { ...order, creditAmount: 20 }, ['customer:ORDER_CANCELLED']],
    [{ kind: 'payment_submitted' }, { ...order, paymentReference: 'ET-123' }, ['admin:PAYMENT_SUBMITTED']],
    [{ kind: 'status', from: 'approved', to: 'in_process' }, order, ['customer:PAYMENT_CONFIRMED', 'admin:PAYMENT_CONFIRMED_ADMIN']],
    [{ kind: 'status', from: 'in_process', to: 'completed' }, { ...order, finalInvoiceId: 'inv9' }, ['customer:ORDER_COMPLETED']],
    [{ kind: 'status', from: 'in_process', to: 'delivered' }, order, []],
  ];

  it.each(cases)('%j → exactly the expected notifications', (event, raw, expected) => {
    const writes = buildOrderNotifications(event, raw, 'o1');
    expect(writes.map((w) => `${w.audience}:${w.content.type}`)).toEqual(expected);
    for (const w of writes) {
      expect(w.id).toMatch(/^order_o1_[a-z_]+$/);
      expect(w.content.orderId).toBe('o1');
      expect(w.content.message).toContain('ORD-2026-09-28-001');
    }
  });

  it('payment confirmation resolves the same admin alert the submission created', () => {
    const submitted = buildOrderNotifications({ kind: 'payment_submitted' }, order, 'o1')[0];
    const resolved = buildOrderNotifications({ kind: 'status', from: 'approved', to: 'in_process' }, order, 'o1')
      .find((w) => w.audience === 'admin')!;
    expect(resolved.id).toBe(submitted.id);
    expect(resolved.mode).toBe('update');
    expect(resolved.content.read).toBe(true);
  });

  it('ids are deterministic, so a retried trigger cannot duplicate', () => {
    const e: OrderEvent = { kind: 'status', from: 'pending', to: 'approved' };
    expect(buildOrderNotifications(e, order, 'o1')[0].id).toBe(buildOrderNotifications(e, order, 'o1')[0].id);
    expect(notificationId('o1', 'approved')).toBe('order_o1_approved');
  });

  it('carries reason, credit and invoice details the modals read', () => {
    const [rej] = buildOrderNotifications({ kind: 'status', from: 'pending', to: 'rejected' }, { ...order, rejectionReason: 'Past cutoff' }, 'o1');
    expect(rej.content.metadata.reason).toBe('Past cutoff');
    const [can] = buildOrderNotifications({ kind: 'status', from: 'approved', to: 'cancelled' }, { ...order, creditAmount: 20 }, 'o1');
    expect(can.content.message).toContain('$20.00 store credit');
    const [done] = buildOrderNotifications({ kind: 'status', from: 'in_process', to: 'completed' }, { ...order, finalInvoiceId: 'inv9' }, 'o1');
    expect(done.content.invoiceId).toBe('inv9');
  });

  it('skips customer notifications when the order has no customerId', () => {
    const { customerId: _omit, ...noCustomer } = order;
    expect(buildOrderNotifications({ kind: 'status', from: 'pending', to: 'approved' }, noCustomer, 'o1')).toEqual([]);
  });

  it('every status that gets a customer email is a real lifecycle status', () => {
    for (const s of EMAILED_STATUSES) expect(ORDER_STATUSES).toContain(s);
    expect(EMAILED_STATUSES).not.toContain('delivered');
  });
});
