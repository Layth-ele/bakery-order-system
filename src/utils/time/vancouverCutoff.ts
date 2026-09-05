/**
 * ⏰ Vancouver Cutoff Utility - SINGLE SOURCE OF TRUTH
 * 
 * This is THE canonical implementation for 48-hour delivery cutoff logic.
 * 
 * ✅ Used by:
 * - CustomerDashboard (disable ordering inputs via isDayLocked)
 * - ProductionToDoSheet (show status badges via getProductionStatusForDate)
 * - Admin order visibility checks
 * - OrderRow (edit permissions)
 * 
 * ✅ All functions use getNowInVancouver() from /utils/timezone.ts (CANONICAL TIME SOURCE)
 * ✅ FEB 9, 2026: Uses BUSINESS_RULES constants (no hardcoding!)
 * 
 * ❌ NEVER duplicate this logic elsewhere
 * ❌ NEVER use new Date() directly
 * ❌ NEVER rely on browser timezone
 * ❌ NEVER create custom Vancouver time functions
 * 
 * Business Rule:
 * For a delivery day D, ordering and changes are LOCKED starting at 
 * 12:00 PM (noon) Vancouver time, exactly 48 hours before that day.
 * 
 * Examples (Vancouver time):
 * - Monday delivery → cutoff = Saturday 12:00 PM
 * - Wednesday delivery → cutoff = Monday 12:00 PM
 * - Friday delivery → cutoff = Wednesday 12:00 PM
 * 
 * Status Transitions:
 * - OPEN: More than 48 hours until delivery noon
 * - LOCKED: Within 48-hour window (customers can't edit, production preparing)
 * - DONE: Past delivery day noon (production finished)
 * 
 * Testing:
 * To test cutoff behavior, temporarily override getNowInVancouver() in /utils/timezone.ts
 * 
 * Then verify:
 * - Monday delivery → locked (exactly at cutoff)
 * - Sunday 11:59 AM → still open
 * - Saturday 12:00 PM → locked
 */

import { getNowInVancouver } from '../timezone';
import { setHours, setMinutes, setSeconds, subHours } from 'date-fns';
import { BUSINESS_RULES } from '../../constants/businessRules';

/**
 * ✅ CRITICAL: Use the canonical Vancouver time helper
 * This ensures 100% consistency with CustomerDashboard's isDayWithin48Hours
 */
export function getVancouverNow(): Date {
  return getNowInVancouver();
}

/**
 * Given a delivery date (local calendar date),
 * return the cutoff Date (48h before at 12:00 PM Vancouver time)
 * 
 * ✅ FEB 9, 2026: Uses BUSINESS_RULES constants (no hardcoding!)
 * 
 * @param deliveryDate - The delivery day (e.g., Monday Feb 17)
 * @returns Cutoff date/time (e.g., Saturday Feb 15 at 12:00 PM)
 */
export function getCutoffForDeliveryDate(deliveryDate: Date): Date {
  // ✅ Use business rule constant for delivery cutoff hour (noon)
  const deliveryAtNoon = setSeconds(
    setMinutes(setHours(deliveryDate, BUSINESS_RULES.DELIVERY_CUTOFF_HOUR), 0),
    0
  );

  // ✅ Use business rule constant for cutoff hours (48)
  return subHours(deliveryAtNoon, BUSINESS_RULES.CUTOFF_HOURS);
}

/**
 * Is ordering locked for this delivery date?
 * 
 * ✅ Use in CustomerDashboard to disable input fields
 * 
 * @param deliveryDate - The delivery day to check
 * @returns true if past cutoff (ordering closed)
 * 
 * Example:
 * const deliveryDate = getWeekDayDate(selectedWeek, dayIndex, selectedYear);
 * const locked = isDayLocked(deliveryDate);
 * <input disabled={locked} title={locked ? "Ordering closed (48h cutoff)" : ""} />
 */
export function isDayLocked(deliveryDate: Date): boolean {
  const now = getVancouverNow();
  const cutoff = getCutoffForDeliveryDate(deliveryDate);
  return now >= cutoff;
}

/**
 * Production status for this delivery date
 * 
 * ✅ Use in ProductionToDoSheet for status badges
 * 
 * @param deliveryDate - The delivery day to check
 * @returns "open" | "locked" | "done"
 * 
 * Status meaning:
 * - "open": More than 48h away, customers can still order/edit
 * - "locked": Within 48h window, customers locked, production preparing
 * - "done": Past delivery day noon, production finished
 * 
 * Example:
 * const status = getProductionStatusForDate(date);
 * // Use status for badge color/icon/label
 */
export function getProductionStatusForDate(
  deliveryDate: Date
): "open" | "locked" | "done" {
  const now = getVancouverNow();
  const cutoff = getCutoffForDeliveryDate(deliveryDate);

  const deliveryNoon = setSeconds(
    setMinutes(setHours(deliveryDate, 12), 0),
    0
  );

  if (now >= deliveryNoon) return "done";
  if (now >= cutoff) return "locked";
  return "open";
}
// ============================================================================
// WEEK UTILITIES (MAR 19, 2026)
// Re-exported here so hooks/useWeekSelection.ts has a single import point.
// The canonical implementations live in utils/weekUtils.ts.
// ============================================================================

import {
  getCurrentWeekNumber as _getCurrentWeekNumber,
  getWeeksInYear as _getWeeksInYear,
  getWeekRange as _getWeekRange,
} from '../weekUtils';

/** Returns the current ISO week number (Vancouver timezone). */
export function getCurrentWeekNumber(): number {
  return _getCurrentWeekNumber();
}

/**
 * Returns the total number of ISO weeks in the given year (52 or 53).
 * Alias for getWeeksInYear from weekUtils.
 */
export function getTotalWeeksInYear(year: number): number {
  return _getWeeksInYear(year);
}

/**
 * Returns a human-readable week range string, e.g. "Mar 23 – Mar 29, 2026".
 * Delegates to the canonical getWeekRange in weekUtils.
 */
export function getWeekRange(weekNumber: number, year: number): string {
  return _getWeekRange(weekNumber, year);
}
