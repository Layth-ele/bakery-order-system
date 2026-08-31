# CHANGELOG — Pass 10: Test Suite Hardening + GST Rate Single Source of Truth
**Version:** 1.8.2
**Released:** April 27, 2026
**Scope:** Make `npm test` pass on a clean install, eliminate hardcoded 5% GST
on the active order-submission path, and close one latent module-init bug.

---

## Why this pass

Pass 9 declared the codebase deployable at ~93/100. A follow-up audit on the
actual code (not the changelogs) and a real test run on a clean checkout
surfaced that:

1. `npm run test` fails immediately on a clean install. 3 of 13 test files
   refuse to load because of broken vitest setup.
2. The customer order-submission path hardcodes `GST_RATE = 0.05` even though
   the admin Settings UI lets you change `gstRate`. Once the Pass 2 server-
   authoritative path activates with a non-default rate, **every order will
   trip `PRICE_TAMPERING_ATTEMPT`** at the 1¢ tolerance check.
3. `firebase/config.ts` has a code path where `db` is never assigned. Masked
   today by `isFirebaseConfigured = true` being hardcoded; would crash
   immediately if that line ever reverted to env-driven, as the comments
   above it suggest is the intended design.

This pass ships small, surgical patches for all three. No component code
changes. No business-logic changes beyond the GST rate plumbing.

**Verification (clean install):**
```
npx tsc --noEmit            → 0 errors  (was 0, still 0)
npx vitest run               → 12/12 files, 203/203 tests pass
                              (was 10/13 files, 194/197 tests pass)
```

---

## Bugs fixed

| # | Severity | Subsystem                | Symptom                                                                 |
|---|----------|--------------------------|-------------------------------------------------------------------------|
| 1 | High     | Test infra               | `npm run test` fails on clean install (rules tests need emulator)       |
| 2 | High     | Test infra               | `orderCalculations.test.ts` fails to load (no `firebase/functions` mock)|
| 3 | Medium   | Test infra               | `cutoffPolicy.test.ts` 3 tests fail with `Cannot find module`           |
| 4 | High     | Pricing — order create   | Hardcoded 5% GST trips price-tampering alerts under non-default rate    |
| 5 | Medium   | Pricing — credit notes   | Same hardcoded rate breaks credit-note ↔ order reconciliation           |
| 6 | Medium   | Cloud Function           | `getTaxRate()` only reads `taxRate`, ignores `gstRate` (the real field) |
| 7 | Low      | Firebase init            | `db` not assigned in `!isFirebaseConfigured && getApps().length===0`    |
| 8 | Trivial  | Imports                  | Two unused imports (`getAvailableCredit`, `connectFunctionsEmulator`)   |

---

## Files changed

### `vitest.config.ts`
Added `exclude: ['src/__tests__/rules/**', ...]` to the test config. Rules tests
import `@firebase/rules-unit-testing` (not in `package.json`) and require a
running Firestore emulator to mean anything. The project already has a
dedicated `npm run test:rules` script that wraps them in `firebase
emulators:exec`. Including them in the default `npm run test` made every CI
run fail during dependency resolution before any real test could execute.

### `src/tests/setup.ts`
Three changes:

1. **Added `vi.mock('firebase/functions', ...)`.** `services/firebase/cloudFunctions.ts`
   calls `getFunctions(app)` at module-load time. Several smoke tests
   transitively import it (via `ordersService → orderWorkflowService → ...`).
   Without this mock the entire test file fails to even *load* — surfacing as
   `"No 'app' export"` errors that were misleadingly attributed to the next
   issue below.
2. **Added `app: {}` and `analytics: null` to the `@/firebase/config` mock.**
   `cloudFunctions.ts` imports `app`. The existing mock omitted it, so
   importing the file blew up. Stub object is fine — the firebase/functions
   mock above ignores the value.
3. **Removed the `Module._load` patch.** It was a 24-line monkey-patch trying
   to bridge `require()` calls in `cutoffPolicy.test.ts` to `vi.mock()`'s
   ESM registry. The patch never worked reliably. Now obsolete because the
   test file itself no longer uses `require()` (see next file).

### `src/services/policies/__tests__/cutoffPolicy.test.ts`
Replaced three inline `require('../../../utils/weekSelection')` calls with a
top-level ESM import:

```ts
import * as weekSelection from '../../../utils/weekSelection';
// ... in test bodies:
vi.mocked(weekSelection.isBeforeThursdayCutoff).mockReturnValue(false);
```

This is the idiomatic Vitest pattern. Works in both jsdom and node
environments without ad-hoc Module._load patching. All three previously-
failing tests now pass.

### `src/services/orderCreationService.ts`
**The high-severity fix.** Replaced:

```ts
const GST_RATE = 0.05;
```

with an async helper:

```ts
async function resolveGstRate(): Promise<number> {
  try {
    const settings = await getSettings();
    for (const c of [settings.gstRate, settings.taxRate]) {
      if (typeof c === 'number' && Number.isFinite(c) && c >= 0 && c < 1) {
        return c;
      }
    }
  } catch (e) {
    console.warn('[orderCreationService] Could not load settings for GST rate, using fallback:', e);
  }
  return FALLBACK_GST_RATE; // 0.05
}
```

Order of preference: `gstRate` (the field admin Settings UI writes) →
`taxRate` (legacy alias documented in `SystemSettings`) → `0.05` fallback if
both are missing or invalid. Mirrors the same helper added to
`functions/src/orders.ts` (Fix #6 below) so client and server agree.

**Why high-severity:** Pass 1 added a 1¢-tolerance comparison between client-
submitted and server-recomputed totals in the Cloud Function, with anything
larger throwing `failed-precondition` AND writing a `PRICE_TAMPERING_ATTEMPT`
record at `severity: HIGH` to `security_alerts`. With this client/server GST
disagreement, every order over $20 would trip that alert once Pass 2's
`createOrderWithCustomId` migration goes live. Fixing it now means that
migration won't generate a false-positive alert storm on day one.

### `src/services/creditService.ts`
Same fix in `createCreditNote()`. Credit notes use the GST rate to split an
inclusive total into subtotal+GST, then store both. If admin changes the
rate but credit notes keep splitting at 5%, CN GST values will not reconcile
against the orders they originated from, breaking GST report totals on the
admin financial dashboard. Falls back to 0.05 on settings read errors so
credit-note creation never fails purely from a settings-fetch problem.

Added import: `import { getSettings } from './data/settingsDataService';`

### `src/functions/src/orders.ts`
`getTaxRate()` now reads `gstRate` first, then falls back to `taxRate`,
then to 0.05. Previously read only `taxRate`. The admin Settings UI writes
`gstRate` (`taxRate` is the legacy alias per `SystemSettings`), so the
function would silently keep using 5% even after admin updated the rate
in the UI.

### `src/firebase/config.ts`
Added the missing `else { db = getFirestore(app); }` branch on first-init.
Previously when `getApps().length === 0` AND `isFirebaseConfigured` was
false, `db` would only be assigned in the catch block — but the catch
block guards `if (!db!)`, which TypeScript can't see is meant to handle
"never assigned" vs "assigned to falsy". Hardcoded `isFirebaseConfigured = true`
masks this today, but the code shape suggests env-driven config was the
intended design and the bug would surface the moment that's restored.

### `src/hooks/useCachedFirebase.ts`
Removed unused `import { getAvailableCredit } from '../services/creditService'`.
`useCachedCreditBalance` uses a dynamic `import('../firebase/firestore')` for
`getCreditNotes` instead. The unused import was harmless but added a
cycle-prone dependency edge between two large modules.

### `src/services/firebase/cloudFunctions.ts`
Removed unused `connectFunctionsEmulator` from the import statement. The
only reference was inside a commented-out block. Trimmed the import to
match what's actually used; left a note above the dead block on how to
re-enable it if someone wants emulator support later.

---

## What's NOT fixed (deferred)

### `BUSINESS_RULES.GST_RATE = 0.05` in `src/constants/businessRules.ts`

Used by:
- `src/hooks/customer/useOrderPricing.ts:42`
- `src/hooks/useCustomerDashboardLogic.ts:370`
- `src/services/customer/customerDashboardService.ts:214`
- `src/constants/pricing.ts:86,103`
- `src/components/modals/admin/AddCreditModal.tsx:54`
- `src/components/modals/orders/CancelledOrderDetailsModal.tsx:127`

These are all **display-time** computations — preview totals shown while a
customer fills the cart, refund summaries on cancelled-order modals, etc.
The actual order *submitted* now uses `resolveGstRate()` correctly (Fix #4
above), so the persisted total on the order document is right.

The discrepancy: between admin updating the rate in Settings and refreshing
the customer's tab, the cart preview will show stale GST. The submitted
total will be correct. This is a UX rather than financial-integrity issue.

Plumbing the live `gstRate` into these synchronous hooks/components is a
non-trivial refactor (they'd all need to subscribe to `useCachedSettings`
and re-render on rate changes). Should be its own pass with its own
component test coverage. Filing as Pass 11 follow-up.

### Other items still on the backlog from Pass 8/9

- Component decomposition of the 44KB `EditOrderPage.tsx` and 43KB `OrderRow.tsx`
- Modal registry rewrite
- Hook/service test coverage expansion
- 92 `console.log` cleanup → proper logger
- Visual regression tests

None are deployment blockers.

---

## Score after Pass 10

| Dimension                      | Pass 9     | **Pass 10**                                |
|--------------------------------|------------|---------------------------------------------|
| Security & data integrity      | 10/10      | **10/10**                                   |
| Backend robustness             | 10/10      | **10/10**                                   |
| Performance & build            | 9/10       | 9/10                                        |
| Data model & indexes           | 8/10       | 8/10                                        |
| Type safety                    | 9.5/10     | 9.5/10                                      |
| Code organization              | 7/10       | 7/10                                        |
| Observability & ops            | 8/10       | 8/10                                        |
| Frontend reliability           | 9/10       | 9/10                                        |
| **Test infrastructure**        | 6/10       | **9/10** (clean install passes 12/12)       |
| **Pricing correctness**        | 7/10       | **9.5/10** (single source of truth on submit)|
| **Overall weighted**           | **~93/100**| **~94/100**                                 |

The score moves modestly because the changes are infrastructure-level. The
real wins are: (a) CI now goes green on a fresh clone, and (b) the latent
PRICE_TAMPERING_ATTEMPT minefield under Pass 2's order migration is defused.
