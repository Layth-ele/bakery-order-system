/**
 * UID Generation Utility
 *
 * Simple unique ID generator for adjustments, credit notes, snapshots, etc.
 * Format: PREFIX-TIMESTAMP-RANDOM
 * Example: "adj-1738742400000-x7k2m9p1q"
 *
 * FIX T2R4-H3 (HIGH — collision-prone IDs in financial-record helpers):
 * Was using `Math.random().toString(36).substring(2, 11)`. Reverse-
 * engineerable in V8 and prone to collisions when two records of the
 * same type are created in the same millisecond. The exported helpers
 * (generateAdjustmentId, generateCreditNoteId, generateSnapshotId) are
 * used for FINANCIAL records — collisions could overwrite real data
 * with another record of the same type.
 *
 * Currently, only `generateSnapshotId` is referenced in production
 * code (invoiceSnapshotService.ts:52). The other two are present for
 * legacy callers. Now uses crypto.getRandomValues() across the board
 * so any future caller picks up the safe behavior automatically.
 */

/**
 * Generate a unique ID with a prefix
 * @param prefix - The prefix for the ID (e.g., 'adj', 'cn', 'snap')
 * @returns A unique ID string in format: prefix-timestamp-random
 */
export function uid(prefix: string = 'id'): string {
  const timestamp = Date.now();
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const random = Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate an adjustment ID
 * @returns A unique adjustment ID (e.g., "adj-1738742400000-x7k2m9p1q")
 */
export function generateAdjustmentId(): string {
  return uid('adj');
}

/**
 * Generate a credit note ID
 * @returns A unique credit note ID (e.g., "cn-1738742400000-x7k2m9p1q")
 */
export function generateCreditNoteId(): string {
  return uid('cn');
}

/**
 * Generate a snapshot ID
 * @returns A unique snapshot ID (e.g., "snap-1738742400000-x7k2m9p1q")
 */
export function generateSnapshotId(): string {
  return uid('snap');
}