/**
 * Week Selection Business Logic
 * Handles week selection validation and locking rules for customer orders
 */

import { getISOWeekInfo, getWeeksInYear } from '../utils/weekUtils';
import { resolveWeekYearNormalized } from './weekUtils';
import { getNowInVancouver, getWeekdayInVancouver, getHourInVancouver } from './timezone';
import { isDayLocked } from './time/vancouverCutoff';
import { getWeekDayDate } from './weekUtils';

/**
 * Check if current time is before Thursday noon cutoff (Vancouver time)
 * ✅ SINGLE SOURCE OF TRUTH: Used for UI logic and week selection
 * 
 * Business Rule: Thursday 12:00 PM Vancouver time is the cutoff
 * - Before Thursday noon (Mon-Wed, Thu before 12pm): can order current week
 * - After Thursday noon (Thu after 12pm, Fri-Sun): must order next week
 * 
 * @param now - Current date in Vancouver timezone (defaults to getNowInVancouver())
 * @returns true if before Thursday noon, false otherwise
 */
export function isBeforeThursdayCutoff(now: Date = getNowInVancouver()): boolean {
  // ✅ CRITICAL FIX: Use timezone-aware helpers instead of .getDay()/.getHours()
  // This ensures we're checking Vancouver time, not device time
  const dayOfWeek = getWeekdayInVancouver(now); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const hours = getHourInVancouver(now);

  // Thursday (4) at noon or later → past cutoff
  const isThursdayNoonOrLater = dayOfWeek === 4 && hours >= 12;
  
  // Friday (5), Saturday (6), or Sunday (0) → past cutoff
  const isPastThursday = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

  // Return true only if we're BEFORE the cutoff
  return !isThursdayNoonOrLater && !isPastThursday;
}

/**
 * Get the initial order week based on current date/time
 * ✅ CRITICAL FIX: Uses Vancouver timezone (not device time)
 * 
 * Business Rule: Orders placed Thursday 12pm or later apply to NEXT week
 * @param now - Current date in Vancouver timezone (defaults to getNowInVancouver())
 * @returns Initial week number to select
 */
export function getInitialOrderWeek(now: Date = getNowInVancouver()): number {
  const { week: currentWeek, year: isoYear } = getISOWeekInfo();
  const maxWeeks = getWeeksInYear(isoYear);

  if (isBeforeThursdayCutoff(now)) {
    return currentWeek;
  }

  // After Thursday cutoff — check if current week still has any open days
  // e.g. Thursday evening: Saturday and/or Sunday may still be orderable
  const currentWeekHasOpenDays = Array.from({ length: 7 }, (_, i) => i).some(dayIndex => {
    const date = getWeekDayDate(currentWeek, dayIndex, isoYear);
    return !isDayLocked(date);
  });

  if (currentWeekHasOpenDays) {
    return currentWeek;
  }

  // Current week fully locked → default to next week
  return currentWeek >= maxWeeks ? 1 : currentWeek + 1;
}

/**
 * Get year for a given week number
 * Handles year transitions (week 52 → week 1)
 * 
 * @param week - Week number to get year for
 * @param currentWeek - Current ISO week
 * @param currentYear - Current ISO year
 * @returns The year this week belongs to
 */
export function getYearForWeek(week: number, currentWeek: number, currentYear: number): number {
  // If we are near year-end and user selects week 1..10, treat as next year
  return currentWeek >= 50 && week <= 10 ? currentYear + 1 : currentYear;
}

/**
 * Check if a restored week is still valid for ordering
 * 
 * @param restoredWeek - Week number from saved cart
 * @param restoredYear - Year from saved cart (optional for backwards compatibility)
 * @param currentWeek - Current ISO week
 * @param currentYear - Current ISO year
 * @returns true if the week is still valid for ordering
 */
export function isRestoredWeekValid(
  restoredWeek: number,
  restoredYear: number | undefined,
  currentWeek: number,
  currentYear: number
): boolean {
  // Determine the year for the restored week if not provided
  const weekYear = restoredYear ?? getYearForWeek(restoredWeek, currentWeek, currentYear);
  
  // Use resolveWeekYear to handle year transitions properly
  const { normalizedWeek, resolvedYear } = resolveWeekYearNormalized(restoredWeek, weekYear);
  const { normalizedWeek: currentNormalizedWeek, resolvedYear: currentResolvedYear } = 
    resolveWeekYearNormalized(currentWeek, currentYear);
  
  // Week is valid if it's in the current year or next year (within next 10 weeks)
  if (resolvedYear < currentResolvedYear) {
    return false; // Week is in the past
  }
  
  if (resolvedYear === currentResolvedYear) {
    // Same year - check if week is not in the past
    return normalizedWeek >= currentNormalizedWeek;
  }
  
  if (resolvedYear === currentResolvedYear + 1) {
    // Next year - allow if we're near year end and week is early in next year
    return currentNormalizedWeek >= 50 && normalizedWeek <= 10;
  }
  
  return false; // Week is too far in the future
}

/**
 * Get the next available week (skipping unavailable weeks)
 * 
 * @param startWeek - Week to start searching from
 * @param unavailableWeeks - Set of unavailable week numbers
 * @param maxWeeks - Total weeks in the year
 * @returns Next available week number
 */
export function getNextAvailableWeek(
  startWeek: number,
  unavailableWeeks: Set<number>,
  maxWeeks: number
): number {
  let week = startWeek;
  let attempts = 0;
  
  while (unavailableWeeks.has(week) && attempts < maxWeeks) {
    week = week >= maxWeeks ? 1 : week + 1;
    attempts++;
  }
  
  return week;
}

/**
 * Check if a week is within valid ordering range
 * 
 * @param week - Week number to check
 * @param currentWeek - Current ISO week
 * @param maxWeeksAhead - Maximum weeks ahead allowed
 * @param totalWeeks - Total weeks in the year
 * @returns true if week is within valid range
 */
export function isWeekInValidRange(
  week: number,
  currentWeek: number,
  maxWeeksAhead: number,
  totalWeeks: number
): boolean {
  const maxWeek = currentWeek + maxWeeksAhead;
  
  if (maxWeek <= totalWeeks) {
    // No year wrap
    return week >= currentWeek && week <= maxWeek;
  } else {
    // Year wrap case
    return week >= currentWeek || week <= (maxWeek - totalWeeks);
  }
}

/**
 * Get all available weeks within ordering range
 * 
 * @param currentWeek - Current ISO week
 * @param totalWeeks - Total weeks in the year
 * @param unavailableWeeks - Set of unavailable week numbers
 * @param maxWeeksAhead - Maximum weeks ahead allowed (default: 10)
 * @returns Array of available week numbers
 */
export function getAvailableWeeks(
  currentWeek: number,
  totalWeeks: number,
  unavailableWeeks: Set<number>,
  maxWeeksAhead: number = 10
): number[] {
  const available: number[] = [];
  
  for (let i = 0; i <= maxWeeksAhead; i++) {
    const week = currentWeek + i;
    const normalizedWeek = week > totalWeeks ? week - totalWeeks : week;
    
    if (!unavailableWeeks.has(normalizedWeek)) {
      available.push(normalizedWeek);
    }
  }
  
  return available;
}

/**
 * Normalize week number to valid range (1 to maxWeeks)
 * 
 * @param week - Week number to normalize
 * @param maxWeeks - Total weeks in the year
 * @returns Normalized week number
 */
export function normalizeWeekNumber(week: number, maxWeeks: number): number {
  if (week < 1) {
    return maxWeeks + week;
  }
  if (week > maxWeeks) {
    return week - maxWeeks;
  }
  return week;
}
// ============================================================================
// WEEK IDENTIFIER HELPERS (added MAR 18, 2026 for cutoffPolicy)
// ============================================================================

/**
 * Returns the current ISO week identifier, e.g. "2026-W11"
 */
export function getCurrentWeekIdentifier(now: Date = getNowInVancouver()): string {
  const { week, year } = getISOWeekInfo(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Returns the next ISO week identifier, e.g. "2026-W12"
 */
export function getNextWeekIdentifier(now: Date = getNowInVancouver()): string {
  const { week, year } = getISOWeekInfo(now);
  const maxWeeks = getWeeksInYear(year);
  const nextWeek = week >= maxWeeks ? 1 : week + 1;
  const nextYear = week >= maxWeeks ? year + 1 : year;
  return `${nextYear}-W${String(nextWeek).padStart(2, '0')}`;
}

// ============================================================================
// CONVENIENCE ALIASES (MAR 19, 2026)
// Required by hooks/customer/useCartOperations.ts
// ============================================================================

/**
 * Get the current order week number.
 * Alias for getInitialOrderWeek() — returns the week number customers should
 * order for (current week if before cutoff, next week otherwise).
 */
export function getCurrentWeek(now?: Date): number {
  return getInitialOrderWeek(now);
}

/**
 * Get the default { week, year } for a new cart.
 * Returns the week number and ISO year customers should order for.
 */
export function getDefaultWeek(now: Date = getNowInVancouver()): { week: number; year: number } {
  const { week: currentWeek, year: isoYear } = getISOWeekInfo(now);
  const maxWeeks = getWeeksInYear(isoYear);

  if (isBeforeThursdayCutoff(now)) {
    return { week: currentWeek, year: isoYear };
  }

  // After Thursday cutoff — check if current week still has open days (e.g. Sat/Sun)
  const currentWeekHasOpenDays = Array.from({ length: 7 }, (_, i) => i).some(dayIndex => {
    const date = getWeekDayDate(currentWeek, dayIndex, isoYear);
    return !isDayLocked(date);
  });

  if (currentWeekHasOpenDays) {
    return { week: currentWeek, year: isoYear };
  }

  // Fully locked → next week
  if (currentWeek >= maxWeeks) {
    return { week: 1, year: isoYear + 1 };
  }
  return { week: currentWeek + 1, year: isoYear };
}

// Re-export getWeeksInYear so callers can import it from this module
export { getWeeksInYear };
