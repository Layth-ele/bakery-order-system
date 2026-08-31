/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TIMESTAMP UTILITIES - CANONICAL SOURCE FOR ALL DATE/TIME OPERATIONS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✅ THE RULE: Use Timestamp for system time fields, string for display fields
 * 
 * SYSTEM EVENT TIMES (use serverTimestamp):
 * - createdAt, updatedAt
 * - approvedAt, rejectedAt, paidAt
 * - paymentProofSubmittedAt, paymentConfirmedAt
 * - expiresAt, timestamp
 * 
 * DISPLAY-ONLY FIELDS (use strings):
 * - weekRange: "Mar 1–Mar 7, 2026"
 * - deliveryDate: "2026-03-07"
 * - invoiceNumber: "INV-001"
 * 
 * Created: March 5, 2026
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { logger } from './logger';


/**
 * ✅ CORRECT: Get server timestamp for event moments
 * 
 * Use this for all system event times:
 * - Order approval/rejection/cancellation
 * - Payment submission/confirmation
 * - Customer registration/approval
 * - Notification creation
 * 
 * @example
 * ```typescript
 * await updateOrder(orderId, {
 *   status: 'approved',
 *   approvedAt: getServerTimestamp() as any, // ✅ Correct
 *   approvedBy: admin.email
 * });
 * ```
 */
export const getServerTimestamp = () => serverTimestamp();

/**
 * ✅ CORRECT: Get current timestamp for immediate client actions
 * 
 * Use this sparingly - only when you need an immediate timestamp
 * for client-side logic (e.g., marking notification as read immediately)
 * 
 * @example
 * ```typescript
 * const notification = {
 *   ...data,
 *   readAt: Timestamp.now() as any // ✅ Immediate client timestamp
 * };
 * ```
 */
export const getClientTimestamp = () => Timestamp.now();

/**
 * ✅ CORRECT: Convert a Date object to Firestore Timestamp
 * 
 * Use this when you have a known date and need to store it as a Timestamp
 * 
 * @example
 * ```typescript
 * const expiresAt = new Date();
 * expiresAt.setFullYear(expiresAt.getFullYear() + 1);
 * 
 * await createInvoice({
 *   ...data,
 *   expiresAt: dateToTimestamp(expiresAt) // ✅ Convert Date to Timestamp
 * });
 * ```
 */
export const dateToTimestamp = (date: Date) => Timestamp.fromDate(date);

/**
 * ✅ CORRECT: Convert a Firestore Timestamp to Date object
 * 
 * Use this when displaying timestamps in the UI
 * 
 * @example
 * ```typescript
 * const order = await getOrder(orderId);
 * const approvedDate = timestampToDate(order.approvedAt);
 * logger.log('Approved:', approvedDate.toLocaleDateString());
 * ```
 */
export const timestampToDate = (timestamp: Timestamp | string | number | Date | null | undefined): Date | null => {
  if (!timestamp) return null;
  
  // Handle Firestore Timestamp
  if ((timestamp as any).toDate && typeof (timestamp as any).toDate === 'function') {
    return (timestamp as any).toDate();
  }
  
  // Handle Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // Handle ISO string (legacy data)
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  logger.warn('⚠️ Unknown timestamp format:', timestamp);
  return null;
};

/**
 * ✅ CORRECT: Format a timestamp for display
 * 
 * Converts any timestamp format to a human-readable string
 * 
 * @example
 * ```typescript
 * formatTimestamp(order.approvedAt) // "Mar 5, 2026, 12:00 PM"
 * formatTimestamp(order.approvedAt, { dateStyle: 'short' }) // "3/5/2026"
 * ```
 */
export const formatTimestamp = (
  timestamp: Timestamp | string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string => {
  const date = timestampToDate(timestamp);
  if (!date) return 'N/A';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options
  };
  
  return date.toLocaleString('en-US', defaultOptions);
};

/**
 * ✅ CORRECT: Get date-only string for display fields
 * 
 * Use this for deliveryDate, invoiceDate, etc.
 * 
 * @example
 * ```typescript
 * const order = {
 *   deliveryDate: getDateOnlyString(new Date('2026-03-07')), // "2026-03-07"
 *   createdAt: getServerTimestamp() as any // Firestore Timestamp
 * };
 * ```
 */
export const getDateOnlyString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * ❌ DEPRECATED: Do not use for event moments
 * 
 * This function is deprecated for system event times.
 * Use getServerTimestamp() instead.
 * 
 * Only use this for display-only fields like invoiceNumber, yearMonth, etc.
 */
export const getISOString = (): string => {
  logger.warn(
    '⚠️ getISOString() is deprecated for event moments. Use getServerTimestamp() instead.'
  );
  return new Date().toISOString();
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a timestamp is in the past
 */
export const isTimestampPast = (timestamp: Timestamp | string | number | Date | null | undefined): boolean => {
  const date = timestampToDate(timestamp);
  if (!date) return false;
  return date < new Date();
};

/**
 * Check if a timestamp is in the future
 */
export const isTimestampFuture = (timestamp: Timestamp | string | number | Date | null | undefined): boolean => {
  const date = timestampToDate(timestamp);
  if (!date) return false;
  return date > new Date();
};

/**
 * Get time elapsed since timestamp (e.g., "2 hours ago")
 */
export const getTimeElapsed = (timestamp: Timestamp | string | number | Date | null | undefined): string => {
  const date = timestampToDate(timestamp);
  if (!date) return 'N/A';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  return 'Just now';
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  // ✅ RECOMMENDED for system event times
  getServerTimestamp,
  getClientTimestamp,
  dateToTimestamp,
  
  // ✅ RECOMMENDED for display/formatting
  timestampToDate,
  formatTimestamp,
  getDateOnlyString,
  
  // ✅ UTILITIES
  isTimestampPast,
  isTimestampFuture,
  getTimeElapsed,
  
  // ❌ DEPRECATED
  getISOString
};
