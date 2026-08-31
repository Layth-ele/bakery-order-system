/**
 * 🔥 FIRESTORE DATA SERVICE
 * 
 * 
 * Pattern: Repository Pattern
 * - Single source of truth for all data operations
 * - Type-safe data access
 * - Automatic real-time listeners
 * - Offline support (Firestore caching)
 * - Production-ready error handling
 * 
 * Version: 1.0
 * Created: February 12, 2026
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  type Firestore,
  type DocumentData,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';

import { db, isFirebaseConfigured } from '../../firebase/config';
import { logger } from '../../utils/logger';


// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FirestoreServiceConfig {
  debug?: boolean;
  enableCache?: boolean;
  retryAttempts?: number;
}

export interface CollectionPaths {
  SETTINGS: string;
  CUSTOMERS: string;
  ORDERS: string;
  PRODUCTS: string;
  CATEGORIES: string;
  CREDIT_NOTES: string;
  INVOICES: string;
  ERROR_LOGS: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Firestore collection paths
 * This is the SINGLE SOURCE OF TRUTH for collection names
 */
export const COLLECTIONS: CollectionPaths = {
  SETTINGS: 'settings',
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  CREDIT_NOTES: 'creditNotes',
  INVOICES: 'invoices',
  ERROR_LOGS: 'errorLogs',
};

// ============================================================================
// HELPER - Strip undefined values recursively
// Firestore rejects any field with value `undefined`
// ============================================================================

function cleanForFirestore(data: any): any {
  return JSON.parse(JSON.stringify(data, (_, value) => {
    if (value === undefined) return null;
    return value;
  }));
}

// ============================================================================
// FIRESTORE DATA SERVICE
// ============================================================================

export class FirestoreDataService {
  private db: Firestore;
  private config: FirestoreServiceConfig;

  constructor(firestore?: Firestore, config?: FirestoreServiceConfig) {
    // ✅ FIX MAR 14, 2026: Better handling when firestore is undefined
    const firestoreInstance = firestore || db;
    
    // ✅ SAFETY GUARD: Check if Firestore is initialized
    if (!firestoreInstance) {
      throw new Error(
        '🔥 Firestore is not initialized. Please check your Firebase configuration.\n' +
        'Make sure all required environment variables are set:\n' +
        '  - VITE_FIREBASE_API_KEY\n' +
        '  - VITE_FIREBASE_PROJECT_ID\n' +
        '  - VITE_FIREBASE_AUTH_DOMAIN\n' +
        '  - VITE_FIREBASE_STORAGE_BUCKET\n' +
        '  - VITE_FIREBASE_MESSAGING_SENDER_ID\n' +
        '  - VITE_FIREBASE_APP_ID'
      );
    }
    
    this.db = firestoreInstance;
    this.config = {
      debug: config?.debug ?? false,
      enableCache: config?.enableCache ?? true,
      retryAttempts: config?.retryAttempts ?? 3,
    };

    if (this.config.debug) {
    }
  }

  // ==========================================================================
  // GENERIC CRUD OPERATIONS
  // ==========================================================================

  /**
   * Gets a single document by ID
   */
  async getDocument<T = DocumentData>(
    collectionPath: string,
    documentId: string
  ): Promise<T | null> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      const docSnap = await getDoc(docRef as any);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...(docSnap.data() as any) } as T;
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to get document ${documentId} from ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Gets all documents from a collection
   *
   * FIX R8-S6-F29 (HIGH): Was unbounded — for a collection with 50K orders,
   * a single call would fetch all of them, blowing up Firestore reads, network,
   * and browser memory.  The parallel `firebase/firestore/orders.ts:getOrders`
   * had a 500-doc default limit; this path silently bypassed it.
   *
   * Now applies a default 1000-doc limit.  Callers that legitimately need
   * unbounded reads should pass `{ unsafe: true }`, log loudly, and have a
   * clear plan for memory/cost.
   */
  async getAllDocuments<T = DocumentData>(
    collectionPath: string,
    options?: { limit?: number; unsafe?: boolean }
  ): Promise<T[]> {
    try {
      const { query, limit: limitFn } = await import('firebase/firestore');
      const collectionRef = collection(this.db, collectionPath);

      const maxDocs = options?.limit ?? 1000;
      let q: any = collectionRef;
      if (!options?.unsafe) {
        q = query(collectionRef, limitFn(maxDocs));
      } else {
        logger.warn(`⚠️ getAllDocuments(${collectionPath}, {unsafe: true}) — ` +
                    `unbounded read; ensure caller has explicit cost/memory plan`);
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() ?? {}),
      })) as T[];
    } catch (error) {
      console.error(`❌ Failed to get documents from ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Queries documents with filters
   */
  async queryDocuments<T = DocumentData>(
    collectionPath: string,
    ...queryConstraints: any[]
  ): Promise<T[]> {
    try {
      const collectionRef = collection(this.db, collectionPath);
      const q = query(collectionRef, ...queryConstraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() ?? {}),
      })) as T[];
    } catch (error) {
      console.error(`❌ Failed to query documents from ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Sets a document (creates or overwrites)
   * ✅ FIX: Strip undefined values before writing — Firestore rejects them
   */
  async setDocument<T = DocumentData>(
    collectionPath: string,
    documentId: string,
    data: Partial<T>
  ): Promise<void> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      const cleanData = cleanForFirestore(data);
      await setDoc(docRef as any, cleanData as any);

      if (this.config.debug) {
      }
    } catch (error) {
      console.error(`❌ Failed to set document ${documentId} in ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Updates a document (partial update)
   * ✅ FIX: Strip undefined values before writing — Firestore rejects them
   */
  async updateDocument<T = DocumentData>(
    collectionPath: string,
    documentId: string,
    data: Partial<T>
  ): Promise<void> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      const cleanData = cleanForFirestore(data);
      await updateDoc(docRef as any, cleanData as any);

      if (this.config.debug) {
      }
    } catch (error) {
      console.error(`❌ Failed to update document ${documentId} in ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a document
   */
  async deleteDocument(
    collectionPath: string,
    documentId: string
  ): Promise<void> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      await deleteDoc(docRef);

      if (this.config.debug) {
      }
    } catch (error) {
      console.error(`❌ Failed to delete document ${documentId} from ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Batch writes (atomic operations)
   * ✅ FIX: Strip undefined values before writing — Firestore rejects them
   */
  async batchWrite(
    operations: Array<{
      type: 'set' | 'update' | 'delete';
      collectionPath: string;
      documentId: string;
      data?: any;
    }>
  ): Promise<void> {
    try {
      const batch = writeBatch(this.db);

      operations.forEach((op) => {
        const docRef = doc(this.db, op.collectionPath, op.documentId);

        switch (op.type) {
          case 'set':
            batch.set(docRef, cleanForFirestore(op.data));
            break;
          case 'update':
            batch.update(docRef, cleanForFirestore(op.data));
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();

      if (this.config.debug) {
      }
    } catch (error) {
      console.error(`❌ Failed to execute batch write:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // REAL-TIME LISTENERS
  // ==========================================================================

  /**
   * Subscribes to a single document's changes
   */
  subscribeToDocument<T = DocumentData>(
    collectionPath: string,
    documentId: string,
    callback: (data: T | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = doc(this.db, collectionPath, documentId);

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error(`❌ Subscription error for ${collectionPath}/${documentId}:`, error);
        if (onError) {
          onError(error);
        }
      }
    );
  }

  /**
   * Subscribes to a collection's changes
   */
  subscribeToCollection<T = DocumentData>(
    collectionPath: string,
    callback: (data: T[]) => void,
    onError?: (error: Error) => void,
    ...queryConstraints: any[]
  ): Unsubscribe {
    const collectionRef = collection(this.db, collectionPath);
    const q = queryConstraints.length > 0
      ? query(collectionRef, ...queryConstraints)
      : collectionRef;

    return onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() ?? {}),
        })) as T[];
        callback(data);
      },
      (error) => {
        console.error(`❌ Subscription error for ${collectionPath}:`, error);
        if (onError) {
          onError(error);
        }
      }
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Checks if a document exists
   */
  async documentExists(collectionPath: string, documentId: string): Promise<boolean> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      const docSnap = await getDoc(docRef as any);
      return docSnap.exists();
    } catch (error) {
      console.error(`❌ Failed to check if document exists:`, error);
      return false;
    }
  }

  /**
   * Counts documents in a collection
   *
   * FIX R8-S6-F38 (HIGH): Was `getDocs(collectionRef).size` — fetched every
   * document just to count.  For a 50,000-record collection that's 50K reads
   * (≈$0.06/call in Firestore costs) plus the network transfer of all data.
   * Now uses getCountFromServer which performs server-side aggregation —
   * one RPC, no document data transferred, billed as 1 read.
   */
  async countDocuments(collectionPath: string): Promise<number> {
    try {
      const { getCountFromServer } = await import('firebase/firestore');
      const collectionRef = collection(this.db, collectionPath);
      const snap = await getCountFromServer(collectionRef);
      return snap.data().count;
    } catch (error) {
      console.error(`❌ Failed to count documents in ${collectionPath}:`, error);
      return 0;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE (Optional)
// ============================================================================

let serviceInstance: FirestoreDataService | null = null;

/**
 * Gets or creates a singleton service instance
 * Returns null if Firebase not configured
 */
export function getFirestoreDataService(
  firestore?: Firestore,
  config?: FirestoreServiceConfig
): FirestoreDataService | null {
  // ✅ Don't initialize if Firebase not configured
  if (!isFirebaseConfigured && !firestore) {
    return null;
  }
  
  if (!serviceInstance) {
    try {
      serviceInstance = new FirestoreDataService(firestore, config);
    } catch (error) {
      logger.warn('⚠️ Failed to initialize FirestoreDataService:', error);
      return null;
    }
  }
  return serviceInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetFirestoreDataService(): void {
  serviceInstance = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FirestoreDataService;
