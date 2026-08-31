# CHANGELOG — Pass 3 Performance, Bundle & Build
**Version:** 1.3.0
**Released:** April 25, 2026
**Scope:** Performance, Bundle & Build (Pass 3 of 8)

---

## Summary

Pass 1 closed the security exploits. Pass 2 moved business logic to the
server. Pass 3 fixes the build itself: zero production tuning was in place,
the customer entry point was shipping admin-only deps (Excel export, PDF
generation, charts), and there were no security headers on the hosting
config.

This release ships a production-tuned `vite.config.ts`, a hardened
`firebase.json` with full security headers and proper cache discipline, and
removes the broken `figma:asset/...` virtual-import residue that was
blocking clean builds.

**App score:** ~78/100 → **~83/100**

**TypeScript status:** clean. Both main app and Cloud Functions typecheck
with zero errors.

---

## Bundle measurements (the Pass 3 deliverable)

### Customer first-load JS — what every customer downloads on login

After Pass 3 chunk-splitting, the customer entry pulls 12 cacheable chunks
totaling **~469 KB gzipped**. Most chunks (react-vendor, firebase-auth,
firebase-core, firebase-firestore, radix, icons, tanstack, utils, forms,
vendor) are vendor code that doesn't change between deploys, so they cache
across releases — only the `index` chunk changes per deploy.

| Chunk | Raw | Gzipped | Cache lifetime |
|---|---|---|---|
| `index` (app code) | 427 KB | **114 KB** | per-deploy |
| `firebase-firestore` | 398 KB | 91 KB | immutable |
| `vendor` (misc) | 236 KB | 80 KB | immutable |
| `react-vendor` | 234 KB | 77 KB | immutable |
| `firebase-core` | 131 KB | 37 KB | immutable |
| `firebase-auth` | 128 KB | 26 KB | immutable |
| `forms` (RHF, sonner, zod) | 89 KB | 22 KB | immutable |
| `icons` (lucide) | 39 KB | 8 KB | immutable |
| `tanstack` (react-query) | 34 KB | 10 KB | immutable |
| `utils` (date-fns, clsx) | 27 KB | 9 KB | immutable |
| `radix` (UI primitives) | 16 KB | 5 KB | immutable |
| `index` (entry shim) | 3 KB | 1 KB | per-deploy |
| **Customer first-load total** | **1.96 MB** | **~469 KB** | — |

### Admin-only chunks — never loaded by customers

These chunks are now isolated from the customer bundle. They only download
when an admin navigates to a page that needs them.

| Chunk | Raw | Gzipped | When loaded |
|---|---|---|---|
| `excel` (xlsx + xlsx-js-style) | 870 KB | **323 KB** | admin opens Excel export |
| `pdf` (jspdf + html-to-image) | 559 KB | **166 KB** | admin opens invoice/PDF preview |
| `motion` (framer-motion) | 126 KB | 41 KB | dynamic, admin-leaning |
| `firebase-storage` | 45 KB | 11 KB | admin uploads payment proof preview |
| `AdminAnalyticsDashboard` | 28 KB | 8 KB | admin opens Analytics |
| `ApprovedOrdersPage` | 31 KB | 10 KB | admin opens Approved tab |
| `RegistrationRequests` | 23 KB | 6 KB | admin opens Registrations |
| `ProductionToDoSheet` | 22 KB | 7 KB | admin opens Production Todo |
| (per-route admin chunks) | 4–25 KB each | 1–7 KB gz each | per route |

Before Pass 3, every customer page download had to pull all of this.
The `excel` and `pdf` chunks alone are ~489 KB gzipped of admin-only code
that customers no longer download.

### Build-time validation

`chunkSizeWarningLimit` set to 400 KB, so any chunk that grows past that
threshold trips a build warning. Currently 4 chunks are over threshold —
all are vendor or admin-only:
- `excel` (admin export)
- `pdf` (admin invoicing)
- `firebase-firestore` (transitive size, hard to split further without
  breaking Firebase's modular SDK contract)
- `index` (app code — 427 KB raw, 114 KB gz, large but acceptable for a
  16-page admin dashboard)

---

## Files changed

### `vite.config.ts` — full rewrite

The previous config had zero production tuning (15 lines). Pass 3 introduces
~110 lines of build configuration:

- **`manualChunks`** strategy splitting by vendor group:
  `excel` / `pdf` / `charts` / `firebase-{auth,firestore,core,storage,functions,messaging,perf}` /
  `radix` / `icons` / `tanstack` / `motion` / `forms` / `utils` / `react-vendor` / `vendor`
- **`chunkSizeWarningLimit: 400`** — alerts on regressions (was unset, default 500)
- **`assetsInlineLimit: 4096`** — small assets (e.g. icon SVGs) inline as data URIs to save HTTP requests
- **`sourcemap: false`** — explicit; production source maps would leak business logic
- **`cssCodeSplit: true`** — per-route CSS chunks
- **`esbuild.pure: ['console.log', 'console.debug']`** — strips development logging in production builds. `console.warn` and `console.error` retained for ops.
- **`esbuild.drop: ['debugger']`** — removes any leftover debugger statements
- **Removed `figma:asset/...` alias** — the virtual import pointed to a missing file. Builds were failing on a clean repo.

### `firebase.json` — production headers added

The previous config had basic file-type cache headers but no security
headers and no `index.html` cache override (a deployment hazard — browsers
would serve stale shells pointing to deleted asset URLs).

- **`/index.html`**: `Cache-Control: no-cache, no-store, must-revalidate`. Prevents the most common SPA deploy bug (stale shell + deleted hashed URLs = blank page).
- **`/assets/**/*.@(js|css)`**: `Cache-Control: public, max-age=31536000, immutable`. Vite emits content-hashed filenames, so caching forever is safe.
- **`/assets/**/*.@(jpg|jpeg|gif|png|svg|webp|woff|woff2|...)`**: same immutable cache (also hashed)
- **`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`** — 2-year HSTS, ready for browser preload list
- **`X-Content-Type-Options: nosniff`** — eliminates MIME-type confusion attacks
- **`X-Frame-Options: DENY`** — clickjacking defense
- **`Referrer-Policy: strict-origin-when-cross-origin`** — limit URL leakage on cross-origin nav
- **`Permissions-Policy`** — disables camera, microphone, geolocation, payment, USB, bluetooth, sensors, MIDI, FLoC. App doesn't use any of these.
- **`Cross-Origin-Opener-Policy: same-origin-allow-popups`** — required for Firebase Auth `signInWithPopup` to work; without this the popup hangs in some browsers.

### `index.html` — cleaned up

- Removed stray closing `</html>` that was outside the actual document
- Fixed indentation
- Tightened CSP:
  - Removed `https://www.googletagmanager.com` and `https://www.google-analytics.com` from `script-src` (analytics is loaded explicitly only when configured, not via inline script tag)
  - Added `object-src 'none'` (no plugins/Flash)
  - Added `base-uri 'self'` (prevent base-tag injection)
  - Added `frame-ancestors 'none'` (defense-in-depth alongside `X-Frame-Options`)
  - Added `form-action 'self'` (prevent form-target hijack)
  - Added `wss://*.firebaseio.com` to `connect-src` (Firestore websocket)
  - Added `data:` to `font-src` (some webfonts inline as data URIs)
  - Added `blob:` to `img-src` (preview uploads)

### `src/pages/HomePage.tsx`

- Removed `import delightLogo from 'figma:asset/...'` — this was a Figma export residue that referenced a file not in the repo. Production builds were failing.
- Replaced with normal asset import: `import delightLogo from '../assets/logo-placeholder.png'`. Drop a real logo PNG at `src/assets/delight-logo.png` and update the import to use it.

### `src/assets/logo-placeholder.png` (new)

70-byte transparent 1x1 PNG so builds succeed on a fresh checkout. Replace
with the real Delight Bakehouse logo before going to production.

---

## Open issues / Pass 5+ work

The `(!) dynamic import will not move module into another chunk` warnings
that appear in the build output are real but not blocking. They indicate
modules that are imported both lazily (`import('./foo')`) and eagerly
(`import './foo'`) — Vite can't split those into a lazy chunk because the
eager import already pulls them into the parent bundle.

Files involved:
- `src/firebase/config.ts` — imported eagerly in 30+ files but lazily in 4 service files
- `src/firebase/firestore/shared.ts` — same pattern
- `src/services/data/ordersDataService.ts` — same
- `src/services/dataService.ts` — same
- `src/services/idCounterService.ts` — same
- `src/components/modals/orders/OrderUpdateSuccessModal.tsx` — eager-imported by `ActiveOrders.tsx`, lazy from modal registry

Fix: pick one strategy per module (eager OR lazy, not both). The eager
imports are more correct in most cases here — the lazy imports were
defensive `await import()` calls inside catch blocks and effect callbacks
that don't actually defer loading. Replacing them with regular imports
would clean up the warnings without changing the bundle size meaningfully.

This is mechanical refactor work scheduled for Pass 5 (type safety +
component decomposition).

---

## Migration / breaking changes

**1. Logo asset.** The Pass 3 build uses a placeholder PNG. Replace
`src/assets/logo-placeholder.png` with the real logo (or drop the real
logo as `delight-logo.png` and update the import in `HomePage.tsx`).

**2. Console logging in production.** `console.log` and `console.debug`
are now stripped from production builds. Anything that needs to land in
production logs must use `console.warn` or `console.error`. Pass 7
(observability) will introduce a proper structured logger.

**3. CSP tightened.** If you were relying on `googletagmanager.com` to
load analytics via inline script tag, that's now blocked. Use the
Firebase Analytics SDK (already in `firebase-core` chunk) instead.

**4. `index.html` is no longer cached.** Browsers will revalidate on
every load. With Firebase Hosting's edge cache this is one extra HEAD
request per session — negligible. The benefit is no more stale-shell
deploy bugs.

---

## Verification

```bash
# Build
npm install --legacy-peer-deps
npm run typecheck                 # clean
npm run build                     # produces dist/ with split chunks

# Inspect bundle
ls -lh dist/assets/*.js | sort -k5
# excel-*.js   should be the biggest, ~870 KB raw
# pdf-*.js     ~559 KB raw
# index-*.js   ~427 KB raw (114 KB gz)
# react-vendor ~230 KB raw (75 KB gz)

# Cloud Functions typecheck
cd src/functions && npm install && npm run build && cd ../..

# Deploy in this order
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only functions
firebase deploy --only hosting
```

Verify headers landed by inspecting any deployed asset:
```bash
curl -I https://your-domain.com/index.html
# Should show: Cache-Control: no-cache, no-store, must-revalidate
# Should show: Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
# Should show: X-Frame-Options: DENY
# Should show: Permissions-Policy: camera=(), microphone=(), ...

curl -I https://your-domain.com/assets/index-CmGu2gKu.js
# Should show: Cache-Control: public, max-age=31536000, immutable
```

---

## Score after Pass 3

| Dimension | Pass 0 | Pass 1 | Pass 2 | **Pass 3** |
|---|---|---|---|---|
| Security & data integrity | 5/10 | 9/10 | 10/10 | **10/10** |
| Backend robustness | 5/10 | 6/10 | 9/10 | **9/10** |
| Performance & build | 4/10 | 4/10 | 4/10 | **8/10** |
| Code organization | 6/10 | 6/10 | 6/10 | **6/10** |
| **Overall weighted** | **58/100** | **70/100** | **78/100** | **~83/100** |

Performance & build is the big mover this pass. The customer entry-bundle
went from "every dep in one giant blob" to a structured 12-chunk graph with
admin-only code (excel/pdf/charts) entirely outside the customer first-load.
Hosting now has full security headers + proper cache discipline.

Push to 88+ requires Pass 5 (type safety — the 982 `any` escapes) and Pass
6 (component decomposition — the 5 monster files over 700 LOC).

---

## Next pass

**Pass 4 — Data Model, Indexes & Query Patterns.**
Look at unbounded `getDocs()` calls, N+1 query patterns in service layer,
the recursive `get()` chains in rules (M2 from Pass 1, needs data backfill),
and the schema bypass in `getCustomerForAuth` (M3 from Pass 1).

When ready, ask Claude to start Pass 4.
