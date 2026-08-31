# Admin Authorization Model

## Single source of truth: `customerType === 'admin'`

Every admin check in this app derives from one field: `customers/{uid}.customerType == 'admin'`

| Layer | Checks | Why |
|---|---|---|
| `firestore.rules` | `customers/{uid}.customerType == 'admin'` | Can read Firestore |
| `storage.rules` | `request.auth.token.admin == true` | Cannot read Firestore — uses custom claim |
| `navigationGuards.ts` | `customer.customerType === 'admin'` → sets `role: 'admin'` | Derived at login |
| `useAdminPermission.ts` | `user.role === 'admin'` | Derived from customerType |
| `authService.ts` | `deriveRoleFromCustomerType(customerType)` | Maps customerType → role |

The `role` field on the client `User` object is **always derived** from `customerType` at login. It is never stored separately. There is no mixed logic.

## Why storage rules use a custom claim

Firestore Security Rules can call `get()` to read documents. Storage Security Rules cannot. So:

- **Firestore** → reads `customers/{uid}.customerType` directly
- **Storage** → reads `request.auth.token.admin` (custom claim set server-side)

Both must be set for a user to have full admin access.

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

3. **Set custom claim for Storage access** (run once via Firebase Admin SDK)
   ```js
   const admin = require('firebase-admin');
   await admin.auth().setCustomUserClaims('THE_ADMIN_UID', { admin: true });
   ```
   Or add to your seed script and run it once.

4. **Set environment variable**
   ```
   VITE_ADMIN_EMAIL=admin@yourbakery.com
   ```

5. **Verify by logging in** — admin should see `/admin` routes and have full Storage access.

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
- Plaintext password fallback from `passwordSecurity.ts`
- `window.clearOldOrders` global exposure
- All `DEBUG = true` flags in production services
