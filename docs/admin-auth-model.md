# Admin Authorization Model

## Single source of truth: customerType === 'admin'

Every admin check in this app derives from a single Firestore field:

`customers/{uid}.customerType == 'admin'`

| Layer | Checks | Why |
|---|---|---|
| `firestore.rules` | `customers/{uid}.customerType == 'admin'` | Firestore access is granted from the customer profile |
| `storage.rules` | `firestore.get(.../customers/$(request.auth.uid)).data.customerType == 'admin'` | Storage rules cannot read the auth token for admin status, so they do a Firestore lookup |
| `AuthContext` / login flow | `customer.customerType === 'admin'` → role becomes `'admin'` | UI role is derived once at login |
| `authService.ts` | `deriveRoleFromCustomerType(customerType)` | Maps Firestore data to the client `role` value |

The `role` field on the client user object is always derived from `customerType` at login time. It is not stored separately and is never treated as a second source of truth.

## Why the storage rules do a Firestore lookup

Storage rules cannot read custom claims as a reliable admin source in the same way they can call `firestore.get()`. The current model is intentionally simple:

- Firestore rules read the customer document directly
- Storage rules perform a Firestore lookup for `customers/{uid}.customerType`
- The UI derives `role` from the same customer document on login

This keeps access controlled from a single authoritative field without depending on a custom claim.

## Setting up a new admin

1. Create the user in Firebase Authentication.
2. Create or update the matching customer document with the same UID.
3. Set the customer document fields:

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

4. Ensure the Firestore document ID equals the Firebase Auth UID.
5. Log in with that account. The app will grant admin access because `customerType` is `admin`.

## Demo mode / no Firebase

When Firebase is not configured, the app may fall back to a local demo mode. That path is separate from the production auth model and is not the source of truth for real admin access.

## Frontend auth flow

```text
Firebase Auth login
  → authService fetches customers/{uid}
  → reads customer.customerType
  → deriveRoleFromCustomerType(customerType) → 'admin' | 'customer'
  → stores the derived role in app context
  → admin UI checks user.role === 'admin'
```

No additional admin custom claims are required for the current implementation.
