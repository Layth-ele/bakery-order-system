/**
 * Notification type re-export
 * For backward compatibility - imports from notification-contract
 * 
 * ✅ FEB 11, 2026: Updated to import from canonical location
 */

import { logger } from '../utils/logger';
export type {
  NotificationItem,
  NotificationType,
} from './notification-contract'; // ✅ CANONICAL LOCATION

import type { NotificationItem } from './notification-contract';

// ✅ Define NotifTarget inline (not in contract, used only in adapters)
export type NotifTarget = 'admin' | 'customer';

// Legacy aliases
export type NotificationData = NotificationItem;
export type Notification = NotificationItem;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Assert that a notification object has the required fields.
 * Throws if the notification is missing id, type, title, or message.
 */
export function assertValidNotification(notification: unknown): asserts notification is NotificationItem {
  if (!notification || typeof notification !== 'object') {
    throw new Error('Invalid notification: must be an object');
  }
  const n = notification as Record<string, unknown>;
  if (!n.id || typeof n.id !== 'string') {
    throw new Error(`Invalid notification: missing or invalid 'id' (got ${JSON.stringify(n.id)})`);
  }
  if (!n.type || typeof n.type !== 'string') {
    throw new Error(`Invalid notification: missing or invalid 'type' (got ${JSON.stringify(n.type)})`);
  }
  if (!n.title || typeof n.title !== 'string') {
    throw new Error(`Invalid notification: missing or invalid 'title' (got ${JSON.stringify(n.title)})`);
  }
  if (!n.message || typeof n.message !== 'string') {
    throw new Error(`Invalid notification: missing or invalid 'message' (got ${JSON.stringify(n.message)})`);
  }
}

/**
 * Filter an array of unknown values to only valid NotificationItems.
 * Logs a warning for each item that fails validation.
 */
export function validateNotifications(items: unknown[]): NotificationItem[] {
  const valid: NotificationItem[] = [];
  for (const item of items) {
    try {
      assertValidNotification(item);
      valid.push(item);
    } catch (err) {
      logger.warn('⚠️ [validateNotifications] Skipping invalid notification:', err);
    }
  }
  return valid;
}