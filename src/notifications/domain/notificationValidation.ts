/**
 * Notification validation stubs
 */
import type { NotificationItem } from '../../types/notification-contract';

export function assertValidNotification(n: any): void {
  // validation stub
}

export function validateNotifications(notifications: any[]): NotificationItem[] {
  return notifications as NotificationItem[];
}
