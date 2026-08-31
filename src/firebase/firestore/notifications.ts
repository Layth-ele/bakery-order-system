/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - NOTIFICATIONS DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the Notifications collection.
 * 
 * EXPORTS:
 * - subscribeToNotifications: Real-time notifications list
 * - createNotification: Create new notification
 * - markNotificationAsRead: Mark single notification as read
 * - markAllNotificationsAsRead: Mark all notifications as read
 * 
 * ✅ All operations are schema-validated
 * ✅ All operations use wrapFirestoreOperation for error handling
 * ✅ Uses hierarchical notification paths (notifications/user_{userId}/items)
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
  limit,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';

import {
  notificationItemSchema,
  parseOrThrow,
  parseArrayPartial,
  type NotificationItem,
} from '../../schemas';

import { db, serverTimestamp, wrapFirestoreOperation } from './shared';
import { getCustomerNotificationPath, getAdminNotificationPath } from '../../notifications/utils/paths';

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to user notifications
 * ✅ VALIDATED: All notification documents are validated
 * ✅ HIERARCHICAL: Uses notifications/user_{userId}/items path
 */
export const subscribeToNotifications = (
  userId: string, 
  callback: (notifications: NotificationItem[]) => void,
  target: 'admin' | 'customer' = 'customer',
  errorCallback?: (error: Error) => void
) => {
  // ✅ FIX: Use hierarchical path instead of flat collection
  const path = target === 'admin' 
    ? getAdminNotificationPath()
    : getCustomerNotificationPath(userId);
  
  const q = query(
    collection(db, ...path),  // ✅ HIERARCHICAL: notifications/user_{userId}/items
    orderBy('createdAt', 'desc'),  // ✅ No userId filter needed!
    limit(50)
  );
  
  return onSnapshot(q, (snapshot) => {
    const rawNotifications: any[] = [];
    snapshot.forEach((doc) => {
      rawNotifications.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all notifications
    const validatedNotifications = parseArrayPartial(notificationItemSchema, rawNotifications, 'Notification');
    callback(validatedNotifications);
  }, (error) => {
    // PASS 9 FIX: Previously this only logged. Callers wrapping this in a
    // Promise (see useCachedNotifications) would hang forever on permission
    // errors or transient network failures. Now we both deliver an empty
    // array (so any direct subscribers don't get stuck on stale data) AND
    // forward the error to an optional errorCallback so Promise wrappers can
    // reject and let TanStack Query retry.
    console.error('Error subscribing to notifications:', error);
    callback([]);
    if (errorCallback) {
      errorCallback(error as Error);
    }
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create notification
 * ✅ INPUT VALIDATED: Input is validated before write
 * ✅ HIERARCHICAL: Uses notifications/user_{userId}/items path
 */
export const createNotification = async (
  notification: Omit<NotificationItem, 'id' | 'createdAt'>,
  target: 'admin' | 'customer' = 'customer'
): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    // ✅ SCHEMA PROTECTION: Validate input (partial validation for creation)
    const validatedInput = parseOrThrow(
      notificationItemSchema.omit({ id: true, createdAt: true }), 
      notification, 
      'CreateNotificationInput'
    );
    
    // ✅ FIX: Use hierarchical path instead of flat collection
    const path = target === 'admin' 
      ? getAdminNotificationPath()
      : getCustomerNotificationPath(notification.customerId ?? '');  // 🔥 FIXED: Changed userId to customerId
    
    await addDoc(collection(db, ...path), {  // ✅ HIERARCHICAL
      ...validatedInput,
      createdAt: serverTimestamp() as any,
      // FIX R9-S6-F49 (HIGH): CustomerNotificationProvider and AdminNotificationProvider
      // subscribe via orderBy('timestamp','desc'). Without this field, every notification
      // created via this path was filtered out of the subscription (Firestore orderBy
      // excludes docs missing the field), making force-status-change notifications
      // invisible to customers.
      timestamp: serverTimestamp() as any,
    });
  }, 'createNotification');
};

/**
 * Mark notification as read
 * ✅ HIERARCHICAL: Uses notifications/user_{userId}/items path
 */
export const markNotificationAsRead = async (
  notificationId: string,
  userId: string,
  target: 'admin' | 'customer' = 'customer'
): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    // ✅ FIX: Use hierarchical path instead of flat collection
    const path = target === 'admin' 
      ? getAdminNotificationPath()
      : getCustomerNotificationPath(userId);
    
    const docRef = doc(db, ...path, notificationId);  // ✅ HIERARCHICAL
    await updateDoc(docRef, { read: true });
  }, `markNotificationAsRead(${notificationId})`);
};

/**
 * Mark all notifications as read
 * ✅ HIERARCHICAL: Uses notifications/user_{userId}/items path
 */
export const markAllNotificationsAsRead = async (
  userId: string,
  target: 'admin' | 'customer' = 'customer'
): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    // ✅ FIX: Use hierarchical path instead of flat collection
    const path = target === 'admin' 
      ? getAdminNotificationPath()
      : getCustomerNotificationPath(userId);
    
    const q = query(
      collection(db, ...path),  // ✅ HIERARCHICAL
      where('read', '==', false)  // ✅ No userId filter needed!
    );
    
    const snapshot = await getDocs(q);
    const updatePromises = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { read: true })
    );
    
    await Promise.all(updatePromises);
  }, `markAllNotificationsAsRead(${userId})`);
};