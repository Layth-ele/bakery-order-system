/**
 * Order calculation smoke tests
 */
import { describe, it, expect } from 'vitest';
import { calculateGST } from '../../services/calculators/orderCalculator';

describe('calculateGST', () => {
  it('calculates 5% on subtotal', () => {
    expect(calculateGST(100)).toBeCloseTo(5.0);
    expect(calculateGST(250)).toBeCloseTo(12.5);
    expect(calculateGST(0)).toBe(0);
  });

  it('handles decimal subtotals', () => {
    const gst = calculateGST(99.99);
    expect(gst).toBeGreaterThan(0);
    expect(gst).toBeLessThan(5.1);
  });
});
