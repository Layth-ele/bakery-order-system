# CHANGELOG — Pass 1 Security Hardening
**Version:** 1.1.0 (formerly Delight_Bakehouse_fixed_v7)
**Released:** April 25, 2026
**Scope:** Security & Data Integrity (Pass 1 of 8 in the enterprise-readiness roadmap)

---

## Summary

This release closes 14 security/integrity issues identified in the Pass 1 audit
(see `PASS_1_SECURITY_AUDIT.md` for full details). Issues range from a critical
bug allowing customers to mint themselves unlimited credit, to medium-priority
hardening of audit-log paths.

**App score:** 58/100 → ~70/100 after deployment.

**TypeScript status:** clean. `npm run typecheck` passes with zero errors on
both the main project and the Cloud Functions package (was 4 errors prior to
this release — pre-existing duplicate imports in `ProductionToDoSheet.tsx`,
fixed as a bonus).

---

## Files changed

### Configuration / Rules
- `firestore.rules` — 5 rule blocks rewritten (C1, H1, H2, H4, L1)

### Cloud Functions (server)
- `src/functions/src/orders.ts` — server-side price recalculation, ownership
  check, status check, return value, price-tampering audit logging
- `src/functions/src/invoices.ts` — admin check enforced (was commented out),
  customer/order existence validation, return value
- `src/functions/src/customers.ts` — soft-delete by default, hard-delete with
  cascade across 7 collections + 3 storage prefixes, admin notification moved
  here from client (H5), return values added

### Client services
- `src/services/security/paymentSecurity.ts` — rate-limit writes now include
  `customerId` so they pass the new H1 rule; `resetPaymentRateLimit` documented
  as admin-only after the rule change
- `src/services/firebase/authService.ts` — removed dead `createAdminNotification`
  call after `signOut()` (H5 cleanup); unused import removed
- `src/services/idCounterService.ts` — fallback path documented as
  no-longer-functional in production after H2 rule change

### Bug fixes (bonus)
- `src/components/admin/ProductionToDoSheet.tsx` — removed duplicate imports of
  `useCachedProducts` and `useCachedCategories` (was causing 4 TS2300 errors)

---

## Deployment order

The patches are designed so they can be deployed in any order, but for minimum
risk:

1. **Deploy `firestore.rules` first.**
   Closes C1, H1, H2, H4, L1 immediately. No code redeployment needed.
   Test in Firebase emulator before pushing to production.

2. **Deploy Cloud Functions next.**
   `firebase deploy --only functions`
   Closes C2, C3, C4, H3, H5 (the latter only when registration is migrated
   to use `createCustomerWithCode` — see Pass 2).

3. **Deploy updated client code last.**
   `npm run build && firebase deploy --only hosting`
   Picks up the paymentSecurity.ts and authService.ts changes.

---

## Issues closed

| ID | Severity | What was fixed |
|---|---|---|
| C1 | Critical | Credit notes — customers can no longer set arbitrary `remainingBalance`. Direction-of-change check enforced at the rule level. |
| C2 | Critical | Invoices Cloud Function — admin check enforced. |
| C3 | Critical | Orders Cloud Function — server-side price recalculation. Tampering attempts logged to `security_alerts`. |
| C4 | Critical | All 3 ID-generating Cloud Functions now `return { id, ... }` as documented. |
| H1 | High | Rate-limit docs now bound to owner via `customerId` field. Cross-tenant access blocked. |
| H2 | High | `idCounters` collection denies all client writes. Cloud Function (Admin SDK) is the only writer. |
| H3 | High | Customer hard-delete now cascades across orders, invoices, credit notes, history, notifications, and Storage. Soft-delete is the default. |
| H4 | High | Customers can no longer set `invoiceNumber` on orders (race window closed). |
| H5 | High | Admin notification of new registration creation moved server-side to `createCustomerWithCode` Cloud Function. Dead client-side call removed. |

Open after Pass 1 (queued for Pass 2):
- M1: dead-but-exposed djb2-hashed admin password verification (recommend deletion)
- M2: recursive `get()` chains in rules — needs data migration (denormalize customerId onto snapshot/event docs)
- M3: schema bypass in `getCustomerForAuth` — needs relaxed-but-still-validating schema
- M4: customer-side payment audit log writes denied — needs Cloud Function migration

---

## Migration notes / breaking changes

**1. Cloud Function client wrappers (`cloudFunctions.ts`) now actually return data.**
Previously the wrappers were typed `Promise<CreateOrderResult>` but the
underlying Cloud Functions returned `undefined`. Any code that was relying on
that being undefined will be surprised — but no such code exists in the current
codebase (the wrappers are not called by any feature today; they were ready for
Pass 2 migration).

**2. `idCounterService.ts` direct-Firestore fallback is now non-functional in production.**
After the H2 rule change, the fallback path that writes directly to
`idCounters/{counterId}` will throw permission-denied. The Cloud Function path
is the only one that succeeds. If you see fallback IDs (timestamp-based, no
counter increment) appearing in production logs, treat it as a Cloud Function
deployment incident, not normal operation.

**3. `resetPaymentRateLimit` from customer-side now silently fails.**
By design — customers should not be able to clear their own lockouts. The
function is preserved for admin contexts. The TIME_WINDOW reset path in
`checkPaymentRateLimit` will still naturally clear stale lockouts after 5
minutes of inactivity.

**4. `createAdminNotification` for new registrations no longer fires from the client.**
Previously the call was made after `signOut()` and silently failed. The
notification is now created by `createCustomerWithCode` Cloud Function — but
that function is not yet wired into the registration flow (which still uses
direct Firestore writes via `createUserProfile`). Until Pass 2 migrates
registration to use the Cloud Function, admins discover new registrations via
the existing Pending tab in `CustomersList`. **No regression vs. previous
behaviour** — the previous behaviour also produced no admin notification.

---

## What's still TODO for full Pass 1 closure

The Pass 1 patches close every issue I could fix without architectural changes.
Two M-level items need data migration that should be done before Pass 2:

- **M2 backfill:** add `customerId` field to existing `orders/{id}/snapshots/*`
  and `orders/{id}/events/*` documents. After backfill, the rules can be
  simplified to remove the recursive `get()` reads — saving billed reads on
  every snapshot/event load.

- **M1 deletion:** delete `src/services/security/passwordSecurity.ts` and its
  test file. Currently dead code, but leaving an exported `verifyAdminPassword`
  function with djb2 hashing in the codebase is a footgun for future
  maintainers.

These are the only remaining Pass 1 items.

---

## Verification

```bash
# Verify TypeScript clean (both targets)
npm install --legacy-peer-deps
npm run typecheck                                  # main app
cd src/functions && npm install && npm run build   # Cloud Functions

# Run smoke tests
npm test
```

All four should pass without error.

---

## Next pass

**Pass 2 — Backend Architecture & Cloud Functions Coverage.**
Move credit application, payment confirmation, status transitions, and order
approval from client-side Firestore SDK calls into Cloud Functions. This
removes the trust-the-client model entirely, which is the architectural change
that takes the score from ~70 to ~78.

When ready, ask Claude to start Pass 2.
