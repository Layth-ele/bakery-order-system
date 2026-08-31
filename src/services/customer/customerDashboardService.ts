/**
 * Customer Dashboard Service - Pure Business Logic
 * 
 * ✅ MARCH 10, 2026: Created during hooks architecture refactoring
 * - Extracted from useCustomerDashboardLogic.ts (592 → ~200 lines)
 * - All business logic consolidated here
 * - Hooks now just orchestrate React state + call these functions
 * 
 * PURPOSE:
 * - Week validation logic (disabled weeks, locked days)
 * - Price calculations for customer types
 * - Cart totals calculations (subtotal, GST, fees)
 * - Order validation (cutoff times, minimum quantities)
 * 
 * PRINCIPLES:
 * - Pure functions (no side effects)
 * - Testable (no React dependencies)
 * - Reusable (can be used outside hooks)
 * - Single responsibility
 * 
 * @author Bakery Order Management System
 */

import { DAY_LABELS } from '../../types/customer-dashboard';
import { CustomerType } from '../../types/customer-dashboard';
import type { Product, Order } from '../../types';
import type { DayQuantities } from '../../types/cart';
import type { CartItem, OrderValidationResult } from '../../types/customer-dashboard';
import { BUSINESS_RULES } from '../../constants/businessRules';
import { isDayLocked } from '../../utils/time/vancouverCutoff';
import {
  getWeekRange,
  getWeekDayDate,
  getYearForWeek,
} from '../../utils/weekUtilsExport';

// ============================================================================
// WEEK VALIDATION
// ============================================================================

/**
 * Check if all days in a week are disabled/locked
 * 
 * @param week - ISO week number
 * @param currentWeek - Current ISO week
 * @param currentYear - Current year
 * @returns True if all days in the week are past cutoff
 */
export function areAllDaysDisabled(
  week: number,
  currentWeek: number,
  currentYear: number
): boolean {
  const yearForWeek = getYearForWeek(week, currentWeek, currentYear);
  
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const deliveryDate = getWeekDayDate(week, dayIndex, yearForWeek);
    if (!isDayLocked(deliveryDate)) {
      return false; // At least one day is still open
    }
  }
  
  return true; // All days are locked
}

/**
 * Check if a week is disabled for ordering
 * 
 * @param week - ISO week number to check
 * @param currentWeek - Current ISO week
 * @param currentYear - Current year
 * @param totalWeeksThisYear - Total weeks in current year
 * @returns True if week cannot be selected for ordering
 */
export function isWeekDisabled(
  week: number,
  currentWeek: number,
  currentYear: number,
  totalWeeksThisYear: number
): boolean {
  const maxWeekAhead = currentWeek + BUSINESS_RULES.MAX_WEEKS_AHEAD;
  
  // Special case: If current week is fully locked
  if (areAllDaysDisabled(currentWeek, currentWeek, currentYear)) {
    const nextWeek = currentWeek >= totalWeeksThisYear ? 1 : currentWeek + 1;
    
    // Handle year boundary
    if (currentWeek >= totalWeeksThisYear - 1 && week <= 10) {
      if (week <= nextWeek) return true;
      const weeksFromCurrent = totalWeeksThisYear - currentWeek + week;
      return weeksFromCurrent > 10;
    }
    
    if (week <= nextWeek) return true;
    
    if (maxWeekAhead <= totalWeeksThisYear) {
      return week > maxWeekAhead;
    }
    
    const wrappedMaxWeek = maxWeekAhead - totalWeeksThisYear;
    if (week > currentWeek) return false;
    return week > wrappedMaxWeek;
  }
  
  // Normal case: Current week has some open days
  // Handle year boundary
  if (currentWeek >= totalWeeksThisYear - 1 && week <= 10) {
    const weeksFromCurrent = totalWeeksThisYear - currentWeek + week;
    return weeksFromCurrent > 10;
  }

  // Allow the current week if it still has open days (e.g. Sat/Sun still within cutoff)
  // areAllDaysDisabled(currentWeek) already returned false above, so some days are open
  if (week === currentWeek) return false;

  // Past weeks are disabled
  if (week < currentWeek) return true;
  
  // Week must be within MAX_WEEKS_AHEAD
  if (maxWeekAhead <= totalWeeksThisYear) {
    return week > maxWeekAhead;
  }
  
  return false;
}

/**
 * Get locked status for each day in a week
 * 
 * @param selectedWeek - ISO week number
 * @param currentWeek - Current ISO week
 * @param currentYear - Current year
 * @returns Array of 7 booleans (true = locked/past cutoff)
 */
export function getLockedDaysForWeek(
  selectedWeek: number,
  currentWeek: number,
  currentYear: number
): boolean[] {
  const yearForWeek = getYearForWeek(selectedWeek, currentWeek, currentYear);
  const locked: boolean[] = [];
  
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const deliveryDate = getWeekDayDate(selectedWeek, dayIndex, yearForWeek);
    locked.push(isDayLocked(deliveryDate));
  }
  
  return locked;
}

// ============================================================================
// PRICE CALCULATIONS
// ============================================================================

/**
 * Calculate price for a product based on customer type
 * 
 * @param product - Product to calculate price for
 * @param customerType - Customer type ('commercial' or 'retail')
 * @returns Final price after discounts
 */
export function calculateCustomerPrice(
  product: Product,
  customerType: string
): number {
  const base: number = customerType === CustomerType.COMMERCIAL
    ? (product.wholesale ?? product.price ?? 0)
    : (product.retail ?? product.price ?? 0);
    
  const discount = product.discount && product.discount > 0 ? product.discount : 0;
  
  return discount > 0 ? base * (1 - discount / 100) : base;
}

/**
 * Calculate all cart totals (subtotal, GST, fees, final total)
 * 
 * @param params - Cart calculation parameters
 * @returns Complete breakdown of cart totals
 */
export function calculateCartTotals(params: {
  cartItems: CartItem[];
  freeDeliveryMin: number;
  deliveryFeeAmount: number;
  serviceChargeEnabled: boolean;
  serviceChargeAmount: number;
  applyCreditEnabled: boolean;
  creditToApply: number;
  /**
   * PASS 12: GST rate now plumbed through. Optional for backwards compat
   * with callers that haven't been updated yet — they get the
   * BUSINESS_RULES.GST_RATE fallback (5%, the previous hardcoded value).
   * Pass the live `liveSettings.gstRate` from `useCachedSettings` to get
   * dynamic admin-controlled rates here.
   */
  gstRate?: number;
}): {
  subtotal: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  baseTotal: number;
  total: number;
} {
  const {
    cartItems,
    freeDeliveryMin,
    deliveryFeeAmount,
    serviceChargeEnabled,
    serviceChargeAmount,
    applyCreditEnabled,
    creditToApply,
    gstRate,
  } = params;
  
  // Calculate subtotal
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.total,
    0
  );
  
  // PASS 12 FIX: Calculate GST using dynamic rate when provided.
  const effectiveGstRate =
    typeof gstRate === 'number' && Number.isFinite(gstRate) && gstRate >= 0 && gstRate < 1
      ? gstRate
      : BUSINESS_RULES.GST_RATE;
  const gst = subtotal * effectiveGstRate;
  
  // Calculate delivery fee (free if above threshold)
  //
  // FIX T2R8-H2: Empty cart used to be charged the full delivery fee
  // (`subtotal === 0` is `< freeDeliveryMin`, so the ternary's false branch
  // returned `deliveryFeeAmount`).  Customer landing on an empty cart screen
  // would see a "$X delivery" line item with no products to deliver. Now
  // matches the pattern in `useOrderPricing.ts:69` — empty cart, no fee.
  const deliveryFee = subtotal === 0 ? 0 : (subtotal >= freeDeliveryMin ? 0 : deliveryFeeAmount);
  
  // Calculate service charge
  const serviceCharge = serviceChargeEnabled ? serviceChargeAmount : 0;
  
  // Calculate base total
  const baseTotal = subtotal + gst + deliveryFee + serviceCharge;
  
  // Calculate final total (with credit applied if enabled)
  const total = applyCreditEnabled 
    ? Math.max(0, baseTotal - creditToApply) 
    : baseTotal;
  
  return {
    subtotal,
    gst,
    deliveryFee,
    serviceCharge,
    baseTotal,
    total,
  };
}

// ============================================================================
// ORDER VALIDATION
// ============================================================================

/**
 * Validate customer order before submission
 * 
 * @param params - Validation parameters
 * @returns Validation result with errors if any
 */
export function validateCustomerOrder(params: {
  cart: Record<string, DayQuantities>;
  products: Product[];
  selectedWeek: number;
  currentWeek: number;
  currentYear: number;
}): OrderValidationResult {
  const { cart, products, selectedWeek, currentWeek, currentYear } = params;
  const errors: string[] = [];
  
  // Check if week is past cutoff
  if (areAllDaysDisabled(selectedWeek, currentWeek, currentYear)) {
    const safeWeekRange = getWeekRange(
      selectedWeek,
      getYearForWeek(selectedWeek, currentWeek, currentYear)
    );
    errors.push(
      `⏰ The delivery week ending ${safeWeekRange} is past the Friday 12:00 PM (Vancouver time) order cutoff. Please select a future week.`
    );
    return { isValid: false, errors };
  }
  
  // Check minimum order quantities for each product/day
  Object.entries(cart).forEach(([productId, quantities]) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    
    DAY_LABELS.forEach((d) => {
      const qty = quantities[d.key];
      if (qty > 0 && qty < (product.dailyMinOrder ?? 0)) {
        errors.push(
          `${product.name} on ${d.label}: ${qty} ordered, minimum is ${(product.dailyMinOrder ?? 0)}`
        );
      }
    });
  });
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
