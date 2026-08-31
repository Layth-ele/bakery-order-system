/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PARSE HELPERS - Runtime Validation with Great Error Messages
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 
 * ✅ parseOrThrow() - Validate and throw on error
 * ✅ parseSafe() - Validate and return result object
 * ✅ Great error messages for debugging
 * ✅ Automatic Timestamp → Date conversion
 * 
 * LAST UPDATED: 2026-03-13
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// ERROR FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format Zod errors into a readable error message
 */
function formatZodErrors(errors: z.ZodError): string {
  return errors.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `[${issue.path.join('.')}]` : '[root]';
      return `  • ${path}: ${issue.message}`;
    })
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSE OR THROW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse data and throw on validation error
 * 
 * @example
 * ```ts
 * const order = parseOrThrow(orderSchema, rawData, 'Order');
 * ```
 * 
 * @param schema - Zod schema to validate against
 * @param data - Raw data to validate
 * @param entityName - Name of entity for error messages (e.g., "Order", "Customer")
 * @returns Validated data
 * @throws {Error} If validation fails
 */
export function parseOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  entityName: string = 'Data'
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = formatZodErrors(error);
      throw new Error(
        `❌ ${entityName} validation failed:\n${formattedErrors}\n\n` +
        `Raw data: ${JSON.stringify(data, null, 2)}`
      );
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSE SAFE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse data and return result object (doesn't throw)
 * 
 * @example
 * ```ts
 * const result = parseSafe(orderSchema, rawData);
 * if (!result.success) {
 *   console.error(result.error);
 *   return null;
 * }
 * const order = result.data;
 * ```
 * 
 * @param schema - Zod schema to validate against
 * @param data - Raw data to validate
 * @returns { success: true, data: T } | { success: false, error: string }
 */
export function parseSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    const formattedErrors = formatZodErrors(result.error);
    return {
      success: false,
      error: `Validation failed:\n${formattedErrors}`,
    };
  } catch (error) {
 // Catch crashes DURING validation (e.g., Object.keys on null)
    console.error('🔥 [parseSafe] Unexpected error during validation:', error);
    console.error('🔥 [parseSafe] Data that caused crash:', JSON.stringify(data, null, 2));
    return {
      success: false,
      error: `Validation crashed: ${error instanceof Error ? (error as any).message : String(error)}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRESTORE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert Firestore Timestamp to Date
 * 
 * @param timestamp - Firestore Timestamp
 * @returns JavaScript Date object
 */
export function timestampToDate(timestamp: Timestamp): Date {
  return timestamp.toDate();
}

/**
 * Convert Firestore Timestamp to ISO string
 * 
 * @param timestamp - Firestore Timestamp
 * @returns ISO 8601 date string
 */
export function timestampToISOString(timestamp: Timestamp): string {
  return timestamp.toDate().toISOString();
}

/**
 * Parse Firestore document and convert timestamps to ISO strings
 * Useful for displaying data in UI or logging
 * 
 * @example
 * ```ts
 * const order = parseFirestoreDoc(orderSchema, docData, 'Order');
 * logger.log(order.createdAt); // ISO string instead of Timestamp
 * ```
 * 
 * @param schema - Zod schema to validate against
 * @param data - Raw Firestore document data
 * @param entityName - Name of entity for error messages
 * @returns Validated data with Timestamps converted to ISO strings
 */
export function parseFirestoreDoc<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  entityName: string = 'Document'
): T {
  // First validate the raw data
  const validated = parseOrThrow(schema, data, entityName);
  
  // Then convert all Timestamp fields to ISO strings for display
  // This is a deep conversion that handles nested objects
  return convertTimestampsToISO(validated) as T;
}

/**
 * Recursively convert all Firestore Timestamps to ISO strings
 * 
 * @param obj - Object to convert
 * @returns Object with Timestamps converted to ISO strings
 */
function convertTimestampsToISO(obj: any): any {
  if (obj instanceof Timestamp) {
    return obj.toDate().toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertTimestampsToISO);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertTimestampsToISO(obj[key]);
    }
    return result;
  }
  
  return obj;
}

// ═══════════════════════════════════════════════════════════════════════════
// ARRAY PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse array of items with individual error handling
 * 
 * @example
 * ```ts
 * const orders = parseArray(orderSchema, rawOrders, 'Order');
 * ```
 * 
 * @param schema - Zod schema for individual items
 * @param data - Array of raw data
 * @param entityName - Name of entity for error messages
 * @returns Array of validated items
 * @throws {Error} If any item fails validation
 */
export function parseArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown[],
  entityName: string = 'Item'
): T[] {
  const arraySchema = z.array(schema);
  return parseOrThrow(arraySchema, data, `${entityName}[]`);
}

/**
 * Parse array of items and skip invalid items (with warnings)
 * Useful for handling partial data corruption
 * 
 * @example
 * ```ts
 * const orders = parseArrayPartial(orderSchema, rawOrders, 'Order');
 * // Returns only valid orders, logs errors for invalid ones
 * ```
 * 
 * @param schema - Zod schema for individual items
 * @param data - Array of raw data
 * @param entityName - Name of entity for error messages
 * @returns Array of validated items (invalid items are skipped)
 */
export function parseArrayPartial<T>(
  schema: z.ZodSchema<T>,
  data: unknown[],
  entityName: string = 'Item'
): T[] {
  const results: T[] = [];
  
  data.forEach((item, index) => {
    const result = parseSafe(schema, item);
    if (result.success) {
      results.push(result.data);
    } else {
      // ✅ Enhanced logging to show which item is failing
      const itemId = (item as any)?.id || `index ${index}`;
      
      // Extract the actual validation error details
      const errorMessage = 'error' in result ? result.error : 'Unknown validation error';
      
      logger.warn(
        `⚠️ ${entityName} ${itemId} failed validation, skipping\n${errorMessage}`
      );
    }
  });
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if value matches schema (type guard)
 * 
 * @example
 * ```ts
 * if (isValid(orderSchema, data)) {
 *   // TypeScript knows data is Order here
 *   logger.log(data.id);
 * }
 * ```
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to check
 * @returns true if data matches schema
 */
export function isValid<T>(schema: z.ZodSchema<T>, data: unknown): data is T {
  return schema.safeParse(data).success;
}