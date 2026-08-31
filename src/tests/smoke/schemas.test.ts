/**
 * Schema smoke tests
 * Validates Zod schemas parse correctly
 */
import { describe, it, expect } from 'vitest';
import { orderSchema } from '../../schemas/order/order.schema';
import { customerSchema } from '../../schemas/customer/customer.schema';
import { Timestamp } from 'firebase/firestore';

const now = Timestamp.now();

const validOrder = {
  id: 'ord-001',
  customerId: 'cust-001',
  customerName: 'Test Store',
  customerAddress: '123 Main St',
  customerContactPerson: 'John',
  items: [{
    productId: 'prod-1',
    productName: 'Bread',
    price: 5.00,
    monday: 2, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0,
    total: 2,
  }],
  subtotal: 10,
  gst: 0.5,
  deliveryFee: 5,
  serviceCharge: 3.99,
  serviceChargeWaived: false,
  total: 19.49,
  status: 'pending' as const,
  week: 12,
  year: 2026,
  createdAt: now,
  updatedAt: now,
};

describe('orderSchema', () => {
  it('accepts a valid order', () => {
    const result = orderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { customerId, ...noCustomer } = validOrder;
    const result = orderSchema.safeParse(noCustomer);
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = orderSchema.safeParse({ ...validOrder, status: 'invalid_status' });
    expect(result.success).toBe(false);
  });
});

describe('customerSchema', () => {
  it('accepts valid commercial customer', () => {
    const result = customerSchema.safeParse({
      id: 'cust-001',
      email: 'test@store.com',
      customerType: 'commercial',
      status: 'approved',
      storeName: 'Test Store',
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid customerType', () => {
    const result = customerSchema.safeParse({
      id: 'cust-001',
      email: 'test@store.com',
      customerType: 'superadmin', // invalid
      status: 'approved',
    });
    expect(result.success).toBe(false);
  });
});
