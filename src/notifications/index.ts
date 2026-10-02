/**
 * Notifications module — public entry point.
 *
 * ── How notifications work ───────────────────────────────────────────────────
 *
 * 1. WRITE (server)
 *    Order lifecycle notifications — new order, approved, rejected,
 *    cancelled, payment submitted, payment confirmed, completed — are written
 *    ONLY by the onOrderLifecycle Cloud Function trigger, from the order
 *    document itself (src/functions/src/lib/orderNotifications.ts). New
 *    registration alerts come from createCustomerWithCode.
 *
 *    Admin actions that aren't status changes — payment reminders, store
 *    credit, order edits / partial cancellations, credit payout requests —
 *    are written by the Cloud Function performing the action, in the same
 *    transaction (src/functions/src/lib/accountNotifications.ts).
 *    The browser never writes a notification; Firestore rules deny it.
 *
 *    Paths: notifications/admin/items/{id}, notifications/user_{uid}/items/{id}
 *    (./utils/paths.ts). Types: src/types/notification-contract.ts.
 *
 * 2. READ — one real-time listener per role:
 *    AdminNotificationProviderV3 (admin layout) and
 *    CustomerNotificationProvider (customer layout).
 *
 * 3. CLICK — ./hooks/notificationActions.ts maps the type to a modal (or a
 *    page) via ./types/notification-modal-mapping.ts, then
 *    src/utils/notification-modal-resolver.ts loads the order/invoice data.
 */

// Bells
export { AdminNotificationBell } from './components/AdminNotificationBell';
export { CustomerNotificationBell } from './components/CustomerNotificationBell';

// Providers (one listener per role)
export { AdminNotificationProviderV3 } from './contexts/AdminNotificationProvider';
export { CustomerNotificationProvider } from './contexts/CustomerNotificationProvider';
export { useAdminNotificationsSafe, useCustomerNotificationsSafe } from './contexts/index';

// Click handling
export { useNotificationActions } from './hooks/notificationActions';
export { getModalForNotification } from './types/notification-modal-mapping';

// Paths
export { getCustomerNotificationPath, getAdminNotificationPath } from './utils/paths';

// Types
export type {
  NotificationType,
  NotificationItem,
  NotificationAction,
  ActionType,
  CustomerNotificationType,
  AdminNotificationType,
} from '../types/notification-contract';
