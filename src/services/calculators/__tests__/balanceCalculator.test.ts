/**
 * Balance Calculator Tests
 * 
 * Tests for balance calculation functions
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateBalanceFromUnpaidRows,
  calculateOutstandingBalance,
  calculateNetBalance,
} from '../balanceCalculator';

// Mock the unpaidSelectors module
vi.mock('../../../utils/payments/unpaidSelectors', () => ({
  getUnpaidRows: vi.fn((orders) => {
    // Simple mock: return base orders that aren't paid
    return orders
      .filter((o: any) => !o.paymentReceived)
      .map((o: any) => ({
        kind: 'base_order',
        order: o,
      }));
  }),
}));

describe('balanceCalculator', () => {
  describe('calculateBalanceFromUnpaidRows()', () => {
    it('should calculate balance from base orders', () => {
      const unpaidRows = [
        {
          kind: 'base_order' as const,
          order: { id: '1', total: 100 },
        },
        {
          kind: 'base_order' as const,
          order: { id: '2', total: 50 },
        },
      ];

      expect(calculateBalanceFromUnpaidRows(unpaidRows as any)).toBe(150);
    });

    it('should calculate balance from adjustment increases', () => {
      const unpaidRows = [
        {
          kind: 'adjustment_increase' as const,
          adjustment: {
            id: 'adj1',
            type: 'increase' as const,
            deltaTotal: 25,
            paid: { status: 'unpaid' as const, amount: 25 },
          },
        },
      ];

      expect(calculateBalanceFromUnpaidRows(unpaidRows as any)).toBe(25);
    });

    it('should handle mixed base orders and adjustments', () => {
      const unpaidRows = [
        {
          kind: 'base_order' as const,
          order: { id: '1', total: 100 },
        },
        {
          kind: 'adjustment_increase' as const,
          adjustment: {
            deltaTotal: 15,
            paid: { amount: 15 },
          },
        },
      ];

      expect(calculateBalanceFromUnpaidRows(unpaidRows as any)).toBe(115);
    });

    it('should handle empty unpaid rows', () => {
      expect(calculateBalanceFromUnpaidRows([])).toBe(0);
    });

    it('should handle invalid/missing totals gracefully', () => {
      const unpaidRows = [
        {
          kind: 'base_order' as const,
          order: { id: '1', total: null },
        },
        {
          kind: 'base_order' as const,
          order: { id: '2', total: undefined },
        },
        {
          kind: 'base_order' as const,
          order: { id: '3', total: 50 },
        },
      ];

      expect(calculateBalanceFromUnpaidRows(unpaidRows as any)).toBe(50);
    });

    it('should handle adjustment without paid.amount (use deltaTotal)', () => {
      const unpaidRows = [
        {
          kind: 'adjustment_increase' as const,
          adjustment: {
            deltaTotal: 30,
            paid: { status: 'unpaid' as const },
          },
        },
      ];

      expect(calculateBalanceFromUnpaidRows(unpaidRows as any)).toBe(30);
    });

    it('should handle decimal amounts', () => {
      const unpaidRows = [
        {
          kind: 'base_order' as const,
          order: { total: 99.99 },
        },
        {
          kind: 'adjustment_increase' as const,
          adjustment: {
            paid: { amount: 15.50 },
          },
        },
      ];

      expect(calculateBalanceFromUnpaidRows(unpaidRows as any)).toBeCloseTo(115.49, 2);
    });
  });

  describe('calculateOutstandingBalance()', () => {
    it('should calculate balance from unpaid orders', () => {
      const orders = [
        {
          id: '1',
          customerId: 'cust1',
          total: 100,
          status: 'completed',
          paymentReceived: false,
        },
        {
          id: '2',
          customerId: 'cust1',
          total: 75,
          status: 'completed',
          paymentReceived: false,
        },
      ];

      expect(calculateOutstandingBalance(orders as any)).toBe(175);
    });

    it('should exclude paid orders', () => {
      const orders = [
        {
          id: '1',
          customerId: 'cust1',
          total: 100,
          status: 'completed',
          paymentReceived: false,
        },
        {
          id: '2',
          customerId: 'cust1',
          total: 50,
          status: 'completed',
          paymentReceived: true, // Paid
        },
      ];

      expect(calculateOutstandingBalance(orders as any)).toBe(100);
    });

    it('should handle empty orders array', () => {
      expect(calculateOutstandingBalance([])).toBe(0);
    });

    it('should handle all paid orders', () => {
      const orders = [
        {
          id: '1',
          total: 100,
          paymentReceived: true,
        },
        {
          id: '2',
          total: 50,
          paymentReceived: true,
        },
      ];

      expect(calculateOutstandingBalance(orders as any)).toBe(0);
    });
  });

  describe('calculateNetBalance()', () => {
    it('should calculate net balance (outstanding - credit)', () => {
      expect(calculateNetBalance(100, 25)).toBe(75);
      expect(calculateNetBalance(150, 50)).toBe(100);
    });

    it('should handle zero credit', () => {
      expect(calculateNetBalance(100, 0)).toBe(100);
    });

    it('should handle zero outstanding balance', () => {
      expect(calculateNetBalance(0, 50)).toBe(-50);
    });

    it('should handle credit exceeding balance (negative result)', () => {
      expect(calculateNetBalance(100, 150)).toBe(-50);
    });

    it('should handle both zero', () => {
      expect(calculateNetBalance(0, 0)).toBe(0);
    });

    it('should handle decimal amounts', () => {
      expect(calculateNetBalance(99.99, 25.50)).toBeCloseTo(74.49, 2);
    });

    it('should handle real bakery scenarios', () => {
      // Customer owes $250, has $50 credit
      expect(calculateNetBalance(250, 50)).toBe(200);

      // Customer owes $100, has $100 credit (exactly paid)
      expect(calculateNetBalance(100, 100)).toBe(0);

      // Customer owes $75, has $100 credit (overpaid)
      expect(calculateNetBalance(75, 100)).toBe(-25);

      // Customer owes $0, has $25 credit
      expect(calculateNetBalance(0, 25)).toBe(-25);
    });
  });

  describe('integration tests', () => {
    it('should calculate complete customer balance scenario', () => {
      const customerOrders = [
        {
          id: 'order1',
          customerId: 'cust1',
          total: 100,
          status: 'completed',
          paymentReceived: false,
        },
        {
          id: 'order2',
          customerId: 'cust1',
          total: 75,
          status: 'completed',
          paymentReceived: false,
        },
        {
          id: 'order3',
          customerId: 'cust1',
          total: 50,
          status: 'completed',
          paymentReceived: true, // Already paid
        },
      ];

      const outstandingBalance = calculateOutstandingBalance(customerOrders as any);
      const availableCredit = 25;
      const netBalance = calculateNetBalance(outstandingBalance, availableCredit);

      expect(outstandingBalance).toBe(175);
      expect(netBalance).toBe(150);
    });

    it('should handle customer with only paid orders', () => {
      const customerOrders = [
        {
          id: 'order1',
          total: 100,
          paymentReceived: true,
        },
      ];

      const outstandingBalance = calculateOutstandingBalance(customerOrders as any);
      const netBalance = calculateNetBalance(outstandingBalance, 50);

      expect(outstandingBalance).toBe(0);
      expect(netBalance).toBe(-50); // Credit only
    });
  });
});
