/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - SNAPSHOTS SUBCOLLECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Snapshots migrated from embedded array to subcollection to avoid 1MB doc limit.
 * 
 * BEFORE: orders/{orderId}.snapshots[] (embedded, unbounded growth)
 * AFTER:  orders/{orderId}/snapshots/{snapId} (subcollection, unlimited)
 * 
 * EXPORTS:
 * - addOrderSnapshot: Create new snapshot in subcollection
 * - getOrderSnapshots: Get all snapshots for an order
 * - getLatestOrderSnapshot: Get most recent snapshot
 * 
 * ✅ All operations are schema-validated
 * ✅ All operations use wrapFirestoreOperation for error handling
 * ✅ Snapshots are immutable (create-only, no updates/deletes)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

import {
  orderSnapshotSchema,
  parseOrThrow,
  parseArrayPartial,
  type OrderSnapshot,
} from '../../schemas';

import { db, serverTimestamp, wrapFirestoreOperation } from './shared';

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all snapshots for an order (sorted newest first)
 * ✅ VALIDATED: All snapshot documents are validated
 * ✅ SUBCOLLECTION: Uses orders/{orderId}/snapshots/*
 */
export const getOrderSnapshots = async (orderId: string): Promise<OrderSnapshot[]> => {
  return wrapFirestoreOperation(async () => {
    const snapshotsRef = collection(db, 'orders', orderId, 'snapshots');
    const q = query(snapshotsRef, orderBy('createdAt', 'desc'));
    
    const snapshot = await getDocs(q);
    const rawSnapshots: any[] = [];
    
    snapshot.forEach((doc) => {
      rawSnapshots.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all snapshots
    return parseArrayPartial(orderSnapshotSchema, rawSnapshots, 'OrderSnapshot') as any;
  }, `getOrderSnapshots(${orderId})`);
};

/**
 * Get the most recent snapshot for an order
 * ✅ VALIDATED: Snapshot document is validated
 * ✅ SUBCOLLECTION: Uses orders/{orderId}/snapshots/* with limit(1)
 */
export const getLatestOrderSnapshot = async (orderId: string): Promise<OrderSnapshot | undefined> => {
  return wrapFirestoreOperation(async () => {
    const snapshotsRef = collection(db, 'orders', orderId, 'snapshots');
    const q = query(snapshotsRef, orderBy('createdAt', 'desc'), limit(1));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return undefined;
    }
    
    const doc = snapshot.docs[0];
    const rawSnapshot = { id: doc.id, ...(doc.data() ?? {}) };
    
    // ✅ SCHEMA PROTECTION: Validate snapshot
    return parseOrThrow(orderSnapshotSchema, rawSnapshot, 'OrderSnapshot') as any;
  }, `getLatestOrderSnapshot(${orderId})`);
};
