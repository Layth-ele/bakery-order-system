/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - ORDER EDIT HISTORY DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the OrderEditHistory collection.
 * 
 * EXPORTS:
 * - getOrderEditHistory: Fetch all edit history for an order
 * - createOrderEditHistory: Create new edit history entry
 * - subscribeToOrderEditHistory: Real-time edit history list
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

export interface OrderEditHistory {
  id: string;
  orderId: string;
  editedBy: string; // Admin email
  editedAt: string;
  reason: string;
  changesSummary: string;
  originalTotal: number;
  newTotal: number;
  creditIssued: number;
  itemsChanged: Array<{
    productId: string;
    productName: string;
    originalQuantity: number;
    newQuantity: number;
    quantityChange: number;
    priceChange: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get edit history for an order
 */
export const getOrderEditHistory = async (orderId: string): Promise<OrderEditHistory[]> => {
  return wrapFirestoreOperation(async () => {
    const q = query(
      collection(db, 'orderEditHistory'),
      where('orderId', '==', orderId),
      orderBy('editedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    const editHistory: OrderEditHistory[] = [];
    snapshot.forEach((doc) => {
      editHistory.push({ id: doc.id, ...(doc.data() ?? {}) } as OrderEditHistory);
    });
    
    return editHistory;
  }, `getOrderEditHistory(${orderId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create order edit history entry
 * ✅ RETURNS: Document ID only
 */
export const createOrderEditHistory = async (
  data: Omit<OrderEditHistory, 'id' | 'editedAt'>
): Promise<string> => {
  return wrapFirestoreOperation(async () => {
    const docRef = await addDoc(collection(db, 'orderEditHistory'), {
      ...data,
      editedAt: serverTimestamp() as any,
    });
    
    return docRef.id;
  }, 'createOrderEditHistory');
};

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to edit history for an order
 */
export const subscribeToOrderEditHistory = (
  orderId: string,
  callback: (history: OrderEditHistory[]) => void
) => {
  const q = query(
    collection(db, 'orderEditHistory'),
    where('orderId', '==', orderId),
    orderBy('editedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const editHistory: OrderEditHistory[] = [];
    snapshot.forEach((doc) => {
      editHistory.push({ id: doc.id, ...(doc.data() ?? {}) } as OrderEditHistory);
    });
    callback(editHistory);
  }, (error) => {
    console.error('Error subscribing to order edit history:', error);
  });
};
