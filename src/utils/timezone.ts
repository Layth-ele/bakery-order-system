/**
 * 🌎 TIMEZONE UTILITIES - SINGLE SOURCE OF TRUTH
 * 
 * ✅ ARCHITECTURAL FIX: All timezone logic centralized in ONE file
 * 
 * IMPORTANT: This is the ONLY file that should contain timezone conversion logic.
 * All business logic (48h cutoffs, week calculations, order deadlines) must use Vancouver time.
 * This ensures consistent behavior regardless of where the user's device is located.
 * 
 * Vancouver Timezone:
 * - PST (Pacific Standard Time): UTC-8 (early November - mid March)
 * - PDT (Pacific Daylight Time): UTC-7 (mid March - early November)
 * - Observes DST transitions
 * 
 * LAYER SEPARATION:
 * - utils/timezone.ts → Owns ALL timezone conversions (THIS FILE)
 * - utils/weekUtils.ts → Uses timezone.ts for Vancouver time
 * - timezoneUtils.ts → DEPRECATED (merged into this file)
 */

const VANCOUVER_TIMEZONE = 'America/Vancouver';

// ============================================================================
// CORE VANCOUVER TIMEZONE FUNCTIONS
// ============================================================================

/**
 * Get current date/time in Vancouver timezone
 * ✅ CANONICAL: This is the primary "now" function for all business logic
 * 
 * Returns a proper Date object representing Vancouver wall time.
 * DST-safe and works regardless of user's device timezone.
 * 
 * @returns Date object representing the current moment in Vancouver
 */
export function getNowInVancouver(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VANCOUVER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);

  // Return as local date so .getTime() comparisons work correctly
  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );
}

/**
 * Get today's date in Vancouver (midnight)
 * 
 * @returns Date object for today at 00:00:00 in Vancouver
 */
export function getTodayInVancouver(): Date {
  const now = getNowInVancouver();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Get the current day of the week in Vancouver timezone
 * 
 * @param date - Optional date to get weekday for (defaults to now)
 * @returns Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export function getWeekdayInVancouver(date?: Date): number {
  try {
    const targetDate = date || new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: VANCOUVER_TIMEZONE,
      weekday: 'short'
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const dayName = formatter.format(targetDate);
    
    const dayMap: { [key: string]: number } = {
      'Sun': 0,
      'Mon': 1,
      'Tue': 2,
      'Wed': 3,
      'Thu': 4,
      'Fri': 5,
      'Sat': 6
    };
    
    return dayMap[dayName] ?? 0;
  } catch (error) {
    console.error('Error getting weekday in Vancouver timezone:', error);
    return new Date().getDay(); // Fallback to local time
  }
}

/**
 * Get the current hour in Vancouver timezone (0-23)
 * ✅ TIMEZONE-SAFE: Uses Intl API to extract hour in Vancouver time
 * 
 * @param date - Optional date to get hour for (defaults to now)
 * @returns Hour of day (0-23)
 */
export function getHourInVancouver(date?: Date): number {
  try {
    const targetDate = date || new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: VANCOUVER_TIMEZONE,
      hour: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(targetDate);
    const hourPart = parts.find(p => p.type === 'hour');
    
    return hourPart ? parseInt(hourPart.value, 10) : 0;
  } catch (error) {
    console.error('Error getting hour in Vancouver timezone:', error);
    return new Date().getHours(); // Fallback to local time
  }
}

/**
 * Get the current day of the week in a specific timezone
 * ✅ BACKWARD COMPATIBLE: Kept for generic timezone support
 * 
 * @param timezone - IANA timezone string (e.g., "America/Vancouver")
 * @returns Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export function getWeekdayInTimeZone(timezone: string): number {
  if (timezone === VANCOUVER_TIMEZONE) {
    return getWeekdayInVancouver();
  }
  
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'short'
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const dayName = formatter.format(now);
    
    const dayMap: { [key: string]: number } = {
      'Sun': 0,
      'Mon': 1,
      'Tue': 2,
      'Wed': 3,
      'Thu': 4,
      'Fri': 5,
      'Sat': 6
    };
    
    return dayMap[dayName] ?? 0;
  } catch (error) {
    console.error('Error getting weekday in timezone:', error);
    return new Date().getDay(); // Fallback to local time
  }
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert any Date to the equivalent date/time in Vancouver
 * 
 * @param date - Date to convert
 * @returns Date object representing the same moment in Vancouver timezone
 */
export function toVancouverTime(date: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: VANCOUVER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const vancouverComponents = parts.reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {} as Record<string, string>);
  
  return new Date(
    parseInt(vancouverComponents.year),
    parseInt(vancouverComponents.month) - 1,
    parseInt(vancouverComponents.day),
    parseInt(vancouverComponents.hour),
    parseInt(vancouverComponents.minute),
    parseInt(vancouverComponents.second)
  );
}

/**
 * Get the current date/time in a specific timezone
 * ✅ BACKWARD COMPATIBLE: Kept for generic timezone support
 * 
 * @param timezone - IANA timezone string (e.g., "America/Vancouver")
 * @returns Date object representing the current time in that timezone
 */
export function getDateInTimeZone(timezone: string): Date {
  if (timezone === VANCOUVER_TIMEZONE) {
    return getNowInVancouver();
  }
  
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    
    const values: { [key: string]: string } = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        values[part.type] = part.value;
      }
    });
    
    return new Date(
      parseInt(values.year),
      parseInt(values.month) - 1,
      parseInt(values.day),
      parseInt(values.hour),
      parseInt(values.minute),
      parseInt(values.second)
    );
  } catch (error) {
    console.error('Error getting date in timezone:', error);
    return new Date(); // Fallback to local time
  }
}

// ============================================================================
// CREATION & MANIPULATION FUNCTIONS
// ============================================================================

/**
 * Create a Date at a specific time in Vancouver
 * 
 * @param year - Year
 * @param month - Month (0-11, same as Date constructor)
 * @param day - Day of month
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @param second - Second (0-59)
 * @returns Date object representing that specific time in Vancouver
 */
export function createVancouverDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  // Create date as if it were in local timezone
  const localDate = new Date(year, month, day, hour, minute, second);
  
  // Format it in Vancouver timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: VANCOUVER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const vancouverStr = formatter.format(localDate);
  
  // Parse it back (this gives us the UTC equivalent)
  // We need to adjust for the offset difference
  const utcDate = new Date(localDate.toISOString());
  
  // Get the offset for Vancouver at this date
  const offsetMinutes = getVancouverOffset(localDate);
  
  // Adjust the date by the offset difference
  const adjustedDate = new Date(year, month, day, hour, minute, second);
  adjustedDate.setMinutes(adjustedDate.getMinutes() - adjustedDate.getTimezoneOffset() + offsetMinutes);
  
  return adjustedDate;
}

/**
 * Get Vancouver timezone offset in minutes for a given date
 * Accounts for PST/PDT transitions
 * 
 * @param date - Date to get offset for
 * @returns Offset in minutes (negative for west of UTC)
 */
function getVancouverOffset(date: Date): number {
  // Create a formatter that includes timezone offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: VANCOUVER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
  
  const formatted = formatter.format(date);
  
  // Extract timezone abbreviation (PST or PDT)
  if (formatted.includes('PDT')) {
    return -420; // UTC-7 = -420 minutes
  } else {
    return -480; // UTC-8 = -480 minutes (PST)
  }
}

// ============================================================================
// ISO WEEK UTILITIES
// ============================================================================

/**
 * Get the current ISO week number in Vancouver timezone
 * 
 * @returns { week: number, year: number }
 */
export function getCurrentWeekNumberVancouver(): { week: number; year: number } {
  const now = getNowInVancouver();
  
  // Use ISO-8601 week calculation
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return {
    week: weekNumber,
    year: d.getUTCFullYear()
  };
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format a Date as Vancouver local time string
 * 
 * @param date - Date to format
 * @returns Formatted string in Vancouver timezone
 */
export function formatVancouverTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: VANCOUVER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Format a date in a specific timezone
 * ✅ BACKWARD COMPATIBLE: Kept for generic timezone support
 * 
 * @param date - Date to format
 * @param timezone - IANA timezone string
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDateInTimeZone(
  date: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (timezone === VANCOUVER_TIMEZONE && !options) {
    return formatVancouverTime(date);
  }
  
  try {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };
    
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  } catch (error) {
    console.error('Error formatting date in timezone:', error);
    return date.toLocaleDateString();
  }
}

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Check if two dates are the same day in Vancouver timezone
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if both dates are on the same Vancouver calendar day
 */
export function isSameDayVancouver(date1: Date, date2: Date): boolean {
  const d1 = toVancouverTime(date1);
  const d2 = toVancouverTime(date2);
  
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}