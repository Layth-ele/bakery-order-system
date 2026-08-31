/**
 * 🔄 Notification Transformation
 * 
 * ✅ DOMAIN LOGIC: Handles transformation of notifications for audit trail
 * ✅ MIGRATED: March 7, 2026 from /services/notificationTransform.ts
 * 
 * PURPOSE:
 * - Transform notifications instead of deleting them
 * - Preserve audit trail of admin actions
 * - Update notification metadata for history views
 * 
 * ARCHITECTURE:
 * - Domain transformation logic lives here
 * - Uses persistence layer from /services/notifications/
 * - Uses pure calculators from /services/calculators/
 * 
 * Example: PAYMENT_SUBMITTED (admin) → PAYMENT_CONFIRMED_ADMIN (history)
 * 
 * VERSION: 2.1.0 - Migrated to /notifications/transformations/
 * Previous: 2.0.0 - Refactored March 7, 2026
 */

import type { NotificationType } from '../../types/notification-contract';
import { isFirebaseConfigured, db } from '../../firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {NOTIFICATION_TYPES} from '../../types/notification-contract'
import { getServerTimestamp } from '../../utils/timestamps';
import {
  shouldTransformNotification,
  getTransformedType,
  isTransformedNotification,
  getTransformationMetadata,
  buildTransformationPayload,
  NOTIFICATION_TRANSFORMATION_MAP,
} from '../../services/calculators/notificationCalculator';

// Import notification paths utilities (moved to /notifications/utils/ in Phase 3)
import { getAdminNotificationPath, getAdminNotificationPathString } from '../utils/paths'; // ✅ PHASE 5: Updated to use consolidated paths

const DEBUG = false;

// ✅ Re-export calculator functions for convenience
export {
  shouldTransformNotification,
  getTransformedType,
  isTransformedNotification,
  getTransformationMetadata,
  NOTIFICATION_TRANSFORMATION_MAP,
};

/**
 * Transform admin PAYMENT_SUBMITTED notification to PAYMENT_CONFIRMED_ADMIN
 * 
 * This preserves the notification as an audit record showing:
 * - Admin saw the payment proof
 * - Admin confirmed the payment
 * - When it was confirmed
 * 
 * @param notificationId - The notification ID to transform
 * @param orderId - The order ID (for logging)
 * @param adminId - The admin who confirmed (for audit)
 * @param adminName - The admin's display name (for audit)
 * @param amount - The payment amount (for display in modal)
 * 
 * @example
 * ```typescript
 * await transformPaymentSubmittedToConfirmed(
 *   'notif-123',
 *   'ORDER_456',
 *   'admin@bakery.com',
 *   'Admin User',
 *   150.00
 * );
 * ```
 */
export async function transformPaymentSubmittedToConfirmed(
  notificationId: string,
  orderId: string,
  adminId: string,
  adminName?: string,
  amount?: number
): Promise<void> {
  // ============================================================================
  // FIREBASE MODE
  // ============================================================================
  
  if (isFirebaseConfigured && db) {
    try {
      const notificationRef = doc(db, ...getAdminNotificationPath(), notificationId);
      
      await updateDoc(notificationRef, {
        // Transform the type
        type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN,
        
        // Add amount for modal display
        amount: amount || 0,
        
        // Update title and message for history view
        title: '✅ Payment Confirmed',
        message: `Payment confirmed for Order ${orderId}`,
        
        // Mark as read (it's now a history item)
        read: true,
        readAt: serverTimestamp() as any,
        
        // Add transformation metadata
        transformedFrom: NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
        transformedAt: serverTimestamp() as any,
        transformedBy: adminId,
        transformedByName: adminName || adminId,
        
        // Update timestamp for sorting
        updatedAt: serverTimestamp() as any,
      });
      
    } catch (error) {
      console.error('❌ [Firebase] Failed to transform notification:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // LOCALSTORAGE MODE (Demo/Development)
  // ============================================================================
  
  else {
    try {
      // Use canonical path utility for localStorage key
      const adminNotificationsKey = getAdminNotificationPathString();
      
      
      const notifications: any[] = [];
      const notificationIndex = notifications.findIndex((n: any) => n.id === notificationId);
      
      if (notificationIndex === -1) {
        return;
      }
      
      
      // Transform the notification
      notifications[notificationIndex] = {
        ...notifications[notificationIndex],
        
        // Transform the type
        type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN,
        
        // Add amount for modal display
        amount: amount || 0,
        
        // Update title and message
        title: '✅ Payment Confirmed',
        message: `Payment confirmed for Order ${orderId}`,
        
        // Mark as read
        read: true,
        readAt: getServerTimestamp() as any,
        
        // Add transformation metadata
        transformedFrom: NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
        transformedAt: getServerTimestamp() as any,
        transformedBy: adminId,
        transformedByName: adminName || adminId,
        
        // Update timestamp
        updatedAt: getServerTimestamp() as any,
      };
      
      // Save back to localStorage
      localStorage.setItem(adminNotificationsKey, JSON.stringify(notifications));
      
      // Dispatch storage event for cross-tab sync
      window.dispatchEvent(new StorageEvent('storage', {
        key: adminNotificationsKey,
        newValue: JSON.stringify(notifications),
        storageArea: localStorage,
      }));
      
    } catch (error) {
      console.error('❌ [localStorage] Failed to transform notification:', error);
      throw error;
    }
  }
}

/**
 * Generic notification transformation function
 * 
 * Uses the calculator functions to determine if transformation is needed
 * and what the target type should be.
 * 
 * @param notificationId - Notification to transform
 * @param currentType - Current notification type
 * @param context - Additional context (adminId, orderId, etc.)
 * @returns Promise that resolves when complete
 */
export async function transformNotification(
  notificationId: string,
  currentType: NotificationType,
  context: {
    orderId?: string;
    adminId?: string;
    adminName?: string;
    amount?: number;
    [key: string]: unknown;
  }
): Promise<void> {
  // Check if this notification should be transformed
  if (!shouldTransformNotification(currentType)) {
    return;
  }

  // Get the transformed type
  const transformedType = getTransformedType(currentType);
  if (!transformedType) {
    return;
  }

  // Build transformation payload
  const payload = buildTransformationPayload(currentType, transformedType, context as any);

  // Apply transformation
  if (isFirebaseConfigured && db) {
    try {
      const notificationRef = doc(db, ...getAdminNotificationPath(), notificationId);
      if (payload) await updateDoc(notificationRef, payload as any);
      
    } catch (error) {
      console.error('❌ [transformNotification] Firebase transformation failed:', error);
      throw error;
    }
  } else {
    try {
      const adminNotificationsKey = getAdminNotificationPathString();
      
      const notifications: any[] = [];
      const notificationIndex = notifications.findIndex((n: any) => n.id === notificationId);
      
      if (notificationIndex === -1) return;
      
      notifications[notificationIndex] = {
        ...notifications[notificationIndex],
        ...payload,
      };
      
      localStorage.setItem(adminNotificationsKey, JSON.stringify(notifications));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: adminNotificationsKey,
        newValue: JSON.stringify(notifications),
        storageArea: localStorage,
      }));
      
    } catch (error) {
      console.error('❌ [transformNotification] LocalStorage transformation failed:', error);
      throw error;
    }
  }
}