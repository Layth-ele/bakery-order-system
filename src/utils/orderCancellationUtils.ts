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

/**
 * Calculate credit amount based on original order and cancelled days
 * This accounts for GST, delivery fees, service charges, and cancellation fees proportionally
 */
export function calculateRefundAmount(
  order: Order,
  cancelledDays: Set<DayKey>,
  cancellationFeePercentage: number = 0
): {
  subtotalRefund: number;
  gstRefund: number;
  deliveryFeeRefund: number;
  serviceChargeRefund: number;
  cancellationFee: number;
  totalRefund: number;
  totalCredit: number;
  percentageCancelled: number;
} {
  // Calculate original totals
  const originalSubtotal = order.subtotal || 0;
  
  // Calculate cancelled subtotal
  const cancelledSubtotal = calculateDaySubtotal(order.items, cancelledDays);
  
  // Calculate percentage of order being cancelled
  const percentageCancelled = originalSubtotal > 0 
    ? cancelledSubtotal / originalSubtotal 
    : 0;
  
  // Calculate proportional refunds
  const gstRefund = (order.gst || 0) * percentageCancelled;
  const deliveryFeeRefund = (order.deliveryFee || 0) * percentageCancelled;
  const serviceChargeRefund = order.serviceChargeWaived 
    ? 0 
    : (order.serviceCharge || 0) * percentageCancelled;
  
  // 🔍 DEBUG: Log service charge calculation

  
  // Calculate gross refund before cancellation fee
  const grossRefund = cancelledSubtotal + gstRefund + deliveryFeeRefund + serviceChargeRefund;
  
  // Calculate cancellation fee
  const cancellationFee = grossRefund * (cancellationFeePercentage / 100);
  
  // Net refund after cancellation fee
  const netRefund = grossRefund - cancellationFee;

  // ✅ FIX: If customer had previously applied credit, that credit was never actually
  // paid — it came from their balance. We must subtract the proportional credit portion
  // so we don't issue double-credit (credit that was applied + new credit for the same amount).
  const creditApplied = (order as any).creditApplied || 0;
  const creditPortion = creditApplied * percentageCancelled;
  // Only subtract credit portion that came from credit (not real money payment)
  const totalRefund = Math.max(0, netRefund - creditPortion);
  const totalCredit = totalRefund; // Credit amount is the net refund (minus already-credited portion)
  
  return {
    subtotalRefund: cancelledSubtotal,
    gstRefund,
    deliveryFeeRefund,
    serviceChargeRefund,
    cancellationFee,
    totalRefund,
    totalCredit,
    percentageCancelled,
  };
}

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