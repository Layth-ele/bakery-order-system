# Schema Field Aliases — Pass 11 reference

This document lists every Firestore field on this codebase that has more than
one name in active use. Most of these are legacy aliases that newer code
shouldn't write but still has to read. The fix-each-one-at-a-time approach
hasn't completed, and the indexes file (Pass 11 audit) made it clear that
silent field-name drift is the main remaining failure mode in our data
model.

For each alias pair: the **canonical** field is what new code writes; the
**legacy** field is what old documents store and what compatibility paths
read. Always read both, write one.

## Settings

| Canonical    | Legacy   | Where used                                     |
|--------------|----------|------------------------------------------------|
| `gstRate`    | `taxRate`| `SystemSettings`, Cloud Function `getTaxRate`  |
| `gstRate`    | `gstRate`| Admin Settings UI (writes canonical)           |

The Pass 10 fixes in `orderCreationService.ts`, `creditService.ts`,
and `functions/src/orders.ts` now read `gstRate` first then fall back to
`taxRate`. Display-time calculations in components (cart preview, refund
summaries) still hardcode `BUSINESS_RULES.GST_RATE = 0.05` — this is
documented and tracked separately as a follow-up; the order document
itself uses the dynamic rate from the moment of submission.

## Credit notes

| Canonical          | Legacy            | Where used                                         |
|--------------------|-------------------|----------------------------------------------------|
| `total`            | `amount`          | `CreditNote` schema; legacy values still present   |
| `orderId`          | `sourceOrderId`   | New code writes both; old code reads `sourceOrderId` |
| `creditNoteNumber` | `id`              | Display in admin tools; `id` is the doc ID         |

`getAvailableCredit` reads `note.remainingBalance ?? note.amount ?? 0`,
which handles all three states: new credit notes (`remainingBalance` set),
mid-migration notes (only `amount` set), and corrupt notes (neither — falls
back to 0 instead of NaN-propagating).

## Orders

| Canonical          | Legacy              | Where used                                      |
|--------------------|---------------------|-------------------------------------------------|
| `customerId`       | `userId`            | Old doc shape, still readable via shared helper |
| `weekRange`        | `weekKey`           | weeklyInvoiceService writes `weekKey`           |
| `customerAddress`  | `storeAddress`      | Both written today, customer profile writes legacy |

## Customers

| Canonical          | Legacy            | Where used                                          |
|--------------------|-------------------|-----------------------------------------------------|
| `storeAddress`     | `address`         | Customer profile writes both for back-compat       |
| `phone`            | `contactNumber`   | Some seed data uses `contactNumber`                |

## Products

| Canonical          | Legacy            | Where used                                         |
|--------------------|-------------------|----------------------------------------------------|
| `categoryId`       | `category`        | **Pass 11 fixed an index that referenced the legacy `category` field** — products written today only have `categoryId`. The dead-index removal closes that gap. |

## Invoices

| Canonical          | Legacy            | Where used                                          |
|--------------------|-------------------|-----------------------------------------------------|
| `invoiceStatus`    | `status`          | **Pass 11 fixed an index that referenced `status` instead of `invoiceStatus`.** Invoices use `invoiceStatus` (paid/unpaid/voided), separate from order `status` (lifecycle). Mixing the two names was a regular source of "missing index" runtime errors. |
| `total`            | `amount`          | Same as credit notes — read both, write canonical   |

## Migration approach for new fields

When introducing a new field that replaces an existing one:

1. Land the schema update so both fields are valid for read.
2. Land the writers — every code path that writes the old field should
   write both fields for at least one full release cycle.
3. Land the readers — every code path that reads the old field should
   read the new field with the old as a fallback.
4. Backfill in production via Cloud Function (or one-time admin script).
5. Confirm via Firestore explore that no documents remain with only the
   old field.
6. Land a release that stops writing the old field.
7. Wait one more cycle, then drop the read fallback.
8. Update this document and the relevant index.

The Pass 4 snapshot/event `customerId` denormalization is the canonical
example of doing this correctly. The legacy alias pairs above all skipped
one or more of those steps.
