/**
 * Notification Calculator - Pure Business Logic
 * 
 * ✅ CLEAN ARCHITECTURE: Pure functions with no side effects
 * - No Firebase calls
 * - Fully testable
 * 
 * Extracted from notificationTransform.ts (I/O operations moved to orchestrator)
 */

import type { NotificationType } from '../../types/notification-contract';
import {NOTIFICATION_TYPES} from '../../types/notification-contract'
import { toDate } from '../../utils/timestampFormatting';

/**
 * Mapping of notification types that should be transformed (not deleted)
 * Key: Original notification type
 * Value: Transformed notification type (for history/audit)
 */
export const NOTIFICATION_TRANSFORMATION_MAP: Record<string, NotificationType> = {
  // Admin notifications that transform after action
  [NOTIFICATION_TYPES.PAYMENT_SUBMITTED]: NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN,
  // Add more transformation rules here as needed
};

/**
 * Check if a notification type should be transformed instead of deleted
 * 
 * @param type - Notification type to check
 * @returns true if transformation rule exists
 */
export function shouldTransformNotification(type: string): boolean {
  return type in NOTIFICATION_TRANSFORMATION_MAP;
}

/**
 * Get the transformed type for a notification
 * 
 * @param originalType - Original notification type
 * @returns Transformed notification type or null if no rule exists
 */
export function getTransformedType(originalType: string): NotificationType | null {
  return NOTIFICATION_TRANSFORMATION_MAP[originalType] || null;
}

/**
 * Check if a notification has been transformed
 * Useful for UI rendering to show transformation history
 * 
 * @param notification - Notification object to check
 * @returns true if notification was transformed
 */
export function isTransformedNotification(notification: any): boolean {
  return !!notification.transformedFrom && !!notification.transformedAt;
}

/**
 * Get transformation metadata from a notification
 * 
 * @param notification - Notification object
 * @returns Transformation metadata or null if not transformed
 */
export function getTransformationMetadata(notification: any): {
  originalType: string;
  transformedAt: string;
  transformedBy?: string;
  transformedByName?: string;
} | null {
  if (!isTransformedNotification(notification)) {
    return null;
  }
  
  return {
    originalType: notification.transformedFrom,
    transformedAt: notification.transformedAt,
    transformedBy: notification.transformedBy,
    transformedByName: notification.transformedByName,
  };
}

/**
 * Build transformation update payload
 * Pure function that creates the data structure for transforming a notification
 * 
 * @param originalType - Original notification type
 * @param orderId - Order ID for message generation
 * @param adminId - Admin who performed transformation
 * @param adminName - Admin display name
 * @param amount - Optional amount for display
 * @returns Transformation payload object
 */
export function buildTransformationPayload(
  originalType: string,
  orderId: string,
  adminId: string,
  adminName?: string,
  amount?: number
): {
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  amount?: number;
  transformedFrom: string;
  transformedBy: string;
  transformedByName: string;
} | null {
  const transformedType = getTransformedType(originalType);
  
  if (!transformedType) {
    return null;
  }
  
  // Build payload based on transformation type
  if (originalType === NOTIFICATION_TYPES.PAYMENT_SUBMITTED) {
    return {
      type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN,
      title: '✅ Payment Confirmed',
      message: `Payment confirmed for Order ${orderId}`,
      read: true,
      amount: amount || 0,
      transformedFrom: originalType,
      transformedBy: adminId,
      transformedByName: adminName || adminId,
    };
  }
  
  // Default transformation
  return {
    type: transformedType,
    title: 'Notification Updated',
    message: `Notification transformed from ${originalType}`,
    read: true,
    transformedFrom: originalType,
    transformedBy: adminId,
    transformedByName: adminName || adminId,
  };
}

/**
 * Calculate notification priority
 * 
 * @param type - Notification type
 * @returns Priority level (1 = highest, 5 = lowest)
 */
export function calculateNotificationPriority(type: NotificationType): number {
  const highPriority: NotificationType[] = [
    NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
    NOTIFICATION_TYPES.ORDER_PENDING,
  ];
  
  const mediumPriority: NotificationType[] = [
    NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED,
    NOTIFICATION_TYPES.PAYMENT_REMINDER,
  ];
  
  const lowPriority: NotificationType[] = [
    NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    NOTIFICATION_TYPES.ORDER_COMPLETED,
    NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN,
  ];
  
  if (highPriority.includes(type)) return 1;
  if (mediumPriority.includes(type)) return 2;
  if (lowPriority.includes(type)) return 3;
  
  return 4; // Default priority
}

/**
 * Check if notification is actionable
 * 
 * @param type - Notification type
 * @returns true if notification requires user action
 */
export function isActionableNotification(type: NotificationType): boolean {
  const actionableTypes: NotificationType[] = [
    NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED,
    NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
    NOTIFICATION_TYPES.ORDER_PENDING,
    NOTIFICATION_TYPES.PAYMENT_REMINDER,
  ];
  
  return actionableTypes.includes(type);
}

/**
 * Generate notification display badge text
 * 
 * @param type - Notification type
 * @returns Badge text (e.g., "Action Required", "Info", "Completed")
 */
export function getNotificationBadgeText(type: NotificationType): string {
  if (isActionableNotification(type)) {
    return 'Action Required';
  }
  
  if (isTransformedNotification({ transformedFrom: type })) {
    return 'Completed';
  }
  
  return 'Info';
}

/**
 * Calculate notification expiry
 * 
 * @param createdAt - Notification creation date
 * @param type - Notification type
 * @returns Expiry date (null if doesn't expire)
 */
export function calculateNotificationExpiry(
  createdAt: Date,
  type: NotificationType
): Date | null {
  // Payment reminders expire after 7 days
  if (type === NOTIFICATION_TYPES.PAYMENT_REMINDER) {
    const expiry = toDate(createdAt) ?? new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
  }
  
  // Most notifications don't expire
  return null;
}

/**
 * Check if notification is expired
 * 
 * @param notification - Notification object with createdAt and type
 * @returns true if notification is expired
 */
export function isNotificationExpired(notification: {
  createdAt: Date | string;
  type: NotificationType;
}): boolean {
  const createdAt = toDate(notification.createdAt) ?? new Date();
    
  const expiry = calculateNotificationExpiry(createdAt, notification.type);
  
  if (!expiry) return false;
  
  return new Date() > expiry;
}
