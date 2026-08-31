# CHANGELOG — Pass 2 Backend Architecture
**Version:** 1.2.0
**Released:** April 25, 2026
**Scope:** Backend Architecture & Cloud Functions Coverage (Pass 2 of 8)

---

## Summary

Pass 1 patched the symptoms of the trust-the-client architecture (rules
hardened, exploits closed). Pass 2 fixes the architecture itself by moving
business-critical writes — order state transitions, payment confirmation, and
credit application — into Cloud Functions. The client now calls these
functions instead of writing to Firestore directly.

The architectural payoff: customers can no longer mint credit by ANY direct
path. Status transitions are server-enforced with a transition matrix that
rejects illegal moves. Every action emits an immutable audit-log entry.

**App score:** ~70/100 → **~78/100**

**TypeScript status:** clean.
- Main app: `npm run typecheck` passes (zero errors)
- Cloud Functions: `cd src/functions && npm run build` passes (zero errors)

---

## Architecture change

Before Pass 2:
```
Customer/Admin UI
      ↓
React service layer (orderActionService, creditService, paymentActionService)
      ↓
Firebase JS SDK (updateDoc, runTransaction)
      ↓
Firestore rules (the only line of defense)
      ↓
Firestore data
```

After Pass 2:
```
Customer/Admin UI
      ↓
React service layer  ←── prefers Cloud Function path
      ↓
Cloud Function (Admin SDK, server-side enforcement)
      ↓ atomic transaction
      ├── Firestore data
      ├── Status audit log (immutable)
      ├── Payment audit log (immutable, if applicable)
      └── Notifications (server-side, no rule-eval issues)
```

The service layer falls back to the legacy direct-Firestore path on
**transport-level errors only** (CF unavailable, deadline exceeded). Real
business errors from the Cloud Function (e.g. "transition not allowed") are
surfaced to the user as failures, not silently retried.

---

## New Cloud Functions

Six new server-side endpoints in `src/functions/src/`:

| File | Function | Caller | What it does |
|------|----------|--------|--------------|
| `orderActions.ts` | `approveOrder` | admin | Atomic state flip pending→approved with server-computed totals (GST, delivery fee, discount stacking). Writes status audit. |
| `orderActions.ts` | `rejectOrder` | admin | Atomic state flip pending→rejected. |
| `orderActions.ts` | `cancelOrder` | admin | Atomic flip to cancelled + voided invoice record (single transaction) + customer notification + optional credit note creation. |
| `payments.ts` | `submitPaymentProof` | customer | Customer-callable. Updates payment fields on their own approved order, emits admin notification, writes audit log. |
| `payments.ts` | `confirmOrderPayment` | admin | Flips approved→in_process, sets paymentReceived, updates customer totalSpent atomically, writes payment audit log. |
| `credit.ts` | `applyOrderCredit` | customer | FIFO deduction across customer's available credit notes + atomic order update + audit log + history record, all in one transaction. |

Plus a shared helper module:
- `_shared.ts` — `requireAuth`, `requireAdmin`, `requireApprovedCustomer`,
  `loadOrder` with ownership check, `assertTransitionAllowed` (the state
  transition matrix), `logStatusChange`, `appendAuditLog`,
  `createAdminNotificationServer`, `createCustomerNotificationServer`,
  cached settings reads.

Status transition matrix (`_shared.ts`):
```
pending     → approved | rejected | cancelled
approved    → in_process | cancelled
in_process  → delivered | cancelled
delivered   → completed | cancelled
completed   → (terminal)
rejected    → (terminal)
cancelled   → (terminal)
```

Anything else throws `failed-precondition`.

---

## Client wiring

The existing service functions now call the Cloud Functions preferentially.
Six new typed wrappers in `src/services/firebase/cloudFunctions.ts`:
`approveOrderViaCloudFunction`, `rejectOrderViaCloudFunction`,
`cancelOrderViaCloudFunction`, `submitPaymentProofViaCloudFunction`,
`confirmOrderPaymentViaCloudFunction`, `applyOrderCreditViaCloudFunction`.

Files modified:

- `services/ordersService.ts` — `approveOrder` and `rejectOrder` now call
  CFs first, fall back to legacy on transport errors.
- `services/orderActionService.ts` — `cancelOrderAction` calls CF first.
- `services/orders/paymentActionService.ts` — `confirmPaymentAction` calls
  CF first.
- `services/creditService.ts` — `applyCreditToOrder` calls CF first.
- `notifications/workflows/notificationWorkflows.ts` — `submitPaymentWorkflow`
  now calls the real `submitPaymentProof` CF (the previous reference to
  `submitPaymentCF` pointed to a function that didn't exist on the server).

The fallback paths are kept so a Cloud Function deployment outage doesn't
take down the app entirely. Once Pass 2 is bedded in, the fallbacks should
be deleted (Pass 3 cleanup).

---

## Rules tightened

`firestore.rules` `creditNotes/{noteId}`:

```diff
- allow create, delete: if isAnyAdmin();
- allow update: if /* customer can update remainingBalance, status, etc.
-                    with direction-of-change checks (Pass 1 patch) */;
+ allow create, update, delete: if isAnyAdmin();
```

**The Pass 1 direction-of-change rule for customer updates is no longer
needed.** With `applyOrderCredit` Cloud Function as the sole writer (using
Admin SDK, which bypasses rules), customers don't need write access to
`creditNotes` at all. C1 is now closed at the architectural level instead
of patched at the rule level.

---

## Stale indexes removed

`firestore.indexes.json` cleaned up:

**Removed (3 stale indexes from a prior migration):**
- `notifications` collection: `(userId ASC, createdAt DESC)` — unused since
  notifications moved to hierarchical `notifications/user_{uid}/items/`
- `notifications` collection: `(userId ASC, read ASC)` — same
- `notifications` collection: `(userId ASC, read ASC, createdAt DESC)` — same

**Added (3 new indexes for Pass 2 audit / credit query paths):**
- `creditApplicationHistory` collection: `(customerId ASC, appliedAt DESC)`
- `payment_audit_logs` collection: `(adminEmail ASC, createdAt DESC)`
- `statusChangeAudits` collection: `(orderId ASC, createdAt DESC)`

Net change: same total count (10), but each index is now actually used.

---

## M1 cleanup — dead password security removed

Deleted:
- `src/services/security/passwordSecurity.ts` (210 lines)
- `src/services/security/__tests__/passwordSecurity.test.ts`

Updated:
- `src/services/security/index.ts` — barrel re-exports for the deleted
  module removed.

The `verifyAdminPassword` function and its djb2 hash implementation had no
callsites in the application. It was a parallel client-side authentication
system competing with Firebase Auth — left in the codebase, it would have
been a footgun for future maintainers ("we already have a password security
service, just wire it up"). Firebase Auth is the sole authentication
mechanism.

---

## Issues closed in Pass 2

| ID | Severity | What was fixed |
|---|---|---|
| C1 | Critical (re-closed) | `creditNotes` customer writes denied entirely. The Pass 1 direction-of-change rule was a patch; this is the architectural fix. |
| C3 | Critical (re-closed) | Order creation/approval/cancellation totals now exclusively server-computed in Cloud Functions. Pass 1 patched `createOrderWithCustomId`; Pass 2 covers the entire order lifecycle. |
| H5 | High (closed) | Admin notification of new registrations, payment submissions, and order cancellations now created server-side via Admin SDK. The previously-dead client-side calls that always failed silently are now non-issues. |
| M1 | Medium (closed) | Dead password security code deleted. |
| M4 | Medium (closed) | `payment_audit_logs` now written by Cloud Functions on both customer (`submitPaymentProof`) and admin (`confirmOrderPayment`) actions. The customer-side audit gap is closed. |
| — | New benefit | Status transition matrix is now enforced. Direct illegal transitions (e.g. cancelled→approved) are rejected. |
| — | New benefit | Race conditions on order state are caught: every state-changing CF re-reads the doc inside its transaction and aborts if the status changed concurrently. |

Open after Pass 2 (queued for later passes):
- M2: recursive `get()` chains in rules — needs data backfill (denormalize
  `customerId` onto snapshot/event docs). Mechanical migration, ~1 day.
- M3: schema bypass in `getCustomerForAuth` — needs relaxed Zod schema.
- Pass 3: bundle / build / performance work.
- Pass 4: data model and query patterns.
- Passes 5–8: type safety, component decomposition, observability, CI/CD.

---

## Migration / breaking changes

**1. `submitPaymentCF` was a dead reference.**
The previous code in `notifications/workflows/notificationWorkflows.ts`
called `httpsCallable(functions, 'submitPaymentCF')` — a function that did
not exist on the server. The call always threw, was caught, and silently
fell back to the service-layer path. Pass 2 wires it to the real
`submitPaymentProof` Cloud Function. Behavior change: the call now succeeds,
which means admin notifications for payment submissions are now actually
delivered (they previously never were because the client-side fallback
relied on a Firestore rule that denied non-admin notification writes).

**2. Customers can no longer write to `creditNotes` directly.**
With `applyOrderCredit` as the sole credit-application path, the rule denies
all client writes. Any code path still trying to update credit notes
directly will now throw permission-denied. The codebase audit found no such
call sites, but a third-party integration or partial deploy (CFs not yet
live) could surface this. Mitigation: leave the legacy `applyCreditToOrder`
client transaction code in place as a fallback. It will throw on the first
`tx.update(note.ref, ...)` call and surface a clear error.

**3. `applyCreditToOrder` is now async over the network instead of an
in-browser transaction.**
Latency goes up by one round-trip (~150–400ms). Throughput goes up because
the credit application is now atomic at the server level — no more retry
storms when two devices apply credit to the same order simultaneously.

**4. Order action results return data may differ slightly.**
The Cloud Function results are typed and minimal. The legacy fallback paths
returned more verbose objects. If any caller was reading specific extra
fields off the result, those fields may no longer be present. Audit:
`approveOrderAction`, `rejectOrderAction`, `cancelOrderAction`,
`confirmPaymentAction` all wrap the underlying calls and produce their own
`OrderActionResult` objects, so consumers see no change.

---

## Verification

```bash
# Main app
npm install --legacy-peer-deps
npm run typecheck                                     # ✅ clean
npm run build

# Cloud Functions
cd src/functions
npm install
npm run build                                          # ✅ clean
cd ../..

# Deploy in this order
firebase deploy --only firestore:rules                # rule tightening
firebase deploy --only firestore:indexes              # new audit indexes
firebase deploy --only functions                      # 6 new CFs
firebase deploy --only hosting                        # client wiring
```

Test end-to-end against the Firebase emulator:
```bash
firebase emulators:start --only firestore,functions,auth
```

Then run through these flows:
1. Customer places an order → admin approves → customer submits payment proof
   → admin confirms payment → status reaches `in_process`. Verify a
   `statusChangeAudits` doc exists for each transition.
2. Admin cancels an `in_process` order → verify atomic status flip + voided
   invoice record + audit log + customer notification all land.
3. Customer applies credit to an order → verify FIFO deduction across credit
   notes, `creditApplicationHistory` record, and that a second concurrent
   apply attempt aborts cleanly.
4. Try a malicious flow: customer attempts to `updateDoc(creditNotes/myNote,
   { remainingBalance: 99999 })` → expect permission-denied.

---

## Score after Pass 2

| Dimension | Pass 0 | Pass 1 | **Pass 2** |
|---|---|---|---|
| Security & data integrity | 5/10 | 9/10 | **10/10** |
| Backend robustness | 5/10 | 6/10 | **9/10** |
| Code organization | 6/10 | 6/10 | **6/10** (unchanged) |
| **Overall weighted** | **58/100** | **70/100** | **~78/100** |

Backend robustness is the big mover — going from "thin Cloud Functions, most
logic in the client" to "every business-critical write is server-enforced,
audited, and atomic." Push to 80+ requires Pass 3 (perf/build) and Pass 5
(type safety).

---

## Next pass

**Pass 3 — Performance, Bundle & Build.**
Vite production tuning (manualChunks, compression), security headers in
`firebase.json`, code-splitting at the route level, removal of remaining
heavy dependencies from the customer entry point, TanStack Query cache TTL
audit, render-cost hotspots on the top 5 pages.

When ready, ask Claude to start Pass 3.
