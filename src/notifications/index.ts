/**
 * Notifications Module - Central Export File
 * 
 * ✅ MAR 7, 2026: Consolidated all notification domain logic
 * ✅ FEB 19, 2026: Updated modal exports to /components/modals/
 * 
 * Architecture:
 * /notifications/
 *   ├── index.ts (this file)
 *   ├── components/
 *   │   ├── NotificationBellBase.tsx
 *   │   ├── AdminNotificationBell.tsx
 *   │   └── CustomerNotificationBell.tsx
 *   ├── contexts/
 *   │   ├── AdminNotificationProvider.tsx
 *   │   ├── CustomerNotificationProvider.tsx
 *   │   ├── UnifiedNotificationProvider.tsx
 *   │   └── index.ts
 *   ├── hooks/
 *   │   ├── notificationActions.ts
 *   │   ├── useOrderNotificationHandlers.ts
 *   │   └── useNotificationTimeout.ts
 *   ├── workflows/                            ✅ NEW: Notification workflows
 *   │   └── notificationWorkflows.ts
 *   ├── transformations/                      ✅ NEW: Transformation logic
 *   │   └── notificationTransform.ts
 *   ├── utils/
 *   │   ├── notificationModalFlow.ts
 *   │   └── paths.ts                          ✅ NEW: Path utilities
 *   └── types/
 *       └── notification-modal-mapping.ts
 * 
 * /types/
 *   └── notification-contract.ts (✅ CANONICAL - imported from here)
 * 
 * /components/modals/
 *   ├── AdminNotificationsModal.tsx (✅ FEB 19, 2026: Moved from /notifications/components/)
 *   ├── NotificationsModal.tsx (✅ FEB 19, 2026: Moved from /notifications/components/)
 *   └── NotificationDetailsModal.tsx (✅ Fallback modal for unknown notifications)
 */

// ============================================
// NOTIFICATION BELL COMPONENTS
// ============================================
/**
 * ── NOTIFICATION PIPELINE (single documented flow) ───────────────────────────
 *
 * 1. EVENT occurs (order approved, payment confirmed, credit issued, etc.)
 *    └─ Called from: services/orderActionService, services/ordersService,
 *       services/paidOrderLifecycleService, services/orderCompletion/completeOrderNow
 *
 * 2. PERSIST notification to Firestore
 *    └─ Via: notifications/domain/orderNotifications.ts → notifyOrder*()
 *       which calls: firebase/firestore/notifications.createNotification()
 *       which writes to: notifications/user_{uid}/items/ or notifications/admin/items/
 *
 * 3. REAL-TIME LISTENER picks up new notification
 *    └─ Via: notifications/contexts/CustomerNotificationProvider (customer)
 *             notifications/contexts/AdminNotificationProvider (admin)
 *       Listeners query their respective Firestore subcollections.
 *
 * 4. MAP notification type → modal type
 *    └─ Via: notifications/types/notification-modal-mapping.ts
 *       getModalForNotification(type, role) returns { modalType, defaultProps }
 *
 * 5. RESOLVE full modal props (fetch related order/invoice/customer)
 *    └─ Via: utils/notification-modal-resolver.ts → resolveModalProps()
 *       Calls: utils/notification-modal-fetchers.ts for data retrieval
 *
 * 6. RENDER in UI
 *    └─ Via: notifications/hooks/notificationActions.ts → handleNotificationClick()
 *       which calls openModal(modalType, resolvedProps)
 *
 * Single admin email is in settings/system.adminEmail (not hardcoded).
 * ─────────────────────────────────────────────────────────────────────────────
 */


export { AdminNotificationBell } from './components/AdminNotificationBell';
export { CustomerNotificationBell } from './components/CustomerNotificationBell';
export { NotificationBellBase } from './components/NotificationBellBase';

// ============================================
// NOTIFICATION MODALS (from /components/modals/)
// ============================================
export { AdminNotificationsModal } from '../components/modals/admin/AdminNotificationsModal';
export { NotificationsModal } from '../components/modals/notifications/NotificationsModal';

// ============================================
// NOTIFICATION CONTEXTS
// ============================================
export { AdminNotificationProviderV3 } from './contexts/AdminNotificationProvider';
export { CustomerNotificationProvider } from './contexts/CustomerNotificationProvider';
export { UnifiedNotificationProvider } from './contexts/UnifiedNotificationProvider';

// Export context hooks from contexts/index.ts
export { 
  useAdminNotifications, 
  useAdminNotificationsSafe,
  useCustomerNotifications,
  useCustomerNotificationsSafe,
  useNotifications,
  useNotificationsSafe
} from './contexts/index';

// ============================================
// NOTIFICATION HOOKS
// ============================================
export { useNotificationActions } from './hooks/notificationActions';

export { useOrderNotificationHandlers } from './hooks/useOrderNotificationHandlers';
export { useNotificationTimeout } from './hooks/useNotificationTimeout';

// ============================================
// NOTIFICATION WORKFLOWS ✅ NEW
// ============================================
export {
  submitPaymentWorkflow,
  confirmPaymentWorkflow,
  updateNotificationWorkflow,
  applyCreditToOrderWorkflow,
  // Legacy exports for backward compatibility
  submitPaymentWorkflow as submitPayment,
  confirmPaymentWorkflow as confirmPayment,
} from './workflows/notificationWorkflows';

// ============================================
// NOTIFICATION DOMAIN LOGIC ✅ NEW
// ============================================
export {
  notifyOrderApproved,
  notifyOrderRejected,
  notifyOrderCancelled,
  notifyOrderAutoCompleted,
  notifyPaymentSubmitted,
  notifyPaymentConfirmed,
  notifyPaymentReminder,
  notifyCreditIssued,
  notifyOrderEdited, // Added for admin order edit notifications
  notifyOrderPlacedTracking,
  notifyPaymentSubmittedTracking,
  updateCustomerNotification,
} from './domain/orderNotifications';

// ============================================
// NOTIFICATION TRANSFORMATIONS ✅ NEW
// ============================================
export {
  transformPaymentSubmittedToConfirmed,
  transformNotification,
  // Re-exported calculator functions
  shouldTransformNotification,
  getTransformedType,
  isTransformedNotification,
  getTransformationMetadata,
  NOTIFICATION_TRANSFORMATION_MAP,
} from './transformations/notificationTransform';

// ============================================
// NOTIFICATION UTILITIES
// ============================================
export { 
  closeThenRun,
  createViewOrderHandler,
  createDownloadInvoiceHandler,
  createActionHandler
} from './utils/notificationModalFlow';

// ============================================
// NOTIFICATION PATHS ✅ NEW
// ============================================
export {
  getCustomerNotificationPath,
  getAdminNotificationPath,
  getNotificationPath,
  getCustomerNotificationPathString,
  getAdminNotificationPathString,
  isValidNotificationPath,
  extractCustomerIdFromPath,
  isAdminNotificationPath,
  isCustomerNotificationPath,
  migrateLegacyPath,
} from './utils/paths';

// ============================================
// NOTIFICATION SERVICES (from Firebase)
// ============================================
export { 
  createNotification, 
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToNotifications
} from '../firebase/firestore';

// ============================================
// NOTIFICATION TYPES
// ============================================
export type { NotificationModalMapping } from './types/notification-modal-mapping';
export { getModalForNotification } from './types/notification-modal-mapping';

// Re-export canonical types from /types/notification-contract.ts
export type { 
  NotificationType,
  NotificationItem,
  NotificationAction,
  ActionType,
  CustomerNotificationType,
  AdminNotificationType,
} from '../types/notification-contract';