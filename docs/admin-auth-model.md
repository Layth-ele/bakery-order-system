# Admin Authorization Model

## Single source of truth: `customerType === 'admin'`

Every admin check in this app derives from one field: `customers/{uid}.customerType == 'admin'`

| Layer | Checks | Why |
|---|---|---|
| `firestore.rules` | `customers/{uid}.customerType == 'admin'` | Reads Firestore directly |
| `storage.rules` | `get(customers/{uid}).data.customerType == 'admin'` | Reads Firestore via `get()` |
| `navigationGuards.ts` | `customer.customerType === 'admin'` → sets `role: 'admin'` | Derived at login |
| `useAdminPermission.ts` | `user.role === 'admin'` | Derived from customerType |
| `authService.ts` | `deriveRoleFromCustomerType(customerType)` | Maps customerType → role |

The `role` field on the client `User` object is **always derived** from `customerType` at login. It is never stored separately. There is no mixed logic.

## How storage rules check admin

Both Firestore and Storage Security Rules resolve admin from the same source — the
`customers/{uid}.customerType` field — using a `get()` lookup:

- **Firestore** → `get(/databases/$(db)/documents/customers/$(uid)).data.customerType == 'admin'`
- **Storage** → `get(/databases/(default)/documents/customers/$(uid)).data.customerType == 'admin'` (see `isAdmin()` in `storage.rules`)

There is no server-side custom claim to keep in sync. A single Firestore document field
(`customerType`) is the one source of truth for admin access across the whole app.

## Setting up a new admin (exact steps)

1. **Create user in Firebase Auth**
   - Firebase Console → Authentication → Add user
   - Note the UID

2. **Create Firestore customer document** (Document ID = Firebase Auth UID)
   ```json
   {
     "email": "admin@yourbakery.com",
     "customerType": "admin",
     "status": "approved",
     "storeName": "Admin",
     "contactPerson": "Admin",
     "createdAt": "<serverTimestamp>",
     "updatedAt": "<serverTimestamp>"
   }
   ```

3. **Set environment variable**
   ```
   VITE_ADMIN_EMAIL=admin@yourbakery.com
   ```

4. **Verify by logging in** — admin should see `/admin` routes and have full Storage access.

> No custom auth claim is required. Both Firestore and Storage rules read
> `customers/{uid}.customerType` directly, so setting `customerType: 'admin'`
> on the customer document (step 2) is all that grants admin access.

## Demo mode (no Firebase configured)

When `VITE_FIREBASE_API_KEY` is not set, `isFirebaseConfigured` is `false`. In this case:
- Admin login uses `VITE_ADMIN_EMAIL` + `VITE_ADMIN_PASSWORD` (never reaches Firebase)
- This code path is **never active** in production (where Firebase is configured)
- The demo short-circuit is in `authService.ts` wrapped in `if (!isFirebaseConfigured)`

## What the frontend checks (consistent chain)

```
Firebase Auth login
  → authService reads customers/{uid} from Firestore
  → extracts customerType
  → deriveRoleFromCustomerType(customerType) → 'admin' | 'customer'
  → stores User{ id, email, role, customerType, status } in context
  → navigationGuards.isAdmin(user) checks user.role === 'admin'
  → useAdminPermission(user) checks user.role === 'admin'
```

No place in the frontend checks `customerType` directly after login — all checks use `role`, which was derived from `customerType` exactly once at login time.

## What was removed

- Hardcoded `isHardcodedAdmin()` function from firestore.rules
- The `admin` custom auth claim — Storage now resolves admin via a Firestore `get()` lookup, matching Firestore rules
- Plaintext password fallback from `passwordSecurity.ts`
- `window.clearOldOrders` global exposure
- All `DEBUG = true` flags in production services
