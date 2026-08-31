/**
 * Credit system smoke tests
 */
import { describe, it, expect } from 'vitest';
import { calculateCreditFromReduction, validateItemEdit } from '../../services/creditService';
import type { OrderItem } from '../../types';
import { Timestamp } from 'firebase/firestore';

const now = Timestamp.now();

const mockItem: OrderItem = {
  productId: 'prod-1',
  productName: 'Sourdough Bread',
  price: 5.00,
  monday: 10, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0,
  total: 10,
};

describe('calculateCreditFromReduction', () => {
  it('calculates credit for order reduction', () => {
    const credit = calculateCreditFromReduction(100, 75);
    expect(credit).toBeCloseTo(25);
  });

  it('returns 0 when totals are equal', () => {
    expect(calculateCreditFromReduction(100, 100)).toBe(0);
  });

  it('returns 0 when new total is higher', () => {
    expect(calculateCreditFromReduction(100, 120)).toBe(0);
  });
});

describe('validateItemEdit', () => {
  it('accepts valid quantity reduction', () => {
    const result = validateItemEdit(mockItem, 5);
    expect(result.valid).toBe(true);
  });

  it('accepts zero (full removal)', () => {
    const result = validateItemEdit(mockItem, 0);
    expect(result.valid).toBe(true);
  });

  it('rejects increase beyond original quantity', () => {
    const result = validateItemEdit(mockItem, 999);
    expect(result.valid).toBe(false);
  });

  it('rejects negative quantity', () => {
    const result = validateItemEdit(mockItem, -1);
    expect(result.valid).toBe(false);
  });
});
