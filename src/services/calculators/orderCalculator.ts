/**
 * Order Calculator - Pure Calculation Functions
 * 
 * ✅ SCHEMA-ALIGNED (Mar 10, 2026): Uses types from schemas
 * ✅ PURE FUNCTIONS: No side effects, no data access
 * ✅ TESTABLE: Easy to unit test
 * ✅ BUSINESS RULES: All calculation logic in one place
 * 
 * This file contains all order-related calculations:
 * - Subtotal, GST, delivery fee, total
 * - Product quantities across days
 * - Order validation
 * 
 * Version: 2.0.0 - Schema-aligned (March 10, 2026)
 */

import { Timestamp } from 'firebase/firestore'; // ✅ For Timestamp type in date formatting
import type { 
  Order, 
  OrderItem, 
  Product, 
  Category 
} from '../../schemas';
import { logger } from '../../utils/logger';
 // ✅ SCHEMA TYPES

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Days of the week for order quantities
 */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * Array of all days of the week
 */
export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday', 
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Category group with associated order items
 */
export interface CategoryGroup {
  category: Category;
  items: OrderItem[];
}

// ============================================================================
// ORDER TOTALS CALCULATION
// ============================================================================

/**
 * Calculate GST for an order
 *
 * FIX T2R7-H4 (HIGH): Was hardcoded `subtotal * 0.05`. PASS 10 fixed this
 * problem in `orderCreationService.ts` (admin updates to tax rate now
 * propagate via `resolveGstRate()`), but this calculator was missed.
 * Currently this function is only referenced from tests + a comment, so
 * it's dead in production paths — but it remains a landmine for any
 * future caller that picks it up.
 *
 * Now accepts an optional `gstRate` parameter (0-1 fractional, e.g. 0.05
 * for 5%). Falls back to 0.05 only when no rate is provided so existing
 * callers don't break, but new callers should always pass the live rate
 * from `getSettings().gstRate`.
 *
 * @param subtotal - Order subtotal (before GST and fees)
 * @param gstRate - GST rate as a fraction (e.g. 0.05 for 5%). Defaults to 0.05.
 * @returns GST amount, rounded to 2dp
 */
export function calculateGST(subtotal: number, gstRate: number = 0.05): number {
  // Defensive validation — clamp obvious bad inputs.
  const rate =
    typeof gstRate === 'number' && Number.isFinite(gstRate) && gstRate >= 0 && gstRate < 1
      ? gstRate
      : 0.05;
  const raw = subtotal * rate;
  // Round to 2dp with epsilon correction to avoid IEEE 754 half-value issues
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate discount amount
 * @param price - Original price
 * @param discountPercent - Discount percentage (0-100)
 * @returns Discount amount
 */
export function calculateDiscount(price: number, discountPercent: number): number {
  return price * (discountPercent / 100);
}

/**
 * Calculate final price after discount
 * @param price - Original price
 * @param discountPercent - Discount percentage (0-100)
 * @returns Price after discount
 */
export function calculateDiscountedPrice(price: number, discountPercent: number): number {
  const discount = calculateDiscount(price, discountPercent);
  return price - discount;
}

/**
 * Calculate order subtotal from items
 * @param items - Array of items with price, quantity, and optional discount
 * @returns Order subtotal
 */
export function calculateSubtotal(
  items: Array<{ price: number; quantity: number; discount?: number }>
): number {
  return items.reduce((sum, item) => {
    const price = item.discount 
      ? calculateDiscountedPrice(item.price, item.discount)
      : item.price;
    return sum + (price * (item.quantity ?? (item as any).total ?? 0));
  }, 0);
}

/**
 * Calculate order total
 * @param subtotal - Order subtotal
 * @param gst - GST amount
 * @param deliveryFee - Delivery fee amount
 * @param serviceCharge - Service charge amount
 * @param serviceChargeWaived - Whether service charge is waived
 * @returns Total amount
 */
export function calculateOrderTotal(
  subtotal: number,
  gst: number,
  deliveryFee: number,
  creditApplied: number,
  deliveryFeeWaived: boolean,
  serviceCharge: number = 0,      // ✅ FIX: Added missing serviceCharge param
  serviceChargeWaived: boolean = false
): number {
  const delivery = deliveryFeeWaived ? 0 : deliveryFee;
  const svcCharge = serviceChargeWaived ? 0 : serviceCharge;
  return Math.max(0, subtotal + gst + delivery + svcCharge - creditApplied);
}

/**
 * Check if an order qualifies for free delivery
 * 
 * @param subtotal - Order subtotal
 * @param freeDeliveryMinimum - Minimum amount for free delivery
 * @returns true if free delivery applies
 */
export function qualifiesForFreeDelivery(
  subtotal: number,
  freeDeliveryMinimum: number
): boolean {
  return subtotal >= freeDeliveryMinimum;
}

/**
 * Validate delivery fee input
 * 
 * @param fee - Delivery fee to validate
 * @returns Error message or null if valid
 */
export function validateDeliveryFee(fee: number): string | null {
  if (isNaN(fee)) return 'Delivery fee must be a valid number';
  if (fee < 0) return 'Delivery fee cannot be negative';
  if (fee > 1000) return 'Delivery fee seems unusually high. Please verify.';
  return null;
}

/**
 * Calculate service charge based on order subtotal
 * 
 * @param subtotal - Order subtotal
 * @param serviceChargeRate - Service charge rate (e.g., 0.03 for 3%)
 * @returns Service charge amount
 */
export function calculateServiceCharge(
  subtotal: number,
  serviceChargeRate: number
): number {
  return subtotal * serviceChargeRate;
}

/**
 * Calculate full order breakdown
 * 
 * @param subtotal - Order subtotal
 * @param deliveryFee - Delivery fee
 * @param serviceChargeRate - Service charge rate
 * @param serviceChargeWaived - Whether service charge is waived
 * @returns Complete order calculation breakdown
 */
export function calculateOrderBreakdown(
  subtotal: number,
  deliveryFee: number,
  serviceChargeRate: number,
  serviceChargeWaived: boolean
) {
  const gst = calculateGST(subtotal);
  const serviceCharge = calculateServiceCharge(subtotal, serviceChargeRate);
  const effectiveServiceCharge = serviceChargeWaived ? 0 : serviceCharge;
  // Use raw arithmetic here — no credit applied at breakdown stage
  const total = subtotal + gst + deliveryFee + effectiveServiceCharge;

  return {
    subtotal,
    gst,
    deliveryFee,
    serviceCharge: effectiveServiceCharge,
    serviceChargeWaived,
    total,
  };
}

export interface PriceCalculationDebugInfo {
  subtotal: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  total: number;
}

// ============================================================================
// ORDER ITEM CALCULATIONS
// ============================================================================

/**
 * Calculates the total quantity for a specific item across all days
 * 
 * @param item - Order item with daily quantities
 * @returns Total quantity across all days
 */
export function calculateItemTotal(item: OrderItem): number {
  return DAYS_OF_WEEK.reduce((sum, day) => {
    return sum + (item[day as keyof typeof item] as number || 0 || 0);
  }, 0);
}

/**
 * Calculates the total quantity for all items in an order
 * 
 * @param order - Order to calculate total for
 * @returns Total quantity of all items
 */
export function calculateOrderTotalQuantity(order: Order): number {
  return order.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
}

/**
 * Gets the quantity for a specific item on a specific day
 * 
 * @param item - Order item
 * @param day - Day of the week
 * @returns Quantity for that day
 */
export function getItemQuantityForDay(item: OrderItem, day: DayOfWeek): number {
  // Support both 'quantities' object and direct day properties
  return item[day as keyof typeof item] as number || 0 || 0;
}

// ============================================================================
// ORDER GROUPING & ORGANIZATION
// ============================================================================

/**
 * Groups order items by their product category
 * 
 * @param order - The order containing items to group
 * @param products - List of all products to match against
 * @param categories - List of all categories
 * @returns Array of category groups with their items, filtered to only include categories with items
 * 
 * @example
 * const groups = groupItemsByCategory(order, products, categories);
 * groups.forEach(({ category, items }) => {
 *   logger.log((category.name ?? ""), items.length);
 * });
 */
export function groupItemsByCategory(
  order: Order,
  products: Product[],
  categories: Category[]
): CategoryGroup[] {
 // Defensive check - ensure categories is an array
  if (!Array.isArray(categories)) {
    logger.warn('⚠️ groupItemsByCategory: categories is not an array, returning empty array', { categories });
    return [];
  }
  
  const categoryGroups = categories
    .map(category => ({
      category,
      items: order.items.filter(item => {
        const product = products.find(p => p.id === item.productId);
        // ✅ Handle both 'category' and 'categoryId' fields for backward compatibility
        return product?.categoryId === category.id || product?.category === category.id;
      })
    }))
    .filter(group => group.items.length > 0); // Only include categories that have items

  // ✅ Include custom/uncategorized items (e.g., admin-added custom products)
  // These have productIds like "custom-..." that don't match any catalog product
  const categorizedProductIds = new Set(
    categoryGroups.flatMap(g => g.items.map(i => i.productId))
  );
  const uncategorizedItems = order.items.filter(
    item => !categorizedProductIds.has(item.productId)
  );
  if (uncategorizedItems.length > 0) {
    categoryGroups.push({
      category: { id: '__custom__', name: 'Custom Items', color: '#8B6F47' } as any,
      items: uncategorizedItems,
    });
  }

  return categoryGroups;
}

// ============================================================================
// DATE & TIME FORMATTING
// ============================================================================

/**
 * Format a date with relative time (Today, Yesterday) or absolute date
 * 
 * 🔥 TIMESTAMP MIGRATION: Now handles both Timestamp and string
 * 
 * @param value - Firestore Timestamp or ISO date string
 * @returns Formatted date string (relative or absolute)
 * 
 * @example
 * formatOrderDate(timestamp) // => "Today"
 * formatOrderDate(yesterdayTimestamp) // => "Yesterday"
 * formatOrderDate(oldTimestamp) // => "Mar 5, 2026"
 */
export function formatOrderDate(value: Timestamp | string): string {
  const date = value instanceof Timestamp ? value.toDate() : new Date(value);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a timestamp with date and time
 * 
 * 🔥 TIMESTAMP MIGRATION: Now handles both Timestamp and string
 * 
 * @param value - Firestore Timestamp or ISO date string
 * @returns Formatted date and time string
 * 
 * @example
 * formatOrderTimestamp(timestamp) // => "Mar 7, 2026, 02:30 PM"
 */
export function formatOrderTimestamp(value: Timestamp | string): string {
  const date = value instanceof Timestamp ? value.toDate() : new Date(value);
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formats a date string or Firestore Timestamp for display with fallback
 * 
 * 🔥 TIMESTAMP MIGRATION: Now handles both Timestamp and string
 * 
 * @param value - Firestore Timestamp, ISO date string, or undefined
 * @param defaultValue - Value to return if date is invalid (default: 'N/A')
 * @returns Formatted date string
 * 
 * @example
 * formatOrderDateWithFallback(timestamp) // => "Mar 7, 2026, 02:30 PM"
 * formatOrderDateWithFallback(undefined) // => "N/A"
 * formatOrderDateWithFallback(null, "Unknown") // => "Unknown"
 */
export function formatOrderDateWithFallback(value?: Timestamp | string | number | Date | any | null, defaultValue: string = 'N/A'): string {
  if (!value) return defaultValue;
  
  try {
    // Handle Firestore Timestamp
    if (value instanceof Timestamp) {
      return value.toDate().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle ISO string (legacy)
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return defaultValue;
  }
}

// ============================================================================
// STRING UTILITIES (Order-Specific)
// ============================================================================

/**
 * Capitalizes the first letter of a string
 * 
 * @param str - String to capitalize
 * @returns Capitalized string
 * 
 * @example
 * capitalize("monday") // => "Monday"
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Gets a short version of a day name (first 3 letters, capitalized)
 * 
 * @param day - Full day name
 * @returns Short day name (e.g., "Mon", "Tue")
 * 
 * @example
 * getShortDayName("monday") // => "Mon"
 * getShortDayName("tuesday") // => "Tue"
 */
export function getShortDayName(day: DayOfWeek): string {
  return capitalize(day.substring(0, 3));
}