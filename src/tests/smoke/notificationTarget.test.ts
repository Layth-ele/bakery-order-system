/**
 * Notification click handling + Firestore document mapping.
 */
import { describe, it, expect, vi } from 'vitest';
import { resolveNotificationTarget } from '../../notifications/utils/notificationTarget';
import { toNotificationItem } from '../../notifications/contexts/toNotificationItem';

describe('resolveNotificationTarget', () => {
  const noOrder = vi.fn().mockResolvedValue(null);

  it('opens the Registrations page for new registrations (current and legacy type)', async () => {
    for (const type of ['NEW_REGISTRATION', 'new_registration']) {
      expect(await resolveNotificationTarget({ type }, undefined, noOrder)).toEqual({
        kind: 'route',
        route: '/admin/registrations',
      });
    }
  });

  it('payment reminder → pay now when nothing was submitted', async () => {
    const load = vi.fn().mockResolvedValue({ paymentSubmitted: false });
    const t = await resolveNotificationTarget({ type: 'PAYMENT_REMINDER', orderId: 'o1' }, undefined, load);
    expect(t).toEqual({ kind: 'modal', modalType: 'SUBMIT_PAYMENT' });
    // Loads only that one order — never a list of all orders.
    expect(load).toHaveBeenCalledWith('o1');
  });

  it('payment reminder → payment-in-review once the customer submitted', async () => {
    const load = vi.fn().mockResolvedValue({ paymentSubmitted: true });
    const t = await resolveNotificationTarget({ type: 'PAYMENT_REMINDER', orderId: 'o1' }, undefined, load);
    expect(t).toEqual({ kind: 'modal', modalType: 'PAYMENT_IN_REVIEW' });
  });

  it('payment reminder still opens something if the order cannot be loaded', async () => {
    const load = vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    const t = await resolveNotificationTarget({ type: 'PAYMENT_REMINDER', orderId: 'o1' }, undefined, load);
    expect(t).toEqual({ kind: 'modal', modalType: 'SUBMIT_PAYMENT' });
  });

  it('uses the mapping for lifecycle notifications and honours an explicit override', async () => {
    expect(await resolveNotificationTarget({ type: 'ORDER_COMPLETED' }, undefined, noOrder)).toEqual({
      kind: 'modal',
      modalType: 'COMPLETED_ORDER_INVOICE',
    });
    expect(await resolveNotificationTarget({ type: 'NEW_REGISTRATION' }, 'ADMIN_ORDER_VIEW', noOrder)).toEqual({
      kind: 'modal',
      modalType: 'ADMIN_ORDER_VIEW',
    });
  });

  it('falls back to the details modal for unknown types', async () => {
    expect(await resolveNotificationTarget({ type: 'SOMETHING_NEW' }, undefined, noOrder)).toEqual({
      kind: 'modal',
      modalType: 'NOTIFICATION_DETAILS',
    });
  });
});

describe('toNotificationItem', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });

  it('reads documents written by the lifecycle Cloud Function', () => {
    const n = toNotificationItem('order_o1_approved', {
      type: 'ORDER_APPROVED_PAY_REQUIRED',
      title: 'Approved',
      message: 'Pay please',
      orderId: 'o1',
      customerId: 'c1',
      customerName: 'Corner Café',
      amount: 120,
      actions: [{ type: 'SUBMIT_PAYMENT', label: 'Submit Payment' }],
      read: false,
      createdAt: ts('2026-09-28T10:00:00.000Z'),
    });
    expect(n).toMatchObject({
      id: 'order_o1_approved',
      orderId: 'o1',
      customerId: 'c1',
      customerName: 'Corner Café',
      amount: 120,
      read: false,
      createdAt: '2026-09-28T10:00:00.000Z',
    });
  });

  it('reads older documents that kept details only in metadata', () => {
    const n = toNotificationItem('legacy1', {
      type: 'CREDIT_ISSUED',
      title: 'Credit',
      message: 'You got credit',
      metadata: { orderId: 'o9', customerId: 'c9', creditAmount: 15, invoiceId: 'inv9' },
      timestamp: ts('2026-01-02T03:04:05.000Z'),
    });
    expect(n).toMatchObject({ orderId: 'o9', customerId: 'c9', amount: 15, invoiceId: 'inv9', read: false });
    expect(n.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(n.actions).toEqual([]);
  });

  it('always yields ISO string timestamps', () => {
    const n = toNotificationItem('x', { type: 'ORDER_REJECTED', createdAt: Date.UTC(2026, 0, 1), readAt: ts('2026-01-03T00:00:00.000Z') });
    expect(n.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(n.readAt).toBe('2026-01-03T00:00:00.000Z');
    // Pending server timestamp (not yet acknowledged) still renders.
    expect(typeof toNotificationItem('y', { type: 'ORDER_REJECTED', createdAt: null }).createdAt).toBe('string');
  });
});
