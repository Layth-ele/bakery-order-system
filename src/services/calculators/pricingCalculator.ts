/**
 * Pricing Calculator - Pure Business Logic
 * 
 * ✅ MARCH 10, 2026: Extracted from /constants/pricing.ts
 * - All calculation functions moved here
 * - Constants remain in /constants/pricing.ts
 * - Pure functions with no side effects
 * - Fully testable
 * 
 * PURPOSE:
 * - Calculate delivery fees (standard, rush, weekend)
 * - Calculate discounts (early bird, bulk, volume)
 * - Calculate taxes (GST, PST, HST)
 * - Calculate order totals
 * - Format currency
 * 
 * @author Bakery Order Management System
 */

import { PRICING_RULES } from '../../constants/pricing';

/**
 * Calculate delivery fee based on order details
 * 
 * @param subtotal - Order subtotal amount
 * @param isRush - Whether this is a rush order (< 48 hours)
 * @param isWeekend - Whether delivery is on weekend (Sat/Sun)
 * @returns Total delivery fee
 */
export function calculateDeliveryFee(
  subtotal: number,
  isRush: boolean = false,
  isWeekend: boolean = false
): number {
  // Free delivery if above threshold
  if (subtotal >= PRICING_RULES.delivery.freeThreshold) {
    return 0;
  }

  let fee = PRICING_RULES.delivery.standardFee;

  // Add rush fee if applicable
  if (isRush) {
    fee += PRICING_RULES.delivery.rushFee;
  }

  // Add weekend surcharge if applicable
  if (isWeekend) {
    fee += PRICING_RULES.delivery.weekendSurcharge;
  }

  return fee;
}

/**
 * Calculate early bird discount
 * 
 * @param subtotal - Order subtotal amount
 * @param daysInAdvance - Number of days order is placed in advance
 * @returns Discount amount
 */
export function calculateEarlyBirdDiscount(
  subtotal: number,
  daysInAdvance: number
): number {
  const { earlyBird } = PRICING_RULES.discounts;
  
  if (!earlyBird.enabled) return 0;
  if (subtotal < earlyBird.minOrderAmount) return 0;
  if (daysInAdvance < earlyBird.threshold) return 0;

  return subtotal * earlyBird.rate;
}

/**
 * Calculate bulk order discount
 * 
 * @param subtotal - Order subtotal amount
 * @returns Discount amount
 */
export function calculateBulkDiscount(subtotal: number): number {
  const { bulk } = PRICING_RULES.discounts;
  
  if (!bulk.enabled) return 0;
  if (subtotal < bulk.threshold) return 0;

  return subtotal * bulk.rate;
}

/**
 * Calculate volume discount (tiered)
 * 
 * @param subtotal - Order subtotal amount
 * @returns Discount amount
 */
export function calculateVolumeDiscount(subtotal: number): number {
  const { volume } = PRICING_RULES.discounts;
  
  if (!volume.enabled) return 0;

  // Find the highest applicable tier
  for (const tier of volume.tiers) {
    if (subtotal >= tier.minAmount) {
      return subtotal * tier.rate;
    }
  }

  return 0;
}

/**
 * Calculate GST + PST
 *
 * FIX R8-S5-F50 (HIGH): Was defaulting to PRICING_RULES.taxes.default which
 * applies BOTH 5% GST AND 7% PST.  But the bakery's products are PST-EXEMPT
 * (basic groceries / bakery items per BC PSTA §138).  If anyone wired this
 * function into the active path, customers would silently be charged 7% extra.
 * Default behavior changed to GST-only; PST is opt-in via the second param.
 *
 * @param amount - Taxable amount
 * @param applyPST - When true, also apply BC PST (7%). Default false (bakery is PST-exempt).
 * @returns Object with GST, PST, and total tax amounts
 */
export function calculateTaxes(
  amount: number,
  applyPST: boolean = false
): {
  gst: number;
  pst: number;
  total: number;
} {
  const gst = amount * PRICING_RULES.taxes.default.gst;
  const pst = applyPST ? amount * PRICING_RULES.taxes.default.pst : 0;

  return {
    gst: Number(gst.toFixed(2)),
    pst: Number(pst.toFixed(2)),
    total: Number((gst + pst).toFixed(2)),
  };
}

/**
 * Calculate total with all fees and taxes
 * 
 * @param params - Order calculation parameters
 * @returns Detailed breakdown of order total
 */
export function calculateOrderTotal(params: {
  subtotal: number;
  deliveryFee?: number;
  serviceCharge?: number;
  discount?: number;
  includeTax?: boolean;
}): {
  subtotal: number;
  deliveryFee: number;
  serviceCharge: number;
  discount: number;
  taxableAmount: number;
  gst: number;
  pst: number;
  total: number;
} {
  const {
    subtotal,
    deliveryFee = 0,
    serviceCharge = 0,
    discount = 0,
    includeTax = true,
  } = params;

  // ✅ FIX: Discount applied to subtotal only (not delivery/service charge).
  // GST applied to (discounted subtotal + deliveryFee + serviceCharge) per CRA rules.
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const taxableAmount = discountedSubtotal + deliveryFee + serviceCharge;

  // Calculate taxes
  const taxes = includeTax ? calculateTaxes(taxableAmount) : { gst: 0, pst: 0, total: 0 };

  // Calculate final total
  const total = taxableAmount + taxes.total;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    serviceCharge: Number(serviceCharge.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    gst: taxes.gst,
    pst: taxes.pst,
    total: Number(total.toFixed(2)),
  };
}

/**
 * Format currency (CAD)
 * 
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "$123.45")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

/**
 * Check if order qualifies for free delivery
 * 
 * @param subtotal - Order subtotal amount
 * @returns True if qualifies for free delivery
 */
export function qualifiesForFreeDelivery(subtotal: number): boolean {
  return subtotal >= PRICING_RULES.delivery.freeThreshold;
}

/**
 * Calculate amount needed for free delivery
 * 
 * @param subtotal - Current order subtotal
 * @returns Amount needed to reach free delivery threshold (0 if already qualified)
 */
export function amountNeededForFreeDelivery(subtotal: number): number {
  const needed = PRICING_RULES.delivery.freeThreshold - subtotal;
  return Math.max(0, needed);
}
