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

/**
 * Create credit note
 * ✅ INPUT VALIDATED: Input is validated before write
 * ✅ RETURNS: Document ID only (caller should fetch if needed)
 */
export const createCreditNote = async (creditNote: Omit<CreditNote, 'id' | 'createdAt'>): Promise<string> => {
  return wrapFirestoreOperation(async () => {
    // ✅ SCHEMA PROTECTION: Validate input using base schema (no refinements)
    const validatedInput = parseOrThrow(
      baseCreditNoteSchema.omit({ id: true, createdAt: true }),
      creditNote,
      'CreateCreditNoteInput'
    );
    
    const colRef = collection(db, 'creditNotes');
    const docRef = await addDoc(colRef, {
      ...validatedInput,
      createdAt: serverTimestamp(),
    });
    
    return docRef.id;
  }, 'createCreditNote');
};

/**
 * Update credit note
 * ✅ INPUT VALIDATED: Partial update is validated
 */
export const updateCreditNote = async (creditNoteId: string, data: Partial<CreditNote>): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid update data: must be an object');
    }
    
    // ✅ SCHEMA PROTECTION: Validate partial update using base schema (no refinements)
    const validatedInput = parseOrThrow(
      baseCreditNoteSchema.partial(),
      data,
      'UpdateCreditNoteInput'
    );
    
    const cleanData = Object.entries(validatedInput).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    if (Object.keys(cleanData).length === 0) {
      logger.warn('updateCreditNote: No valid fields to update');
      return;
    }
    
    const docRef = doc(db, 'creditNotes', creditNoteId);
    await updateDoc(docRef, cleanData);
    
  }, `updateCreditNote(${creditNoteId})`);
};

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
