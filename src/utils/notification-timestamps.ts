/**
 * Canonical Notification Timestamp Utility
 * 
 * ✅ SINGLE SOURCE OF TRUTH for all notification timestamp handling
 * 
 * This prevents timestamp mismatches that cause notifications to:
 * - Appear in wrong order
 * - Show incorrect relative times
 * - Fail to sort properly
 * - Break pagination
 * 
 * VERSION: 1.0 - Initial implementation
 * 
 * FIRESTORE TIMESTAMP FORMAT:
 * - Storage: Firestore Timestamp objects (server-side)
 * - Reading: Convert to Unix milliseconds (client-side)
 * - Display: Convert to ISO strings or relative times (UI)
 * 
 * USAGE:
 * 
 * ```typescript
 * import { 
 *   toFirestoreTimestamp, 
 *   fromFirestoreTimestamp, 
 *   formatNotificationTime 
 * } from '@/utils/notification-timestamps';
 * 
 * // Writing to Firestore
 * const firestoreData = {
 *   createdAt: toFirestoreTimestamp(), // Firestore Timestamp
 *   readAt: null,
 * };
 * 
 * // Reading from Firestore
 * const doc = await getDoc(docRef);
 * const createdAt = fromFirestoreTimestamp(doc.data().createdAt); // Unix ms
 * 
 * // Displaying in UI
 * const displayTime = formatNotificationTime(createdAt); // "5m ago"
 * ```
 */

import { Timestamp } from 'firebase/firestore';
import { logger } from './logger';


// ============================================================================
// CORE CONVERSIONS
// ============================================================================

/**
 * Convert to Firestore Timestamp for storage
 * 
 * Creates a Firestore Timestamp object from:
 * - Unix milliseconds (number)
 * - Date object
 * - Current time (if no parameter)
 * 
 * Use this when WRITING to Firestore
 * 
 * @param value - Unix ms, Date, or undefined (defaults to now)
 * @returns Firestore Timestamp object
 * 
 * @example
 * ```typescript
 * // Current time
 * const now = toFirestoreTimestamp();
 * 
 * // Specific time
 * const specific = toFirestoreTimestamp(1704067200000);
 * 
 * // From Date
 * const fromDate = toFirestoreTimestamp(new Date());
 * 
 * // Use in Firestore write
 * await setDoc(docRef, {
 *   createdAt: toFirestoreTimestamp(),
 *   readAt: null,
 * });
 * ```
 */
export function toFirestoreTimestamp(value?: number | Date): Timestamp {
  if (value === undefined) {
    // Current time
    return Timestamp.now();
  }
  
  if (typeof value === 'number') {
    // Unix milliseconds
    return Timestamp.fromMillis(value);
  }
  
  // Date object
  return Timestamp.fromDate(value);
}

/**
 * Convert from Firestore Timestamp to Unix milliseconds
 * 
 * Safely converts Firestore Timestamp objects to Unix ms for client-side use
 * Handles null/undefined gracefully
 * 
 * Use this when READING from Firestore
 * 
 * @param timestamp - Firestore Timestamp, null, or undefined
 * @returns Unix milliseconds or null
 * 
 * @example
 * ```typescript
 * // Read from Firestore
 * const doc = await getDoc(docRef);
 * const data = doc.data();
 * 
 * const createdAt = fromFirestoreTimestamp(data.createdAt); // number
 * const readAt = fromFirestoreTimestamp(data.readAt); // null if not read
 * 
 * // Use in state
 * setNotification({
 *   ...data,
 *   createdAt: createdAt!,
 *   readAt: readAt,
 * });
 * ```
 */
export function fromFirestoreTimestamp(timestamp: any): number | null {
  // Null or undefined
  if (!timestamp) {
    return null;
  }
  
  // Already a number (Unix ms) - passthrough
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  
  // Firestore Timestamp object
  if (timestamp?.toMillis && typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis();
  }
  
  // Firestore Timestamp-like object with seconds/nanoseconds
  if (timestamp?.seconds !== undefined) {
    return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
  }
  
  // Date object
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  
  // ISO string
  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    return isNaN(parsed) ? null : parsed;
  }
  
  logger.warn('⚠️ Unknown timestamp format:', timestamp);
  return null;
}

/**
 * Convert from Firestore Timestamp to ISO string
 * 
 * Safely converts Firestore Timestamp objects to ISO strings for display/serialization
 * Handles null/undefined gracefully
 * 
 * @param timestamp - Firestore Timestamp, null, or undefined
 * @returns ISO string or null
 * 
 * @example
 * ```typescript
 * const doc = await getDoc(docRef);
 * const isoString = fromFirestoreTimestampToISO(doc.data().createdAt);
 * // Returns: "2024-01-01T12:00:00.000Z"
 * ```
 */
export function fromFirestoreTimestampToISO(timestamp: any): string | null {
  const ms = fromFirestoreTimestamp(timestamp);
  return ms ? new Date(ms).toISOString() : null;
}

// ============================================================================
// FIELD CONVERTERS
// ============================================================================

/**
 * Timestamp fields that should exist in notification documents
 */
export interface NotificationTimestampFields {
  /** When the notification was created (required) */
  createdAt: Timestamp;
  
  /** When the notification was read (optional, null if unread) */
  readAt?: Timestamp | null;
  
  /** Legacy timestamp field (deprecated, only for backward compatibility) */
  timestamp?: number;
}

/**
 * Convert notification data TO Firestore format
 * 
 * Converts all timestamp fields from Unix ms to Firestore Timestamps
 * 
 * @param data - Notification data with Unix ms timestamps
 * @returns Notification data with Firestore Timestamps
 * 
 * @example
 * ```typescript
 * const notificationData = {
 *   id: 'notif123',
 *   type: 'ORDER_APPROVED',
 *   title: 'Order Approved',
 *   message: 'Your order is ready!',
 *   createdAt: Date.now(), // Unix ms
 *   readAt: null,
 *   read: false,
 * };
 * 
 * const firestoreData = toFirestoreNotificationFormat(notificationData);
 * await setDoc(docRef, firestoreData);
 * ```
 */
export function toFirestoreNotificationFormat(data: any): any {
  const result = { ...data };
  
  // Convert createdAt to Firestore Timestamp
  if (data.createdAt !== undefined) {
    result.createdAt = toFirestoreTimestamp(data.createdAt);
  }
  
  // Convert readAt to Firestore Timestamp (or null)
  if (data.readAt !== undefined && data.readAt !== null) {
    result.readAt = toFirestoreTimestamp(data.readAt);
  } else {
    result.readAt = null;
  }
  
  // Remove legacy timestamp field if present
  if (result.timestamp !== undefined) {
    delete result.timestamp;
  }
  
  return result;
}

/**
 * Convert notification data FROM Firestore format
 * 
 * Converts all timestamp fields from Firestore Timestamps to Unix ms
 * 
 * @param data - Firestore document data with Timestamps
 * @returns Notification data with Unix ms timestamps
 * 
 * @example
 * ```typescript
 * const doc = await getDoc(docRef);
 * const firestoreData = doc.data();
 * 
 * const notificationData = fromFirestoreNotificationFormat(firestoreData);
 * // notificationData.createdAt is now Unix ms (number)
 * // notificationData.readAt is now Unix ms or null
 * ```
 */
export function fromFirestoreNotificationFormat(data: any): any {
  const result = { ...data };
  
  // Convert createdAt from Firestore Timestamp to Unix ms
  if (data.createdAt) {
    const createdAt = fromFirestoreTimestamp(data.createdAt);
    result.createdAt = createdAt || Date.now(); // Fallback to now if conversion fails
  }
  
  // Convert readAt from Firestore Timestamp to Unix ms (or null)
  if (data.readAt !== undefined) {
    result.readAt = fromFirestoreTimestamp(data.readAt);
  }
  
  // Handle legacy timestamp field
  if (data.timestamp !== undefined && !result.createdAt) {
    result.createdAt = data.timestamp;
  }
  
  return result;
}

// ============================================================================
// DISPLAY FORMATTING
// ============================================================================

/**
 * Format notification timestamp for display
 * 
 * Converts Unix ms to human-readable relative time
 * - "Just now" (< 1 minute)
 * - "5m ago" (< 1 hour)
 * - "3h ago" (< 24 hours)
 * - "2d ago" (< 7 days)
 * - "Jan 15" (>= 7 days)
 * 
 * @param timestamp - Unix milliseconds or Firestore Timestamp
 * @returns Formatted time string
 * 
 * @example
 * ```typescript
 * formatNotificationTime(Date.now() - 1000 * 60 * 5); // "5m ago"
 * formatNotificationTime(Date.now() - 1000 * 60 * 60 * 3); // "3h ago"
 * formatNotificationTime(Date.now() - 1000 * 60 * 60 * 24 * 2); // "2d ago"
 * ```
 */
export function formatNotificationTime(timestamp: number | any): string {
  // Convert Firestore Timestamp to Unix ms if needed
  const ms = typeof timestamp === 'number' 
    ? timestamp 
    : fromFirestoreTimestamp(timestamp);
  
  if (!ms) return 'Unknown';
  
  const now = Date.now();
  const diffMs = now - ms;
  
  // Future timestamp (shouldn't happen, but handle gracefully)
  if (diffMs < 0) return 'Just now';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Just now (< 1 minute)
  if (diffMins < 1) return 'Just now';
  
  // Minutes ago (< 1 hour)
  if (diffMins < 60) return `${diffMins}m ago`;
  
  // Hours ago (< 24 hours)
  if (diffHours < 24) return `${diffHours}h ago`;
  
  // Days ago (< 7 days)
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // Date (>= 7 days)
  const date = new Date(ms);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Format notification timestamp to full date/time
 * 
 * Converts Unix ms to full date and time string
 * 
 * @param timestamp - Unix milliseconds or Firestore Timestamp
 * @param includeTime - Whether to include time (default: true)
 * @returns Formatted date/time string
 * 
 * @example
 * ```typescript
 * formatNotificationDateTime(1704067200000);
 * // "Jan 1, 2024 at 12:00 PM"
 * 
 * formatNotificationDateTime(1704067200000, false);
 * // "Jan 1, 2024"
 * ```
 */
export function formatNotificationDateTime(
  timestamp: number | any,
  includeTime: boolean = true
): string {
  // Convert Firestore Timestamp to Unix ms if needed
  const ms = typeof timestamp === 'number' 
    ? timestamp 
    : fromFirestoreTimestamp(timestamp);
  
  if (!ms) return 'Unknown';
  
  const date = new Date(ms);
  
  if (includeTime) {
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } else {
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
}

// ============================================================================
// VALIDATION & SORTING
// ============================================================================

/**
 * Check if timestamp is valid
 * 
 * @param timestamp - Value to check
 * @returns true if valid timestamp
 * 
 * @example
 * ```typescript
 * isValidTimestamp(Date.now()); // true
 * isValidTimestamp(Timestamp.now()); // true
 * isValidTimestamp(null); // false
 * isValidTimestamp('not a timestamp'); // false
 * ```
 */
export function isValidTimestamp(timestamp: any): boolean {
  // Null/undefined
  if (!timestamp) return false;
  
  // Unix ms (number)
  if (typeof timestamp === 'number') {
    return timestamp > 0 && !isNaN(timestamp);
  }
  
  // Firestore Timestamp
  if (timestamp?.toMillis && typeof timestamp.toMillis === 'function') {
    return true;
  }
  
  // Timestamp-like object
  if (timestamp?.seconds !== undefined) {
    return typeof timestamp.seconds === 'number';
  }
  
  // Date object
  if (timestamp instanceof Date) {
    return !isNaN(timestamp.getTime());
  }
  
  return false;
}

/**
 * Sort notifications by timestamp (newest first)
 * 
 * @param notifications - Array of notifications with createdAt field
 * @returns Sorted array (newest first)
 * 
 * @example
 * ```typescript
 * const sorted = sortNotificationsByNewest(notifications);
 * // sorted[0] is the newest notification
 * ```
 */
export function sortNotificationsByNewest(notifications: any[]): any[] {
  return [...notifications].sort((a, b) => {
    const timeA = fromFirestoreTimestamp(a.createdAt) || 0;
    const timeB = fromFirestoreTimestamp(b.createdAt) || 0;
    return timeB - timeA; // Descending (newest first)
  });
}

/**
 * Sort notifications by timestamp (oldest first)
 * 
 * @param notifications - Array of notifications with createdAt field
 * @returns Sorted array (oldest first)
 * 
 * @example
 * ```typescript
 * const sorted = sortNotificationsByOldest(notifications);
 * // sorted[0] is the oldest notification
 * ```
 */
export function sortNotificationsByOldest(notifications: any[]): any[] {
  return [...notifications].sort((a, b) => {
    const timeA = fromFirestoreTimestamp(a.createdAt) || 0;
    const timeB = fromFirestoreTimestamp(b.createdAt) || 0;
    return timeA - timeB; // Ascending (oldest first)
  });
}

// ============================================================================
// DOCUMENTATION & EXAMPLES
// ============================================================================

/**
 * CANONICAL TIMESTAMP FORMATS
 * 
 * ✅ IN FIRESTORE (Server-side):
 * {
 *   createdAt: Timestamp { seconds: 1704067200, nanoseconds: 0 },
 *   readAt: null | Timestamp { ... }
 * }
 * 
 * ✅ IN CLIENT CODE (After reading):
 * {
 *   createdAt: 1704067200000, // Unix ms (number)
 *   readAt: null | 1704067200000
 * }
 * 
 * ✅ IN UI (Display):
 * "5m ago" | "3h ago" | "Jan 15" | "Jan 1, 2024 at 12:00 PM"
 * 
 * ❌ AVOID:
 * - ISO strings in Firestore (breaks ordering)
 * - Mixed formats (some Timestamp, some number)
 * - Legacy timestamp field (deprecated)
 */

/**
 * MIGRATION GUIDE
 * 
 * Step 1: Replace direct Timestamp usage
 * 
 * Before:
 * ```typescript
 * import { Timestamp } from 'firebase/firestore';
 * const timestamp = Timestamp.now(); // ❌ Scattered usage
 * ```
 * 
 * After:
 * ```typescript
 * import { toFirestoreTimestamp } from '@/utils/notification-timestamps';
 * const timestamp = toFirestoreTimestamp(); // ✅ Centralized
 * ```
 * 
 * Step 2: Replace manual conversions
 * 
 * Before:
 * ```typescript
 * const ms = doc.data().createdAt?.toMillis?.() || Date.now(); // ❌ Manual
 * ```
 * 
 * After:
 * ```typescript
 * import { fromFirestoreTimestamp } from '@/utils/notification-timestamps';
 * const ms = fromFirestoreTimestamp(doc.data().createdAt) || Date.now(); // ✅ Safe
 * ```
 * 
 * Step 3: Replace custom formatters
 * 
 * Before:
 * ```typescript
 * const diffMins = Math.floor((Date.now() - timestamp) / 60000);
 * const display = diffMins < 60 ? `${diffMins}m ago` : ...; // ❌ Duplicated logic
 * ```
 * 
 * After:
 * ```typescript
 * import { formatNotificationTime } from '@/utils/notification-timestamps';
 * const display = formatNotificationTime(timestamp); // ✅ Consistent
 * ```
 */
