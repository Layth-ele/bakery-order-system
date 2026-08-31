import {getNowInVancouver} from './timezone';
import { isDayLocked } from './time/vancouverCutoff';

// FIX M2: Both branches of the ternary previously returned `new Date().getDay()`
// (the browser's local day-of-week), so the `timezone` argument was completely
// ignored. The fix uses Intl.DateTimeFormat to obtain the numeric weekday in the
// requested timezone: 0=Sunday … 6=Saturday, matching Date.getDay() convention.
function getWeekdayInTimeZone(timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone,
  }).formatToParts(new Date());
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? '';
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[weekdayStr] ?? new Date().getDay();
}
/**
 * Week Schedule Utilities
 * 
 * ✅ ARCHITECTURAL FIX: All week/time logic centralized here
 * 
 * LAYER SEPARATION:
 * - utils/weekUtils.ts → Owns ALL week/date business logic
 * - utils/timezone.ts → Owns timezone conversions
 * - data/initialData.ts → PURE DATA ONLY, no exports of utility functions
 * 
 * This file is the SINGLE SOURCE OF TRUTH for:
 * - ISO-8601 week calculations
 * - Week range formatting
 * - 48-hour delivery cutoff logic
 * - Week availability/disability checks
 * - Year transition handling
 * 
 * ✅ REFACTORING COMPLETE: Eliminated duplicated week logic
 * 
 * CANONICAL WEEK ENGINE:
 * - getISOWeekInfo(date) → Calculate ISO week from date
 * - getWeekInfoByNumber(weekNumber, year) → Get week dates from week number
 * 
 * ALL OTHER FUNCTIONS DELEGATE TO THESE TWO:
 * - getWeekRange() → uses getWeekInfoByNumber()
 * - getWeekStartDate() → uses getWeekInfoByNumber()
 * - getWeekDayDate() → uses getWeekInfoByNumber()
 * - isDayWithin48Hours() → uses getWeekDayDate() → uses getWeekInfoByNumber()
 * - areAllDaysDisabled() → uses isDayWithin48Hours()
 * - shouldShowWeekendWarning() → uses areAllDaysDisabled()
 * 
 * ✅ CRITICAL ARCHITECTURAL PRINCIPLE: NO YEAR AUTO-DETECTION IN UTILITIES
 * 
 * WHY:
 * - Utilities must be PURE and DETERMINISTIC
 * - Same inputs must ALWAYS produce same outputs
 * - Year auto-detection creates non-deterministic behavior
 * - Silent bugs in invoice generation and admin exports
 * 
 * RULE:
 * - Year parameter is REQUIRED (not optional) in all utility functions
 * - Year resolution happens ONCE in UI/selector layer
 * - Utilities accept (weekNumber, year) and trust the caller
 * 
 * This ensures:
 * ✅ No duplicated week calculation logic
 * ✅ No hidden year auto-detection logic
 * ✅ Bug fixes apply to ALL functions
 * ✅ Consistent behavior across the entire app
 * ✅ Deterministic, testable utilities
 * ✅ Single place to update if ISO-8601 logic needs changes
 */


// ============================================================================
// ✅ CANONICAL ISO-8601 WEEK CALCULATION (SINGLE SOURCE OF TRUTH)
// ============================================================================
// Used across the entire app for consistency:
// - Order creation (customer & admin)
// - Invoice generation
// - Invoice search filters
// - Admin history
// - Production planning
// - Dashboard widgets
// ============================================================================

/**
 * Get ISO-8601 week information for a given date
 * 
 * ISO-8601 Week Rules:
 * - Week 1 is the week with the first Thursday of the year
 * - Weeks start on Monday, end on Sunday
 * - Week year can differ from calendar year:
 *   - Dec 29-31 might be Week 1 of next year
 *   - Jan 1-3 might be Week 52/53 of previous year
 * - A year has 52 or 53 weeks (long year if Jan 1 is Thursday OR leap year + Jan 1 is Wednesday)
 * 
 * @param date - Date to calculate week for (defaults to today in Vancouver time)
 * @returns ISO week data with week number, year, start/end dates, weekKey
 */
export function getISOWeekInfo(date: Date = getNowInVancouver()): {
  week: number;
  year: number;
  weekStart: Date;
  weekEnd: Date;
  weekKey: string;
} {
  // Create a copy to avoid mutating the original date
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  
  // Get day of week (1=Monday, 7=Sunday)
  const dayNum = d.getUTCDay() || 7;
  
  // Set to Thursday of this week (used to determine the year)
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  
  // Get ISO year (might differ from calendar year)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const isoYear = d.getUTCFullYear();
  
  // Calculate week start (Monday) and end (Sunday)
  const weekStart = new Date(d);
  weekStart.setUTCDate(d.getUTCDate() - 3); // Thursday - 3 = Monday
  
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6); // Monday + 6 = Sunday
  
  // Convert back to local time zone
  const weekStartLocal = new Date(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate());
  const weekEndLocal = new Date(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate());
  
  // Generate weekKey in canonical format
  const weekKey = `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
  
  return {
    week: weekNumber,
    year: isoYear,
    weekStart: weekStartLocal,
    weekEnd: weekEndLocal,
    weekKey,
  };
}

/**
 * Get current ISO week number (legacy function for backwards compatibility)
 * ⚠️ DEPRECATED: Use getISOWeekInfo() instead for full week data
 * 
 * @returns Current ISO week number (1-53)
 */
export function getCurrentWeekNumber(): number {
  return getISOWeekInfo().week;
}

/**
 * Get current year in Vancouver timezone
 */
export function getCurrentYear(): number {
  return getNowInVancouver().getFullYear();
}

/**
 * Get ISO week info for a specific week number and year
 * 
 * @param weekNumber - ISO week number (1-53)
 * @param year - ISO year
 * @returns ISO week data with start/end dates, weekKey
 */
export function getWeekInfoByNumber(weekNumber: number, year: number): {
  week: number;
  year: number;
  weekStart: Date;
  weekEnd: Date;
  weekKey: string;
} {
  // Get January 4th of the year (always in week 1 by ISO-8601 definition)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  
  // Get the Monday of week 1
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  
  // Calculate the Monday of the requested week
  const weekStart = new Date(week1Monday);
  weekStart.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  
  // Convert to local time
  const weekStartLocal = new Date(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate());
  const weekEndLocal = new Date(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate());
  
  const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
  
  return {
    week: weekNumber,
    year,
    weekStart: weekStartLocal,
    weekEnd: weekEndLocal,
    weekKey,
  };
}

/**
 * Check if a year is a leap year
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get total weeks in a year according to ISO 8601
 * A year has 53 weeks if:
 * 1. It ends on a Thursday (Dec 31 is Thursday), OR
 * 2. It's a leap year AND it ends on a Friday (Dec 31 is Friday)
 */
export function getWeeksInYear(year: number): number {
  const dec31 = new Date(year, 11, 31);
  const dec31Day = dec31.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // Convert to ISO day (1=Monday, 7=Sunday)
  const isoDay = dec31Day === 0 ? 7 : dec31Day;
  
  // Year has 53 weeks if it ends on Thursday (4) OR if it's a leap year ending on Friday (5)
  if (isoDay === 4 || (isLeapYear(year) && isoDay === 5)) {
    return 53;
  }
  
  return 52;
}

/**
 * Check if we're in the final weeks of the year (last 4 weeks)
 * ✅ USES ISO WEEK INFO: Correct for year boundaries
 */
export function isNearYearEnd(): boolean {
  const { week: currentWeek, year: currentYear } = getISOWeekInfo();
  const totalWeeks = getWeeksInYear(currentYear);
  return currentWeek >= totalWeeks - 3; // Last 4 weeks
}

/**
 * Resolve the correct ISO year for a given week number
 * ✅ CRITICAL FIX: Handles New Year edge cases correctly
 * 
 * ISO-8601 weeks don't always match calendar year:
 * - Dec 29-31 might be Week 1 of NEXT year
 * - Jan 1-3 might be Week 52/53 of PREVIOUS year
 * 
 * @param selectedWeek - The week number being selected
 * @param currentWeek - Current ISO week number
 * @param currentYear - Current ISO year
 * @param weeksInYear - Total weeks in the current year (52 or 53)
 * @returns The correct ISO year for the selected week
 */
export function resolveWeekYear(
  selectedWeek: number,
  currentWeek: number,
  currentYear: number,
  weeksInYear: number
): number {
  // If we're at end of year (week 50+) and selecting week 1-6, it's next year
  if (currentWeek >= weeksInYear - 2 && selectedWeek <= 6) {
    return currentYear + 1;
  }
  
  // If we're at start of year (week 1-3) and selecting week 47+, it's previous year
  if (currentWeek <= 3 && selectedWeek >= weeksInYear - 5) {
    return currentYear - 1;
  }
  
  return currentYear;
}

/**
 * Resolve week and year with normalization
 * Returns both the normalized week number and resolved year
 * 
 * @param weekNumber - Week number to resolve
 * @param year - Year for the week
 * @returns Object with normalizedWeek and resolvedYear
 */
export function resolveWeekYearNormalized(
  weekNumber: number,
  year: number
): { normalizedWeek: number; resolvedYear: number } {
  const weeksInYear = getWeeksInYear(year);
  
  // Normalize week number to valid range
  let normalizedWeek = weekNumber;
  let resolvedYear = year;
  
  // Handle week overflow (e.g., week 54 → week 1 of next year)
  if (weekNumber > weeksInYear) {
    normalizedWeek = weekNumber - weeksInYear;
    resolvedYear = year + 1;
  }
  
  // Handle week underflow (e.g., week 0 → week 52/53 of previous year)
  if (weekNumber < 1) {
    const weeksInPrevYear = getWeeksInYear(year - 1);
    normalizedWeek = weeksInPrevYear + weekNumber;
    resolvedYear = year - 1;
  }
  
  return { normalizedWeek, resolvedYear };
}

/**
 * Check if a week/year combination is in the past
 * ✅ USES ISO WEEK INFO: Correct for year boundaries
 *
 * FIX R10-S6-F78 (HIGH): Was `return week <= currentWeek` — current week was
 * classified as past, so customers couldn't order for "this week" even when
 * the daily cutoffs hadn't been hit. The current week is NOT in the past.
 */
export function isWeekInPast(week: number, year: number): boolean {
  const { week: currentWeek, year: currentYear } = getISOWeekInfo();
  
  if (year < currentYear) return true;
  if (year > currentYear) return false;
  return week < currentWeek;
}

/**
 * Get week date range formatted as "Mon DD - Sun DD, Month YYYY"
 * Example: "Mon 6 - Sun 12, Jan 2026"
 * 
 * ✅ PURE UTILITY: Year is REQUIRED (no auto-detection)
 * Year resolution must happen in UI/selector layer, not utilities
 * 
 * @param weekNumber - ISO week number
 * @param year - ISO year (REQUIRED - caller must resolve year)
 * @returns Formatted week range string
 */
export function getWeekRange(weekNumber: number, year: number): string {
  const { weekStart, weekEnd } = getWeekInfoByNumber(weekNumber, year);
  
  // Format the range
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const month = months[weekEnd.getMonth()];
  const displayYear = weekEnd.getFullYear();
  
  return `Mon ${startDay} - Sun ${endDay}, ${month} ${displayYear}`;
}

/**
 * Get the start date (Monday) of a given week
 * 
 * ✅ PURE UTILITY: Year is REQUIRED (no auto-detection)
 * Year resolution must happen in UI/selector layer, not utilities
 * 
 * @param weekNumber - ISO week number
 * @param year - ISO year (REQUIRED - caller must resolve year)
 * @returns Date object representing the Monday of that week
 */
export function getWeekStartDate(weekNumber: number, year: number): Date {
  const { weekStart } = getWeekInfoByNumber(weekNumber, year);
  return weekStart;
}

/**
 * Get specific day date for a week
 * 
 * ✅ PURE UTILITY: Year is REQUIRED (no auto-detection)
 * Year resolution must happen in UI/selector layer, not utilities
 * 
 * @param weekNumber - ISO week number
 * @param dayOfWeek - Day index (0=Monday, 1=Tuesday, ..., 6=Sunday) OR day name string
 * @param year - ISO year (REQUIRED - caller must resolve year)
 * @returns Date object for that specific day
 */
export function getWeekDayDate(weekNumber: number, dayOfWeek: number | string, year: number): Date {
  // Convert day name to index if needed
  let dayIndex: number;
  if (typeof dayOfWeek === 'string') {
    const dayMap: Record<string, number> = {
      'monday': 0,
      'tuesday': 1,
      'wednesday': 2,
      'thursday': 3,
      'friday': 4,
      'saturday': 5,
      'sunday': 6
    };
    dayIndex = dayMap[dayOfWeek.toLowerCase()] ?? 0;
  } else {
    dayIndex = dayOfWeek;
  }
  
  // Get week start and add day offset
  const { weekStart } = getWeekInfoByNumber(weekNumber, year);
  const targetDate = new Date(weekStart);
  targetDate.setDate(weekStart.getDate() + dayIndex);
  
  return targetDate;
}

/**
 * Format date as MM/DD
 */
export function formatShortDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * Check if a specific day is within 48 hours from now
 * ✅ USES VANCOUVER TIMEZONE - Business rules always apply in America/Vancouver
 * ✅ PURE UTILITY: Year is REQUIRED (no auto-detection)
 * 
 * Business Rule: Orders must be placed 48 hours (2 days) before delivery
 * Cutoff time: 12:00 PM (noon) Vancouver time, 2 days before delivery
 * 
 * Example: Friday delivery → Wednesday 12pm Vancouver time cutoff
 * 
 * @param weekNumber - ISO week number
 * @param dayOfWeek - Day index (0=Monday, 1=Tuesday, ..., 6=Sunday) OR day name string
 * @param year - ISO year (REQUIRED - caller must resolve year)
 * @returns true if the day is within 48 hours from now (past the cutoff)
 */
export function isDayWithin48Hours(weekNumber: number, dayOfWeek: number | string, year: number): boolean {
  // Get the delivery day date
  const deliveryDate = getWeekDayDate(weekNumber, dayOfWeek, year);
  
  // ✅ REFACTORED (Feb 9, 2026): Use canonical isDayLocked() from vancouverCutoff.ts
  // ✅ ELIMINATES: Duplicated cutoff calculation logic (was lines 410-420)
  // ✅ SAFETY: DST-safe, single source of truth, impossible to drift
  // ✅ BEFORE: Used .setDate() and .setHours() (NOT DST-safe)
  // ✅ AFTER: Delegates to date-fns-based implementation (DST-safe)
  return isDayLocked(deliveryDate);
}

/**
 * Calculate if a week is disabled based on 48-hour cutoff rule
 * A week is disabled if ALL its days are past the cutoff
 */
export function areAllDaysDisabled(weekNumber: number, currentYear: number): boolean {
  const days = [0, 1, 2, 3, 4, 5, 6]; // Monday through Sunday
  
  return days.every((dayIndex) => isDayWithin48Hours(weekNumber, dayIndex, currentYear));
}

// ============================================================================
// WEEK AVAILABILITY & SELECTION LOGIC
// ============================================================================

export interface WeekInfo {
  weekNumber: number;
  year: number;
  weekRange: string;
  isDisabled: boolean;
  isCurrent: boolean;
  isNext: boolean;
  isRecommended: boolean;
}

/**
 * Calculate if a specific week is disabled for ordering
 *
 * FIX R10-S6-F79 (HIGH): Was missing `weekYear` parameter. Comparing only
 * `weekNumber < currentWeek` meant "Week 1" of next year (legitimate near-future)
 * was classified as disabled because `1 < 50` (current week of this year).
 * Now compares year-week tuples lexicographically.
 *
 * Also: default maxWeeksAhead now reads from BUSINESS_RULES (was hardcoded 4
 * while BUSINESS_RULES.MAX_WEEKS_AHEAD = 10 — inconsistent).
 *
 * The `weekYear` parameter is OPTIONAL with a fallback to currentYear so
 * existing callers that haven't been updated still compile, but they will
 * see same-year-only behavior (the previous broken behavior).  New callers
 * should always pass weekYear.
 */
export function isWeekDisabled(
  weekNumber: number,
  currentWeek: number,
  currentYear: number,
  maxWeeksAhead: number = 10,
  weekYear: number = currentYear
): boolean {
  // Convert (year, week) to a single comparable integer: year*100 + week
  // Works because no year has > 53 ISO weeks; 100 is a safe multiplier.
  const target = weekYear * 100 + weekNumber;
  const current = currentYear * 100 + currentWeek;

  // Disable past weeks
  if (target < current) return true;

  // Disable weeks too far in the future
  if (target > current + maxWeeksAhead) return true;

  return false;
}

/**
 * Get safe week range (handles errors gracefully)
 */
export function getSafeWeekRange(weekNumber: number, year: number): string {
  try {
    return getWeekRange(weekNumber, year);
  } catch (error) {
    console.error(`Error getting week range for Week ${weekNumber}, ${year}:`, error);
    return `Week ${weekNumber}, ${year}`;
  }
}

/**
 * Get year for a given week number (handles year wrap-around)
 * ✅ CRITICAL FIX: Now uses resolveWeekYear for ISO-correct handling
 * 
 * @deprecated Use resolveWeekYear() instead for better edge case handling
 */
export function getYearForWeek(weekNumber: number, currentWeek: number, currentYear: number): number {
  const totalWeeksThisYear = getWeeksInYear(currentYear);
  return resolveWeekYear(weekNumber, currentWeek, currentYear, totalWeeksThisYear);
}

/**
 * Calculate recommended week for ordering
 * Returns the next available week if current week is disabled
 */
export function getRecommendedWeek(currentWeek: number, currentYear: number): {
  weekNumber: number;
  year: number;
} {
  const totalWeeksThisYear = getWeeksInYear(currentYear);
  const allDaysDisabled = areAllDaysDisabled(currentWeek, currentYear);
  
  if (allDaysDisabled) {
    // Recommend next week
    const nextWeek = currentWeek >= totalWeeksThisYear ? 1 : currentWeek + 1;
    const nextYear = currentWeek >= totalWeeksThisYear ? currentYear + 1 : currentYear;
    return { weekNumber: nextWeek, year: nextYear };
  }
  
  // Current week is fine
  return { weekNumber: currentWeek, year: currentYear };
}

/**
 * Generate list of available weeks for selection
 * Memoization-friendly: returns consistent array structure
 */
export function getAvailableWeeks(
  currentWeek: number,
  currentYear: number,
  maxWeeksAhead: number = 4
): WeekInfo[] {
  const totalWeeksThisYear = getWeeksInYear(currentYear);
  const weeks: WeekInfo[] = [];
  const recommended = getRecommendedWeek(currentWeek, currentYear);
  
  // Generate weeks from current week to maxWeeksAhead
  for (let i = 0; i <= maxWeeksAhead; i++) {
    let weekNumber = currentWeek + i;
    let year = currentYear;
    
    // Handle year wrap-around
    if (weekNumber > totalWeeksThisYear) {
      weekNumber = weekNumber - totalWeeksThisYear;
      year = currentYear + 1;
    }
    
    const isDisabled = isWeekDisabled(weekNumber, currentWeek, currentYear, maxWeeksAhead);
    const isCurrent = weekNumber === currentWeek && year === currentYear;
    const isNext = weekNumber === (currentWeek >= totalWeeksThisYear ? 1 : currentWeek + 1);
    const isRecommended = weekNumber === recommended.weekNumber && year === recommended.year;
    
    weeks.push({
      weekNumber,
      year,
      weekRange: getSafeWeekRange(weekNumber, year),
      isDisabled,
      isCurrent,
      isNext,
      isRecommended
    });
  }
  
  return weeks;
}

/**
 * Check if currently in weekend (Saturday or Sunday) in Vancouver timezone
 * ✅ FIXED: Now uses Vancouver timezone instead of device timezone
 */
export function isWeekend(): boolean {
  const day = getWeekdayInTimeZone('America/Vancouver');
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if should show weekend warning
 * ✅ CRITICAL FIX: Now uses complete Vancouver-timezone logic
 * 
 * Business Rule: Show warning when:
 * 1. It's weekend in Vancouver (Saturday or Sunday)
 * 2. ALL days in the current week are past the 48-hour cutoff
 * 
 * This prevents showing the warning incorrectly when:
 * - User is in different timezone but it's not weekend in Vancouver
 * - Some days are still available (not all past cutoff)
 * 
 * @param currentWeek - Current ISO week number
 * @param currentYear - Current year
 * @returns true if weekend warning should be shown
 */
export function shouldShowWeekendWarning(
  currentWeek: number,
  currentYear: number
): boolean {
  // ✅ Step 1: Check if it's weekend in Vancouver timezone
  if (!isWeekend()) {
    return false;
  }

  // ✅ Step 2: Check if ALL days in current week are past 48-hour cutoff
  // Get the week's start date
  const weekStart = getWeekStartDate(currentWeek, currentYear);
  
  // Check each day (Monday through Sunday)
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + dayOffset);
    
    // If ANY day is still available (not past cutoff), don't show warning
    if (!isDayWithin48Hours(currentWeek, dayOffset, currentYear)) {
      return false;
    }
  }

  // ✅ All conditions met: Weekend + All days disabled
  return true;
}