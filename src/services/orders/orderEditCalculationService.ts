/**
 * Order Edit Calculation Service - Pure Business Logic
 * 
 * ✅ MARCH 10, 2026: Created during hooks architecture refactoring
 * - Extracted from useEditOrderLogic.ts (318 → ~150 lines)
 * - All calculation logic consolidated here
 * - Hooks now just orchestrate React state + call these functions
 * 
 * PURPOSE:
 * - Calculate product totals for edited orders
 * - Calculate item subtotals
 * - Calculate discount amounts (percentage/fixed)
 * - Calculate edited order totals with all fees
 * - Filter active days based on order data
 * 
 * PRINCIPLES:
 * - Pure functions (no side effects)
 * - Testable (no React dependencies)
 * - Reusable (can be used outside hooks)
 * - Single responsibility
 * 
 * @author Bakery Order Management System
 */

import type { Order } from '../../types';
import { BUSINESS_RULES } from '../../constants/businessRules';

// ============================================================================
// TYPES
// ============================================================================

export interface DayQuantities {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export type DayKey = keyof DayQuantities;

export interface EditedItem extends DayQuantities {
  productId: string;
  productName: string;
  price: number;
}

const DAYS: Array<{ key: DayKey; label: string; full: string }> = [
  { key: 'monday', label: 'Mon', full: 'Monday' },
  { key: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { key: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { key: 'thursday', label: 'Thu', full: 'Thursday' },
  { key: 'friday', label: 'Fri', full: 'Friday' },
  { key: 'saturday', label: 'Sat', full: 'Saturday' },
  { key: 'sunday', label: 'Sun', full: 'Sunday' },
];

// ============================================================================
// PRODUCT CALCULATIONS
// ============================================================================

/**
 * Calculate total quantity for a product across all days
 * 
 * @param item - Edited item with day quantities
 * @returns Total quantity across all days
 */
export function calculateProductTotal(item: EditedItem): number {
  return DAYS.reduce((sum, day) => sum + (item[day.key] || 0), 0);
}

/**
 * Calculate subtotal for a single item
 * 
 * @param item - Edited item
 * @param total - Total quantity (pre-calculated for efficiency)
 * @returns Item subtotal (quantity × price)
 */
export function calculateItemSubtotal(item: EditedItem, total: number): number {
  return total * (item?.price || 0);
}

// ============================================================================
// DISCOUNT CALCULATIONS
// ============================================================================

/**
 * Calculate discount amount based on type and value
 * 
 * @param discount - Discount value (percentage or fixed amount)
 * @param discountType - 'percentage' or 'fixed'
 * @param itemsSubtotal - Subtotal of all items
 * @returns Discount amount in dollars
 */
export function calculateDiscountAmount(
  discount: number,
  discountType: 'percentage' | 'fixed',
  itemsSubtotal: number
): number {
  if (!discount || discount === 0) return 0;
  
  if (discountType === 'percentage') {
    return (discount / 100) * itemsSubtotal;
  } else {
    // Fixed amount - can't discount more than subtotal
    return Math.min(discount, itemsSubtotal);
  }
}

// ============================================================================
// TOTALS CALCULATIONS
// ============================================================================

/**
 * Calculate all totals for an edited order
 * 
 * @param params - Calculation parameters
 * @returns Complete breakdown of order totals
 */
export function calculateEditedOrderTotals(params: {
  editedItems: { [productId: string]: EditedItem };
  discount: number;
  discountType: 'percentage' | 'fixed';
  deliveryFee: string;
  deliveryFeeEnabled: boolean;
  serviceCharge: number;
  /**
   * PASS 12: GST rate now plumbed through. Optional for backwards compat
   * (callers get BUSINESS_RULES.GST_RATE = 5% if omitted). Pass the live
   * settings value so the order-edit modal totals match what the customer
   * was shown when they placed the order.
   */
  gstRate?: number;
}): {
  itemsSubtotal: number;
  gst: number;
  deliveryFeeValue: number;
  baseTotal: number;
  discountAmount: number;
  finalTotal: number;
} {
  const {
    editedItems,
    discount,
    discountType,
    deliveryFee,
    deliveryFeeEnabled,
    serviceCharge,
    gstRate,
  } = params;
  
  // Calculate items subtotal
  const itemsSubtotal = Object.keys(editedItems).reduce((sum, productId) => {
    const item = editedItems[productId];
    const total = calculateProductTotal(item);
    return sum + calculateItemSubtotal(item, total);
  }, 0);
  
  // PASS 12 FIX: GST from dynamic rate when provided, else 5% fallback.
  const effectiveGstRate =
    typeof gstRate === 'number' && Number.isFinite(gstRate) && gstRate >= 0 && gstRate < 1
      ? gstRate
      : BUSINESS_RULES.GST_RATE;
  const gst = itemsSubtotal * effectiveGstRate;
  
  // Calculate delivery fee
  const deliveryFeeValue = deliveryFeeEnabled
    ? (parseFloat(deliveryFee) || 0)
    : 0;
  
  // Calculate base total (before discount)
  const baseTotal = itemsSubtotal + gst + serviceCharge;
  
  // Calculate discount amount
  const discountAmount = calculateDiscountAmount(
    discount,
    discountType,
    itemsSubtotal
  );
  
  // Calculate final total
  const finalTotal = baseTotal - discountAmount + deliveryFeeValue;
  
  return {
    itemsSubtotal,
    gst,
    deliveryFeeValue,
    baseTotal,
    discountAmount,
    finalTotal,
  };
}

// ============================================================================
// ACTIVE DAYS FILTERING
// ============================================================================

/**
 * Filter days to only show those with active orders
 * 
 * @param order - Order to analyze
 * @returns Array of days that have quantities > 0
 */
export function filterActiveDays(
  order: Order
): Array<{ key: DayKey; label: string; full: string }> {
  const daysWithOrders = new Set<DayKey>();
  
  // Track which days have orders
  order.items.forEach((item) => {
    DAYS.forEach(day => {
      if ((item[day.key] || 0) > 0) {
        daysWithOrders.add(day.key);
      }
    });
  });
  
  // Filter days to only include those with orders
  const filteredDays = DAYS.filter(day => daysWithOrders.has(day.key));
  
  // Return filtered days, or all days if none have orders (fallback)
  return filteredDays.length > 0 ? filteredDays : DAYS;
}

/**
 * Convert order items to edited items map
 * 
 * @param order - Order to convert
 * @returns Map of productId to EditedItem
 */
export function convertOrderToEditedItems(
  order: Order
): { [productId: string]: EditedItem } {
  const itemsMap: { [productId: string]: EditedItem } = {};
  
  order.items.forEach((item) => {
    itemsMap[item.productId] = {
      productId: item.productId,
      productName: item.productName,
      price: item.price,
      monday: item.monday || 0,
      tuesday: item.tuesday || 0,
      wednesday: item.wednesday || 0,
      thursday: item.thursday || 0,
      friday: item.friday || 0,
      saturday: item.saturday || 0,
      sunday: item.sunday || 0,
    };
  });
  
  return itemsMap;
}
