/**
 * Credit Service
 * 
 * Manages customer credit notes and credit application to orders
 * Handles credit balance calculations and credit application history
 * ✅ MAR 14, 2026: Firebase integration with dual-mode pattern
 */

import {Order, CreditNote} from '../types'
import { safeParseJSON } from '../utils/safeLocalStorage';
import { invalidateCache } from '../hooks/useCachedFirebase'; // TanStack Query cache invalidation
import { getServerTimestamp } from '../utils/timestamps'; // ✅ TIMESTAMP FIX
import { isFirebaseConfigured } from '../firebase/config'; // Firebase mode detection


// ✅ MAR 14, 2026: Import Firebase collections
import {
  getCreditNotes as getFirestoreCreditNotes,
} from '../firebase/firestore/creditNotes';

import {
  getOrderEditHistory as getFirestoreOrderEditHistory,
  type OrderEditHistory as FirestoreOrderEditHistory,
} from '../firebase/firestore/orderEditHistory';

import {
  getCreditApplicationHistory as getFirestoreCreditApplicationHistory,
  type CreditApplicationRecord,
} from '../firebase/firestore/creditApplicationHistory';


// ✅ MAR 10, 2026: Removed duplicate CreditNote interface - now imported from /schemas

// ✅ NEW: Order Edit History Interface (re-exported from Firebase layer)
export type OrderEditHistory = FirestoreOrderEditHistory;

/**
 * Get all credit notes for a customer
 * ✅ MAR 14, 2026: Firebase integration with dual-mode pattern
 */
export async function getAllCreditNotes(customerId: string): Promise<CreditNote[]> {
  // ✅ Firebase mode
  if (isFirebaseConfigured) {
    return await getFirestoreCreditNotes(customerId);
  }
  
  const creditNotes = safeParseJSON<any[]>('bakery_credit_notes', []);
  return creditNotes.filter((note: CreditNote) => note.customerId === customerId);
}

/**
 * Get available credit balance for a customer
 * ✅ MAR 14, 2026: Now async to support Firebase
 */
export async function getAvailableCredit(customerId: string): Promise<number> {
  const creditNotes = await getAllCreditNotes(customerId);
  return creditNotes
    .filter((note: CreditNote) => note.status === 'available' || note.status === 'partially_used')
    .reduce((total: number, note: CreditNote) => {
      // ✅ FIX: Backward compatibility - use remainingBalance if available, otherwise fall back to amount
      const balance = note.remainingBalance ?? note.amount ?? 0;
      return total + balance;
    }, 0);
}

/**
 * Get maximum credit that can be applied to an order
 * ✅ MAR 14, 2026: Now async to support Firebase
 */
export async function getMaxApplicableCredit(customerId: string, orderTotal: number): Promise<number> {
  const availableCredit = await getAvailableCredit(customerId);
  return Math.min(availableCredit, orderTotal);
}

/**
 * Format credit amount for display
 */
export function formatCreditAmount(amount: number | undefined | null): string {
  // Handle undefined, null, or invalid values
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0.00';
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * ✅ MAR 14, 2026: Get edit history for a specific order
 * Returns all admin edits made to this order (for invoice display)
 */
export async function getOrderEditHistory(orderId: string): Promise<OrderEditHistory[]> {
  // ✅ Firebase mode
  if (isFirebaseConfigured) {
    return await getFirestoreOrderEditHistory(orderId);
  }
  
  const editHistoryList = safeParseJSON<any[]>('bakery_order_edit_history', []);
  return editHistoryList.filter((edit: OrderEditHistory) => edit.orderId === orderId);
}

/**
 * ✅ MAR 14, 2026: Get total credit issued from admin edits for an order
 * Used to display "Admin Edit Credit" line in invoice payment summary
 */
export async function getTotalAdminEditCredit(orderId: string): Promise<number> {
  const edits = await getOrderEditHistory(orderId);
  return edits.reduce((total, edit) => total + edit.creditIssued, 0);
}

/**
 * Apply store credit to an order — applyOrderCredit Cloud Function only.
 *
 * The server reads the customer's credit notes, deducts FIFO, updates the
 * order's creditApplied / amountDue and writes the history record in one
 * transaction. There is no client-side fallback: retrying in the browser
 * after a server error could deduct the credit twice.
 *
 * @throws Error with a user-facing message (e.g. insufficient credit)
 */
export async function applyCreditToOrder(
  orderId: string,
  _customerId: string,
  amount: number
): Promise<void> {
  const { applyOrderCreditViaCloudFunction, callableErrorMessage } = await import('./firebase/cloudFunctions');
  try {
    await applyOrderCreditViaCloudFunction({ orderId, amount });
  } catch (error) {
    throw new Error(callableErrorMessage(error, 'apply your credit'));
  }
}

/**
 * Get credit summary for a customer
 * ✅ MAR 14, 2026: Now async to support Firebase
 * ✅ PASS 5: Return type tightened from `any` to a structured shape so
 * downstream callers (generateCreditUsageReport, dashboards) get the
 * type they actually use.
 */
export interface CreditSummary {
  availableCredit: number;
  totalEarned: number;
  totalUsed: number;
  creditNotes: CreditNote[];
}

export async function getCreditSummary(customerId: string): Promise<CreditSummary> {
  const creditNotes = await getAllCreditNotes(customerId);
  
  const availableCredit = creditNotes
    .filter((note: CreditNote) => note.status === 'available' || note.status === 'partially_used')
    .reduce((sum: number, note: CreditNote) => sum + (note.remainingBalance ?? (note.amount ?? 0)), 0);

  const totalEarned = creditNotes.reduce((sum: number, note: CreditNote) => sum + (note.amount ?? 0), 0);
  
  const totalUsed = creditNotes.reduce((sum: number, note: CreditNote) => {
    const balance = note.remainingBalance ?? (note.amount ?? 0);
    return sum + ((note.amount ?? 0) - balance);
  }, 0);

  return {
    availableCredit,
    totalEarned,
    totalUsed,
    creditNotes,
  };
}

/**
 * Get credit application history for a customer
 * ✅ MAR 14, 2026: Firebase integration with dual-mode pattern
 */
export async function getCreditApplicationHistory(customerId: string): Promise<CreditApplicationRecord[]> {
  // ✅ Firebase mode
  if (isFirebaseConfigured) {
    return await getFirestoreCreditApplicationHistory(customerId);
  }
  
  const applicationHistory = safeParseJSON<any[]>('bakery_credit_application_history', []);
  return applicationHistory.filter((app) => app.customerId === customerId);
}

/**
 * Generate credit usage report for customer
 * ✅ MAR 14, 2026: Now async to support Firebase
 */
export async function generateCreditUsageReport(customerId: string): Promise<any> {
  const summary = await getCreditSummary(customerId);
  const applicationHistory = await getCreditApplicationHistory(customerId);

  // Calculate statistics
  const totalCreditGenerated = summary.totalEarned;
  const totalCreditUsed = summary.totalUsed;
  const totalCreditRemaining = summary.availableCredit;
  
  // Count orders with credit applied
  const ordersWithCreditApplied = new Set(
    applicationHistory.map((app) => app.orderId)
  ).size;
  
  // Count credit notes by status
  const creditNoteCount = summary.creditNotes.length;
  const fullyUsedCreditNotes = summary.creditNotes.filter(
    (note) => note.status === 'fully_used'
  ).length;
  const partiallyUsedCreditNotes = summary.creditNotes.filter(
    (note) => note.status === 'partially_used'
  ).length;
  const availableCreditNotes = summary.creditNotes.filter(
    (note) => note.status === 'available'
  ).length;

  return {
    summary,
    applicationHistory,
    reportGeneratedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
    // Statistics for modal display
    totalCreditGenerated,
    totalCreditUsed,
    totalCreditRemaining,
    ordersWithCreditApplied,
    creditNoteCount,
    fullyUsedCreditNotes,
    partiallyUsedCreditNotes,
    availableCreditNotes,
  };
}

/**
 * Ask for a credit note's remaining balance to be paid out. The
 * requestCreditPayout Cloud Function flags the note (it can no longer be
 * spent on orders) and notifies the admin.
 */
export async function requestCreditPayout(customerId: string, creditNoteId: string): Promise<void> {
  const { requestCreditPayoutViaCloudFunction, callableErrorMessage } = await import('./firebase/cloudFunctions');
  try {
    await requestCreditPayoutViaCloudFunction(creditNoteId);
  } catch (error) {
    throw new Error(callableErrorMessage(error, 'request the payout'));
  }
  invalidateCache.credit(customerId);
}

// ─── Paid-order edit rules (saving: editPaidOrder Cloud Function) ───────────
export { canEditPaidOrder, validateItemEdit } from "./orders/paidOrderEditService";
