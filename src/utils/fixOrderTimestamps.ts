/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIX ORDER TIMESTAMPS UTILITY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This utility fixes orders with invalid timestamp formats in Firestore.
 * 
 * USAGE:
 * 1. Import this function in your console
 * 2. Call fixOrderTimestamp('orderId') to fix a specific order
 * 3. Call fixAllOrderTimestamps() to fix all orders
 * 
 * ✅ MAR 16, 2026: Created to fix timestamp validation errors
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { db, Timestamp } from '../firebase/firestore/shared';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { logger } from './logger';


/**
 * Convert any value to a Firestore Timestamp
 */
function toTimestamp(value: any): Timestamp {
  // Already a Timestamp
  if (value instanceof Timestamp) {
    return value;
  }
  
  // Serialized Timestamp object
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  
  // ISO string
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }
  
  // Number (milliseconds)
  if (typeof value === 'number') {
    return Timestamp.fromMillis(value);
  }
  
  // Date object
  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }
  
  // Default to now
  logger.warn(`⚠️ Could not convert value to Timestamp, using current time:`, value);
  return Timestamp.now();
}

/**
 * Fix timestamps for a specific order
 */
export async function fixOrderTimestamp(orderId: string): Promise<void> {
  try {
    
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      console.error(`❌ Order ${orderId} not found`);
      return;
    }
    
    const data = orderSnap.data();
    const updates: any = {};
    
    // Fix createdAt if needed
    if (data.createdAt && !(data.createdAt instanceof Timestamp)) {
      updates.createdAt = toTimestamp(data.createdAt);
    }
    
    // Fix updatedAt if needed
    if (data.updatedAt && !(data.updatedAt instanceof Timestamp)) {
      updates.updatedAt = toTimestamp(data.updatedAt);
    }
    
    // Fix other timestamp fields if they exist
    const timestampFields = [
      'completedAt',
      'paidAt',
      'approvedAt',
      'rejectedAt',
      'cancelledAt',
      'updateRequestedAt',
    ];
    
    timestampFields.forEach(field => {
      if (data[field] && !(data[field] instanceof Timestamp)) {
        updates[field] = toTimestamp(data[field]);
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(orderRef, updates);
    } else {
    }
  } catch (error) {
    console.error(`❌ Error fixing order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Fix timestamps for all orders in Firestore
 */
export async function fixAllOrderTimestamps(): Promise<void> {
  try {
    
    const ordersRef = collection(db, 'orders');
    const snapshot = await getDocs(ordersRef);
    
    let fixedCount = 0;
    let errorCount = 0;
    let validCount = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const needsFix = 
          (data.createdAt && !(data.createdAt instanceof Timestamp)) ||
          (data.updatedAt && !(data.updatedAt instanceof Timestamp));
        
        if (needsFix) {
          await fixOrderTimestamp(doc.id);
          fixedCount++;
        } else {
          validCount++;
        }
      } catch (error) {
        console.error(`❌ Error fixing order ${doc.id}:`, error);
        errorCount++;
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing all orders:', error);
    throw error;
  }
}

/**
 * Quick fix for the specific order mentioned in the error
 */
export async function fixProblematicOrder(): Promise<void> {
  await fixOrderTimestamp('8UqEpReefSl5BeOdN2KN');
}
