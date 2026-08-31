# Seed Audit vs App Schema — March 2026

## Collection → Firestore Path Mapping

| Collection | Firestore Path | Status |
|---|---|---|
| settings | `settings/system` | ✅ Correct |
| categories | `categories/{id}` | ✅ Correct |
| products | `products/{id}` | ✅ Correct |
| customers | `customers/{id}` | ⚠️ Extra fields ignored by schema |
| orders | `orders/{id}` | ❌ Field name mismatches |
| notifications (admin) | `notifications/admin/items/{id}` | ✅ Correct |
| notifications (customer) | `notifications/user_{customerId}/items/{id}` | ✅ Correct |
| creditNotes | `creditNotes/{id}` | ❌ Schema mismatch |
| creditApplicationHistory | `creditApplicationHistory/{id}` | ✅ OK |
| orderEditHistory | `orderEditHistory/{id}` | ✅ OK |
| snapshots | `snapshots/{id}` | ❌ App uses subcollection: `orders/{orderId}/snapshots/{id}` |
| idCounters | `idCounters/{collection}` | ✅ Correct |

## Issues Found

### orders.js
- Uses `weekNumber` → schema expects `week`
- Uses `customerType` → NOT in order schema (ignored by Firestore but clean to remove)
- Uses `weekRange` as string date range → schema accepts optional string ✅
- Missing `customerContactPerson` (required in schema) → uses `customerName` only
- Uses `deliveryFeeWaived` → NOT in schema (only `serviceChargeWaived` is)

### customers.js  
- `professionalId`, `creditBalance`, `totalOrders`, `totalSpent`, `suspendedAt`, `suspensionReason` → NOT in customer schema (Firestore ignores extra fields, but worth noting)
- `storeName: null` for individual customers → schema uses `optionalNonEmptyStringSchema` which rejects null

### credits.js (creditNotes)
- Schema requires: `orderId`, `creditNoteNumber`, `subtotal`, `total`, `createdBy`, `createdAt` (ISO string)
- Seed provides: `issuedAmount`, `usedAmount`, `creditType`, `issuedAt`, `issuedBy` → wrong field names
- `status` values: seed uses `'active'` → schema enum is `'available'|'partially_used'|'fully_used'|'paid_out'`
- `createdAt` → schema expects ISO string, seed provides Firestore Timestamp

### history.js (snapshots)
- Seed writes to `snapshots` collection (top-level)
- App reads from `orders/{orderId}/snapshots/{id}` (subcollection)
- Need to write snapshots as subcollection documents

### settings.js
- `freeDeliveryMin: 100` → app DEFAULT uses 250 (minor, will be overwritten by seed ✅)
- `deliveryFee: 10` → app DEFAULT uses 50 (minor ✅)
- `businessName` → seed uses "Delicious Bakery House", app uses "Delight Bakehouse"
- `createdAt/updatedAt: Date.now()` → should be Firestore Timestamps for consistency
