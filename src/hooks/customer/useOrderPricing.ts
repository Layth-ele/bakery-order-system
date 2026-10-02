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
import {
  resolveDeliveryFee,
  resolveFreeDeliveryMin,
  resolveServiceCharge,
  resolveTaxRate,
} from '../../functions/src/lib/settingsValues';

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
  const { data: liveSettings, isLoading: settingsLoading } = useCachedSettings();
  // The exact setting rules placeOrder uses (functions/src/lib/settingsValues),
  // so the cart shows what the server will charge.
  const general = (liveSettings ?? null) as Record<string, unknown> | null;
  const freeDeliveryMin = resolveFreeDeliveryMin(general);
  const deliveryFeeAmount = resolveDeliveryFee(general);
  const serviceChargeAmount = resolveServiceCharge(general);
  const serviceChargeEnabled = serviceChargeAmount > 0;
  const gstRate = resolveTaxRate(general);

  function computeTotals(
    subtotal: number,
    applyCreditEnabled: boolean,
    creditToApply: number
  ) {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const gst = round2(subtotal * gstRate);
    const deliveryFee = subtotal === 0 || subtotal >= freeDeliveryMin ? 0 : round2(deliveryFeeAmount);
    const serviceCharge = round2(serviceChargeAmount);
    const baseTotal = round2(subtotal + gst + deliveryFee + serviceCharge);
    // baseTotal = invoice total; total = what's left to pay after store credit.
    const total = applyCreditEnabled ? Math.max(0, round2(baseTotal - creditToApply)) : baseTotal;
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
