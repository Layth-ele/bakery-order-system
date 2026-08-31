/**
 * Pricing Rules Configuration
 * ✅ MARCH 10, 2026: Refactored - moved calculations to /services/calculators/pricingCalculator.ts
 * 
 * PURPOSE:
 * - Static pricing configuration (fees, tax rates, discounts)
 * - Single source of truth for pricing constants
 * - Easy to update pricing strategies
 * 
 * ⚠️ IMPORTANT:
 * - This file contains ONLY static values
 * - All calculation logic is in /services/calculators/pricingCalculator.ts
 * - Do NOT add functions to this file
 * 
 * USAGE:
 * ```typescript
 * import { PRICING_RULES } from '@/constants/pricing';
 * import { calculateDeliveryFee, calculateTaxes } from '@/services/calculators';
 * 
 * const fee = calculateDeliveryFee(subtotal, isRush, isWeekend);
 * const taxes = calculateTaxes(amount);
 * ```
 */

import { BUSINESS_RULES } from './businessRules';

export const PRICING_RULES = {
  /**
   * Delivery Pricing
   */
  delivery: {
    freeThreshold: BUSINESS_RULES.DEFAULT_FREE_DELIVERY_MIN,
    standardFee: BUSINESS_RULES.DEFAULT_DELIVERY_FEE,
    rushFee: 25, // Additional $25 for rush orders (< 48 hours notice)
    weekendSurcharge: 15, // Additional $15 for Saturday/Sunday delivery
  },

  /**
   * Service Charges
   */
  service: {
    standardCharge: BUSINESS_RULES.DEFAULT_SERVICE_CHARGE,
  },

  /**
   * Discount Rates
   */
  discounts: {
    // Early Bird Discount (orders placed well in advance)
    earlyBird: {
      enabled: false, // Feature flag
      threshold: 14, // 14+ days in advance
      rate: 0.10, // 10% off
      minOrderAmount: 100, // Minimum $100 order
    },
    
    // Bulk Order Discount
    bulk: {
      enabled: false, // Feature flag
      threshold: 500, // $500+ subtotal
      rate: 0.15, // 15% off
    },
    
    // Volume Discounts (tiered)
    volume: {
      enabled: false, // Feature flag
      tiers: [
        { minAmount: 1000, rate: 0.20 }, // 20% off for $1000+
        { minAmount: 500, rate: 0.15 },  // 15% off for $500+
        { minAmount: 250, rate: 0.10 },  // 10% off for $250+
      ],
    },
    
    // First Order Discount
    firstOrder: {
      enabled: false, // Feature flag
      rate: 0.05, // 5% off
      maxDiscount: 25, // Maximum $25 off
    },
  },

  /**
   * Tax Rates (Canadian)
   */
  taxes: {
    gst: BUSINESS_RULES.GST_RATE, // 5% GST (Federal)
    pst: {
      BC: 0.07, // 7% PST (British Columbia)
      ON: 0.00, // Ontario uses HST instead
      AB: 0.00, // Alberta has no PST
      SK: 0.06, // 6% PST (Saskatchewan)
      MB: 0.07, // 7% PST (Manitoba)
    },
    hst: {
      ON: 0.13, // 13% HST (Ontario)
      NS: 0.15, // 15% HST (Nova Scotia)
      NB: 0.15, // 15% HST (New Brunswick)
      NL: 0.15, // 15% HST (Newfoundland)
      PE: 0.15, // 15% HST (Prince Edward Island)
    },
    // Default to BC (Vancouver bakery)
    default: {
      gst: BUSINESS_RULES.GST_RATE,
      pst: 0.07,
      total: 0.12, // 5% + 7% = 12%
    },
  },

  /**
   * Minimum Order Values
   */
  minimums: {
    delivery: BUSINESS_RULES.DEFAULT_FREE_DELIVERY_MIN,
    pickup: 0, // No minimum for pickup
  },
} as const;

/**
 * Type-safe pricing rules
 */
export type PricingRules = typeof PRICING_RULES;
