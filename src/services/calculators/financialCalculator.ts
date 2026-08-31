/**
 * Financial Calculator - Money & Currency Operations
 * 
 * ✅ CLEAN ARCHITECTURE: Pure functions with no side effects
 * - Money rounding with proper precision
 * - Currency formatting
 * - GST calculations
 * 
 * ✅ MIGRATED MARCH 7, 2026 from /utils/money.ts
 */

/**
 * Convert any value to a properly formatted money amount
 * Rounds to 2 decimal places and returns 0 for invalid inputs
 * 
 * @param n - The value to convert to money
 * @returns A number rounded to 2 decimal places, or 0 if invalid
 * 
 * @example
 * money(10.567) // => 10.57
 * money("15.99") // => 15.99
 * money(null) // => 0
 * money(undefined) // => 0
 * money("invalid") // => 0
 */
export function money(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  // Add a tiny epsilon in the direction of rounding to avoid IEEE 754 half-value issues
  // e.g. money(10.565) = 10.57, money(-0.005) = -0.01
  const eps = Number.EPSILON * Math.sign(x || 1);
  return Math.round((x + eps) * 100) / 100;
}

/**
 * Format a number as currency with dollar sign
 * Simple version that just adds $ and formats to 2 decimals
 * 
 * @param amount - The amount to format
 * @param includeSign - Whether to include the $ sign (default: true)
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrencySimple(123.45) // => "$123.45"
 * formatCurrencySimple(123.45, false) // => "123.45"
 */
export function formatCurrencySimple(amount: number, includeSign: boolean = true): string {
  const rounded = money(amount);
  const formatted = rounded.toFixed(2);
  
  if (includeSign) {
    return `$${formatted}`;
  }
  return formatted;
}

/**
 * Calculate GST (5%) from a total amount
 * Splits a total amount (that includes GST) back into subtotal and GST
 * 
 * @param total - The total amount including GST
 * @returns Object with subtotal and GST amount
 * 
 * @example
 * splitGST(105.00) // => { subtotal: 100.00, gst: 5.00 }
 */
export function splitGST(total: number): { subtotal: number; gst: number } {
  const subtotal = money(total / 1.05);
  const gst = money(total - subtotal);
  return { subtotal, gst };
}

/**
 * Add GST (5%) to a subtotal
 * 
 * @param subtotal - The subtotal amount before GST
 * @returns Object with subtotal, GST, and total
 * 
 * @example
 * addGST(100.00) // => { subtotal: 100.00, gst: 5.00, total: 105.00 }
 */
export function addGST(subtotal: number): { subtotal: number; gst: number; total: number } {
  const sub = money(subtotal);
  const gst = money(sub * 0.05);
  const total = money(sub + gst);
  return { subtotal: sub, gst, total };
}

/**
 * Format discount percentage
 * 
 * @param percentage - Discount percentage (0-100)
 * @returns Formatted percentage string
 * 
 * @example
 * formatDiscountPercentage(15) // => "15%"
 * formatDiscountPercentage(0) // => "0%"
 * formatDiscountPercentage(undefined) // => "0%"
 */
export function formatDiscountPercentage(percentage: number | undefined): string {
  if (!percentage) return '0%';
  return `${percentage.toFixed(0)}%`;
}
