/**
 * Notification Data Migration Utility
 * 
 * ✅ MAR 17, 2026: Fix old notifications with empty orderIds
 * 
 * PURPOSE:
 * - Repair notifications that were created with empty orderId fields
 * - Extract orderId from notification ID or message text
 * - Add missing actions array
 * 
 * USAGE:
 * - Run once on app initialization
 * - Safe to run multiple times (idempotent)
 */

export interface NotificationToFix {
  id: string;
  orderId: string;
  type?: string;
  message?: string;
  metadata?: {
    paymentProofUrl?: string;
    paymentRef?: string;
    [key: string]: unknown;
  };
  actions: Array<{ [key: string]: unknown }>;
  [key: string]: unknown;
}

/**
 * Extract orderId from notification ID
 * 
 * Notification IDs follow pattern: `payment-{orderId}-submitted`
 * 
 * @param notificationId - The notification ID
 * @returns Extracted orderId or null if not found
 */
function extractOrderIdFromNotificationId(notificationId: string): string | null {
  // Pattern: payment-{orderId}-submitted
  const match = notificationId.match(/^payment-(.+)-submitted$/);
  return match ? match[1] : null;
}

/**
 * Extract orderId from notification message
 * 
 * Message contains text like "for order ORD-1773793120452-ekn6o"
 * 
 * @param message - The notification message
 * @returns Extracted orderId or null if not found
 */
function extractOrderIdFromMessage(message: string): string | null {
  // Pattern: "for order {orderId}"
  const match = message.match(/for order\s+([A-Z0-9\-]+)/);
  return match ? match[1] : null;
}

/**
 * Fix a single notification with empty orderId
 * 
 * @param notification - Notification to fix
 * @returns Fixed notification or null if can't be fixed
 */
function fixNotification(notification: NotificationToFix): NotificationToFix | null {
  // Skip if orderId is already present
  if (notification.orderId && notification.orderId.length > 0) {
    return null; // No fix needed
  }

  let orderId: string | null = null;

  // Try to extract from notification ID
  orderId = extractOrderIdFromNotificationId(notification.id);

  // If not found, try to extract from message
  if (!orderId && notification.message) {
    orderId = extractOrderIdFromMessage(notification.message);
  }

  if (!orderId) {
    console.error('❌ [Migration] Could not extract orderId for notification:', notification.id);
    return null;
  }

  // Create fixed notification
  const fixed: NotificationToFix = {
    ...notification,
    orderId,
  };

  // Add actions if missing (for PAYMENT_SUBMITTED notifications)
  if (notification.type === 'PAYMENT_SUBMITTED' && (!notification.actions || notification.actions.length === 0)) {
    fixed.actions = [
      {
        type: 'CONFIRM_PAYMENT',
        label: 'Confirm Payment',
        payload: {
          orderId,
          paymentProofUrl: notification.metadata?.paymentProofUrl || '',
          paymentRef: notification.metadata?.paymentRef || orderId,
        }
      }
    ];
  }


  return fixed;
}

/**
 * Migrate admin notifications in localStorage
 * 
 * Fixes all notifications with empty orderIds.
 * Safe to run multiple times.
 */
export function migrateAdminNotifications(): number {
  const storageKey = 'bakery_admin_notifications';
  
  try {
    const rawData = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (!rawData) {
      return 0;
    }

    const notifications: NotificationToFix[] = ((() => { try { return JSON.parse(rawData); } catch { return null; } })());
    let fixedCount = 0;

    const migratedNotifications = notifications.map(notification => {
      const fixed = fixNotification(notification);
      if (fixed) {
        fixedCount++;
        return fixed;
      }
      return notification;
    });

    if (fixedCount > 0) {
      
      // Trigger storage event to refresh UI
      // Firebase notification event dispatched via Firestore real-time listener
    } else {
    }

    return fixedCount;
  } catch (error) {
    console.error('❌ [Migration] Error migrating admin notifications:', error);
    return 0;
  }
}

/**
 * Run all notification migrations
 * 
 * Call this once on app initialization.
 */
export function runNotificationMigrations(): void {
  
  const fixedCount = migrateAdminNotifications();
  
}
