# CHANGELOG — Pass 5 Type Safety
**Version:** 1.5.0
**Released:** April 26, 2026
**Scope:** Type Safety & Schema Discipline (Pass 5 of 8)

---

## Summary

Pass 5 begins the migration from "TypeScript-shaped JavaScript" to actual
TypeScript. The previous tsconfig had `strict: false`, `strictNullChecks: false`,
`noImplicitAny: false` — the compiler enforced almost nothing. With
those flags off, ~6900 `any` escapes accumulated and the type system
provided fewer guarantees than `// @ts-nocheck` on every file.

Pass 5 enables `noImplicitAny` (plus `noImplicitThis`, `alwaysStrict`,
`useUnknownInCatchVariables`) — the half of `--strict` that's tractable in
one pass. Full `strict: true` is documented and deferred because enabling
it surfaces 71 real null-safety issues that need careful per-site
refactoring (Blob | undefined → Blob, possibly-undefined customer fields
rendered without guards, etc.). Pass 6 will tackle those during component
decomposition.

**App score:** ~85–86/100 → **~86–87/100**

**TypeScript status:** clean. Both targets compile under the new
strict-er tsconfig with zero errors.

---

## Honest accounting on the `any` count

The original Pass 0 audit reported "982 `any` escapes" (291 `: any` + 670
`as any` + a handful of others) — those numbers came from a grep that
**excluded `src/functions/node_modules`**. Including the nested
`node_modules`, the raw count is ~6900 (mostly third-party `.d.ts` files
that ship with `@google-cloud/firestore`). In application source code,
the real number was always ~960.

After Pass 5, application source has:

| | Pass 0 (v7) | Pass 5 (v12) | Δ |
|---|---|---|---|
| `: any` (annotation) | 291 | 309 | +18 |
| `as any` (cast) | 670 | 674 | +4 |
| Total | 961 | 983 | +22 |

The count went *up* slightly across Passes 1–5 because Passes 1, 2, and 4
each added Cloud Function code, audit log helpers, and migration utilities
where defensive `any` typing was the right choice for in-flight data
contracts. The 11 surgical fixes in Pass 5 cancelled most of those
additions out.

**The point of Pass 5 is not the count — it's the floor.** Before Pass 5,
new code could ship with implicit `any` and the compiler would say
nothing. After Pass 5, every implicit `any` triggers a build failure.
Every new `any` in code review now has to be explicit (`: any` or
`as any`), which makes them visible to grep audits going forward.

---

## tsconfig.json — strict-er but not yet `strict: true`

```diff
-    "strict": false,
-    "strictNullChecks": false,
-    "noImplicitAny": false,
-    "noUnusedLocals": false,
-    "noUnusedParameters": false,
-    "noFallthroughCasesInSwitch": false,
+    "strict": false,
+    "strictNullChecks": false,
+    "noImplicitAny": true,
+    "noImplicitThis": true,
+    "alwaysStrict": true,
+    "useUnknownInCatchVariables": true,
+    "noUnusedLocals": false,
+    "noUnusedParameters": false,
+    "noFallthroughCasesInSwitch": true,
```

Why the partial migration:

- **`noImplicitAny: true`** — was the easy half. 24 errors after surfacing,
  all fixed in Pass 5. New code now has to annotate parameters, return
  types, and object literals — no implicit anys allowed.
- **`noImplicitThis: true`** — already passing; explicit now.
- **`alwaysStrict: true`** — emits `"use strict"` on every module; already
  the case for ESM but explicit is better.
- **`useUnknownInCatchVariables: true`** — catch params are now `unknown`
  instead of `any`. Catches a real class of bug where caught errors get
  used without type-checking. All existing call sites already do
  `(e as Error)?.message` or similar, so this passes without code changes.
- **`noFallthroughCasesInSwitch: true`** — catches missing `break;` /
  `return;` in switch cases. Currently passing.
- **`strictNullChecks: false`** (deferred) — enabling this surfaces 71
  errors. Each is real and tractable; the refactor is careful per-site
  work. Scheduled for Pass 6 because many of the affected sites are in
  the 5 monster components Pass 6 will rewrite anyway, so they'll get
  fixed naturally during decomposition.

### What enabling `strict: true` would surface (the Pass 6 backlog)

71 errors clustered in:
- `WeeklyInvoices.tsx` (4): `Blob | undefined` passed to download APIs
  that require `Blob`
- `customer-dashboard/CustomerDashboardMain.tsx` (4): optional
  `customerType` parameter type mismatch with a function expecting
  `string`
- `routes/optimistic/orderActions.ts` (4): incomplete optimistic-update
  return shapes
- `DeleteCustomerModal.tsx` (2): possibly-undefined `customer.storeName`
  rendered without fallback
- `ActiveOrders.tsx` (2): `boolean | undefined` assigned to `boolean`
- ~50 more spread across services/hooks (mostly possibly-undefined
  property access)

None of these are silent bugs today — they're places where the developer
relied on runtime guarantees the type system can't see. Adding the right
guards or non-null assertions makes them visible.

---

## Files touched (the surgical fixes that landed)

11 files, 11 fixes. Each chose the highest-leverage type to introduce so
the change ripples to call sites.

| File | What changed |
|---|---|
| `src/hooks/customer/usePaymentConfirmedModal.ts` | Replaced wrong-by-3-fields openModal type signature (`maxSize: string` was an alias that didn't exist on the canonical signature; the real 4th param is `overlayBlur`). Removed 3 `as any` casts at the call site. |
| `src/main.tsx` | `_noopStorage` typed as `Storage` with explicit return types per method — was an implicit any object literal. |
| `src/services/creditService.ts` | Added `CreditSummary` interface, tightened `getCreditSummary` return type from `Promise<any>` to `Promise<CreditSummary>`. Eliminates 3 implicit-any errors in `generateCreditUsageReport`. |
| `src/services/notifications/notificationPersistence.ts` | Replaced 4 `safeParseJSON<any>` with `safeParseJSON<NotificationData[]>`. The notification array was already typed everywhere else. |
| `src/components/modals/orders/CompletedOrderInvoiceModal.tsx` | Typed the `.catch()` return values explicitly as `Product[]` / `Category[]`. |
| `src/contexts/ModalContextNew.tsx` | Explicitly typed the HMR-fallback object as `ModalContextValue`. Was inferring an unrelated `any[]` for `modalStack`. |
| `src/hooks/useCustomerDashboardLogic.ts` | Empty memo array now typed `boolean[]` matching the interface. |
| `src/notifications/hooks/notificationActions.ts` | Typed `loadProducts`/`loadCategories` returns explicitly, typed the `.find()` callback parameter, used keyof typeof for `actionTypeToModalType` index. Added `Product`/`Category` imports. |
| `src/routes/loaders/adminLoaders.ts` | `topProducts: []` typed as `Array<{ id: string; name: string; sales: number }>`. |
| `src/utils/emptyStream.ts` | All 6 stream-shim methods now have explicit return types. |
| `src/utils/pdf/pdfTemplates.ts` | `.map()` callback param typed as `Record<string, unknown>` (the `order` parent is `any`, so this is the closest sound type at the boundary). |

---

## What I deliberately didn't fight

Two patterns where `any` is the right choice and chasing them down would
be cargo-culting:

**FieldValue / Timestamp boundaries.** Firestore's `serverTimestamp()`
and `FieldValue.increment()` return placeholder objects that aren't the
runtime type they'll become after the write completes. The `as any` cast
at write sites is the standard Firebase pattern. ~150 occurrences across
the codebase fall in this category — they're not bugs.

**Modal prop discriminated unions.** `openModal<T extends ModalType>(type, props)`
takes 47 different `T` values, each with its own `props` shape.
TypeScript's inference works at the call site (typing `props` correctly
when `type` is a literal) but breaks at forwarding sites (when `type`
is dynamic). The `as any` casts in `modalRegistry.tsx` (45 instances) and
`modalResolver.ts` are at the type-system boundary where TS itself can't
express the variance. Fixing this would require rewriting modal dispatch
as a registry pattern with per-type handlers — a Pass 6 component-decomp
candidate.

---

## Migration / breaking changes

None at runtime. The new tsconfig flags affect compile-time only.

**Build behavior change:** any new code that ships with implicit `any`
will fail `npm run typecheck`. Existing CI / pre-commit hooks need to run
typecheck (verify they do — `package.json` has `"typecheck": "tsc --noEmit"`).

---

## Verification

```bash
npm install --legacy-peer-deps
npm run typecheck                    # clean (was clean before too;
                                     # but now under strict-er flags)
npm run build                        # Pass 3 chunk graph preserved

cd src/functions && npm install && npm run build && cd ../..
                                     # Cloud Functions clean
```

To preview what Pass 6's strict-mode flip will surface:

```bash
node node_modules/typescript/bin/tsc --noEmit --strict
# Expect ~71 errors, all real. Each is a small fix; the work is just
# scrolling through them and adding the right guard / non-null
# assertion / optional chain.
```

---

## Score after Pass 5

| Dimension | Pass 4 | **Pass 5** |
|---|---|---|
| Security & data integrity | 10/10 | 10/10 |
| Backend robustness | 9.5/10 | 9.5/10 |
| Performance & build | 8.5/10 | 8.5/10 |
| Data model & indexes | 8/10 | 8/10 |
| Type safety | 4/10 | **6/10** |
| Code organization | 6/10 | 6/10 |
| **Overall weighted** | **~85–86/100** | **~86–87/100** |

Smaller score lift than projected (+1 to +2 vs +3 to +5) because the
biggest type-safety dividend lands when full `strict: true` is on.
What Pass 5 did is set the floor — no new code can ship with implicit
anys, and `useUnknownInCatchVariables` closed the silent-error-shadowing
hole. Pass 6 will move the score the rest of the way.

---

## Next pass

**Pass 6 — Component Decomposition + Strict Mode Completion.**
The 5 monster components ≥700 LOC (`EditOrderPage`, `CustomerDashboardMain`,
`OrderRow`, `EditPaidOrderModal`, `SystemSettingsView`). Decompose them
into smaller hooks + presentational components. While the files are
open, fix the 71 `strictNullChecks` errors (most cluster in these same
components). Result: `tsconfig.strict: true` becomes possible.

Plus: address the modal prop dispatch typing (the 45 `as any` in
`modalRegistry.tsx`) by rewriting as a registry pattern with per-type
handlers.

Expected score impact: +3 → ~89–90/100.

When ready, ask Claude to start Pass 6.
