/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE SHARED UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Shared utilities used across all Firestore domain files.
 * 
 * EXPORTS:
 * - wrapFirestoreOperation: Enhanced error handling wrapper
 * - db: Firestore database instance
 * - Firestore primitives (serverTimestamp, Timestamp, etc.)
 * - Schema validation utilities
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  serverTimestamp,
  Timestamp,
  DocumentData,
  QueryConstraint,
  increment,
} from 'firebase/firestore';
import { db } from '../config';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORT FIRESTORE PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Database instance
  db,
  
  // Firestore primitives
  serverTimestamp,
  Timestamp,
  increment,
  
  // Types
  type DocumentData,
  type QueryConstraint,
};

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wraps Firestore operations with enhanced error handling and validation
 * Prevents silent data corruption and provides clear error messages
 * 
 * ⚠️ DEMO MODE BEHAVIOR:
 * When Firebase is not configured (e.g., in Figma Make preview), this function
 * returns a safe default value (empty array) instead of throwing an error.
 * This allows the app to render without Firebase credentials.
 * 
 * @param operation - The Firestore operation to wrap
 * @param context - Context string for error messages (e.g., "getCustomers")
 * @returns Promise that resolves to operation result or throws enhanced error
 * 
 * @example
 * ```typescript
 * return wrapFirestoreOperation(
 *   async () => {
 *     const snapshot = await getDocs(collection(db, 'customers'));
 *     return snapshot.docs.map(doc => doc.data());
 *   },
 *   'getCustomers'
 * );
 * ```
 */
export function wrapFirestoreOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  // ✅ FIX MAR 14, 2026: Graceful degradation when Firestore is not configured
  if (!db) {
    logger.warn(`⚠️ [wrapFirestoreOperation] Firestore not configured, returning empty array for ${context}`);
    // ✅ SILENT DEGRADATION: In demo/preview mode (Figma Make), Firestore operations
    // return empty results without logging warnings. This is expected behavior.
    // The app works perfectly with empty data for preview purposes.
    return Promise.resolve([] as unknown as T);
  }
  
  return operation().catch((error) => {
    // Internal-only log — never expose raw context (contains UIDs) to the UI
    console.error(`🔥 Firestore Error [${context}]:`, {
      message: (error as any).message,
      code: (error as any).code,
      stack: (error as any).stack,
    });

    const code = (error as any).code as string | undefined;

    // ─── Map Firebase error codes → human-friendly messages ───────────────
    // IMPORTANT: Never include `context` in thrown messages — it contains
    // internal function names and raw Firebase UIDs that must not reach the UI.
    if (code === 'permission-denied') {
      throw new Error("You don't have permission to do that. Please contact support if this keeps happening.");
    }
    if (code === 'not-found') {
      throw new Error("The record you're looking for couldn't be found. It may have been deleted.");
    }
    if (code === 'already-exists') {
      throw new Error('This record already exists. Please refresh and try again.');
    }
    if (code === 'invalid-argument') {
      throw new Error('Some information is missing or invalid. Please check your details and try again.');
    }
    if (code === 'unauthenticated') {
      throw new Error('Your session has expired. Please sign in again.');
    }
    if (code === 'resource-exhausted') {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      throw new Error('The server is temporarily unavailable. Please check your connection and try again.');
    }
    if (code === 'cancelled') {
      throw new Error('The operation was cancelled. Please try again.');
    }

    // Fallback for any unrecognised Firebase or network error
    throw new Error('Something went wrong. Please try again or contact support if the problem continues.');
  });
}

// No longer needed - removed the warning system
// Track warned contexts to avoid console spam
// declare module './shared' {
//   interface WrapFirestoreOperation {
//     _warnedContexts?: Set<string>;
//   }
// }
// wrapFirestoreOperation._warnedContexts = new Set<string>();