/**
 * Credit Service
 * 
 * Manages customer credit notes and credit application to orders
 * Handles credit balance calculations and credit application history
 * NEW: Admin edit paid orders with automatic credit issuance
 * ✅ MAR 14, 2026: Firebase integration with dual-mode pattern
 */

import {Order, CreditNote} from '../types'
import { safeParseJSON, safeSetJSON } from '../utils/safeLocalStorage';
import { invalidateCache } from '../hooks/useCachedFirebase'; // TanStack Query cache invalidation
import { getServerTimestamp } from '../utils/timestamps'; // ✅ TIMESTAMP FIX
import { isFirebaseConfigured } from '../firebase/config'; // Firebase mode detection

import { getOrder as getOrderFromDS, updateOrder as updateOrderInDS } from './data/ordersDataService';
// PASS 10 FIX: settings-driven GST rate (see createCreditNote).
import { getSettings } from './data/settingsDataService';

// ✅ MAR 14, 2026: Import Firebase collections
import {
  getCreditNotes as getFirestoreCreditNotes,
  createCreditNote as createFirestoreCreditNote,
  updateCreditNote as updateFirestoreCreditNote,
} from '../firebase/firestore/creditNotes';

import {
  getOrderEditHistory as getFirestoreOrderEditHistory,
  createOrderEditHistory as createFirestoreOrderEditHistory,
  type OrderEditHistory as FirestoreOrderEditHistory,
} from '../firebase/firestore/orderEditHistory';

import { toDate } from '../utils/timestampFormatting';
import {
  getCreditApplicationHistory as getFirestoreCreditApplicationHistory,
  createCreditApplication as createFirestoreCreditApplication,
  type CreditApplicationRecord,
} from '../firebase/firestore/creditApplicationHistory';
import { logger } from '../utils/logger';


// ✅ MAR 10, 2026: Removed duplicate CreditNote interface - now imported from /schemas

// ✅ NEW: Order Edit History Interface (re-exported from Firebase layer)
export type OrderEditHistory = FirestoreOrderEditHistory;

/**
 * Generate a crypto-secure 9-char base36 ID suffix.
 *
 * FIX T2R4-H3 (HIGH — collision-prone IDs in financial records):
 * The credit-application and credit-note IDs below were using
 * `Math.random().toString(36).substr(2, 9)` which is reverse-engineerable
 * in V8 and prone to collisions when two credits are applied or issued
 * in the same millisecond. Credit records are financial — collisions
 * could overwrite a real credit-application history entry with another,
 * losing audit trail. Now uses crypto.getRandomValues().
 */
function cryptoIdSuffix(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
}

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
 * Apply credit to an order
 * ✅ MAR 14, 2026: Firebase integration with dual-mode pattern
 * FIX BUG 12: The entire read-validate-write sequence is now wrapped in a
 * Firestore transaction. Without this, two concurrent order submissions could
 * both read the same credit balance (TOCTOU), pass the validation check, and
 * each deduct the full amount — effectively double-spending the credit.
 */
export async function applyCreditToOrder(
  orderId: string,
  customerId: string,
  amount: number
): Promise<void> {
  // ✅ PASS 2: Prefer Cloud Function path. Server is sole authority for credit
  // application — atomic read of all candidate notes, FIFO deduction, order
  // update, and audit log all in one transaction. After this is the default,
  // the Firestore rule on creditNotes can deny ALL customer writes (Pass 2
  // rules update). Customers can no longer mint credit by ANY direct path.
  if (isFirebaseConfigured) {
    try {
      const { applyOrderCreditViaCloudFunction } = await import('./firebase/cloudFunctions');
      await applyOrderCreditViaCloudFunction({ orderId, amount });
      return;
    } catch (cfError: any) {
      const isTransportError =
        cfError?.code === 'functions/internal' ||
        cfError?.code === 'functions/unavailable' ||
        cfError?.code === 'functions/deadline-exceeded' ||
        cfError?.code === 'functions/not-found';
      if (!isTransportError) {
        // Real business error from server — surface it
        throw cfError;
      }
      logger.warn('⚠️ [applyCreditToOrder] Cloud Function unavailable, falling back to client transaction:', cfError);
      // Fall through to legacy
    }
  }

  if (isFirebaseConfigured) {
    // ── Firestore transactional path ─────────────────────────────────────────
    const { db: firestoreDb } = await import('../firebase/config');
    const { runTransaction, collection, query, where, getDocs, doc, serverTimestamp }
      = await import('firebase/firestore');

    // FIX BUG 1 (CRITICAL): Pre-fetch document refs OUTSIDE the transaction.
    // getDocs() with a query is NOT tracked by Firestore's conflict detection —
    // only tx.get(docRef) reads are. Running getDocs() inside runTransaction()
    // created a TOCTOU window: two concurrent applications could both read the
    // same balance, both pass the validation check, and both deduct, resulting
    // in double-spending. The fix: collect document IDs first (outside the tx),
    // then re-read each document via tx.get() inside the transaction so every
    // read participates in conflict detection and triggers a retry on conflict.
    const preQuerySnap = await getDocs(
      query(
        collection(firestoreDb, 'creditNotes'),
        where('customerId', '==', customerId),
        where('status', 'in', ['available', 'partially_used'])
      )
    );
    // Collect document refs — these are stable IDs, not data subject to races
    const candidateRefs = preQuerySnap.docs.map(d => doc(firestoreDb, 'creditNotes', d.id));

    await runTransaction(firestoreDb, async (tx) => {
      // 1. Re-read every candidate note via tx.get() so each read is registered
      //    with the transaction's conflict-detection mechanism. If any note is
      //    modified concurrently, Firestore will abort and retry this transaction.
      const noteSnaps = await Promise.all(candidateRefs.map(ref => tx.get(ref)));

      const availableNotes = noteSnaps
        .filter(snap => snap.exists())
        .map(snap => ({ id: snap.id, ref: snap.ref, ...snap.data() } as any))
        .filter((n: any) => n.status === 'available' || n.status === 'partially_used')
        .sort((a: any, b: any) =>
          (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0)
        );

      // 2. Validate available balance — now truly atomic (all reads are in-tx)
      const totalAvailable = availableNotes.reduce(
        (sum: number, n: any) => sum + (n.remainingBalance ?? n.amount ?? 0), 0
      );
      if (amount > totalAvailable) {
        throw new Error(
          `Insufficient credit. Available: ${formatCreditAmount(totalAvailable)}, Requested: ${formatCreditAmount(amount)}`
        );
      }

      // 3. Compute deductions (FIFO) inside the transaction
      let remainingAmount = amount;
      for (const note of availableNotes) {
        if (remainingAmount <= 0) break;
        const noteBalance = note.remainingBalance ?? (note.amount ?? 0);
        const amountToUse = Math.min(noteBalance, remainingAmount);
        const newBalance = noteBalance - amountToUse;
        tx.update(note.ref, {
          remainingBalance: newBalance,
          status: newBalance <= 0 ? 'fully_used' : 'partially_used',
          updatedAt: serverTimestamp(),
        });
        remainingAmount -= amountToUse;
      }

      // 4. Read current order and update creditApplied inside the transaction
      const orderRef = doc(firestoreDb, 'orders', orderId);
      const orderSnap = await tx.get(orderRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const newCreditApplied = (orderData.creditApplied || 0) + amount;
        const newAmountDue = Math.max(0, (orderData.total || 0) - newCreditApplied);
        tx.update(orderRef, {
          creditApplied: newCreditApplied,
          amountDue: newAmountDue,
          updatedAt: serverTimestamp(),
        });
      }
    });

    // 5. Record application history outside the transaction (non-critical audit trail)
    try {
      await createFirestoreCreditApplication({ orderId, customerId, amount });
    } catch (historyErr) {
      logger.warn('[applyCreditToOrder] History record failed (non-fatal):', historyErr);
    }

  } else {
    // ── localStorage demo path (unchanged) ───────────────────────────────────
    // Validate credit amount
    const availableCredit = await getAvailableCredit(customerId);
    if (amount > availableCredit) {
      throw new Error(`Insufficient credit. Available: ${formatCreditAmount(availableCredit)}, Requested: ${formatCreditAmount(amount)}`);
    }

    // Get all credit notes
    const creditNotes = await getAllCreditNotes(customerId);
    const availableNotes = creditNotes
      .filter((note: CreditNote) => note.status === 'available' || note.status === 'partially_used')
      .sort((a: CreditNote, b: CreditNote) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0));

    let remainingAmount = amount;
    const updatedNotes: Array<{ id: string; updates: Partial<CreditNote> }> = [];

    for (const note of availableNotes) {
      if (remainingAmount <= 0) break;
      const noteBalance = note.remainingBalance ?? (note.amount ?? 0);
      const amountToUse = Math.min(noteBalance, remainingAmount);
      const newBalance = noteBalance - amountToUse;
      updatedNotes.push({
        id: note.id,
        updates: {
          remainingBalance: newBalance,
          status: newBalance <= 0 ? 'fully_used' : 'partially_used',
        },
      });
      remainingAmount -= amountToUse;
    }

    // Update credit notes in localStorage
    const allCreditNotes = safeParseJSON<any[]>('bakery_credit_notes', []);
    for (const { id, updates } of updatedNotes) {
      const noteIndex = allCreditNotes.findIndex((n: CreditNote) => n.id === id);
      if (noteIndex !== -1) {
        allCreditNotes[noteIndex] = { ...allCreditNotes[noteIndex], ...updates };
      }
    }
    safeSetJSON('bakery_credit_notes', allCreditNotes);

    const currentOrder = await getOrderFromDS(orderId);
    if (currentOrder) {
      const newCreditApplied = (currentOrder.creditApplied || 0) + amount;
      await updateOrderInDS(orderId, { creditApplied: newCreditApplied });
    }

    const applicationHistory = safeParseJSON<any[]>('bakery_credit_application_history', []);
    applicationHistory.push({
      id: `APP-${Date.now()}-${cryptoIdSuffix()}`,
      orderId,
      customerId,
      amount,
      appliedAt: getServerTimestamp() as any,
    });
    safeSetJSON('bakery_credit_application_history', applicationHistory);
  }

  // ✅ Invalidate TanStack Query cache after applying credit
  invalidateCache.credit(customerId);
  invalidateCache.orders(); // Order also changed (creditApplied field)
}

/**
 * Create a new credit note
 * ✅ MAR 14, 2026: Firebase integration with dual-mode pattern
 */
export async function createCreditNote(
  customerId: string,
  sourceOrderId: string,
  amount: number,
  reason: string,
  type: CreditNote['type'],
  adminEmail?: string
): Promise<CreditNote> {

  // PASS 10 FIX: Resolve GST rate from settings instead of hardcoding 0.05.
  // Same rationale as orderCreationService.ts — admin tax-rate changes must
  // flow through every place that splits an inclusive amount into subtotal+GST,
  // otherwise credit notes will not reconcile against the orders they
  // originated from after a rate change. Falls back to 0.05 if settings are
  // unavailable so credit-note creation never fails on a settings read error.
  let gstRate = 0.05;
  try {
    const settings = await getSettings();
    for (const c of [settings.gstRate, settings.taxRate]) {
      if (typeof c === 'number' && Number.isFinite(c) && c >= 0 && c < 1) {
        gstRate = c;
        break;
      }
    }
  } catch (e) {
    logger.warn('[createCreditNote] Could not load settings for GST rate, using fallback 0.05:', e);
  }
  // ✅ Calculate GST breakdown (amount includes GST)
  const subtotal = amount / (1 + gstRate);
  const gst = amount - subtotal;

  const creditNoteData: Omit<CreditNote, 'id'> = {
    customerId,
    orderId: sourceOrderId, // ✅ Required field per schema
    creditNoteNumber: `CN-${Date.now()}`, // ✅ Required field per schema
    
    // ✅ Backward compatibility fields (optional in schema)
    sourceOrderId, // Legacy field
    amount, // Legacy field (alias for total)
    status: 'available', // Legacy field
    type, // Legacy field
    reason, // Optional field
    
    // ✅ Required financial fields
    subtotal,
    gst,
    deliveryFeeAdjustment: 0, // No delivery fee adjustment for admin edits
    total: amount,
    
    // ✅ Required status fields
    createdAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
    createdBy: adminEmail || 'admin',
    remainingBalance: amount,
    fullyApplied: false,
  };

  // ✅ Firebase mode
  if (isFirebaseConfigured) {
    const noteId = await createFirestoreCreditNote(creditNoteData);
    const creditNote = { ...creditNoteData, id: noteId } as CreditNote;
    return creditNote;
  } else {
    const creditNote: CreditNote = {
      ...creditNoteData,
      id: `CREDIT-${Date.now()}-${cryptoIdSuffix()}`,
    };

    const creditNotes = safeParseJSON<any[]>('bakery_credit_notes', []);
    creditNotes.push(creditNote);

    return creditNote;
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
 * Request credit payout
 * ✅ MAR 14, 2026: Fixed to accept creditNoteId parameter and integrate with Firebase
 */
export async function requestCreditPayout(
  customerId: string,
  creditNoteId: string
): Promise<void> {
  // 1. Get credit note from Firestore
  const { getCreditNotes, updateCreditNote } = await import('../firebase/firestore');
  const creditNotes = await getCreditNotes(customerId);
  const creditNote = creditNotes.find(note => note.id === creditNoteId);
  
  if (!creditNote) {
    throw new Error('Credit note not found');
  }
  
  // 2. Validate credit note can be paid out
  if (creditNote.payoutRequested) {
    throw new Error('Payout already requested for this credit note');
  }
  
  const balance = creditNote.remainingBalance ?? creditNote.amount;
  if (balance <= 0) {
    throw new Error('No remaining balance to request payout');
  }
  
  // 3. Update credit note in Firestore
  await updateCreditNote(creditNoteId, {
    payoutRequested: true,
    payoutRequestedAt: getServerTimestamp() as any,
  });
  
  
  // 4. Invalidate TanStack Query cache
  invalidateCache.credit(customerId);
  
}

/**
 * Check if a paid order can be edited by admin
 * ✅ FEB 9, 2026: STATUS MODEL FIX
 * Admin can edit orders in production or completed (payment confirmed)
 */

// ─── Paid-order edit functions ───────────────────────────────────────────────
// These are re-exported from their own module for backward compatibility.
// Import directly from services/orders/paidOrderEditService for new code.
export {
  canEditPaidOrder,
  validateItemEdit,
  calculateCreditFromReduction,
  adminEditPaidOrder,
} from "./orders/paidOrderEditService";
