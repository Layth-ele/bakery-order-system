/**
 * Cloud Functions Entry Point
 *
 * Exports all Cloud Functions for Firebase deployment
 *
 * Available Functions:
 *   Creation (existing — Pass 1 hardened):
 *   - createOrderWithCustomId: Create order with sequential ID (ORD-2026-03-26-NNN)
 *   - createCustomerWithCode: Create customer with sequential code (CUST-2026-03-26-NNN)
 *   - createInvoiceWithCustomId: Create invoice with sequential number (DBH-2026-03-26-NNNNNN)
 *   - generateId: Server-side ID generation (callable)
 *
 *   Lifecycle (Pass 1):
 *   - deleteCustomerAccount: Soft/hard delete customer with cascade
 *   - cleanupOldCounters: Scheduled monthly cleanup of old counter docs
 *
 *   Order actions (Pass 2 — server-enforced state transitions):
 *   - approveOrder: Admin approves a pending order with server-computed totals
 *   - rejectOrder: Admin rejects a pending order
 *   - cancelOrder: Admin cancels an order (any non-terminal status)
 *
 *   Payments (Pass 2):
 *   - submitPaymentProof: Customer submits payment proof for an approved order
 *   - confirmOrderPayment: Admin confirms payment received → in_process
 *
 *   Credit (Pass 2):
 *   - applyOrderCredit: Customer applies their available credit FIFO to an order
 */

import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

// ─── Creation ───────────────────────────────────────────────────────────────
export { createOrderWithCustomId } from "./orders";
export { createCustomerWithCode, deleteCustomerAccount } from "./customers";
export { createInvoiceWithCustomId } from "./invoices";

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
