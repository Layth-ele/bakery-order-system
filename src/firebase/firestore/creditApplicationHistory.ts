/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - CREDIT APPLICATION HISTORY DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the CreditApplicationHistory collection.
 * 
 * EXPORTS:
 * - getCreditApplicationHistory: Fetch application history for a customer
 * - createCreditApplication: Create new application record
 * - subscribeToCreditApplicationHistory: Real-time application history
 * 
 * ✅ All operations use wrapFirestoreOperation for error handling
 * 
 * Created: March 14, 2026
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';

import { db, serverTimestamp, wrapFirestoreOperation } from './shared';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface CreditApplicationRecord {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  appliedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get credit application history for a customer
 */
export const getCreditApplicationHistory = async (
  customerId: string
): Promise<CreditApplicationRecord[]> => {
  return wrapFirestoreOperation(async () => {
    const q = query(
      collection(db, 'creditApplicationHistory'),
      where('customerId', '==', customerId),
      orderBy('appliedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    const history: CreditApplicationRecord[] = [];
    snapshot.forEach((doc) => {
      history.push({ id: doc.id, ...(doc.data() ?? {}) } as CreditApplicationRecord);
    });
    
    return history;
  }, `getCreditApplicationHistory(${customerId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create credit application record
 * ✅ RETURNS: Document ID only
 */
export const createCreditApplication = async (
  data: Omit<CreditApplicationRecord, 'id' | 'appliedAt'>
): Promise<string> => {
  return wrapFirestoreOperation(async () => {
    const docRef = await addDoc(collection(db, 'creditApplicationHistory'), {
      ...data,
      appliedAt: serverTimestamp() as any,
    });
    
    return docRef.id;
  }, 'createCreditApplication');
};

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to credit application history for a customer
 */
export const subscribeToCreditApplicationHistory = (
  customerId: string,
  callback: (history: CreditApplicationRecord[]) => void
) => {
  const q = query(
    collection(db, 'creditApplicationHistory'),
    where('customerId', '==', customerId),
    orderBy('appliedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const history: CreditApplicationRecord[] = [];
    snapshot.forEach((doc) => {
      history.push({ id: doc.id, ...(doc.data() ?? {}) } as CreditApplicationRecord);
    });
    callback(history);
  }, (error) => {
    console.error('Error subscribing to credit application history:', error);
  });
};
