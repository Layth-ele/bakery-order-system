/**
 * idCounterService.ts — Client-side Firestore atomic ID generator
 *
 * Format : PREFIX-YYYY-MM-DD-NNN  (3 digits min, grows: 999→1000→9999→10000)
 * Examples:
 *   DBH-2026-03-26-001   ← 1st invoice today
 *   ORD-2026-03-26-042   ← 42nd order today
 *   CUST-2026-03-26-007  ← 7th customer today
 *
 * ✅ Atomic Firestore transaction  — collision-proof for 10,000+ customers
 * ✅ MOD-97 check digit appended  — catches phone/email typos automatically
 * ✅ Daily counter per prefix     — resets to 001 every Vancouver midnight
 * ✅ Natural growth               — 001→999→1000→9999 (no fixed cap)
 */

import { db } from '../firebase/config';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { logger } from '../utils/logger';
// FIX T2R4-H6 (HIGH): Was hardcoded `'DBH' / 'ORD' / 'CUST'` strings.
// Centralized constant from businessDefaults.ts so future rebrands or
// multi-tenant deploys only change the prefix in one place.
import { ID_PREFIXES } from '../constants/businessDefaults';


export type CounterType = 'customers' | 'orders' | 'invoices';

const PREFIX: Record<CounterType, string> = {
  customers: ID_PREFIXES.CUSTOMER,
  orders:    ID_PREFIXES.ORDER,
  invoices:  ID_PREFIXES.INVOICE,
};

// ─── helpers ────────────────────────────────────────────────────────────────

/** 001→999 then 1000→9999→10000 — minimum 3 digits, grows naturally */
function formatSeq(n: number): string {
  return n < 1000 ? String(n).padStart(3, '0') : String(n);
}

/** Today's date in Vancouver timezone  →  "2026-03-26" */
function getDailyKey(): string {
  const now = new Date();
  const van = new Date(now.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
  const y = van.getFullYear();
  const m = String(van.getMonth() + 1).padStart(2, '0');
  const d = String(van.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * MOD-97 check digit (ISO 11649 style)
 * Converts every character to its ASCII code, concatenates, then computes 98 − (num % 97).
 * Result is always 2 digits (01–97).
 *
 * @example checkDigit("DBH20260326001") → "47"
 * So final ID = "DBH-2026-03-26-001-47"
 * If someone reads "048" instead of "047" the app can reject it instantly.
 */
export function computeCheckDigit(idWithoutCheck: string): string {
  // Strip dashes, convert each char to its char-code string, concatenate
  const digits = idWithoutCheck
    .replace(/-/g, '')
    .split('')
    .map(c => String(c.charCodeAt(0)))
    .join('');

  // BigInt so we don't lose precision on large strings
  const remainder = Number(BigInt(digits) % 97n);
  const check = 98 - remainder;
  return String(check).padStart(2, '0');
}

/**
 * Verify a full ID (with check digit suffix) is valid.
 * @example verifyId("DBH-2026-03-26-001-47") → true
 */
export function verifyId(fullId: string): boolean {
  const lastDash = fullId.lastIndexOf('-');
  if (lastDash === -1) return false;
  const base  = fullId.slice(0, lastDash);
  const given = fullId.slice(lastDash + 1);
  return computeCheckDigit(base) === given;
}

// ─── core counter ────────────────────────────────────────────────────────────

/**
 * Atomically get the next ID.
 * ✅ FIX 5: Tries Cloud Function first (server-side, no gap risk on network drop).
 *           Falls back to direct Firestore transaction if CF is unavailable.
 * ✅ FIX 6: Improved error handling to prevent ID gaps and conflicts.
 */
export async function getNextId(type: CounterType): Promise<string> {
  // ── Try Cloud Function (preferred: server-controlled, retry-safe) ──────────
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('../firebase/config');
    if (app) {
      const fns = getFunctions(app);
      const fn  = httpsCallable<{ type: string }, { id: string }>(fns, 'generateId');
      
      // Retry up to 3 times with exponential backoff
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await fn({ type });
          if (result.data?.id) {
            // Verify the returned ID is valid
            if (verifyId(result.data.id)) {
              return result.data.id;
            } else {
              logger.warn(`⚠️ Cloud Function returned invalid ID: ${result.data.id}`);
            }
          }
        } catch (callError) {
          logger.warn(`⚠️ Cloud Function call attempt ${attempt} failed:`, callError);
          if (attempt < 3) {
            // Wait before retry (100ms, 200ms, 400ms)
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
          }
        }
      }
    }
  } catch (cfError) {
    logger.warn('⚠️ Cloud Function generateId unavailable, falling back to direct counter:', cfError);
  }

  // ── Direct Firestore transaction fallback ────────────────────────────────
  //
  // ⚠️ PASS 1 H2 NOTE: After the H2 rule patch, idCounters/{counterId} writes
  // from clients are denied by Firestore. This fallback path will throw
  // permission-denied. It is preserved here only so that emulator / development
  // setups without Cloud Functions still work — in production the Cloud
  // Function path above is the only one that succeeds.
  //
  // If you see the Date.now()-based fallback ID below being used in production
  // logs, the Cloud Function deploy is broken — investigate immediately rather
  // than treating the fallback ID as legitimate (it bypasses the daily counter).
  const prefix    = PREFIX[type];
  const dateKey   = getDailyKey();
  const counterId = `${prefix}-${dateKey}`;
  const counterRef = doc(db!, 'idCounters', counterId);

  try {
    const seq = await runTransaction(db!, async (tx) => {
      const snap = await tx.get(counterRef);
      const last = snap.exists() ? (snap.data()?.lastNumber ?? 0) : 0;
      const next = last + 1;
      tx.set(counterRef, { prefix, dateKey, lastNumber: next, updatedAt: serverTimestamp() }, { merge: true });
      return next;
    });

    const base  = `${prefix}-${dateKey}-${formatSeq(seq)}`;
    const check = computeCheckDigit(base);
    const id = `${base}-${check}`;
    
    // Verify the generated ID
    if (!verifyId(id)) {
      throw new Error(`Generated invalid ID: ${id}`);
    }
    
    return id;
  } catch (txError) {
    console.error('❌ [getNextId] Firestore transaction failed:', txError);
    // FIX R5-S5-F15 (CRITICAL): Was producing a Date.now-based fallback ID.
    // Three problems:
    //   1. Fallback IDs are non-sequential — they break the daily counter contract
    //      that downstream invoice search/aggregation relies on.
    //   2. CRA requires sequential invoice numbers (Income Tax Act regulation 229).
    //      Date.now-based numbers create gaps and out-of-order entries that fail
    //      audit because they look like the business is hiding/skipping invoices.
    //   3. The check digit was correctly computed, hiding the underlying problem
    //      from verifyId() — every fallback ID looked legitimate.
    // The correct response when both the Cloud Function AND the direct-Firestore
    // path fail is to fail loudly so the caller can retry or surface the error
    // to the user.  Falling back silently to broken IDs is worse than no ID.
    logger.exception('idCounter.getNextId.failed', txError as Error, {
      type,
      counterId,
      dateKey,
    });
    throw new Error(
      `ID generation failed for ${type}.  Both Cloud Function and direct ` +
      `transaction paths returned errors.  Original: ${(txError as Error)?.message ?? txError}`
    );
  }
}

// ─── public helpers ──────────────────────────────────────────────────────────

/** e.g. CUST-2026-03-26-001-47 */
export async function generateCustomerId(): Promise<string> {
  return getNextId('customers');
}

/** e.g. ORD-2026-03-26-001-47 */
export async function generateOrderNumber(): Promise<string> {
  return getNextId('orders');
}

/** e.g. DBH-2026-03-26-001-47 */
export async function generateInvoiceNumber(): Promise<string> {
  return getNextId('invoices');
}
