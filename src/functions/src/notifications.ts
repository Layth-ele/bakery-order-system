/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS FILE WAS REMOVED - DO NOT RE-ADD WITHOUT READING THIS NOTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FIX T2R6-H4 (HIGH — privilege escalation primitive): This file previously
 * exported a `createAdminNotification` callable Cloud Function that:
 *   - Only required `request.auth` (any signed-in user, including pending /
 *     rejected customers)
 *   - Performed NO field validation on type / title / message / actions
 *   - Wrote directly to `notifications/admin/items/{notificationId}` using
 *     the Admin SDK (bypassing the post-T2R8-C1 Firestore rules that DO
 *     restrict customer client writes)
 *
 * The function was NEVER exported from `index.ts` — so it was not actually
 * deployed.  But its presence in source was a landmine: if anyone added
 * `export { createAdminNotification } from './notifications'` to index.ts
 * (e.g. to "fix" a perceived missing notification feature), the moment that
 * deploy went live, ANY signed-in user could write arbitrary phishing
 * notifications to the admin feed via Admin SDK — with rules bypass making
 * the T2R8-C1 fix moot for that path.
 *
 * The legitimate server-side notification helper is
 * `createAdminNotificationServer` in `_shared.ts`, which is a private
 * internal function (not exported as a callable) used only by other CFs
 * (e.g. `payments.ts:submitPaymentProof` line 99).  Other CFs can import
 * it and trust the caller is already authenticated and authorized.
 *
 * If you genuinely need a customer-facing callable that creates admin
 * notifications, the design must be:
 *   1. Auth check: caller is approved customer
 *   2. Type whitelist (PAYMENT_SUBMITTED, ORDER_PLACED_TRACKING, etc)
 *   3. orderId required AND verified to belong to the calling customer
 *      (a `db.collection("orders").doc(orderId).get()` then
 *       `if (snap.data()?.customerId !== request.auth.uid) throw ...`)
 *   4. Rate limit (e.g. via security_alerts ledger) to prevent spam
 *   5. Sanitize title/message (no HTML, length caps)
 *
 * Even then, it's almost always better to use a Firestore trigger on the
 * relevant data collection (orders, payments) than a client-callable —
 * the trigger fires on the *event* you actually want to notify about,
 * with no client surface at all.
 *
 * Contact the security audit owner before re-adding any client-callable
 * notification function.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Empty module export so legacy `import { ... } from './notifications'`
// still type-resolves to nothing.
export {};
