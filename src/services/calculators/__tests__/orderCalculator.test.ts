/**
 * Order Calculator Tests
 * 
 * Tests for pure order calculation functions
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGST,
  calculateDiscount,
  calculateDiscountedPrice,
  calculateSubtotal,
  calculateOrderTotal,
  DAYS_OF_WEEK,
} from '../orderCalculator';

describe('orderCalculator', () => {
  describe('calculateGST()', () => {
    it('should calculate 5% GST', () => {
      expect(calculateGST(100)).toBe(5);
      expect(calculateGST(200)).toBe(10);
      expect(calculateGST(50)).toBe(2.5);
    });

    it('should handle decimal subtotals', () => {
      expect(calculateGST(99.99)).toBeCloseTo(5, 2);
      expect(calculateGST(123.45)).toBeCloseTo(6.17, 2);
    });

    it('should handle zero', () => {
      expect(calculateGST(0)).toBe(0);
    });

    it('should handle negative values (for refunds)', () => {
      expect(calculateGST(-100)).toBe(-5);
    });
  });

  describe('calculateDiscount()', () => {
    it('should calculate discount amount', () => {
      expect(calculateDiscount(100, 10)).toBe(10);
      expect(calculateDiscount(100, 25)).toBe(25);
      expect(calculateDiscount(50, 20)).toBe(10);
    });

    it('should handle decimal percentages', () => {
      expect(calculateDiscount(100, 12.5)).toBe(12.5);
      expect(calculateDiscount(200, 7.5)).toBe(15);
    });

    it('should handle zero discount', () => {
      expect(calculateDiscount(100, 0)).toBe(0);
    });

    it('should handle 100% discount', () => {
      expect(calculateDiscount(100, 100)).toBe(100);
    });

    it('should handle decimal prices', () => {
      expect(calculateDiscount(49.99, 10)).toBeCloseTo(5, 2);
    });
  });

  describe('calculateDiscountedPrice()', () => {
    it('should calculate price after discount', () => {
      expect(calculateDiscountedPrice(100, 10)).toBe(90);
      expect(calculateDiscountedPrice(100, 25)).toBe(75);
      expect(calculateDiscountedPrice(50, 20)).toBe(40);
    });

    it('should handle no discount', () => {
      expect(calculateDiscountedPrice(100, 0)).toBe(100);
    });

    it('should handle 100% discount', () => {
      expect(calculateDiscountedPrice(100, 100)).toBe(0);
    });

    it('should handle decimal prices and percentages', () => {
      expect(calculateDiscountedPrice(49.99, 15)).toBeCloseTo(42.49, 2);
    });

    it('should use calculateDiscount internally', () => {
      const price = 100;
      const discount = 25;
      const expected = price - calculateDiscount(price, discount);
      expect(calculateDiscountedPrice(price, discount)).toBe(expected);
    });
  });

  describe('calculateSubtotal()', () => {
    it('should calculate subtotal from items without discount', () => {
      const items = [
        { price: 10, quantity: 2 },
        { price: 5, quantity: 3 },
      ];
      expect(calculateSubtotal(items)).toBe(35); // (10*2) + (5*3)
    });

    it('should handle items with discount', () => {
      const items = [
        { price: 100, quantity: 1, discount: 10 }, // $90
        { price: 50, quantity: 2, discount: 20 },  // $80
      ];
      expect(calculateSubtotal(items)).toBe(170); // 90 + 80
    });

    it('should handle mixed items (some with discount, some without)', () => {
      const items = [
        { price: 100, quantity: 1 },              // $100
        { price: 50, quantity: 2, discount: 10 }, // $90
      ];
      expect(calculateSubtotal(items)).toBe(190);
    });

    it('should handle empty items array', () => {
      expect(calculateSubtotal([])).toBe(0);
    });

    it('should handle decimal prices and quantities', () => {
      const items = [
        { price: 12.99, quantity: 3 },
      ];
      expect(calculateSubtotal(items)).toBeCloseTo(38.97, 2);
    });

    it('should handle real bakery order', () => {
      const items = [
        { price: 4.50, quantity: 12 },  // Croissants: $54
        { price: 3.25, quantity: 6 },   // Muffins: $19.50
        { price: 15.00, quantity: 2, discount: 10 }, // Cakes with 10% off: $27
      ];
      expect(calculateSubtotal(items)).toBeCloseTo(100.50, 2);
    });
  });

  describe('calculateOrderTotal()', () => {
    it('should calculate total with all components', () => {
      const total = calculateOrderTotal(100, 5, 10, 0, false);
      expect(total).toBe(115); // 100 + 5 + 10
    });

    it('should handle delivery fee waived', () => {
      const total = calculateOrderTotal(100, 5, 10, 0, true);
      expect(total).toBe(105); // 100 + 5 (no delivery fee)
    });

    it('should handle credit applied', () => {
      const total = calculateOrderTotal(100, 5, 10, 20, false);
      expect(total).toBe(95); // 100 + 5 + 10 - 20
    });

    it('should handle credit applied with waived delivery', () => {
      const total = calculateOrderTotal(100, 5, 10, 15, true);
      expect(total).toBe(90); // 100 + 5 - 15 (delivery waived)
    });

    it('should not allow negative totals', () => {
      const total = calculateOrderTotal(100, 5, 10, 200, false);
      expect(total).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero values', () => {
      expect(calculateOrderTotal(0, 0, 0, 0, false)).toBe(0);
    });

    it('should handle decimal amounts', () => {
      const total = calculateOrderTotal(99.99, 5, 7.50, 10.25, false);
      expect(total).toBeCloseTo(102.24, 2);
    });

    it('should calculate real bakery order scenarios', () => {
      // Scenario 1: Regular order
      const order1 = calculateOrderTotal(100, 5, 10, 0, false);
      expect(order1).toBe(115);

      // Scenario 2: Free delivery threshold
      const order2 = calculateOrderTotal(100, 5, 10, 0, true);
      expect(order2).toBe(105);

      // Scenario 3: With credit applied
      const order3 = calculateOrderTotal(100, 5, 10, 25, false);
      expect(order3).toBe(90);

      // Scenario 4: Full credit coverage
      const order4 = calculateOrderTotal(100, 5, 10, 115, false);
      expect(order4).toBe(0);
    });
  });

  describe('DAYS_OF_WEEK constant', () => {
    it('should have all 7 days', () => {
      expect(DAYS_OF_WEEK).toHaveLength(7);
    });

    it('should have days in correct order', () => {
      expect(DAYS_OF_WEEK[0]).toBe('monday');
      expect(DAYS_OF_WEEK[1]).toBe('tuesday');
      expect(DAYS_OF_WEEK[2]).toBe('wednesday');
      expect(DAYS_OF_WEEK[3]).toBe('thursday');
      expect(DAYS_OF_WEEK[4]).toBe('friday');
      expect(DAYS_OF_WEEK[5]).toBe('saturday');
      expect(DAYS_OF_WEEK[6]).toBe('sunday');
    });
  });

  describe('integration tests', () => {
    it('should calculate complete order from items to total', () => {
      // Order with 3 items
      const items = [
        { price: 10, quantity: 2 },       // $20
        { price: 15, quantity: 1, discount: 10 }, // $13.50
        { price: 5, quantity: 4 },        // $20
      ];

      const subtotal = calculateSubtotal(items); // $53.50
      const gst = calculateGST(subtotal);        // $2.68
      const deliveryFee = 10;
      const creditApplied = 0;
      const total = calculateOrderTotal(subtotal, gst, deliveryFee, creditApplied, false);

      expect(subtotal).toBeCloseTo(53.50, 2);
      expect(gst).toBeCloseTo(2.68, 2);
      expect(total).toBeCloseTo(66.18, 2);
    });

    it('should handle order with free delivery threshold', () => {
      const items = [
        { price: 50, quantity: 3 }, // $150
      ];

      const subtotal = calculateSubtotal(items);
      const gst = calculateGST(subtotal);
      const deliveryFee = 10;
      const isDeliveryWaived = subtotal >= 100; // Free delivery over $100

      const total = calculateOrderTotal(subtotal, gst, deliveryFee, 0, isDeliveryWaived);

      expect(subtotal).toBe(150);
      expect(gst).toBe(7.5);
      expect(total).toBe(157.5); // No delivery fee
    });

    it('should handle order with partial credit', () => {
      const items = [
        { price: 25, quantity: 4 }, // $100
      ];

      const subtotal = calculateSubtotal(items);
      const gst = calculateGST(subtotal);
      const deliveryFee = 10;
      const creditApplied = 30;

      const total = calculateOrderTotal(subtotal, gst, deliveryFee, creditApplied, false);

      expect(total).toBe(85); // 100 + 5 + 10 - 30
    });
  });
});
