/**
 * Order lifecycle smoke tests
 * Validates status transitions and workflow guards without Firebase.
 */
import { describe, it, expect } from 'vitest';
import { canEditPaidOrder } from '../../services/orders/paidOrderEditService';
import { isDeliveryFeeRequired, qualifiesForFreeDelivery, calculateOrderTotals } from '../../services/orders/deliveryFeeService';
import { validateItemEdit, calculateCreditFromReduction } from '../../services/creditService';
import { canTransitionOrderStatus } from '../../utils/stateTransitionRules';
import type { Order, OrderItem } from '../../types';
import { Timestamp } from 'firebase/firestore';

const now = Timestamp.now();

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    customerId: 'cust-1',
    customerName: 'Test Store',
    customerAddress: '123 Main',
    customerContactPerson: 'John',
    items: [],
    subtotal: 100,
    gst: 5,
    deliveryFee: 10,
    serviceCharge: 3.99,
    serviceChargeWaived: false,
    total: 118.99,
    status: 'pending',
    week: 12,
    year: 2026,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Order;
}

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    productId: 'prod-1',
    productName: 'Bread',
    price: 5,
    monday: 10, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0,
    total: 10,
    ...overrides,
  } as OrderItem;
}

describe('canEditPaidOrder', () => {
  it('allows editing in_process orders', () => {
    const { canEdit } = canEditPaidOrder(makeOrder({ status: 'in_process' }));
    expect(canEdit).toBe(true);
  });

  it('allows editing completed orders', () => {
    const { canEdit } = canEditPaidOrder(makeOrder({ status: 'completed' }));
    expect(canEdit).toBe(true);
  });

  it('blocks editing pending orders', () => {
    const { canEdit } = canEditPaidOrder(makeOrder({ status: 'pending' }));
    expect(canEdit).toBe(false);
  });

  it('blocks editing cancelled orders', () => {
    const { canEdit } = canEditPaidOrder(makeOrder({ status: 'cancelled' }));
    expect(canEdit).toBe(false);
  });
});

describe('delivery fee rules', () => {
  it('requires fee when deliveryFee is undefined', () => {
    const order = makeOrder({ deliveryFee: undefined });
    expect(isDeliveryFeeRequired(order)).toBe(true);
  });

  it('qualifies for free delivery at $250+', () => {
    expect(qualifiesForFreeDelivery(makeOrder({ subtotal: 250 }))).toBe(true);
    expect(qualifiesForFreeDelivery(makeOrder({ subtotal: 249.99 }))).toBe(false);
  });
});

describe('order total calculation', () => {
  it('calculates correct total with all fees', () => {
    const { gst, total } = calculateOrderTotals(200, 10, 3.99, false);
    expect(gst).toBeCloseTo(10);
    expect(total).toBeCloseTo(223.99);
  });

  it('waives service charge when flag is true', () => {
    const { total } = calculateOrderTotals(100, 0, 3.99, true);
    expect(total).toBeCloseTo(105);
  });
});

describe('item edit validation', () => {
  const item = makeItem({ total: 10 });

  it('allows reducing quantity', () => {
    expect(validateItemEdit(item, 5).valid).toBe(true);
  });

  it('allows zeroing out (removal)', () => {
    expect(validateItemEdit(item, 0).valid).toBe(true);
  });

  it('rejects quantity above original', () => {
    expect(validateItemEdit(item, 99).valid).toBe(false);
  });

  it('rejects negative quantity', () => {
    expect(validateItemEdit(item, -1).valid).toBe(false);
  });
});

describe('credit calculation', () => {
  it('issues credit equal to reduction amount', () => {
    expect(calculateCreditFromReduction(100, 80)).toBeCloseTo(20);
  });

  it('issues no credit when total is same', () => {
    expect(calculateCreditFromReduction(100, 100)).toBe(0);
  });

  it('issues no credit when total increases', () => {
    expect(calculateCreditFromReduction(100, 120)).toBe(0);
  });
});

describe('canonical order status transitions', () => {
  it('allows the documented forward progression', () => {
    expect(canTransitionOrderStatus('pending', 'approved')).toBe(true);
    expect(canTransitionOrderStatus('approved', 'in_process')).toBe(true);
    expect(canTransitionOrderStatus('in_process', 'delivered')).toBe(true);
    expect(canTransitionOrderStatus('delivered', 'completed')).toBe(true);
  });

  it('allows terminal admin exits for rejected and cancelled flows', () => {
    expect(canTransitionOrderStatus('pending', 'rejected')).toBe(true);
    expect(canTransitionOrderStatus('pending', 'cancelled')).toBe(true);
    expect(canTransitionOrderStatus('approved', 'cancelled')).toBe(true);
  });

  it('blocks non-sequential or terminal re-entry transitions', () => {
    expect(canTransitionOrderStatus('approved', 'delivered')).toBe(false);
    expect(canTransitionOrderStatus('in_process', 'completed')).toBe(false);
    expect(canTransitionOrderStatus('completed', 'approved')).toBe(false);
    expect(canTransitionOrderStatus('cancelled', 'approved')).toBe(false);
    expect(canTransitionOrderStatus('rejected', 'approved')).toBe(false);
  });
});
