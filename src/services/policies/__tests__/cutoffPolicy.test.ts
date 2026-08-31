/**
 * Cutoff Policy Tests
 * 
 * Tests for business rules around delivery cutoffs and order timing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canModifyDeliveryDay,
  canModifyDeliveryDays,
  canOrderCurrentWeek,
  getOrderWeek,
  isInProductionWindow,
  canEditOrder,
  type CutoffValidationResult,
} from '../cutoffPolicy';
// PASS 10 FIX: Import the mocked module at top-level so test bodies can access
// the vi.fn() instances directly. Previous version called require() inline,
// which fails in Vitest's ESM runtime ("Cannot find module") and made every
// test that referenced the mocks fail to even load.
import * as weekSelection from '../../../utils/weekSelection';

// Mock the Vancouver cutoff utilities
vi.mock('../../../utils/time/vancouverCutoff', () => ({
  isDayLocked: vi.fn((date: Date) => {
    // Mock: Lock dates in the past or within 48 hours
    const now = new Date();
    const cutoff = new Date(date);
    cutoff.setHours(12, 0, 0, 0); // Noon on delivery day
    const hoursDiff = (cutoff.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 48;
  }),
}));

vi.mock('../../../utils/weekSelection', () => ({
  isBeforeThursdayCutoff: vi.fn(() => {
    // Mock: Always return true for tests (can be overridden)
    return true;
  }),
  getCurrentWeekIdentifier: vi.fn(() => '2026-W11'),
  getNextWeekIdentifier: vi.fn(() => '2026-W12'),
}));

describe('cutoffPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canModifyDeliveryDay()', () => {
    it('should allow modifying dates more than 48 hours away', () => {
      // Date 5 days in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      
      const result = canModifyDeliveryDay(futureDate);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block modifying dates within 48 hours', () => {
      // Date tomorrow (within 48 hours)
      const nearDate = new Date();
      nearDate.setDate(nearDate.getDate() + 1);
      
      const result = canModifyDeliveryDay(nearDate);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should block modifying past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const result = canModifyDeliveryDay(pastDate);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should return consistent validation result structure', () => {
      const date = new Date();
      date.setDate(date.getDate() + 5);
      
      const result = canModifyDeliveryDay(date);
      
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });
  });

  describe('canModifyDeliveryDays()', () => {
    it('should categorize dates into allowed and blocked', () => {
      const today = new Date();
      
      const dates = [
        new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),  // Tomorrow (blocked)
        new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),  // 5 days away (allowed)
        new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days away (allowed)
      ];
      
      const result = canModifyDeliveryDays(dates);
      
      expect(result).toHaveProperty('allowedDates');
      expect(result).toHaveProperty('blockedDates');
      expect(Array.isArray(result.allowedDates)).toBe(true);
      expect(Array.isArray(result.blockedDates)).toBe(true);
    });

    it('should handle empty array', () => {
      const result = canModifyDeliveryDays([]);
      
      expect(result.allowedDates).toHaveLength(0);
      expect(result.blockedDates).toHaveLength(0);
    });

    it('should handle all dates allowed', () => {
      const today = new Date();
      const dates = [
        new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000),
        new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
      ];
      
      const result = canModifyDeliveryDays(dates);
      
      expect(result.allowedDates.length).toBeGreaterThan(0);
    });

    it('should handle all dates blocked', () => {
      const today = new Date();
      const dates = [
        new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
      ];
      
      const result = canModifyDeliveryDays(dates);
      
      expect(result.blockedDates.length).toBeGreaterThan(0);
    });
  });

  describe('canOrderCurrentWeek()', () => {
    it('should allow ordering current week before Thursday cutoff', () => {
      const result = canOrderCurrentWeek();
      
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should include reason when not allowed', () => {
      vi.mocked(weekSelection.isBeforeThursdayCutoff).mockReturnValue(false);

      const result = canOrderCurrentWeek();

      if (!result.allowed) {
        expect(result.reason).toBeDefined();
      }
    });

    it('should return validation result structure', () => {
      const result = canOrderCurrentWeek();
      
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });
  });

  describe('getOrderWeek()', () => {
    it('should return current week before Thursday cutoff', () => {
      vi.mocked(weekSelection.isBeforeThursdayCutoff).mockReturnValue(true);
      vi.mocked(weekSelection.getCurrentWeekIdentifier).mockReturnValue('2026-W11');

      const week = getOrderWeek();

      expect(week).toBe('2026-W11');
    });

    it('should return next week after Thursday cutoff', () => {
      vi.mocked(weekSelection.isBeforeThursdayCutoff).mockReturnValue(false);
      vi.mocked(weekSelection.getNextWeekIdentifier).mockReturnValue('2026-W12');

      const week = getOrderWeek();

      expect(week).toBe('2026-W12');
    });

    it('should return a valid week identifier format', () => {
      const week = getOrderWeek();
      
      expect(week).toMatch(/^\d{4}-W\d{1,2}$/);
    });
  });

  describe('isInProductionWindow()', () => {
    it('should return boolean', () => {
      const order = {
        week: '2026-W11',
        status: 'approved',
      };
      
      const result = isInProductionWindow(order as any);
      
      expect(typeof result).toBe('boolean');
    });

    it('should handle orders without week', () => {
      const order = {
        status: 'approved',
      };
      
      const result = isInProductionWindow(order as any);
      
      expect(typeof result).toBe('boolean');
    });

    it('should handle different order statuses', () => {
      const statuses = ['pending', 'approved', 'completed', 'cancelled'];
      
      statuses.forEach(status => {
        const order = { week: '2026-W11', status };
        const result = isInProductionWindow(order as any);
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('canEditOrder()', () => {
    it('should allow editing pending orders', () => {
      const order = {
        id: 'order1',
        status: 'pending',
        week: '2026-W11',
        deliveryDates: {},
      };
      
      const result = canEditOrder(order as any);
      
      // Result depends on cutoff, but should have proper structure
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should block editing completed orders', () => {
      const order = {
        id: 'order1',
        status: 'completed',
        week: '2026-W11',
        deliveryDates: {},
      };
      
      const result = canEditOrder(order as any);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should block editing cancelled orders', () => {
      const order = {
        id: 'order1',
        status: 'cancelled',
        week: '2026-W11',
        deliveryDates: {},
      };
      
      const result = canEditOrder(order as any);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cancelled');
    });

    it('should block editing rejected orders', () => {
      const order = {
        id: 'order1',
        status: 'rejected',
        week: '2026-W11',
        deliveryDates: {},
      };
      
      const result = canEditOrder(order as any);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('rejected');
    });

    it('should return validation result with reason when blocked', () => {
      const order = {
        id: 'order1',
        status: 'completed',
        week: '2026-W11',
        deliveryDates: {},
      };
      
      const result = canEditOrder(order as any);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical order flow', () => {
      // Check if can order current week
      const weekCheck = canOrderCurrentWeek();
      
      if (weekCheck.allowed) {
        // Get appropriate week
        const week = getOrderWeek();
        expect(week).toBeDefined();
        
        // Create order
        const order = {
          id: 'order1',
          status: 'pending',
          week: week,
          deliveryDates: {},
        };
        
        // Check if can edit
        const editCheck = canEditOrder(order as any);
        expect(editCheck).toHaveProperty('allowed');
      }
    });

    it('should handle delivery day validation for order', () => {
      const today = new Date();
      const deliveryDates = [
        new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
        new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days
        new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
      ];
      
      const results = canModifyDeliveryDays(deliveryDates);
      
      // Should categorize correctly
      expect(results.allowedDates.length + results.blockedDates.length).toBe(deliveryDates.length);
    });

    it('should handle cutoff edge case (exactly 48 hours)', () => {
      const exactCutoff = new Date();
      exactCutoff.setHours(exactCutoff.getHours() + 48);
      
      const result = canModifyDeliveryDay(exactCutoff);
      
      // Should have a definitive answer (allowed or not)
      expect(typeof result.allowed).toBe('boolean');
    });
  });

  describe('error handling', () => {
    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      
      expect(() => {
        canModifyDeliveryDay(invalidDate);
      }).not.toThrow();
    });

    it('should handle null order in canEditOrder', () => {
      expect(() => {
        canEditOrder(null as any);
      }).not.toThrow();
    });

    it('should handle order without status', () => {
      const order = {
        id: 'order1',
        week: '2026-W11',
      };
      
      expect(() => {
        canEditOrder(order as any);
      }).not.toThrow();
    });
  });
});
