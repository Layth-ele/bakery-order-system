/**
 * generateId — Cloud Function callable
 *
 * Clients call this instead of incrementing Firestore counters directly.
 * Server-side generation means: if the client drops mid-request, the
 * Cloud Function either completes fully or the transaction rolls back —
 * no orphaned counter increments, no permanent gaps.
 *
 * FIX T2R6-C3 (CRITICAL — sequential ID counter exhaustion / CRA audit gap):
 * Was only checking `request.auth` (any authenticated user, even a pending /
 * rejected customer).  ANY authenticated user could call this and increment
 * the daily counter — draining IDs and producing audit gaps in the invoice
 * sequence.  For a CRA-registered business, sequential invoice numbers are
 * a tax-compliance requirement; unexplained gaps are an audit red flag.
 *
 * Now requires:
 *   - 'invoices' (DBH prefix): admin only — matches createInvoiceWithCustomId
 *   - 'orders' (ORD prefix): approved customer or admin — matches
 *     createOrderWithCustomId's customer-status check
 *   - 'customers' (CUST prefix): admin or self-registration during signup —
 *     matches createCustomerWithCode's caller-uid-must-equal-data.uid check.
 *     We allow any authenticated user here because this is called during
 *     the registration flow (the user is creating their own profile).
 *
 * Client usage:
 *   const fn = httpsCallable(functions, 'generateId');
 *   const { data } = await fn({ type: 'invoices' });
 *   // data.id = "DBH-2026-03-26-001-47"
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getNextDailyId, type Prefix } from "./idGenerator";

const db = getFirestore();

const TYPE_TO_PREFIX: Record<string, Prefix> = {
  invoices:  "DBH",
  orders:    "ORD",
  customers: "CUST",
};

export const generateId = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const type = request.data?.type as string;
  const prefix = TYPE_TO_PREFIX[type];

  if (!prefix) {
    throw new HttpsError(
      "invalid-argument",
      `Unknown type "${type}". Must be one of: invoices, orders, customers.`
    );
  }

  // FIX T2R6-C3: Per-type authorization check.  Drop the request before
  // incrementing the counter so an unauthorized caller cannot drain the
  // daily sequence.
  const callerUid = request.auth.uid;
  const callerSnap = await db.collection("customers").doc(callerUid).get();
  // Note: a brand-new customer signing up may not yet have a profile doc —
  // that's fine for the 'customers' (CUST) self-registration case.  All
  // other types require an existing profile.
  const callerData = callerSnap.exists ? (callerSnap.data() as any) : null;
  const isAdmin = callerData?.customerType === "admin";
  const isApprovedCustomer = callerData?.status === "approved";

  if (type === "invoices") {
    // Invoice number generation is admin-only — matches the admin check in
    // createInvoiceWithCustomId.
    if (!isAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only administrators can generate invoice numbers."
      );
    }
  } else if (type === "orders") {
    // Order number generation: approved customers or admins.
    if (!isAdmin && !isApprovedCustomer) {
      throw new HttpsError(
        "permission-denied",
        "Your account must be approved before placing orders."
      );
    }
  } else if (type === "customers") {
    // Customer code generation: any authenticated user, since this is called
    // during the registration flow before the profile doc fully exists.
    // The downstream createCustomerWithCode CF enforces that the caller can
    // only create a profile for themselves (caller uid === data.uid).
  }

  const id = await getNextDailyId(prefix);
  return { id };
});
