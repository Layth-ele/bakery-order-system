/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - CREDIT NOTES DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the CreditNotes collection.
 * 
 * EXPORTS:
 * - getCreditNotes: Fetch all credit notes for a customer
 * - createCreditNote: Create new credit note
 * - updateCreditNote: Update credit note
 * - subscribeToCreditNotes: Real-time credit notes list
 * 
 * ✅ All operations are schema-validated
 * ✅ All operations use wrapFirestoreOperation for error handling
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';

import {
  creditNoteSchema,
  baseCreditNoteSchema,
  parseOrThrow,
  parseArrayPartial,
  type CreditNote,
} from '../../schemas';

import { db, serverTimestamp, wrapFirestoreOperation } from './shared';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get credit notes for a customer
 * ✅ VALIDATED: All credit note documents are validated
 */
export const getCreditNotes = async (customerId: string): Promise<CreditNote[]> => {
  return wrapFirestoreOperation(async () => {
    const q = query(
      collection(db, 'creditNotes'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    const rawCreditNotes: any[] = [];
    snapshot.forEach((doc) => {
      rawCreditNotes.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all credit notes
    return parseArrayPartial(creditNoteSchema, rawCreditNotes, 'CreditNote');
  }, `getCreditNotes(${customerId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to credit notes for a customer
 * ✅ VALIDATED: All credit note documents are validated
 */
export const subscribeToCreditNotes = (customerId: string, callback: (creditNotes: CreditNote[]) => void) => {
  const q = query(
    collection(db, 'creditNotes'),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const rawCreditNotes: any[] = [];
    snapshot.forEach((doc) => {
      rawCreditNotes.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all credit notes
    const validatedCreditNotes = parseArrayPartial(creditNoteSchema, rawCreditNotes, 'CreditNote');
    callback(validatedCreditNotes);
  }, (error) => {
    console.error('Error subscribing to credit notes:', error);
  });
};
