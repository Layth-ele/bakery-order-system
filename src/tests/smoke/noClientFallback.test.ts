/**
 * Order actions run ONLY in Cloud Functions. When a function fails — even
 * with a transport-style error after the server may already have committed —
 * the browser must report the failure and never apply the action itself
 * (that is how double approvals / double credit happened before).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateOrder, cf } = vi.hoisted(() => ({
  updateOrder: vi.fn(),
  cf: {
    approveOrderViaCloudFunction: vi.fn(),
    rejectOrderViaCloudFunction: vi.fn(),
    cancelOrderViaCloudFunction: vi.fn(),
    confirmOrderPaymentViaCloudFunction: vi.fn(),
    submitPaymentProofViaCloudFunction: vi.fn(),
    completeOrderViaCloudFunction: vi.fn(),
    editOrderViaCloudFunction: vi.fn(),
    editPaidOrderViaCloudFunction: vi.fn(),
    sendPaymentReminderViaCloudFunction: vi.fn(),
    issueStoreCreditViaCloudFunction: vi.fn(),
    requestCreditPayoutViaCloudFunction: vi.fn(),
  },
}));

vi.mock('../../services/data/ordersDataService', () => ({
  updateOrder: (...a: unknown[]) => updateOrder(...a),
  getOrder: vi.fn(),
  getOrders: vi.fn(),
}));

// Expected failures are logged by ErrorLogger; keep test output quiet.
vi.mock('../../components/errors/ErrorLogger', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../components/errors/ErrorLogger')>();
  return { ...real, ErrorLogger: { ...real.ErrorLogger, log: vi.fn() } };
});

vi.mock('../../hooks/useCachedFirebase', () => ({
  invalidateCache: { orders: vi.fn(), customerOrders: vi.fn(), credit: vi.fn(), all: vi.fn() },
}));

vi.mock('../../services/firebase/cloudFunctions', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/firebase/cloudFunctions')>();
  return { ...real, ...cf };
});

import { callableErrorMessage } from '../../services/firebase/cloudFunctions';
import { approveOrder, rejectOrder } from '../../services/ordersService';
import { rejectOrderAction, cancelOrderAction } from '../../services/orderActionService';
import { confirmPaymentAction, submitPaymentAction } from '../../services/orders/paymentActionService';
import { requestCreditPayout } from '../../services/creditService';
import { saveOrderEdit, savePaidOrderReduction } from '../../services/orders/orderEdits';
import { remindCustomerToPay } from '../../services/orders/paymentReminders';
import { completeOrderNow } from '../../services/orderCompletion/completeOrderNow';

const order = { id: 'o1', customerId: 'c1', orderNumber: 'ORD-1', status: 'pending', subtotal: 100, total: 105 } as any;
const admin = { email: 'admin@x.test', name: 'Admin', storeName: 'Admin' };
const serverError = (code: string, message = '') => Object.assign(new Error(message), { code });

describe('callableErrorMessage', () => {
  it('explains connection problems, server errors, missing deploys and business errors', () => {
    expect(callableErrorMessage(serverError('functions/unavailable'), 'approve this order')).toMatch(/Couldn't reach the server to approve this order/);
    expect(callableErrorMessage(serverError('functions/internal'), 'approve this order')).toMatch(/Refresh to check the order/);
    expect(callableErrorMessage(serverError('functions/not-found', 'not-found'), 'approve this order')).toMatch(/isn't deployed/);
    expect(callableErrorMessage(serverError('functions/failed-precondition', 'Cannot transition order from "completed" to "approved".'), 'x'))
      .toBe('Cannot transition order from "completed" to "approved".');
  });
});

describe('no client-side fallback', () => {
  beforeEach(() => {
    Object.values(cf).forEach((fn) => fn.mockReset().mockRejectedValue(serverError('functions/internal')));
    updateOrder.mockReset();
  });

  it('approve', async () => {
    const r = await approveOrder('o1', order, 10, { email: admin.email });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Refresh to check the order/);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('reject', async () => {
    expect(await rejectOrder('o1', order, 'late')).toBe(false);
    const r = await rejectOrderAction(order, admin, 'late');
    expect(r.success).toBe(false);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('cancel (with store credit)', async () => {
    const r = await cancelOrderAction({ ...order, status: 'approved' }, admin, 'closed', undefined, 10);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/cancel this order/);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('confirm payment', async () => {
    const r = await confirmPaymentAction({ ...order, status: 'approved' }, admin);
    expect(r.success).toBe(false);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('customer payment submission', async () => {
    await expect(submitPaymentAction('o1', 'c1', 'ET-1', 'pw')).rejects.toThrow(/submit your payment/);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('mark complete', async () => {
    const r = await completeOrderNow({ ...order, status: 'in_process' }, { actor: admin.email });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/complete this order/);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('success paths go through the Cloud Function only', async () => {
    cf.approveOrderViaCloudFunction.mockResolvedValue({ success: true, orderId: 'o1', total: 115, gst: 5, deliveryFee: 10 });
    cf.cancelOrderViaCloudFunction.mockResolvedValue({ success: true, orderId: 'o1' });
    expect((await approveOrder('o1', order, 10, { email: admin.email })).total).toBe(115);
    expect((await cancelOrderAction(order, admin, 'closed')).success).toBe(true);
    cf.completeOrderViaCloudFunction.mockResolvedValue({ status: 'completed', orderId: 'o1', invoiceId: 'o1', invoiceNumber: 'DBH-1' });
    expect(await completeOrderNow(order)).toEqual({ success: true, invoiceId: 'o1', invoiceNumber: 'DBH-1' });
    expect(cf.approveOrderViaCloudFunction).toHaveBeenCalledWith({ orderId: 'o1', deliveryFee: 10 });
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it('order edits, reminders and credit payouts fail loudly and write nothing', async () => {
    await expect(saveOrderEdit(order, { editedItems: { p1: { monday: 2 } } })).rejects.toBeTruthy();
    await expect(savePaidOrderReduction({ ...order, status: 'in_process' }, [{ productId: 'p1', monday: 1 }], 'short')).rejects.toBeTruthy();
    await expect(remindCustomerToPay({ ...order, status: 'approved' })).rejects.toBeTruthy();
    await expect(requestCreditPayout('c1', 'n1')).rejects.toThrow(/request the payout/);
    expect(updateOrder).not.toHaveBeenCalled();
  });
});
