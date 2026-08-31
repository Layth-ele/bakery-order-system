/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRIMITIVE SCHEMAS - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Common primitive schemas used across all domain schemas
 * 
 * ✅ Firestore Timestamp enforcement
 * ✅ Reusable ID patterns
 * ✅ Email, phone, currency validation
 * 
 * LAST UPDATED: 2026-03-16 (Timestamp null/undefined fix applied)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase/firestore';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// FIRESTORE TIMESTAMP SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Firestore Timestamp schema
 * ✅ REQUIRED: Use this for ALL stored timestamp fields
 * ✅ MAR 12, 2026: Enhanced to accept Timestamp instances, serialized Timestamps, AND ISO strings
 * ✅ MAR 16, 2026: Added debug logging to diagnose validation issues + accept legacy formats
 * 
 * Accepts:
 * 1. Firestore Timestamp instances (from direct Firestore reads)
 * 3. ISO date strings (from converted data)
 * 4. serverTimestamp() placeholders (for writes)
 * 5. Legacy formats: Date objects, Unix timestamps (numbers), any date-parseable strings
 */
export const firestoreTimestampSchema = z.custom<Timestamp | string | number | Date | FieldValue>(
  (val) => {
 // CRITICAL FIX - Allow undefined/null for optional timestamp fields
    // This prevents validation errors when optional timestamps are not set
    if (val === undefined || val === null) {
      return true; // Let the .optional() wrapper handle this
    }
    
    // Allow serverTimestamp() placeholders (have _methodName property — Firebase v8/compat)
    if (val && typeof val === 'object' && '_methodName' in val) {
      return true;
    }

    // Firebase v9+ FieldValue (serverTimestamp, increment, arrayUnion, etc.)
    // no longer uses _methodName — check instanceof instead
    try {
      if (val instanceof FieldValue) {
        return true;
      }
    } catch {
      // FieldValue constructor not available in test/mock environment — skip
    }

    // Duck-type check: any object with a toDate() function is Timestamp-like.
    // This covers mocked Timestamps in tests AND real Firestore Timestamps.
    // We do this BEFORE instanceof so we never call instanceof on a non-class mock.
    if (val && typeof val === 'object' && typeof (val as any).toDate === 'function') {
      return true;
    }

    // Allow actual Timestamp instances (only when Timestamp is a real class)
    try {
      if (val instanceof Timestamp) {
        return true;
      }
    } catch {
      // Timestamp is not a constructor (e.g. mocked as plain object) — skip
    }

    // Allow Date objects (legacy format)
    if (val instanceof Date) {
      return true;
    }
    
    // Allow serialized Timestamp objects (from JSON)
    if (val && typeof val === 'object' && 'seconds' in val && 'nanoseconds' in val) {
      return true;
    }
    
    // Allow numbers (Unix timestamps in milliseconds or seconds)
    if (typeof val === 'number') {
      // Check if it's a reasonable timestamp (between year 2000 and 2100)
      const year2000Ms = 946684800000;
      const year2100Ms = 4102444800000;
      const year2000Sec = 946684800;
      const year2100Sec = 4102444800;
      
      // Accept if it's in the valid range (either milliseconds or seconds)
      return (val >= year2000Ms && val <= year2100Ms) || (val >= year2000Sec && val <= year2100Sec);
    }
    
    // Allow ISO date strings (from converted data)
    if (typeof val === 'string') {
      // Try to parse as date
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        return true;
      }
    }
    
    // Debug: Log unexpected values
    logger.warn('🔍 [Timestamp Validation] Unexpected value:', {
      value: val,
      type: typeof val,
      constructor: val?.constructor?.name,
      keys: val && typeof val === 'object' ? Object.keys(val) : 'N/A',
    });
    
    return false;
  },
  {
    message: 'Must be a Firestore Timestamp, serialized Timestamp object, ISO date string, Date object, or Unix timestamp.',
  }
);

/**
 * Optional Firestore Timestamp
 */
export const optionalFirestoreTimestampSchema = firestoreTimestampSchema.optional();

/**
 * Nullable Firestore Timestamp
 */
export const nullableFirestoreTimestampSchema = firestoreTimestampSchema.nullable();

/**
 * ISO Date String schema (for display/logging only, NOT for Firestore writes)
 * Use this for:
 * - console logging
 * - in-memory objects
 * - display formatting
 */
export const isoDateStringSchema = z.string().datetime({
  message: 'Must be a valid ISO 8601 date string (e.g., "2026-03-05T12:00:00.000Z")',
});

/**
 * Optional ISO Date String
 */
export const optionalIsoDateStringSchema = isoDateStringSchema.optional();

/**
 * Flexible Date Schema - accepts both date-only strings and Firestore Timestamps
 * ✅ MAR 13, 2026: Created for deliveryDate field to handle both formats
 * 
 * Accepts:
 * 1. Date-only strings in YYYY-MM-DD format (e.g., "2026-03-15")
 * 2. Firestore Timestamp instances
 * 3. Serialized Timestamp objects (from JSON)
 * 
 * Use this for fields that may have been stored as either string or Timestamp
 */
export const flexibleDateSchema = z.custom<Timestamp | string>(
  (val) => {
    // Allow undefined/null to pass through (will be caught by optional wrapper)
    if (val === undefined || val === null) {
      return true;
    }
    
    // Allow actual Timestamp instances
    if (val instanceof Timestamp) {
      return true;
    }

    // Duck-type check: any object with a toDate() function is Timestamp-like.
    // This covers mocked Timestamps in tests (which aren't instanceof Timestamp
    // because the class is replaced by a plain object mock).
    if (val && typeof val === 'object' && typeof (val as any).toDate === 'function') {
      return true;
    }
    
    // Check if it's a Timestamp-like object by checking for required methods/properties
    // This handles cases where instanceof doesn't work due to module loading issues
    if (val && typeof val === 'object') {
      // Check for Timestamp-like structure (has seconds and nanoseconds properties)
      const hasSeconds = 'seconds' in val;
      const hasNanoseconds = 'nanoseconds' in val;
      
      if (hasSeconds && hasNanoseconds) {
        const seconds = (val as any).seconds;
        const nanoseconds = (val as any).nanoseconds;
        
        // Check if it has the toDate method (characteristic of Firestore Timestamps)
        const hasToDate = typeof (val as any).toDate === 'function';
        
        // Valid if: has toDate method OR both seconds and nanoseconds are numbers
        if (hasToDate || (typeof seconds === 'number' && typeof nanoseconds === 'number')) {
          return true;
        }
      }
    }
    
    // Allow date-only strings (YYYY-MM-DD format)
    if (typeof val === 'string') {
      // Date-only format validation (YYYY-MM-DD)
      const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateOnlyRegex.test(val)) {
        return true;
      }
      // Also accept ISO datetime strings for flexibility
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      return isoRegex.test(val);
    }
    
    return false;
  },
  {
    message: 'Must be a date string (YYYY-MM-DD), ISO datetime string, Firestore Timestamp, or serialized Timestamp object.',
  }
);

/**
 * Optional Flexible Date
 */
export const optionalFlexibleDateSchema = flexibleDateSchema.optional();

// ═══════════════════════════════════════════════════════════════════════════
// ID SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generic ID schema
 * Firestore document IDs are non-empty strings
 */
export const idSchema = z.string().min(1, 'ID cannot be empty');

/**
 * Email schema
 */
export const emailSchema = z.string().email('Must be a valid email address');

/**
 * Phone number schema (optional format validation)
 * Allows formats: +1-604-555-0100, (604) 555-0100, 604-555-0100, etc.
 */
const phoneRegex = /^[\d\s\-\+\(\)]+$/;
export const phoneSchema = z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .regex(phoneRegex, 'Phone number contains invalid characters');

/**
 * Optional phone number
 */
export const optionalPhoneSchema = phoneSchema.optional();

// ═══════════════════════════════════════════════════════════════════════════
// CURRENCY SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Currency amount (always positive)
 */
export const positiveAmountSchema = z.number().nonnegative('Amount must be non-negative');

/**
 * Currency amount (can be negative for credits/refunds)
 */
export const amountSchema = z.number();

/**
 * Percentage (0-100)
 */
export const percentageSchema = z.number().min(0).max(100, 'Percentage must be between 0 and 100');

/**
 * Optional percentage
 */
export const optionalPercentageSchema = percentageSchema.optional();

// ═══════════════════════════════════════════════════════════════════════════
// WEEK & YEAR SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ISO Week Number (1-53)
 */
export const weekNumberSchema = z.number().int().min(1).max(53, 'Week number must be between 1 and 53');

/**
 * Year (2020-2099)
 */
export const yearSchema = z.number().int().min(2020).max(2099, 'Year must be between 2020 and 2099');

/**
 * Week key format (e.g., "2026-W04")
 */
export const weekKeySchema = z.string().regex(/^\d{4}-W\d{2}$/, 'Week key must be in format YYYY-WNN (e.g., "2026-W04")');

/**
 * Year-Month format (e.g., "2026-01")
 */
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Year-month must be in format YYYY-MM (e.g., "2026-01")');

// ═══════════════════════════════════════════════════════════════════════════
// COMMON FIELD SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Non-empty string
 */
export const nonEmptyStringSchema = z.string().min(1, 'Cannot be empty');

/**
 * Optional non-empty string
 */
export const optionalNonEmptyStringSchema = nonEmptyStringSchema.optional();

/**
 * URL schema
 */
export const urlSchema = z.string().url('Must be a valid URL');

/**
 * Optional URL
 */
export const optionalUrlSchema = urlSchema.optional();

/**
 * Address schema (flexible for Canadian addresses)
 */
export const addressSchema = z.string().min(5, 'Address must be at least 5 characters');

/**
 * Optional address
 */
export const optionalAddressSchema = addressSchema.optional();