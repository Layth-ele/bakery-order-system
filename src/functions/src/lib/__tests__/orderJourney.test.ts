/**
 * End-to-end order journeys through the lifecycle side-effect runner
 * (the logic behind the onOrderLifecycle trigger), with in-memory fakes
 * that enforce the same idempotency rules as production:
 *   - notifications: create-once per id, update only if it exists
 *     (Firestore create() / update())
 *   - emails: at most one send per orderStatusEmailLogId (emailLog)
 *
 * Asserts that every step produces exactly the expected notifications and
 * emails — once — even when the trigger is delivered twice.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { runOrderSideEffects, orderStatusEmailLogId, type OrderSideEffectDeps } from '../orderSideEffects';
import type { NotificationWrite } from '../orderNotifications';

type Doc = Record<string, unknown>;

class FakeBackend {
  notifications = new Map<string, Doc>();
  emails = new Map<string, { status: string; to: string }>();
  emailAttempts = 0;
  failNotificationIds = new Set<string>();

  private key(w: NotificationWrite) {
    return w.audience === 'admin' ? `admin/${w.id}` : `user_${w.customerId}/${w.id}`;
  }

  deps: OrderSideEffectDeps = {
    writeNotification: async (w) => {
      if (this.failNotificationIds.has(w.id)) throw new Error(`boom ${w.id}`);
      const k = this.key(w);
      if (w.mode === 'create') {
        if (this.notifications.has(k)) return; // Firestore create(): ALREADY_EXISTS
        this.notifications.set(k, { ...w.content, read: w.content.read ?? false });
      } else {
        if (!this.notifications.has(k)) return; // update(): NOT_FOUND
        this.notifications.set(k, { ...this.notifications.get(k), ...w.content });
      }
    },
    sendStatusEmail: async (orderId, status, order) => {
      this.emailAttempts += 1;
      const id = orderStatusEmailLogId(orderId, status);
      if (this.emails.has(id)) return; // emailLog already "sent"
      this.emails.set(id, { status, to: String(order.customerEmail ?? '') });
    },
  };

  types() {
    return [...this.notifications.entries()].map(([k, v]) => `${k.split('/')[0]}:${v.type}`).sort();
  }
  emailStatuses() {
    return [...this.emails.values()].map((e) => e.status);
  }
}

const base: Doc = {
  orderNumber: 'ORD-2026-09-28-007',
  customerId: 'cust1',
  customerEmail: 'sam@corner.test',
  customerName: 'Corner Café',
  weekRange: 'Sep 28 – Oct 4',
  subtotal: 100,
  gst: 5,
  total: 120,
};

describe('order journeys', () => {
  let be: FakeBackend;
  let current: Doc | undefined;

  /** Apply a write and run the trigger (twice, to simulate a redelivery). */
  async function write(next: Doc | undefined, { redeliver = true } = {}) {
    const before = current;
    current = next;
    const results = await runOrderSideEffects(before, next, 'o1', be.deps);
    if (redeliver) await runOrderSideEffects(before, next, 'o1', be.deps);
    return results;
  }

  beforeEach(() => {
    be = new FakeBackend();
    current = undefined;
  });

  it('happy path: placed → approved → paid → completed', async () => {
    await write({ ...base, status: 'pending' });
    expect(be.types()).toEqual(['admin:ORDER_PLACED_TRACKING']);
    expect(be.emailStatuses()).toEqual(['pending']);

    await write({ ...current, status: 'approved', amountDue: 120 });
    expect(be.types()).toEqual(['admin:ORDER_PLACED_TRACKING', 'user_cust1:ORDER_APPROVED_PAY_REQUIRED']);
    expect(be.emailStatuses()).toEqual(['pending', 'approved']);

    await write({ ...current, paymentSubmitted: true, paymentReference: 'ET-55' });
    expect(be.types()).toContain('admin:PAYMENT_SUBMITTED');
    expect(be.emailStatuses()).toHaveLength(2); // no email for a submission

    await write({ ...current, status: 'in_process', paymentReceived: true });
    // Admin alert resolved in place (same doc), customer told it's paid.
    expect(be.types()).toEqual([
      'admin:ORDER_PLACED_TRACKING',
      'admin:PAYMENT_CONFIRMED_ADMIN',
      'user_cust1:ORDER_APPROVED_PAY_REQUIRED',
      'user_cust1:PAYMENT_CONFIRMED',
    ]);
    expect(be.notifications.get('admin/order_o1_payment')?.read).toBe(true);

    await write({ ...current, status: 'completed', finalInvoiceId: 'inv7' });
    expect(be.types()).toContain('user_cust1:ORDER_COMPLETED');
    expect(be.emailStatuses()).toEqual(['pending', 'approved', 'in_process', 'completed']);

    // Exactly 5 notifications and 4 emails for the whole journey, despite
    // every step being delivered twice.
    expect(be.notifications.size).toBe(5);
    expect(be.emails.size).toBe(4);
    expect(be.emailAttempts).toBe(8); // attempted twice, sent once each
  });

  it('rejection: one customer notification + one email, carrying the reason', async () => {
    await write({ ...base, status: 'pending' });
    await write({ ...current, status: 'rejected', rejectionReason: 'Past the weekly cutoff' });
    const rej = be.notifications.get('user_cust1/order_o1_rejected')!;
    expect(rej.type).toBe('ORDER_REJECTED');
    expect(String(rej.message)).toContain('Past the weekly cutoff');
    expect(be.emailStatuses()).toEqual(['pending', 'rejected']);
  });

  it('cancellation after approval announces the store credit', async () => {
    await write({ ...base, status: 'pending' });
    await write({ ...current, status: 'approved' });
    await write({ ...current, status: 'cancelled', cancellationReason: 'Closed for holiday', creditAmount: 45 });
    const c = be.notifications.get('user_cust1/order_o1_cancelled')!;
    expect(String(c.message)).toContain('$45.00 store credit');
    expect(be.emailStatuses()).toEqual(['pending', 'approved', 'cancelled']);
  });

  it('paid order auto-completed straight from approved still notifies once', async () => {
    await write({ ...base, status: 'pending' });
    await write({ ...current, status: 'approved' });
    await write({ ...current, status: 'completed', paymentReceived: true });
    expect(be.types().filter((t) => t.endsWith('ORDER_COMPLETED'))).toHaveLength(1);
    expect(be.emailStatuses()).toContain('completed');
  });

  it('payment confirmed without a prior submission does not invent an admin alert', async () => {
    await write({ ...base, status: 'pending' });
    await write({ ...current, status: 'approved' });
    await write({ ...current, status: 'in_process', paymentReceived: true });
    expect(be.notifications.has('admin/order_o1_payment')).toBe(false);
    expect(be.types()).toContain('user_cust1:PAYMENT_CONFIRMED');
  });

  it('edits that do not change status or payment produce nothing', async () => {
    await write({ ...base, status: 'pending' });
    const n = be.notifications.size;
    const e = be.emails.size;
    await write({ ...current, note: 'Please add extra rye', updatedAt: 123 });
    await write({ ...current, items: [{ productName: 'Rye', price: 5, total: 2 }] });
    expect(be.notifications.size).toBe(n);
    expect(be.emails.size).toBe(e);
  });

  it('legacy delivered status is never announced', async () => {
    await write({ ...base, status: 'in_process' }, { redeliver: false });
    const results = await runOrderSideEffects(current, { ...current, status: 'delivered' }, 'o1', be.deps);
    expect(results.filter((r) => r.label.includes('notification'))).toHaveLength(0);
    expect(be.emailStatuses()).not.toContain('delivered');
  });

  it('a failing side effect does not block the others', async () => {
    be.failNotificationIds.add('order_o1_placed');
    const results = await runOrderSideEffects(undefined, { ...base, status: 'pending' }, 'o1', be.deps);
    expect(results.find((r) => r.label.includes('order_o1_placed'))?.ok).toBe(false);
    expect(be.emailStatuses()).toEqual(['pending']); // email still went out
  });

  it('deleting an order produces nothing', async () => {
    await write({ ...base, status: 'pending' });
    const results = await runOrderSideEffects(current, undefined, 'o1', be.deps);
    expect(results).toEqual([]);
  });
});
