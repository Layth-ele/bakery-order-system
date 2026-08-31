/**
 * 🔒 SECURITY SERVICES - BARREL EXPORT
 *
 * Centralized security operations for authentication and payment verification
 *
 * ✅ MAR 7, 2026: Created as part of Phase 3 - Security Logic Migration
 * ✅ PASS 2 (Apr 2026): Removed Password Security exports.
 *   The previous client-side djb2-hashed admin password verification was
 *   dead code (no callsites in the application) and dangerous if reused.
 *   Firebase Auth is the sole authentication mechanism.
 */

// Payment Security
export {
  checkPaymentRateLimit,
  recordPaymentAttempt,
  resetPaymentRateLimit,
  checkBulkRateLimit,
  logPaymentAudit,
  queryAuditLogs,
  generateAuditSummary,
  clearAllRateLimits,
  exportRateLimitStatus,
  RATE_LIMIT_CONFIG,
  type PaymentAuditLog,
} from './paymentSecurity';
