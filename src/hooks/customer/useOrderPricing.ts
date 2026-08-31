/**
 * useOrderPricing
 *
 * Loads business settings and computes pricing values for the order page.
 * Extracted from CustomerDashboardMain to reduce its size.
 *
 * Returns delivery fee, free delivery threshold, service charge config,
 * and the calculated totals given a subtotal.
 */
import { useCachedSettings } from '../useCachedFirebase';
import { BUSINESS_RULES } from '../../constants/businessRules';

export interface OrderPricing {
  freeDeliveryMin: number;
  deliveryFeeAmount: number;
  serviceChargeEnabled: boolean;
  serviceChargeAmount: number;
  gstRate: number;
  settingsLoading: boolean;
  /** Compute totals from a subtotal */
  computeTotals(subtotal: number, applyCreditEnabled: boolean, creditToApply: number): {
    gst: number;
    deliveryFee: number;
    serviceCharge: number;
    baseTotal: number;
    total: number;
  };
}

export function useOrderPricing(): OrderPricing {
  // ✅ FIXED: Use live Firestore settings (was one-time async fetch — missed admin changes)
  const { data: liveSettings, isLoading: settingsLoading } = useCachedSettings();

  const freeDeliveryMin =
    liveSettings?.freeDeliveryMin ?? BUSINESS_RULES.DEFAULT_FREE_DELIVERY_MIN;
  const deliveryFeeAmount =
    liveSettings?.deliveryFee ?? BUSINESS_RULES.DEFAULT_DELIVERY_FEE;
  const serviceChargeEnabled =
    liveSettings?.serviceChargeEnabled ?? true;
  const serviceChargeAmount =
    liveSettings?.serviceChargeAmount ?? BUSINESS_RULES.DEFAULT_SERVICE_CHARGE;
  // PASS 12 FIX: gstRate now comes from live settings, matching the pattern
  // already used by every adjacent field. Previously hardcoded to
  // BUSINESS_RULES.GST_RATE (5%), so an admin changing the rate in the
  // Settings UI would NOT update the cart preview shown to customers — the
  // preview would stay at 5% while the submitted order (post-Pass 10) used
  // the correct rate. Also reads `taxRate` as a legacy alias to match the
  // server-side resolver in functions/src/orders.ts.
  const gstRate = (() => {
    const candidates = [liveSettings?.gstRate, liveSettings?.taxRate];
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c) && c >= 0 && c < 1) {
        return c;
      }
    }
    return BUSINESS_RULES.GST_RATE; // 5% fallback
  })();

  function computeTotals(
    subtotal: number,
    applyCreditEnabled: boolean,
    creditToApply: number
  ) {
    // BUG FIX: `subtotal * gstRate` was unrounded (e.g. $1.2500000000000002).
    // calculateGST() in orderCalculator uses epsilon-corrected Math.round to 2dp.
    // Using the same approach here ensures the cart display matches stored order totals.
    const gst = Math.round((subtotal * gstRate + Number.EPSILON) * 100) / 100;
    // No delivery fee on empty cart; fee waived when subtotal meets threshold
    const deliveryFee = subtotal === 0 ? 0 : (subtotal >= freeDeliveryMin ? 0 : deliveryFeeAmount);
    const serviceCharge = serviceChargeEnabled ? serviceChargeAmount : 0;
    const baseTotal = subtotal + gst + deliveryFee + serviceCharge;
    const total = applyCreditEnabled ? Math.max(0, baseTotal - creditToApply) : baseTotal;
    return { gst, deliveryFee, serviceCharge, baseTotal, total };
  }

  return {
    freeDeliveryMin,
    deliveryFeeAmount,
    serviceChargeEnabled,
    serviceChargeAmount,
    gstRate,
    settingsLoading,
    computeTotals,
  };
}
