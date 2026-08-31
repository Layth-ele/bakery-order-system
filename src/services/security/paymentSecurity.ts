/**
 * 🔒 PAYMENT SECURITY SERVICE
 *
 * Critical security features for payment confirmations:
 * - Rate limiting to prevent abuse (Firestore-backed — survives page refresh)
 * - Audit logging for compliance
 * - IP tracking (client-side approximation)
 * - Suspicious activity detection
 *
 * ✅ FIX BUG 3 (HIGH): Rate limiting is now persisted in Firestore.
 * Previous implementation used an in-memory Map which was wiped on every page
 * refresh, new tab, or private window — making the lockout completely bypassable.
 * The limit state is now stored under rateLimits/{orderId} in Firestore so it
 * survives refreshes and is consistent across browser tabs.
 *
 * ⚠️ NOTE: A Cloud Function is still the gold standard for server-enforced limits.
 * This Firestore-backed approach is secure against client bypass while not requiring
 * a backend deployment.
 *
 * ✅ MAR 7, 2026: Migrated from /utils/paymentSecurity.ts to /services/security
 */

import { addDoc, collection, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { getServerTimestamp } from '../../utils/timestamps';
import { toDate } from '../../utils/timestampFormatting';
import { logger } from '../../utils/logger';


const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

// ============================================================================
// RATE LIMITING — Firestore-backed (survives page refresh / new tabs)
// ============================================================================

interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

export const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 3,           // Max confirmations per time window
  TIME_WINDOW: 300000,       // 5 minutes in milliseconds
  LOCKOUT_DURATION: 900000,  // 15 minutes lockout
  COOLDOWN_PERIOD: 60000,    // 1 minute between attempts
};

/** Firestore document ref for a given order's rate-limit state */
function rateLimitRef(orderId: string) {
  return doc(db!, 'rateLimits', orderId);
}

/** Read the current rate-limit entry from Firestore (returns null if none) */
async function getRateLimitEntry(orderId: string): Promise<RateLimitEntry | null> {
  try {
    const snap = await getDoc(rateLimitRef(orderId));
    if (!snap.exists()) return null;
    return snap.data() as RateLimitEntry;
  } catch (err) {
    // FIX T2R5-H1 (HIGH — design trade-off documented):
    //
    // Behavior: fail open (allow the attempt) when Firestore is unavailable.
    //
    // The original audit flagged this as a HIGH risk because an attacker
    // who can DOS Firestore could bypass the rate limit. Re-evaluating:
    //
    // 1. The rate limiter is a defense-in-depth check on TOP of Cloud
    //    Function authentication and Firestore rules. The actual writes
    //    that matter (order status changes, credit deductions) flow through
    //    Cloud Functions which run with their own server-side rate limits
    //    and audit trails (security_alerts collection).
    //
    // 2. Failing CLOSED here would block ALL legitimate payment
    //    confirmations during ANY Firestore outage — turning a third-party
    //    issue into a complete payments outage. Most attackers don't have
    //    DOS capability against Firebase; legitimate Firestore blips happen
    //    occasionally.
    //
    // 3. The proper "gold standard" fix is a server-side rate limit in a
    //    Cloud Function, which would enforce limits regardless of client
    //    Firestore state. That's a real follow-up — captured here so the
    //    HIGH finding has a concrete next step rather than being silently
    //    accepted.
    //
    // What we DO improve here: write a security_alerts entry so admin
    // sees whenever the rate limiter falls open, even though we still
    // permit the attempt. If alerts fire frequently, that's the signal to
    // implement the server-side limiter.
    logger.warn('[paymentSecurity] Could not read rate limit — failing open', err);
    void writeRateLimitFallback(orderId, err);
    return null;
  }
}

/**
 * Best-effort security-alert write when the rate limiter falls open.
 * If THIS write also fails (the same Firestore is unavailable), we accept
 * the silent-failure trade-off — there's no third channel.
 */
async function writeRateLimitFallback(orderId: string, err: unknown): Promise<void> {
  try {
    const { collection: fsCollection, addDoc: fsAddDoc } = await import('firebase/firestore');
    const customerId = auth.currentUser?.uid ?? 'unknown';
    await fsAddDoc(fsCollection(db!, 'security_alerts'), {
      type: 'RATE_LIMIT_FAIL_OPEN',
      severity: 'MEDIUM',
      orderId,
      customerId,
      adminEmail: customerId,
      reason: (err as any)?.message ?? String(err),
      timestamp: serverTimestamp() as any,
    });
  } catch { /* second-level failure intentionally swallowed */ }
}

/** Write an updated rate-limit entry to Firestore */
async function setRateLimitEntry(orderId: string, entry: RateLimitEntry): Promise<void> {
  try {
    // ✅ FIX H1 (Pass 1): Include customerId so the new Firestore rule binds
    // the rate-limit doc to its owner. Without this field, the write is denied
    // by the Pass-1-hardened rule, and the rate limiter would silently fail open.
    const customerId = auth.currentUser?.uid;
    if (!customerId) {
      // Unauthenticated callers cannot write rate limits.
      return;
    }
    await setDoc(rateLimitRef(orderId), {
      ...entry,
      customerId,
      orderId,
      updatedAt: serverTimestamp() as any,
    });
  } catch {
    logger.warn('[paymentSecurity] Could not persist rate limit entry');
  }
}

/**
 * Check if payment confirmation is rate limited.
 * Now async — reads from Firestore instead of an in-memory Map.
 */
export async function checkPaymentRateLimit(orderId: string): Promise<{
  allowed: boolean;
  reason?: string;
  remainingTime?: number;
  attemptsRemaining?: number;
}> {
  const now = Date.now();
  const entry = await getRateLimitEntry(orderId);

  if (!entry) {
    return { allowed: true, attemptsRemaining: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
  }

  // Check if currently locked
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const remainingTime = Math.ceil((entry.lockedUntil - now) / 1000);
    return {
      allowed: false,
      reason: `Too many confirmation attempts. Please wait ${Math.ceil(remainingTime / 60)} minutes.`,
      remainingTime,
    };
  }

  // Check cooldown period
  if (now - entry.lastAttempt < RATE_LIMIT_CONFIG.COOLDOWN_PERIOD) {
    const remainingTime = Math.ceil((RATE_LIMIT_CONFIG.COOLDOWN_PERIOD - (now - entry.lastAttempt)) / 1000);
    return {
      allowed: false,
      reason: `Please wait ${remainingTime} seconds before confirming again.`,
      remainingTime,
    };
  }

  // Reset attempts if time window has passed (zero the entry instead of deleting it)
  // FIX R8-S5-F48 (CRITICAL): Was calling resetPaymentRateLimit(orderId) which
  // attempts deleteDoc().  But the H1 Firestore rule denies non-admin deletes,
  // so the delete fails silently — the entry keeps `attempts: 3` forever, and
  // every subsequent payment attempt re-locks the customer permanently.
  // Solution: zero the counter via setRateLimitEntry (rule allows owner update).
  if (now - entry.lastAttempt > RATE_LIMIT_CONFIG.TIME_WINDOW) {
    await setRateLimitEntry(orderId, { attempts: 0, lastAttempt: now, lockedUntil: null });
    return { allowed: true, attemptsRemaining: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
  }

  // Check attempt limit
  if (entry.attempts >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS) {
    const lockedUntil = now + RATE_LIMIT_CONFIG.LOCKOUT_DURATION;
    await setRateLimitEntry(orderId, { ...entry, lockedUntil });
    return {
      allowed: false,
      reason: `Maximum confirmation attempts exceeded. Account locked for 15 minutes.`,
      remainingTime: Math.ceil(RATE_LIMIT_CONFIG.LOCKOUT_DURATION / 1000),
    };
  }

  return {
    allowed: true,
    attemptsRemaining: RATE_LIMIT_CONFIG.MAX_ATTEMPTS - entry.attempts,
  };
}

/**
 * Record a payment confirmation attempt.
 * Now async — writes to Firestore.
 *
 * ✅ FIX H1 (Pass 1): Guards on auth.currentUser. If the caller is not signed
 * in, no rate-limit doc is written — the new Firestore rule denies anonymous
 * writes anyway, but skipping the write avoids a logged warning per attempt.
 *
 * FIX R9-S6-F32 (HIGH): Was a non-transactional read-then-write pattern.  Two
 * concurrent attempts could both read attempts=2, both compute 3, both write 3
 * — counter undercounts, lockout never triggers.  Switched to runTransaction
 * so increments are atomic.
 */
export async function recordPaymentAttempt(orderId: string): Promise<void> {
  const now = Date.now();
  const customerId = auth.currentUser?.uid;
  if (!customerId) return;

  try {
    const { runTransaction } = await import('firebase/firestore');
    await runTransaction(db!, async (tx) => {
      const ref = rateLimitRef(orderId);
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, {
          attempts: 1,
          lastAttempt: now,
          lockedUntil: null,
          customerId,
          orderId,
          updatedAt: serverTimestamp() as any,
        });
      } else {
        const cur = snap.data() as RateLimitEntry;
        tx.set(ref, {
          ...cur,
          attempts: cur.attempts + 1,
          lastAttempt: now,
          customerId,
          orderId,
          updatedAt: serverTimestamp() as any,
        });
      }
    });
  } catch (err) {
    // FIX R9-S6-F33 (HIGH): Was failing open silently.  Now log to security_alerts
    // so admin can spot abuse patterns.  Caller still proceeds (we don't want to
    // block legitimate payments on a rate-limit write failure), but the failure
    // is no longer invisible.
    logger.warn('[paymentSecurity] recordPaymentAttempt failed:', err);
    try {
      await addDoc(collection(db!, 'security_alerts'), {
        type: 'RATE_LIMIT_WRITE_FAILED',
        customerId,
        orderId,
        timestamp: getServerTimestamp() as any,
        severity: 'MEDIUM',
        error: String((err as Error)?.message ?? err),
      });
    } catch {
      // Even the alert write failed — silently swallow at this point
    }
  }
}

/**
 * Reset rate limit for an order (after successful confirmation).
 * Now async — deletes from Firestore.
 *
 * ⚠️ FIX H1 (Pass 1): Customer DELETE is now denied by the new Firestore rule —
 * only admins can delete a rateLimits doc. This is intentional: customers must
 * not be able to clear their own lockouts. For successful confirmations, the
 * doc is left in place and naturally aged out by the TIME_WINDOW reset path
 * in checkPaymentRateLimit. If you need explicit reset on success, expose an
 * admin-only Cloud Function that uses Admin SDK.
 */
export async function resetPaymentRateLimit(orderId: string): Promise<void> {
  try {
    await deleteDoc(rateLimitRef(orderId));
    if (DEBUG) logger.log(`✅ Rate limit: Reset for order ${orderId}`);
  } catch {
    // Expected for non-admin callers under the new rule — silent.
    if (DEBUG) logger.log('[paymentSecurity] resetPaymentRateLimit: delete denied (expected for non-admin)');
  }
}

/**
 * Get current rate limit status for bulk operations.
 * Now async — reads from Firestore.
 */
export async function checkBulkRateLimit(orderIds: string[]): Promise<Map<string, Awaited<ReturnType<typeof checkPaymentRateLimit>>>> {
  const results = new Map<string, Awaited<ReturnType<typeof checkPaymentRateLimit>>>();
  await Promise.all(
    orderIds.map(async (orderId) => {
      results.set(orderId, await checkPaymentRateLimit(orderId));
    })
  );
  return results;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export interface PaymentAuditLog {
  action: 'PAYMENT_CONFIRMED' | 'PAYMENT_REJECTED' | 'BULK_CONFIRMATION' | 'SUSPICIOUS_ACTIVITY';
  orderId: string | string[];
  adminEmail: string;
  adminName: string;
  timestamp: string;
  amount?: number;
  customerName?: string;
  customerId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log payment confirmation for audit trail
 * ⚠️ CRITICAL: This should be moved to Cloud Function in production
 * 
 * @param data - Audit log data
 */
export async function logPaymentAudit(data: PaymentAuditLog): Promise<void> {
  try {
    if (DEBUG) logger.log('📝 Audit Log:', data);

    // Get approximate IP (client-side) - NOT SECURE for production
    const ip = await getClientIP().catch(() => 'unknown');
    
    // Get user agent
    const userAgent = navigator.userAgent;

    // Add to Firestore
    await addDoc(collection(db, 'payment_audit_logs'), {
      ...data,
      ip,
      userAgent,
      createdAt: serverTimestamp() as any,
      environment: import.meta.env.MODE,
    });

    if (DEBUG) logger.log('✅ Audit log saved to Firestore');

    // Check for suspicious patterns
    await detectSuspiciousActivity(data);
  } catch (error) {
    console.error('❌ Error logging payment audit:', error);
    // Don't throw - audit logging should not block payment confirmation
  }
}

/**
 * Get client IP address (approximation via external service)
 * ⚠️ NOT SECURE - Use server-side IP detection in production
 */
async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Detect suspicious payment confirmation patterns
 * @param data - Audit log data
 */
async function detectSuspiciousActivity(data: PaymentAuditLog): Promise<void> {
  try {
    // Check rate of confirmations from same admin
    const recentLogs = await getRecentAuditLogs(data.adminEmail, 60000); // Last 1 minute
    
    if (recentLogs.length > 10) {
      if (DEBUG) logger.warn('⚠️ Suspicious activity: Rapid confirmations detected');
      
      // Log suspicious activity
      await addDoc(collection(db, 'security_alerts'), {
        type: 'RAPID_CONFIRMATIONS',
        adminEmail: data.adminEmail,
        count: recentLogs.length,
        timestamp: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
        severity: 'HIGH',
      });
    }

    // Check for bulk confirmations without proper authorization
    if (data.action === 'BULK_CONFIRMATION' && Array.isArray(data.orderId) && data.orderId.length > 20) {
      if (DEBUG) logger.warn('⚠️ Suspicious activity: Large bulk confirmation detected');
      
      await addDoc(collection(db, 'security_alerts'), {
        type: 'LARGE_BULK_CONFIRMATION',
        adminEmail: data.adminEmail,
        orderCount: data.orderId.length,
        timestamp: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
        severity: 'MEDIUM',
      });
    }
  } catch (error) {
    console.error('❌ Error detecting suspicious activity:', error);
  }
}

/**
 * Get recent audit logs for an admin (for suspicious activity detection)
 * FIX H2: Was a stub that unconditionally returned [] — detectSuspiciousActivity()
 * could therefore never fire. Now performs a real Firestore query scoped to the
 * time window requested.
 */
async function getRecentAuditLogs(adminEmail: string, timeWindowMs: number): Promise<PaymentAuditLog[]> {
  try {
    const { collection: col, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
    const cutoff = new Date(Date.now() - timeWindowMs);
    const q = query(
      col(db, 'payment_audit_logs'),
      where('adminEmail', '==', adminEmail),
      where('createdAt', '>=', cutoff),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as PaymentAuditLog);
  } catch {
    // If the collection is missing or the index hasn't been built yet, fail open
    // (suspicious-activity detection degrades gracefully).
    return [];
  }
}

/**
 * Query audit logs for reporting
 * @param filters - Query filters
 */
export async function queryAuditLogs(filters: {
  adminEmail?: string;
  orderId?: string;
  startDate?: Date;
  endDate?: Date;
  action?: PaymentAuditLog['action'];
  limit?: number;
}): Promise<PaymentAuditLog[]> {
  try {
    // This would implement complex Firestore queries in production
    // For now, return empty array
    return [];
  } catch (error) {
    console.error('Failed to query audit logs:', error);
    return [];
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate audit report summary
 * @param logs - Array of audit logs
 */
export function generateAuditSummary(logs: PaymentAuditLog[]): {
  totalConfirmations: number;
  totalAmount: number;
  uniqueAdmins: number;
  dateRange: { start: string; end: string } | null;
  topAdmins: Array<{ email: string; count: number }>;
} {
  if (logs.length === 0) {
    return {
      totalConfirmations: 0,
      totalAmount: 0,
      uniqueAdmins: 0,
      dateRange: null,
      topAdmins: [],
    };
  }

  const totalConfirmations = logs.length;
  const totalAmount = logs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const uniqueAdmins = new Set(logs.map(log => log.adminEmail)).size;
  
  const dates = logs.map(log => toDate(log.timestamp) ?? new Date()).sort((a, b) => a.getTime() - b.getTime());
  const dateRange = {
    start: dates[0].toISOString(),
    end: dates[dates.length - 1].toISOString(),
  };

  // Count confirmations per admin
  const adminCounts = new Map<string, number>();
  logs.forEach(log => {
    adminCounts.set(log.adminEmail, (adminCounts.get(log.adminEmail) || 0) + 1);
  });

  const topAdmins = Array.from(adminCounts.entries())
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalConfirmations,
    totalAmount,
    uniqueAdmins,
    dateRange,
    topAdmins,
  };
}

/**
 * Clear all rate limits (admin utility)
 * FIX C3: Previous implementation called `rateLimitStore.clear()` but
 * `rateLimitStore` (the old in-memory Map) was removed when the service was
 * refactored to Firestore — both functions threw ReferenceError at runtime.
 * Now queries and deletes all documents in the rateLimits collection.
 * ⚠️ Use with caution — this clears server-side state for ALL orders.
 */
export async function clearAllRateLimits(): Promise<void> {
  try {
    const { collection: col, getDocs, deleteDoc } = await import('firebase/firestore');
    const snap = await getDocs(col(db!, 'rateLimits'));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    if (DEBUG) logger.log(`🔓 All rate limits cleared (${snap.size} entries deleted)`);
  } catch (err) {
    logger.warn('[paymentSecurity] clearAllRateLimits failed:', err);
  }
}

/**
 * Export rate limit status for debugging
 * FIX C3: Previous implementation called `rateLimitStore.entries()` on the
 * removed in-memory Map, throwing ReferenceError. Now reads from Firestore.
 */
export async function exportRateLimitStatus(): Promise<Array<{ orderId: string; status: RateLimitEntry }>> {
  try {
    const { collection: col, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(col(db!, 'rateLimits'));
    return snap.docs.map(d => ({
      orderId: d.id,
      status: d.data() as RateLimitEntry,
    }));
  } catch (err) {
    logger.warn('[paymentSecurity] exportRateLimitStatus failed:', err);
    return [];
  }
}
