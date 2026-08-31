/**
 * Order calculation smoke tests
 */
import { describe, it, expect } from 'vitest';
import { calculateOrderTotals } from '../../services/orderWorkflowService';
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

describe('calculateOrderTotals', () => {
  it('sums subtotal + GST + delivery + service charge', () => {
    const { gst, total } = calculateOrderTotals(200, 10, 3.99, false);
    expect(gst).toBeCloseTo(10);         // 5% of 200
    expect(total).toBeCloseTo(223.99);   // 200 + 10 + 3.99 + 10
  });

  it('omits service charge when waived', () => {
    const { total } = calculateOrderTotals(100, 0, 3.99, true);
    expect(total).toBeCloseTo(105);      // 100 + 5 GST only
  });

  it('works with free delivery (deliveryFee = 0)', () => {
    const { total } = calculateOrderTotals(300, 0, 0, true);
    expect(total).toBeCloseTo(315);      // 300 + 15 GST
  });

  it('never produces negative total', () => {
    const { total } = calculateOrderTotals(0, 0, 0, true);
    expect(total).toBeGreaterThanOrEqual(0);
  });
});
