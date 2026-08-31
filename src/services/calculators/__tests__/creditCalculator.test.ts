/**
 * Credit Calculator Tests
 * 
 * Tests for credit calculation functions
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAvailableCredit,
  getMaxApplicableCredit,
  calculateCreditNoteAmount,
  canApplyCreditToOrder,
  type CreditNote,
} from '../creditCalculator';

describe('creditCalculator', () => {
  describe('calculateAvailableCredit()', () => {
    it('should sum available credit from credit notes', () => {
      const creditNotes: CreditNote[] = [
        {
          id: '1',
          customerId: 'cust1',
          sourceOrderId: 'order1',
          amount: 50,
          remainingBalance: 50,
          status: 'available',
          createdAt: '2024-01-01',
          reason: 'Refund',
          type: 'refund',
        } as any,
        {
          id: '2',
          customerId: 'cust1',
          sourceOrderId: 'order2',
          amount: 30,
          remainingBalance: 30,
          status: 'available',
          createdAt: '2024-01-02',
          reason: 'Overpayment',
          type: 'overpayment',
        } as any,
      ];

      expect(calculateAvailableCredit(creditNotes)).toBe(80);
    });

    it('should include partially used credit notes', () => {
      const creditNotes: CreditNote[] = [
        {
          id: '1',
          customerId: 'cust1',
          sourceOrderId: 'order1',
          amount: 100,
          remainingBalance: 60, // $40 used
          status: 'partially_used',
          createdAt: '2024-01-01',
          reason: 'Refund',
          type: 'refund',
        } as any,
      ];

      expect(calculateAvailableCredit(creditNotes)).toBe(60);
    });

    it('should exclude fully used credit notes', () => {
      const creditNotes: CreditNote[] = [
        {
          id: '1',
          customerId: 'cust1',
          sourceOrderId: 'order1',
          amount: 50,
          remainingBalance: 0,
          status: 'fully_used',
          createdAt: '2024-01-01',
          reason: 'Refund',
          type: 'refund',
        } as any,
        {
          id: '2',
          customerId: 'cust1',
          sourceOrderId: 'order2',
          amount: 30,
          remainingBalance: 30,
          status: 'available',
          createdAt: '2024-01-02',
          reason: 'Refund',
          type: 'refund',
        } as any,
      ];

      expect(calculateAvailableCredit(creditNotes)).toBe(30);
    });

    it('should exclude paid out credit notes', () => {
      const creditNotes: CreditNote[] = [
        {
          id: '1',
          customerId: 'cust1',
          sourceOrderId: 'order1',
          amount: 100,
          remainingBalance: 0,
          status: 'paid_out',
          createdAt: '2024-01-01',
          reason: 'Refund',
          type: 'refund',
        } as any,
      ];

      expect(calculateAvailableCredit(creditNotes)).toBe(0);
    });

    it('should handle empty credit notes array', () => {
      expect(calculateAvailableCredit([])).toBe(0);
    });

    it('should handle mixed statuses', () => {
      const creditNotes: CreditNote[] = [
        {
          id: '1',
          amount: 50,
          remainingBalance: 50,
          status: 'available',
        } as CreditNote,
        {
          id: '2',
          amount: 100,
          remainingBalance: 30,
          status: 'partially_used',
        } as CreditNote,
        {
          id: '3',
          amount: 25,
          remainingBalance: 0,
          status: 'fully_used',
        } as CreditNote,
      ];

      expect(calculateAvailableCredit(creditNotes)).toBe(80); // 50 + 30
    });

    it('should use remainingBalance over amount', () => {
      const creditNotes: CreditNote[] = [
        {
          id: '1',
          amount: 100,
          remainingBalance: 75, // $25 already used
          status: 'partially_used',
        } as CreditNote,
      ];

      expect(calculateAvailableCredit(creditNotes)).toBe(75);
    });

    it('should handle missing remainingBalance (fallback to amount)', () => {
      const creditNotes: any[] = [
        {
          id: '1',
          amount: 50,
          status: 'available',
          // No remainingBalance
        },
      ];

      expect(calculateAvailableCredit(creditNotes)).toBe(50);
    });
  });

  describe('getMaxApplicableCredit()', () => {
    it('should return available credit if less than order total', () => {
      expect(getMaxApplicableCredit(50, 100)).toBe(50);
      expect(getMaxApplicableCredit(25, 75)).toBe(25);
    });

    it('should return order total if credit exceeds it', () => {
      expect(getMaxApplicableCredit(150, 100)).toBe(100);
      expect(getMaxApplicableCredit(75, 50)).toBe(50);
    });

    it('should return exact amount if equal', () => {
      expect(getMaxApplicableCredit(100, 100)).toBe(100);
    });

    it('should handle zero credit', () => {
      expect(getMaxApplicableCredit(0, 100)).toBe(0);
    });

    it('should handle zero order total', () => {
      expect(getMaxApplicableCredit(50, 0)).toBe(0);
    });

    it('should handle decimal amounts', () => {
      expect(getMaxApplicableCredit(37.50, 99.99)).toBe(37.50);
      expect(getMaxApplicableCredit(99.99, 37.50)).toBe(37.50);
    });

    it('should handle real bakery scenarios', () => {
      // Customer has $50 credit, order is $125
      expect(getMaxApplicableCredit(50, 125)).toBe(50);

      // Customer has $100 credit, order is $75
      expect(getMaxApplicableCredit(100, 75)).toBe(75);

      // Customer has $25 credit, order is $25
      expect(getMaxApplicableCredit(25, 25)).toBe(25);
    });
  });

  describe('calculateCreditNoteAmount()', () => {
    it('should calculate credit for reduced total', () => {
      expect(calculateCreditNoteAmount(100, 75)).toBe(25);
      expect(calculateCreditNoteAmount(150, 100)).toBe(50);
    });

    it('should return 0 if total increased', () => {
      expect(calculateCreditNoteAmount(100, 125)).toBe(0);
    });

    it('should return 0 if total unchanged', () => {
      expect(calculateCreditNoteAmount(100, 100)).toBe(0);
    });

    it('should handle decimal amounts', () => {
      expect(calculateCreditNoteAmount(99.99, 75.50)).toBeCloseTo(24.49, 2);
    });

    it('should handle complete refund', () => {
      expect(calculateCreditNoteAmount(100, 0)).toBe(100);
    });

    it('should handle small reductions', () => {
      expect(calculateCreditNoteAmount(100, 99.50)).toBeCloseTo(0.50, 2);
    });

    it('should handle real order edit scenarios', () => {
      // Removed 2 items worth $15 each
      const original = 145;
      const adjusted = 115;
      expect(calculateCreditNoteAmount(original, adjusted)).toBe(30);

      // Customer cancelled half the order
      const fullOrder = 200;
      const halfOrder = 100;
      expect(calculateCreditNoteAmount(fullOrder, halfOrder)).toBe(100);
    });
  });

  describe('canApplyCreditToOrder()', () => {
    it('should return true if credit can cover part of order', () => {
      expect(canApplyCreditToOrder(50, 100)).toBe(true);
      expect(canApplyCreditToOrder(25, 75)).toBe(true);
    });

    it('should return true if credit can cover full order', () => {
      expect(canApplyCreditToOrder(100, 100)).toBe(true);
      expect(canApplyCreditToOrder(150, 100)).toBe(true);
    });

    it('should return false if no credit available', () => {
      expect(canApplyCreditToOrder(0, 100)).toBe(false);
    });

    it('should return false if order total is zero', () => {
      expect(canApplyCreditToOrder(50, 0)).toBe(false);
    });

    it('should return false if both are zero', () => {
      expect(canApplyCreditToOrder(0, 0)).toBe(false);
    });

    it('should handle decimal amounts', () => {
      expect(canApplyCreditToOrder(12.50, 99.99)).toBe(true);
      expect(canApplyCreditToOrder(0.01, 100)).toBe(true);
    });

    it('should work with getMaxApplicableCredit', () => {
      const credit = 50;
      const orderTotal = 100;
      
      if (canApplyCreditToOrder(credit, orderTotal)) {
        const maxApplicable = getMaxApplicableCredit(credit, orderTotal);
        expect(maxApplicable).toBe(50);
      }
    });
  });

  describe('integration tests', () => {
    it('should handle complete credit workflow', () => {
      // Customer has credit notes
      const creditNotes: CreditNote[] = [
        {
          id: '1',
          customerId: 'cust1',
          sourceOrderId: 'order1',
          amount: 50,
          remainingBalance: 50,
          status: 'available',
          createdAt: '2024-01-01',
          reason: 'Refund',
          type: 'refund',
        } as any,
        {
          id: '2',
          customerId: 'cust1',
          sourceOrderId: 'order2',
          amount: 100,
          remainingBalance: 30,
          status: 'partially_used',
          createdAt: '2024-01-02',
          reason: 'Overpayment',
          type: 'overpayment',
        } as any,
      ];

      const availableCredit = calculateAvailableCredit(creditNotes);
      expect(availableCredit).toBe(80);

      // Customer places $125 order
      const orderTotal = 125;
      const canApply = canApplyCreditToOrder(availableCredit, orderTotal);
      expect(canApply).toBe(true);

      // Apply maximum credit
      const creditApplied = getMaxApplicableCredit(availableCredit, orderTotal);
      expect(creditApplied).toBe(80);

      // Customer owes remaining
      const amountOwed = orderTotal - creditApplied;
      expect(amountOwed).toBe(45);
    });

    it('should handle order edit creating credit note', () => {
      // Original order
      const originalTotal = 150;

      // Customer reduces order
      const newTotal = 100;

      // Calculate credit note
      const creditAmount = calculateCreditNoteAmount(originalTotal, newTotal);
      expect(creditAmount).toBe(50);

      // Add to existing credit
      const existingCreditNotes: CreditNote[] = [
        {
          id: '1',
          amount: 25,
          remainingBalance: 25,
          status: 'available',
        } as CreditNote,
      ];

      const totalCredit = calculateAvailableCredit(existingCreditNotes) + creditAmount;
      expect(totalCredit).toBe(75);
    });

    it('should handle credit exceeding new order', () => {
      const creditNotes: CreditNote[] = [
        {
          id: '1',
          amount: 100,
          remainingBalance: 100,
          status: 'available',
        } as CreditNote,
      ];

      const credit = calculateAvailableCredit(creditNotes);
      const orderTotal = 50;

      const maxApplicable = getMaxApplicableCredit(credit, orderTotal);
      expect(maxApplicable).toBe(50); // Can only use $50

      const remainingCredit = credit - maxApplicable;
      expect(remainingCredit).toBe(50); // $50 credit left
    });
  });
});
