/**
 * Notification Contexts - Barrel Exports
 * 
 * LOCATION: /notifications/contexts/ (Consolidated Feb 11, 2026)
 * 
 * All notification context providers and hooks in one place.
 */

// Admin Provider
export {
  AdminNotificationProviderV3,
  useAdminNotifications,
  useAdminNotificationsSafe,
} from './AdminNotificationProvider';

// Customer Provider
export {
  CustomerNotificationProvider,
  useCustomerNotifications,
  useCustomerNotificationsSafe,
} from './CustomerNotificationProvider';

// Unified Provider
export {
  UnifiedNotificationProvider,
  useNotifications,
  useNotificationsSafe,
} from './UnifiedNotificationProvider';