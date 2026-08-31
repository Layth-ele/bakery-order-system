/**
 * 💾 Notification Persistence Layer
 * 
 * ✅ PERSISTENCE ONLY: CRUD operations for notifications
 * ✅ CREATED: March 7, 2026 - Split from orderNotificationService
 * 
 * PURPOSE:
 * - Create, read, update, delete notifications
 * - Supports Firebase (production) and localStorage (development)
 * - No business logic - pure persistence operations
 * 
 * ARCHITECTURE:
 * - Persistence layer lives here in /services/notifications/
 * - Domain logic lives in /notifications/domain/
 * - Path utilities from /notifications/utils/paths
 * 
 * VERSION: 1.0.0 - Initial split from orderNotificationService
 */

import { isFirebaseConfigured, db } from '../../firebase/config';
import { safeParseJSON } from '../../utils/safeLocalStorage';
import { collection, doc, setDoc, updateDoc, serverTimestamp, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { getServerTimestamp } from '../../utils/timestamps';
import { debug } from '../../utils/debug';
import { 
  getAdminNotificationPath, 
  getAdminNotificationPathString, 
  getCustomerNotificationPath, 
  getCustomerNotificationPathString 
} from '../../notifications/utils/paths';

const DEBUG = false;

// ============================================================================
// NOTIFICATION DATA STRUCTURE
// ============================================================================

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  orderId?: string;
  actions: Array<{ type: string; label: string; payload?: any }>;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: any;
  updatedAt?: any;
}

// ============================================================================
// CUSTOMER NOTIFICATION PERSISTENCE
// ============================================================================

/**
 * Create a customer notification (Firebase or localStorage fallback)
 */
export async function createCustomerNotification(
  customerId: string,
  notificationId: string,
  type: string,
  title: string,
  message: string,
  orderId: string,
  actions: Array<{ type: string; label: string; payload?: any }>,
  metadata?: Record<string, any>
): Promise<void> {
  const notification: NotificationData = {
    id: notificationId,
    type,
    title,
    message,
    orderId,
    actions,
    metadata: metadata || {},
    read: false,
    createdAt: getServerTimestamp() as any,
  };

  if (isFirebaseConfigured) {
    try {
      const path = getCustomerNotificationPath(customerId);
      const notificationRef = doc(db, ...path, notificationId);
      await setDoc(notificationRef, {
        ...notification,
        createdAt: serverTimestamp() as any,
        timestamp: serverTimestamp() as any, // ✅ Required for orderBy('timestamp') in providers
      });
    } catch (error) {
      console.error('❌ Failed to create customer notification in Firebase:', error);
      // Fallback to localStorage
      createCustomerNotificationLocalStorage(customerId, notification);
    }
  } else {
    // Development mode: use localStorage
    createCustomerNotificationLocalStorage(customerId, notification);
  }
}

/**
 * Create customer notification in localStorage (development fallback)
 */
function createCustomerNotificationLocalStorage(customerId: string, notification: NotificationData): void {
  const storageKey = getCustomerNotificationPathString(customerId);
  const notifications = safeParseJSON<NotificationData[]>(storageKey, []);
  
  const filtered = notifications.filter((n) => n.id !== notification.id);
  filtered.unshift(notification);
  
  // FIX H7: Was missing localStorage.setItem — the filtered array was built then
  // immediately discarded without being persisted. Customer notifications created
  // via the Firebase fallback path (e.g. order-approved, payment-confirmed) were
  // silently lost on every call.
  localStorage.setItem(storageKey, JSON.stringify(filtered));
}

/**
 * Update a customer notification (Firebase or localStorage)
 */
export async function updateCustomerNotification(
  customerId: string,
  notificationId: string,
  updates: Partial<NotificationData>
): Promise<void> {
  if (isFirebaseConfigured) {
    try {
      const path = getCustomerNotificationPath(customerId);
      const notificationRef = doc(db, ...path, notificationId);
      await updateDoc(notificationRef, {
        ...updates,
        updatedAt: serverTimestamp() as any,
      });
    } catch (error) {
      console.error('❌ Failed to update customer notification in Firebase:', error);
      // Fallback to localStorage
      updateCustomerNotificationLocalStorage(customerId, notificationId, updates);
    }
  } else {
    // Development mode: use localStorage
    updateCustomerNotificationLocalStorage(customerId, notificationId, updates);
  }
}

/**
 * Update customer notification in localStorage (development fallback)
 */
function updateCustomerNotificationLocalStorage(
  customerId: string,
  notificationId: string,
  updates: Partial<NotificationData>
): void {
  const storageKey = getCustomerNotificationPathString(customerId);
  const notifications = safeParseJSON<NotificationData[]>(storageKey, []);
  
  const index = notifications.findIndex((n: any) => n.id === notificationId);
  if (index !== -1) {
    notifications[index] = {
      ...notifications[index],
      ...updates,
      updatedAt: getServerTimestamp() as any,
    };
    // FIX H7: Was missing localStorage.setItem — the updated array was built
    // then discarded. Marking notifications as read had no effect in fallback mode.
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }
}

/**
 * Delete customer notifications by query (e.g., all notifications for an order)
 */
export async function deleteCustomerNotifications(
  customerId: string,
  queryParams: { orderId?: string; type?: string }
): Promise<void> {
  if (isFirebaseConfigured) {
    try {
      const path = getCustomerNotificationPath(customerId);
      const notificationsRef = collection(db, ...path);
      
      // Build query
      let q = query(notificationsRef);
      if (queryParams.orderId) {
        q = query(q, where('orderId', '==', queryParams.orderId));
      }
      if (queryParams.type) {
        q = query(q, where('type', '==', queryParams.type));
      }
      
      // Execute query and delete
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
    } catch (error) {
      console.error('❌ Failed to delete customer notifications from Firebase:', error);
      // Fallback to localStorage
      deleteCustomerNotificationsLocalStorage(customerId, queryParams);
    }
  } else {
    // Development mode: use localStorage
    deleteCustomerNotificationsLocalStorage(customerId, queryParams);
  }
}

/**
 * Delete customer notifications in localStorage (development fallback)
 */
function deleteCustomerNotificationsLocalStorage(
  customerId: string,
  queryParams: { orderId?: string; type?: string }
): void {
  const storageKey = getCustomerNotificationPathString(customerId);
  const notifications = safeParseJSON<NotificationData[]>(storageKey, []);
  
  const filtered = notifications.filter((n) => {
    if (queryParams.orderId && n.orderId !== queryParams.orderId) return true;
    if (queryParams.type && n.type !== queryParams.type) return true;
    return false;
  });
  
  // FIX H7: Was missing localStorage.setItem — deleted notifications were
  // never removed from storage, so stale notifications kept reappearing.
  localStorage.setItem(storageKey, JSON.stringify(filtered));
}

// ============================================================================
// ADMIN NOTIFICATION PERSISTENCE
// ============================================================================

/**
 * Create an admin notification (Firebase or localStorage fallback)
 */
export async function createAdminNotification(
  notificationId: string,
  type: string,
  title: string,
  message: string,
  orderId: string,
  actions: Array<{ type: string; label: string; payload?: any }>,
  metadata?: Record<string, any>
): Promise<void> {
  debug.log('🔔 [createAdminNotification] Creating notification:', { notificationId, type, title, orderId });

  const notification: NotificationData = {
    id: notificationId,
    type,
    title,
    message,
    orderId,
    actions,
    metadata: metadata || {},
    read: false,
    createdAt: getServerTimestamp() as any,
  };


  if (isFirebaseConfigured) {
    try {
      const path = getAdminNotificationPath();
      const notificationRef = doc(db, ...path, notificationId);
      await setDoc(notificationRef, {
        ...notification,
        createdAt: serverTimestamp() as any,
        timestamp: serverTimestamp() as any, // ✅ Required for orderBy('timestamp') in providers
      });
      debug.log('✅ [createAdminNotification] Firebase success');
    } catch (error) {
      console.error('❌ Failed to create admin notification in Firebase:', error);
      // Fallback to localStorage
      createAdminNotificationLocalStorage(notification);
    }
  } else {
    // Development mode: use localStorage
    createAdminNotificationLocalStorage(notification);
  }
}

/**
 * Create admin notification in localStorage (development fallback)
 */
function createAdminNotificationLocalStorage(notification: NotificationData): void {
  debug.log('💾 [createAdminNotificationLocalStorage] Saving notification:', notification.id, notification.type);
  const storageKey = getAdminNotificationPathString();
  const notifications = safeParseJSON<NotificationData[]>(storageKey, []);
  
  // Remove existing notification with same ID (replace)
  const filtered = notifications.filter((n) => n.id !== notification.id);
  filtered.unshift(notification);
  
  // ✅ CRITICAL FIX - Save the filtered array to localStorage
  localStorage.setItem(storageKey, JSON.stringify(filtered));
  debug.log('✅ [createAdminNotificationLocalStorage] Saved to localStorage, total notifications:', filtered.length);
  
  // Trigger storage event for reactivity
  window.dispatchEvent(new StorageEvent('storage', {
    key: storageKey,
    newValue: JSON.stringify(filtered),
    oldValue: localStorage.getItem(storageKey),
    storageArea: localStorage,
  }));
}

/**
 * Update an admin notification (Firebase or localStorage)
 */
export async function updateAdminNotification(
  notificationId: string,
  updates: Partial<NotificationData>
): Promise<void> {
  if (isFirebaseConfigured) {
    try {
      const path = getAdminNotificationPath();
      const notificationRef = doc(db, ...path, notificationId);
      await updateDoc(notificationRef, {
        ...updates,
        updatedAt: serverTimestamp() as any,
      });
    } catch (error) {
      console.error('❌ Failed to update admin notification in Firebase:', error);
      // Fallback to localStorage
      updateAdminNotificationLocalStorage(notificationId, updates);
    }
  } else {
    // Development mode: use localStorage
    updateAdminNotificationLocalStorage(notificationId, updates);
  }
}

/**
 * Update admin notification in localStorage (development fallback)
 */
function updateAdminNotificationLocalStorage(
  notificationId: string,
  updates: Partial<NotificationData>
): void {
  const storageKey = getAdminNotificationPathString();
  const notifications = safeParseJSON<NotificationData[]>(storageKey, []);
  
  const index = notifications.findIndex((n: any) => n.id === notificationId);
  if (index !== -1) {
    notifications[index] = {
      ...notifications[index],
      ...updates,
      updatedAt: getServerTimestamp() as any,
    };
    // FIX H7: Was missing localStorage.setItem — admin notification updates
    // (e.g. marking as read) were silently discarded in fallback mode.
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }
}