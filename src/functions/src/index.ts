/**
 * Cloud Functions entry point.
 *
 * Every change to an order, its money or its notifications happens here —
 * the web app only calls these functions (Firestore rules deny direct
 * writes). Order status notifications + emails come from one trigger
 * (onOrderLifecycle); other notifications are written by the function that
 * performs the action, in the same transaction.
 *
 *   Orders       placeOrder · approveOrder · rejectOrder · cancelOrder
 *                (whole order or some days) · editOrder (unpaid) ·
 *                editPaidOrder (reduce → store credit) · completeOrder ·
 *                autoCompleteOrders (weekly schedule)
 *   Payments     submitPaymentProof · confirmOrderPayment
 *   Credit       applyOrderCredit · issueStoreCredit · requestCreditPayout
 *   Reminders    sendPaymentReminder
 *   Customers    createCustomerWithCode · deleteCustomerAccount
 *   Emails       sendPasswordResetEmail · sendTestEmail (see emails.ts)
 *   Triggers     onOrderLifecycle · onSettingsWritten ·
 *                snapshot/event customerId denormalization
 *   Maintenance  generateId · cleanupOldCounters · bootstrapSettings ·
 *                backfillSnapshotCustomerId
 */

import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

// ─── Creation ───────────────────────────────────────────────────────────────
export { placeOrder } from "./orders";
export { createCustomerWithCode, deleteCustomerAccount } from "./customers";

// ─── ID generation & maintenance ─────────────────────────────────────────────
export { generateId } from "./generateId";
export { cleanupOldCounters } from "./counterCleanup";

// ─── Pass 2: Order action functions ─────────────────────────────────────────
export { approveOrder, rejectOrder, cancelOrder } from "./orderActions";

// ─── Pass 2: Payment functions ──────────────────────────────────────────────
export { submitPaymentProof, confirmOrderPayment } from "./payments";

// ─── Pass 2: Credit functions ───────────────────────────────────────────────
export { applyOrderCredit } from "./credit";

// ─── Pass 4: Data migrations ────────────────────────────────────────────────
export { backfillSnapshotCustomerId } from "./backfillSnapshotCustomerId";

// ─── Pass 4: Firestore triggers — auto-denormalize parent customerId ────────
export {
  onSnapshotCreatedDenormalizeCustomerId,
  onEventCreatedDenormalizeCustomerId,
} from "./firestoreTriggers";

// ─── T2R8-H7: Settings bootstrap for non-admin first user ───────────────────
// Auto-creates settings/general with safe defaults if missing.  Idempotent;
// never overwrites an existing document.  Callable by any authenticated user
// (used by getSettings() client fallback path).
export { bootstrapSettings } from "./bootstrapSettings";

// ─── Public business card for the login page (synced from settings) ───────
export { onSettingsWritten } from "./publicProfileTrigger";

// ─── Order completion: manual + weekly schedule (single writer of "completed")
export { completeOrder, autoCompleteOrders } from "./orderCompletion";

// ─── Order lifecycle side effects: notifications + emails (single trigger) ──
export { onOrderLifecycle } from "./orderLifecycleTrigger";

// ─── Customer emails via Resend (see docs/email-system.md) ──────────────────
export { sendPasswordResetEmail, sendTestEmail } from "./emails";

// ─── Admin order edits (unpaid: reprice; paid: reduce → store credit) ───────
export { editOrder, editPaidOrder } from "./orderRevisions";

// ─── Reminders and store credit (notification written in the same tx) ──────
export { sendPaymentReminder, issueStoreCredit, requestCreditPayout } from "./accountActions";
