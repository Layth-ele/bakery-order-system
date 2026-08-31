/**
 * Financial Calculator Tests
 * 
 * Tests for pure financial calculation functions
 */

import { describe, it, expect } from 'vitest';
import {
  money,
  formatCurrencySimple,
  splitGST,
  addGST,
  formatDiscountPercentage,
} from '../financialCalculator';

describe('financialCalculator', () => {
  describe('money()', () => {
    it('should round to 2 decimal places', () => {
      expect(money(10.567)).toBe(10.57);
      expect(money(10.564)).toBe(10.56);
      expect(money(10.565)).toBe(10.57); // Banker's rounding
    });

    it('should handle string inputs', () => {
      expect(money('15.99')).toBe(15.99);
      expect(money('100')).toBe(100);
      expect(money('0.5')).toBe(0.5);
    });

    it('should return 0 for invalid inputs', () => {
      expect(money(null)).toBe(0);
      expect(money(undefined)).toBe(0);
      expect(money('invalid')).toBe(0);
      expect(money(NaN)).toBe(0);
      expect(money(Infinity)).toBe(0);
      expect(money(-Infinity)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(money(-10.567)).toBe(-10.57);
      expect(money(-0.005)).toBe(-0.01);
    });

    it('should handle zero and very small numbers', () => {
      expect(money(0)).toBe(0);
      expect(money(0.001)).toBe(0);
      expect(money(0.004)).toBe(0);
      expect(money(0.005)).toBe(0.01);
    });

    it('should handle large numbers', () => {
      expect(money(1234567.89)).toBe(1234567.89);
      expect(money(999999.999)).toBe(1000000);
    });
  });

  describe('formatCurrencySimple()', () => {
    it('should format with dollar sign by default', () => {
      expect(formatCurrencySimple(123.45)).toBe('$123.45');
      expect(formatCurrencySimple(0)).toBe('$0.00');
      expect(formatCurrencySimple(1000)).toBe('$1000.00');
    });

    it('should format without dollar sign when specified', () => {
      expect(formatCurrencySimple(123.45, false)).toBe('123.45');
      expect(formatCurrencySimple(0, false)).toBe('0.00');
    });

    it('should round values properly', () => {
      expect(formatCurrencySimple(123.456)).toBe('$123.46');
      expect(formatCurrencySimple(123.454)).toBe('$123.45');
    });

    it('should handle negative values', () => {
      expect(formatCurrencySimple(-50.25)).toBe('$-50.25');
      expect(formatCurrencySimple(-50.25, false)).toBe('-50.25');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(formatCurrencySimple(null as any)).toBe('$0.00');
      expect(formatCurrencySimple(undefined as any)).toBe('$0.00');
      expect(formatCurrencySimple('invalid' as any)).toBe('$0.00');
    });
  });

  describe('splitGST()', () => {
    it('should split total into subtotal and GST', () => {
      const result = splitGST(105);
      expect(result.subtotal).toBe(100);
      expect(result.gst).toBe(5);
    });

    it('should handle decimal totals', () => {
      const result = splitGST(52.5);
      expect(result.subtotal).toBe(50);
      expect(result.gst).toBe(2.5);
    });

    it('should handle small amounts', () => {
      const result = splitGST(1.05);
      expect(result.subtotal).toBe(1);
      expect(result.gst).toBe(0.05);
    });

    it('should handle zero', () => {
      const result = splitGST(0);
      expect(result.subtotal).toBe(0);
      expect(result.gst).toBe(0);
    });

    it('should round properly', () => {
      const result = splitGST(105.25);
      expect(result.subtotal).toBe(100.24);
      expect(result.gst).toBe(5.01);
    });

    it('should maintain total when recombined', () => {
      const total = 105.25;
      const result = splitGST(total);
      const recombined = money(result.subtotal + result.gst);
      expect(recombined).toBe(total);
    });
  });

  describe('addGST()', () => {
    it('should add 5% GST to subtotal', () => {
      const result = addGST(100);
      expect(result.subtotal).toBe(100);
      expect(result.gst).toBe(5);
      expect(result.total).toBe(105);
    });

    it('should handle decimal subtotals', () => {
      const result = addGST(50.5);
      expect(result.subtotal).toBe(50.5);
      expect(result.gst).toBe(2.53);
      expect(result.total).toBe(53.03);
    });

    it('should handle zero', () => {
      const result = addGST(0);
      expect(result.subtotal).toBe(0);
      expect(result.gst).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should round all values properly', () => {
      const result = addGST(99.99);
      expect(result.subtotal).toBe(99.99);
      expect(result.gst).toBe(5);
      expect(result.total).toBe(104.99);
    });

    it('should match total exactly', () => {
      const result = addGST(123.45);
      expect(result.total).toBe(result.subtotal + result.gst);
    });
  });

  describe('formatDiscountPercentage()', () => {
    it('should format percentage with % sign', () => {
      expect(formatDiscountPercentage(15)).toBe('15%');
      expect(formatDiscountPercentage(25)).toBe('25%');
      expect(formatDiscountPercentage(0)).toBe('0%');
    });

    it('should handle undefined', () => {
      expect(formatDiscountPercentage(undefined)).toBe('0%');
    });

    it('should round to whole numbers', () => {
      expect(formatDiscountPercentage(15.6)).toBe('16%');
      expect(formatDiscountPercentage(15.4)).toBe('15%');
    });

    it('should handle zero and 100', () => {
      expect(formatDiscountPercentage(0)).toBe('0%');
      expect(formatDiscountPercentage(100)).toBe('100%');
    });

    it('should handle decimal percentages', () => {
      expect(formatDiscountPercentage(12.5)).toBe('13%');
      expect(formatDiscountPercentage(7.3)).toBe('7%');
    });
  });

  describe('GST integration tests', () => {
    it('should be reversible (splitGST and addGST)', () => {
      const subtotal = 100;
      const { total } = addGST(subtotal);
      const { subtotal: splitSubtotal } = splitGST(total);
      expect(splitSubtotal).toBe(subtotal);
    });

    it('should handle real-world bakery amounts', () => {
      // $47.50 order
      const order1 = addGST(47.5);
      expect(order1.total).toBe(49.88);

      // $125.00 order
      const order2 = addGST(125);
      expect(order2.total).toBe(131.25);

      // $0.75 single item
      const order3 = addGST(0.75);
      expect(order3.total).toBe(0.79);
    });
  });
});
