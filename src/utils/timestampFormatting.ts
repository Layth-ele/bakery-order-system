/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TIMESTAMP FORMATTING UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Helper functions for formatting Firestore Timestamps in the UI
 * 
 * 🔥 TIMESTAMP MIGRATION (Phase 1 - Option C)
 * Order, OrderAdjustment, OrderRevision now use Firestore Timestamp
 * 
 * USAGE:
 * ```ts
 * import { formatTimestamp, formatRelativeTimestamp } from '@/utils/timestampFormatting';
 * 
 * // In your component:
 * <div>{formatTimestamp(order.createdAt)}</div>
 * <div>{formatRelativeTimestamp(order.createdAt)}</div> // "5 minutes ago"
 * ```
 * 
 * LAST UPDATED: 2026-03-06
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Timestamp, FieldValue } from 'firebase/firestore';

/**
 * Convert Firestore Timestamp or ISO string to Date object
 * Handles both old (string) and new (Timestamp) formats for migration
 * FieldValue (serverTimestamp sentinels) return null — they are write-only values.
 */
export function toDate(value: Timestamp | string | number | Date | FieldValue | undefined | null): Date | null {
  if (value === null || value === undefined) return null;
  
  // FieldValue (serverTimestamp sentinel) — write-only, cannot be converted
  if (value instanceof FieldValue) return null;
  
  // Already a Date
  if (value instanceof Date) return value;
  
  // Handle Firestore Timestamp (has toDate method)
  if (typeof (value as any)?.toDate === 'function') {
    return (value as any).toDate();
  }
  
  // Handle numeric timestamp (milliseconds)
  if (typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Handle ISO string (legacy format)
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

/**
 * Format a Firestore Timestamp as a date string
 * Example: "Jan 15, 2026, 2:30 PM"
 */
export function formatTimestamp(
  value: Timestamp | string | number | Date | FieldValue | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = toDate(value);
  if (!date) return 'N/A';
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Format a Firestore Timestamp as a short date
 * Example: "Jan 15, 2026"
 */
export function formatShortTimestamp(
  value: Timestamp | string | undefined | null
): string {
  const date = toDate(value);
  if (!date) return 'N/A';
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a Firestore Timestamp with relative time
 * Examples: "Today", "Yesterday", "Jan 15, 2026"
 */
export function formatRelativeTimestamp(
  value: Timestamp | string | undefined | null
): string {
  const date = toDate(value);
  if (!date) return 'N/A';
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a Firestore Timestamp as "time ago"
 * Examples: "5 minutes ago", "2 hours ago", "3 days ago"
 */
export function formatTimeAgo(
  value: Timestamp | string | undefined | null
): string {
  const date = toDate(value);
  if (!date) return 'N/A';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  
  return formatShortTimestamp(value);
}

/**
 * Convert Firestore Timestamp to ISO string
 */
export function toISOString(value: Timestamp | string | undefined | null): string | null {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

/**
 * Check if a timestamp is within the last N days
 */
export function isWithinDays(
  value: Timestamp | string | undefined | null,
  days: number
): boolean {
  const date = toDate(value);
  if (!date) return false;
  
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  return diffDays >= 0 && diffDays <= days;
}

/**
 * Calculate days since a timestamp
 */
export function daysSince(value: Timestamp | string | undefined | null): number {
  const date = toDate(value);
  if (!date) return 0;
  
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
