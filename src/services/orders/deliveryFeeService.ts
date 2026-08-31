/**
 * Delivery Fee Service
 *
 * Pure business rules for delivery fee calculation.
 * Extracted from orderWorkflowService to reduce its size.
 */
import { getSettings } from '../data/settingsDataService';
import type { Order } from '../../types';

export function isDeliveryFeeRequired(order: Order): boolean {
  return order.deliveryFee === undefined || order.deliveryFee === null;
}

/**
 * Check if order qualifies for free delivery
 * 
 * Business Rule:
 * - Orders >= $250 subtotal get free delivery
 */
export function qualifiesForFreeDelivery(order: Order): boolean {
  return (order.subtotal || 0) >= 250;
}

/**
 * Calculate delivery fee based on order subtotal
 * 
 * Business Rules:
 * - Subtotal >= $250: Free delivery ($0)
 * - Subtotal < $250: Standard delivery fee from settings
 */
export async function calculateDeliveryFee(order: Order): Promise<number> {
  if (qualifiesForFreeDelivery(order)) {
    return 0;
  }
  
  const settings = await getSettings();
  return settings.deliveryFee || 50; // Default $50 if not set
}

/**
 * Calculate order totals with given fees
 */

export function calculateOrderTotals(
  subtotal: number,
  deliveryFee: number,
  serviceCharge: number,
  serviceChargeWaived: boolean = false
): { gst: number; total: number } {
  // FIX M3: Was `subtotal * 0.05` — raw IEEE 754 multiplication produces values like
  // $0.9999999999999998 or $1.0000000000000002. Every other GST calculation in the
  // codebase (orderCalculator.ts, ordersService.ts, clientSideOperations.ts) uses
  // epsilon-corrected Math.round to 2 dp to avoid this. Aligning here prevents
  // invoice totals from differing by 1 cent from stored order totals.
  const gst = Math.round((subtotal * 0.05 + Number.EPSILON) * 100) / 100;
  const total = subtotal + gst + deliveryFee + (serviceChargeWaived ? 0 : serviceCharge);
  return { gst, total };
}
