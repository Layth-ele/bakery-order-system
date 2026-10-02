/**
 * Order Cancellation Utilities
 * 
 * ✅ MAR 12, 2026: Created for day-specific order cancellation calculations
 * 
 * This file provides utilities for:
 * - Calculating totals for specific days
 * - Computing refund amounts for partial cancellations
 * - Validating day cancellation logic
 */

import type { Order, OrderItem } from '../types';
import {
  effectiveGstRate,
  normalizeItems,
  orderTotals,
  planCancellation,
  round2,
} from '../functions/src/lib/orderRevision';

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAYS: Array<{ key: DayKey; label: string; fullLabel: string }> = [
  { key: 'monday', label: 'Mon', fullLabel: 'Monday' },
  { key: 'tuesday', label: 'Tue', fullLabel: 'Tuesday' },
  { key: 'wednesday', label: 'Wed', fullLabel: 'Wednesday' },
  { key: 'thursday', label: 'Thu', fullLabel: 'Thursday' },
  { key: 'friday', label: 'Fri', fullLabel: 'Friday' },
  { key: 'saturday', label: 'Sat', fullLabel: 'Saturday' },
  { key: 'sunday', label: 'Sun', fullLabel: 'Sunday' },
];

/**
 * Calculate the subtotal for specific days in an order
 */
export function calculateDaySubtotal(items: OrderItem[], selectedDays: Set<DayKey>): number {
  let subtotal = 0;
  
  items.forEach(item => {
    let dayQuantity = 0;
    
    selectedDays.forEach(day => {
      dayQuantity += item[day] || 0;
    });
    
    subtotal += dayQuantity * item.price;
  });
  
  return subtotal;
}

/**
 * Calculate total items for specific days
 */
export function calculateDayItemCount(items: OrderItem[], selectedDays: Set<DayKey>): number {
  let total = 0;
  
  items.forEach(item => {
    selectedDays.forEach(day => {
      total += item[day] || 0;
    });
  });
  
  return total;
}

export interface RefundPreview {
  /** Payment was received: the customer is refunded (as store credit). */
  paid: boolean;
  /** Every delivery day is cancelled → the whole order is cancelled. */
  full: boolean;
  subtotalRefund: number;
  gstRefund: number;
  deliveryFeeRefund: number;
  serviceChargeRefund: number;
  cancellationFee: number;
  totalRefund: number;
  /** Store credit the customer receives (paid: refund − fee; unpaid: store credit returned). */
  totalCredit: number;
  /** Unpaid orders: what the customer still owes afterwards. */
  newAmountDue: number;
  percentageCancelled: number;
}

/**
 * What cancelling `cancelledDays` will do — computed with the exact rules
 * the cancelOrder Cloud Function applies (lib/orderRevision.planCancellation),
 * so the preview always equals the result.
 */
export function calculateRefundAmount(
  order: Order,
  cancelledDays: Set<DayKey>,
  cancellationFeePercentage: number = 0
): RefundPreview {
  const days = [...cancelledDays];
  const paid = (order as any).paymentReceived === true;
  const empty: RefundPreview = {
    paid, full: false, subtotalRefund: 0, gstRefund: 0, deliveryFeeRefund: 0, serviceChargeRefund: 0,
    cancellationFee: 0, totalRefund: 0, totalCredit: 0, newAmountDue: Number((order as any).amountDue ?? order.total ?? 0),
    percentageCancelled: 0,
  };
  let plan;
  try {
    plan = planCancellation(order as any, days, cancellationFeePercentage, FALLBACK_GST_RATE);
  } catch {
    return empty;
  }
  const items = normalizeItems(order.items);
  const before = orderTotals(items, order as any, effectiveGstRate(order as any, FALLBACK_GST_RATE));
  const after = plan.totals;
  const base = (t: { subtotal: number; discountAmount: number }) => t.subtotal - t.discountAmount;
  const subtotalRefund = round2(base(before) - (after ? base(after) : 0));
  const percentageCancelled = base(before) > 0 ? subtotalRefund / base(before) : 0;

  if (!paid) {
    return { ...empty, full: plan.full, totalCredit: plan.credit, newAmountDue: plan.amountDue, percentageCancelled };
  }
  return {
    paid,
    full: plan.full,
    subtotalRefund,
    gstRefund: round2((order.gst ?? 0) - (after ? after.gst : 0)),
    deliveryFeeRefund: plan.full ? round2(order.deliveryFee ?? 0) : 0,
    serviceChargeRefund: plan.full && !order.serviceChargeWaived ? round2(order.serviceCharge ?? 0) : 0,
    cancellationFee: plan.fee,
    totalRefund: round2(plan.credit + plan.fee),
    totalCredit: plan.credit,
    newAmountDue: plan.amountDue,
    percentageCancelled,
  };
}

/** Only used for orders that carry no GST of their own. */
const FALLBACK_GST_RATE = 0.05;

/**
 * Get active days (days with items ordered) for an order
 */
export function getActiveDays(items: OrderItem[]): DayKey[] {
  const activeDays = new Set<DayKey>();
  
  items.forEach(item => {
    DAYS.forEach(day => {
      if (item[day.key] && item[day.key] > 0) {
        activeDays.add(day.key);
      }
    });
  });
  
  return Array.from(activeDays);
}

/**
 * Check if all days are selected for cancellation
 */
export function isFullOrderCancellation(
  items: OrderItem[],
  selectedDays: Set<DayKey>
): boolean {
  const activeDays = getActiveDays(items);
  return activeDays.every(day => selectedDays.has(day));
}

/**
 * Get breakdown of items by day
 */
export function getItemsByDay(items: OrderItem[]): Map<DayKey, Array<{ productName: string; quantity: number; price: number; subtotal: number }>> {
  const dayMap = new Map<DayKey, Array<{ productName: string; quantity: number; price: number; subtotal: number }>>();
  
  DAYS.forEach(day => {
    const dayItems: Array<{ productName: string; quantity: number; price: number; subtotal: number }> = [];
    
    items.forEach(item => {
      const quantity = item[day.key] || 0;
      if (quantity > 0) {
        dayItems.push({
          productName: item.productName,
          quantity,
          price: item.price,
          subtotal: quantity * item.price,
        });
      }
    });
    
    if (dayItems.length > 0) {
      dayMap.set(day.key, dayItems);
    }
  });
  
  return dayMap;
}