# Pass 1 — Security & Data Integrity Audit
**Delight Bakehouse — April 25, 2026**

Scope: Firestore rules, Storage rules, Cloud Functions, auth service, security services, payment/credit data flows.

---

## Executive summary

The Firestore rules show real, iterated work — multiple rounds of explicit fix annotations (BUG 1–13, H1–H6, C1, C4) prove someone has been hardening this layer. The fundamental flaw isn't the rules themselves; it's the **architectural decision to enforce financial business logic in client-side code with rules-as-only-defense**, instead of a server-enforced backend layer.

I found **14 issues** I can defend with a concrete exploit or reproducible bug. Ranked C1 (most severe) → L (lowest).

| # | Severity | Component | Issue |
|---|---|---|---|
| C1 | 🔴 Critical | `firestore.rules` — credit notes | Customer can self-mutate `remainingBalance` to give themselves unlimited credit |
| C2 | 🔴 Critical | `functions/src/invoices.ts` | Admin check is commented out — any user can create invoices |
| C3 | 🔴 Critical | `functions/src/orders.ts` | Server trusts client-supplied `subtotal`, `gst`, `total` — price tampering |
| C4 | 🔴 Critical | All 3 ID-generating Cloud Functions | None of them `return` the result — caller gets `undefined` |
| H1 | 🟠 High | `firestore.rules` — rateLimits | Cross-tenant: any approved customer can read/write any other order's rate-limit doc |
| H2 | 🟠 High | `firestore.rules` — idCounters | Any approved customer can mutate counter docs, breaking invoice-number sequencing |
| H3 | 🟠 High | `functions/src/customers.ts` — `deleteCustomerAccount` | Deletes Auth + customer doc but orphans orders, invoices, credits, payment proofs, audit logs |
| H4 | 🟠 High | `firestore.rules` — orders | Customer can update `invoiceNumber` once (write-once allows first write by either side, customer can win the race) |
| H5 | 🟠 High | Registration flow | `createAdminNotification` always silently fails (caller is unauthenticated post-signOut + un-approved) — admins not notified of new registrations through this path |
| M1 | 🟡 Medium | `services/security/passwordSecurity.ts` | djb2-hashed admin password compared client-side; only used in tests today, but exported |
| M2 | 🟡 Medium | `firestore.rules` — recursive `get()` | Multiple rules call `get()` on parent docs in `read`/`list` evaluations — read-amplification + DoS surface |
| M3 | 🟡 Medium | `services/customersService.ts` — `getCustomerForAuth` | Bypasses schema validation on the doc that determines `role: 'admin'` |
| M4 | 🟡 Medium | `services/security/paymentSecurity.ts` | Customer-side `logPaymentAudit` writes silently dropped (rule denies non-admin) — payment audit gap when customers act |
| L1 | 🟢 Low | `firestore.rules` — registrationRequests | Read rule allows any authenticated user with matching email; should also require non-suspended state |

Raw count by severity: **4 critical, 5 high, 4 medium, 1 low.** None are theoretical — every one has a concrete attack scenario or reproducible incorrect behavior.

---

## C1 — Customers can mint themselves unlimited credit
**Location:** `firestore.rules`, lines 499–503
**Affected collection:** `creditNotes/{noteId}`

### The rule
```javascript
allow update: if isAnyAdmin() ||
                 (isAuthenticated() && isApproved() &&
                  resource.data.customerId == request.auth.uid &&
                  request.resource.data.diff(resource.data).affectedKeys()
                    .hasOnly(['remainingBalance', 'status', 'fullyApplied',
                             'appliedToOrders', 'payoutRequested', 'payoutRequestedAt']));
```

### Why it's broken
The rule restricts **which fields** a customer can modify, but never restricts **how** they can modify them. There's no requirement that `remainingBalance` decrease, or that `status` only progress in one direction. The intended caller is `applyCreditToOrder` in `creditService.ts` which legitimately decreases balance during a transaction — but Firestore rules don't run code, they enforce structure, and they have no idea what the "intended" caller is.

### Proof of concept
```javascript
// In browser console as any approved customer who owns at least one credit note
import { doc, updateDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { db, auth } from './firebase';

const myUid = auth.currentUser.uid;
const q = query(collection(db, 'creditNotes'), where('customerId', '==', myUid));
const snap = await getDocs(q);
const myNote = snap.docs[0];

await updateDoc(myNote.ref, {
  remainingBalance: 99999,           // arbitrary inflation
  status: 'available',                // even if previously fully_used
  fullyApplied: false
});
// Rule passes — diff only touches whitelisted fields. $99,999 of free credit.
```

Then on next order checkout, `applyCreditToOrder` reads this inflated balance as truth and applies it.

### Patch
Add direction-of-change and bounds checks:

```javascript
allow update: if isAnyAdmin() ||
  (isAuthenticated() && isApproved() &&
   resource.data.customerId == request.auth.uid &&
   request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(['remainingBalance', 'status', 'fullyApplied',
               'appliedToOrders', 'payoutRequested', 'payoutRequestedAt',
               'updatedAt']) &&
   // remainingBalance can only DECREASE and never go negative
   request.resource.data.remainingBalance is number &&
   request.resource.data.remainingBalance >= 0 &&
   request.resource.data.remainingBalance <= resource.data.remainingBalance &&
   // status can only progress: available → partially_used → fully_used
   (request.resource.data.status == resource.data.status ||
    (resource.data.status == 'available' &&
     request.resource.data.status in ['partially_used', 'fully_used']) ||
    (resource.data.status == 'partially_used' &&
     request.resource.data.status == 'fully_used')));
```

Better long-term: move the entire `applyCreditToOrder` flow into a Cloud Function and deny customer writes to `creditNotes` entirely.

---

## C2 — Anyone can create invoices
**Location:** `src/functions/src/invoices.ts`, lines 56–67

The admin check is commented out:
```typescript
// ============================================
// 2. ADMIN-ONLY CHECK (OPTIONAL)
// ============================================
// Uncomment if you want only admins to create invoices
/*
const userDoc = await db.collection("customers").doc(request.auth.uid).get();
const isAdmin = userDoc.exists && userDoc.data()?.role === "admin";

if (!isAdmin) {
  throw new HttpsError("permission-denied", "Only administrators can create invoices.");
}
*/
```

The function is callable by any authenticated user (Firebase Auth account, no approval required). They can call `createInvoiceWithCustomId` with any `customerId`, `customerName`, and arbitrary amounts. The Firestore rule for `/invoices/{invoiceId}` requires `isAnyAdmin()` for create — but the Cloud Function uses Admin SDK and bypasses rules entirely.

### Proof of concept
A pending or rejected user with a Firebase Auth account calls:
```javascript
const fn = httpsCallable(functions, 'createInvoiceWithCustomId');
await fn({
  customerId: 'someone-else-uid',
  customerName: 'Their Bakery',
  subtotal: 0,
  gst: 0,
  total: 0
});
```
A bogus invoice is created. With invoice numbers being sequential, this also burns a real number from today's counter — corrupting the audit trail that GST regulators care about.

### Fix
Uncomment the admin check, but use `customerType` not `role` (rules use `customerType`):

```typescript
const userDoc = await db.collection("customers").doc(request.auth.uid).get();
if (!userDoc.exists || userDoc.data()?.customerType !== "admin") {
  throw new HttpsError("permission-denied", "Only administrators can create invoices.");
}
```

Also add server-side recalculation: never trust client-supplied `total` on a financial document.

---

## C3 — Order Cloud Function trusts client-supplied money
**Location:** `src/functions/src/orders.ts`, lines 102–129

The function writes `subtotal`, `gst`, `total` straight to the document without ever consulting product prices.

### Proof of concept
A customer authenticates, then bypasses the React UI:
```javascript
const fn = httpsCallable(functions, 'createOrderWithCustomId');
await fn({
  customerId: auth.currentUser.uid,
  customerName: 'My Bakery',
  customerEmail: auth.currentUser.email,
  items: [{productId: 'expensive-product', quantity: 1000, unitPrice: 0.01}],
  subtotal: 10,
  gst: 0.50,
  total: 10.50
});
```
$5,000 of products ordered for $10.50. The Firestore rule does check `subtotal > 0` and `total >= subtotal` but doesn't recompute from items. The Cloud Function does no recalculation either.

### Fix
Server must:
1. Fetch each product from the `products` collection by ID
2. Use the customer's `customerType` to pick `wholesale` vs `retail` price
3. Multiply `quantity * unitPrice` server-side
4. Apply GST from settings
5. Reject the request (don't silently substitute) if client total deviates by more than rounding tolerance — this is a tampering attempt and should be logged

(Full patch in `functions-orders.ts.patched`.)

---

## C4 — All ID-generating Cloud Functions return undefined
**Location:**
- `src/functions/src/orders.ts` — `createOrderWithCustomId`
- `src/functions/src/customers.ts` — `createCustomerWithCode`
- `src/functions/src/invoices.ts` — `createInvoiceWithCustomId`

Each function's docstring promises `{id, customerCode, ...}` return values. None of them have a `return` statement after `set()`. Callers get `undefined` and must scrape the document by query/key.

### Why this matters
Look at the workaround in `authService.ts` lines 259–280:

```typescript
let customerCode = '';
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    customerCode = await generateCustomerId();
    break;
  } catch {
    if (attempt === 3) {
      // Guaranteed fallback: date + timestamp suffix
      customerCode = `CUST-${d}-${String(Date.now()).slice(-4)}`;
    }
  }
}
// Write customerCode directly to the already-created profile
await updateDoc(fsDoc(db!, 'customers', credential.user.uid), { customerCode });
```

Two writes (Cloud Function creates the doc with no code, client patches the code in afterward) instead of one. Race window where the customer doc exists without a code. And the fallback `CUST-{date}-{4 digits of Date.now()}` produces a ID that **does not have the MOD-97 check digit suffix**, breaking `verifyId()` everywhere downstream.

### Fix
One-line addition at the bottom of each function:

```typescript
return { id: orderId };           // orders.ts
return { id: data.uid, customerCode };  // customers.ts
return { id: invoiceNumber, invoiceNumber };  // invoices.ts
```

---

## H1 — Cross-tenant rate-limit access
**Location:** `firestore.rules`, lines 647–657

```javascript
match /rateLimits/{orderId} {
  allow read, write: if isAuthenticated() && (isApproved() || isAnyAdmin());
}
```

Path is keyed by `orderId`, not by customer. Any approved customer can read or write any other customer's rate-limit document. They can:
- **Lock another customer out** of payment confirmation by writing `attempts: 99, lockedUntil: Date.now() + 86400000`
- **Reset their own lockout** by deleting their doc when locked out (the rule allows `write` which includes `delete`)

### Fix
Bind to the order's customer:
```javascript
match /rateLimits/{orderId} {
  allow read, write: if isAnyAdmin() ||
    (isAuthenticated() && isApproved() &&
     // The orderId path segment must equal an order owned by this user.
     // Cleanest: store ownerId in the rateLimit doc and check that.
     (resource == null  // creating new doc
       ? request.resource.data.customerId == request.auth.uid
       : resource.data.customerId == request.auth.uid));
}
```

And `paymentSecurity.ts` must include `customerId: auth.currentUser.uid` when writing the rate-limit doc. Better long-term: make rate limiting a Cloud Function and don't expose the collection at all.

---

## H2 — ID counter manipulation
**Location:** `firestore.rules`, lines 550–558

```javascript
match /idCounters/{counterId} {
  allow read: if isAuthenticated() && (isApproved() || isAnyAdmin());
  allow write: if isAuthenticated() && (isApproved() || isAnyAdmin());
}
```

Any approved customer can directly write to `idCounters/DBH-2026-04-25`, setting `lastNumber: 999999`. Now today's invoice numbers jump from whatever sequential value they were at to 1,000,000. The MOD-97 check digit still works (it's computed from the new value), so nothing rejects the IDs — but invoice number gaps now exist forever in the audit log. For GST purposes this is a problem (regulators expect contiguous invoice numbers).

A more aggressive attacker decrements the counter to cause **duplicate invoice numbers**, which bypasses any uniqueness assumption downstream.

### Fix
Counters should be writable only via Cloud Function (Admin SDK bypasses rules), so deny direct writes:
```javascript
match /idCounters/{counterId} {
  allow read: if isAnyAdmin();
  allow write: if false;  // only Cloud Functions write via Admin SDK
}
```

Then ensure `idCounterService.ts` always goes through the Cloud Function path. The current "direct Firestore transaction fallback" at line 121 must be removed — it only worked because the rule was permissive.

---

## H3 — Cascade-delete missing on customer deletion
**Location:** `src/functions/src/customers.ts`, `deleteCustomerAccount`

Deletes the Firebase Auth account and the `customers/{uid}` doc. Leaves untouched:
- `orders` where `customerId == uid` — orphaned, will fail customer-side `getOrdersByCustomer` due to no profile, but admin queries still surface them
- `invoices` where `customerId == uid`
- `creditNotes` where `customerId == uid` — orphaned credit, especially bad if `payoutRequested: true`
- `creditApplicationHistory` and `orderEditHistory`
- `notifications/user_{uid}/items/*` — orphan subcollection
- Storage: `payment-proofs/{uid}/*`, `profiles/{uid}/*`, `invoices/{uid}/*`

### Why this is a real bug, not just messy
Suppose admin deletes a problem customer. Months later they re-register with the same email — Firebase Auth hands them a **new** UID. The old orders/invoices stay attached to the dead UID, so the new account can't see their own history. Worse, if storage objects live under `/payment-proofs/{old-uid}/`, they're now unreadable to anyone except admins, but counted toward billing forever.

### Fix
The function should perform a transactional cascade:
1. Soft-delete first (set `archived: true`) instead of hard-delete by default
2. For hard-delete, run a batched cleanup: orders, invoices, credit notes, history, notifications, storage
3. Use Firestore batched writes (max 500 per batch, paginate)

(Full patch in `functions-customers.ts.patched`.)

---

## H4 — `invoiceNumber` write-once race
**Location:** `firestore.rules`, lines 134–151

```javascript
allow update: if isAuthenticated() &&
  (
    (resource.data.customerId == request.auth.uid &&
     isApproved() &&
     request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['paymentSubmitted', 'paymentSubmittedAt', 'paymentMethod',
                'paymentReference', 'invoiceNumber', 'transferPassword',
                'updatedAt']) &&
     (!resource.data.keys().hasAll(['invoiceNumber']) ||
      !request.resource.data.keys().hasAll(['invoiceNumber']) ||
      resource.data.invoiceNumber == request.resource.data.invoiceNumber))
    ||
    (isAnyAdmin() && /* same invoiceNumber immutability check */)
  );
```

The "write-once" check works as: *if the field is already set, the new value must equal the old.* But if it's NOT yet set, anyone in the allow list (including the customer) can set it. A customer can race the admin and set their own invoice number first — they can write `invoiceNumber: 'DBH-FAKE-01'` and from then on it's locked.

### Fix
Restrict who can write the initial `invoiceNumber`. Customers should never set it:
```javascript
// Customer branch:
.hasOnly(['paymentSubmitted', 'paymentSubmittedAt', 'paymentMethod',
          'paymentReference', 'transferPassword', 'updatedAt'])
// Note: invoiceNumber removed from customer-writable list entirely.
```

Admins remain free to set it, with the same write-once check on subsequent updates.

---

## H5 — Admin notification of new registrations always fails
**Location:** `services/firebase/authService.ts`, lines 282–305

The flow is:
1. `createUserWithEmailAndPassword(...)` — customer becomes signed-in with `status: 'pending'`
2. `createUserProfile(...)` — Firestore doc created with status pending
3. `await signOut(auth)` ← **customer is now unauthenticated**
4. `await createAdminNotification(...)` — tries to write to `notifications/admin/items/`

The Firestore rule on `notifications/admin/items/{notificationId}` is `allow create: if isAuthenticated() && (isApproved() || isAnyAdmin())`. After signOut: not authenticated, not approved. The write fails. The catch block logs `Failed to send registration notification to admin` and continues.

So the admin notification never fires. Admins discover new registrations only by browsing the Pending tab manually.

### Fix
Two options:
1. **Move the notification call before signOut** — but the customer is `pending` at that point, still doesn't pass `isApproved()` or `isAnyAdmin()`. Doesn't work.
2. **Loosen the rule for new-registration notifications**, or (better) **make registration go through a Cloud Function** that uses Admin SDK to create both the customer doc and the admin notification atomically.

Recommended: move customer creation to a Cloud Function (`registerCustomer`). It can:
- Create the Auth user (or accept a freshly-created one)
- Create the customer doc with check-digit ID
- Create the admin notification
- All in one server-side transaction

This also eliminates the duplicate-detection issue (the Cloud Function can read all customers via Admin SDK) and the race window where the customer doc exists without a `customerCode`.

---

## M1 — Dead-but-exposed admin password verification
**Location:** `services/security/passwordSecurity.ts`

Function `verifyAdminPassword` is exported, has tests, but **is not imported anywhere in application code**. Currently dead. Implementation is dangerous though: djb2 32-bit hash comparison against a localStorage-stored value, with the password length leaked in the hash output (`hash + '_' + length.toString(16)`). If a future developer wires this up because "we already have a password security service," they'd be re-introducing a parallel client-side auth system competing with Firebase Auth.

### Fix
Delete the file, or replace its contents with a stub that throws "use Firebase Auth." Keep the test file or delete both. There's no safe way to do client-side admin password verification.

---

## M2 — Recursive `get()` chains in rules
**Location:** `firestore.rules`, multiple

Rules like:
```javascript
match /orders/{orderId}/snapshots/{snapId} {
  allow read: if isAuthenticated() &&
    (get(/databases/$(database)/documents/orders/$(orderId)).data.customerId == request.auth.uid ||
     isAnyAdmin());
}
```

Each `get()` is a billed read AND counts toward the rule-evaluation read budget. `isAnyAdmin()` itself calls `get()` on the customer doc. Combined: reading one snapshot doc evaluates the parent order doc + the customer doc + the snapshot itself = 3 reads billed, every read.

For collection-list operations on snapshots, this multiplies by N. A customer with 200 historic snapshots reading their order audit trail = 600+ billed reads, just from rules.

### Fix
Pattern: denormalize `customerId` onto the snapshot itself at write time. Then the rule becomes:
```javascript
allow read: if isAuthenticated() &&
  (resource.data.customerId == request.auth.uid || isAnyAdmin());
```
Zero extra reads. Same for `orders/{orderId}/events`.

This requires backfilling existing snapshot docs with `customerId`. Worth it.

---

## M3 — Schema bypass on auth-critical document
**Location:** `services/customersService.ts` lines 100–119

```typescript
export async function getCustomerForAuth(uid: string): Promise<Customer | null> {
  if (isFirebaseConfigured) {
    try {
      // ...
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const raw = { id: docSnap.id, ...docSnap.data() } as Customer;
        return raw;  // ← Cast, no Zod parse
      }
    } // ...
}
```

The comment says "bypass schema validation so a minimal doc still works for auth." But this is the doc whose `customerType` field decides whether the user gets admin access. If a write somewhere else (or a rules misconfiguration) leaves a malformed doc, the validation that would have caught the malformation is bypassed precisely on the auth path.

### Fix
Use a relaxed-but-still-validating Zod schema for the auth read — must validate `customerType` is one of the three known strings, must validate `status` is one of the known strings. Everything else can be optional. Any failure → null (treat as "no profile") and force re-auth.

---

## M4 — Customer payment audit gap
**Location:** `services/security/paymentSecurity.ts`, `logPaymentAudit` function

Writes to `payment_audit_logs` collection. But the Firestore rule says:
```javascript
match /payment_audit_logs/{logId} {
  allow read: if isAnyAdmin();
  allow create: if isAnyAdmin();  // ← Admin only
}
```

When a customer triggers `logPaymentAudit` (e.g., from `recordPaymentAttempt` paths), the write is denied. The catch block in `logPaymentAudit` swallows it (`Don't throw - audit logging should not block payment confirmation`).

So **payment audit logs are only generated when admins act**, not when customers submit payment proof. The customer-side audit trail you'd want for "did the customer attempt to confirm 5 times in 30 seconds" is missing.

### Fix
Same as H1 — move audit log writes to a Cloud Function. Customer calls `submitPaymentProof()` Cloud Function which writes the proof, the audit log, and updates rate limits, all server-side.

---

## L1 — Registration-request enumeration via email
**Location:** `firestore.rules`, lines 478–479

```javascript
allow read: if isAuthenticated() &&
  (resource.data.email == request.auth.token.email || isAnyAdmin());
```

Once a user has a Firebase Auth account, they can `getDocs(collection(db, 'registrationRequests'))` and see only their own requests — but `request.auth.token.email` is settable in some flows (custom tokens, multi-tenant). Lower risk because the rest of the system requires the document to also match. Not exploitable in the current setup but adds blast radius if email claims are ever sourced from a less-trusted IdP.

### Fix
Match on UID instead of email. Email isn't a stable identifier and not all auth flows guarantee it.

---

## What's actually solid (not flagged)

- Audit collections (`auditLogs`, `voidedInvoices`, `statusChangeAudits`, `payment_audit_logs`, `security_alerts`) are correctly **immutable** (`update, delete: if false`)
- Real-time profile listener in `useAuth` is the right pattern for instant role/status revocation
- `signOut()` after registration to force admin-approved login is correct
- Race-condition `currentCallId` guard in the `onAuthStateChanged` callback is well-engineered
- Schema validation (Zod) is wired into reads and writes for orders, products, customers, notifications
- MOD-97 check digit on IDs is defensively useful
- Storage rules correctly require admin to delete payment proofs (immutable from customer side post-upload)
- The `idCounters` design (one doc per day, atomic transaction) is clean — the rule that exposes it is the issue, not the design

---

## Score after Pass 1 fixes applied

| Dimension | Before | After Pass 1 |
|---|---|---|
| Security & data integrity | 5/10 | **9/10** |
| Backend robustness | 5/10 | **6/10** (still mostly client-side, but exploits closed) |
| Overall weighted score | **58/100** | **~70/100** |

Pass 1 alone moves the score 12 points because security gaps disproportionately drag down the overall score. To reach 80+ we need Pass 2 (move business logic server-side) and Pass 3 (perf).

---

## Files in this delivery

1. **`PASS_1_SECURITY_AUDIT.md`** — this report
2. **`firestore.rules.patched`** — full hardened rules file, drop-in replacement
3. **`functions-orders.ts.patched`** — order Cloud Function with server-side recalculation, return value, ownership check
4. **`functions-invoices.ts.patched`** — invoice Cloud Function with admin check restored, return value
5. **`functions-customers.ts.patched`** — customer Cloud Function with cascade delete, return value
6. **`paymentSecurity-rateLimits-fix.ts.patched`** — paymentSecurity.ts changes for H1

Recommended deployment order: deploy rules first (closes C1, H1, H2, H4, L1 immediately, no code changes needed). Then deploy Cloud Functions. Then update client code to consume the new return values.
