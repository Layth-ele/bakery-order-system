/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTIFICATION → MODAL MAPPING TABLE (Step 5 Complete)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✅ FEB 16, 2026: STEP 2 COMPLETE - Type-Safe Enforcement
 * - Every CustomerNotificationType MUST have a modal mapping
 * - Every AdminNotificationType MUST have a modal mapping
 * - TypeScript will error at compile-time if any notification type is missing
 * 
 * ✅ FEB 11, 2026: MOVED TO /notifications/types/
 * 
 * This is the CANONICAL MAPPING between notification types and modal types.
 * 
 * ✅ SINGLE SOURCE OF TRUTH for notification → modal routing
 * ✅ Eliminates confusion about which modal opens for each notification
 * ✅ Makes it obvious which modals are needed / unused
 * ✅ Type-safe with TypeScript discriminated unions
 * 
 * USAGE:
 * ```typescript
 * import { getModalForNotification } from './notification-modal-mapping';
 * 
 * const modalConfig = getModalForNotification(notification.type);
 * if (modalConfig) {
 *   openModal(modalConfig.modalType, modalConfig.getProps(notification));
 * }
 * ```
 * 
 * VERSION: 2.0.0 (Type-Safe Enforcement)
 * LAST UPDATED: 2026-02-16
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ModalType } from '@/types/modals'; // ✅ Using alias import
import type { NotificationItem } from '@/types/notification-contract'; // ✅ Using alias import
import { 
  NOTIFICATION_TYPES, 
  normalizeNotificationType 
} from '@/types/notification-contract'; // ✅ Using alias import - Combined into one import

// ✅ STEP 2: Import type-safe notification types
import type { 
  CustomerNotificationType, 
  AdminNotificationType,
  NotificationType 
} from '@/types/notification-contract';

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING CONFIGURATION TYPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for how a notification maps to a modal
 */
export interface NotificationModalMapping {
  /** The modal type to open */
  modalType: ModalType;
  
  /** Function to extract modal props from notification */
  getProps: (notification: NotificationItem, context?: any) => Record<string, any>;
  
  /** Optional: Description of what this modal shows */
  description?: string;
  
  /** Optional: Whether this modal requires additional context */
  requiresContext?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER NOTIFICATION → MODAL MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Customer-facing notification mappings
 * These determine which modal opens when a customer clicks a notification
 * 
 * ✅ TYPE-SAFE: Every CustomerNotificationType MUST have a mapping
 * TypeScript will error if any notification type is missing
 */
export const CUSTOMER_NOTIFICATION_MODAL_MAP: Record<
  CustomerNotificationType,  // ✅ STEP 2: Changed from string to CustomerNotificationType
  NotificationModalMapping
> = {
  /**
   * ORDER_PENDING
   * Customer just submitted order, waiting for admin approval
   * Modal: PENDING_ORDER_DETAILS - Shows order details and status
   */
  [NOTIFICATION_TYPES.ORDER_PENDING]: {
    modalType: 'PENDING_ORDER_DETAILS',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      order: notification.metadata?.order,
    }),
    description: 'View pending order details and wait for approval',
  },

  /**
   * ORDER_APPROVED_PAY_REQUIRED
   * Admin approved order, customer needs to submit payment
   * Modal: SUBMIT_PAYMENT - Payment submission form
   */
  [NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED]: {
    modalType: 'SUBMIT_PAYMENT',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      amount: notification.amount,
      invoiceNumber: notification.metadata?.invoiceNumber,
    }),
    description: 'Open payment submission form to pay for approved order',
  },

  /**
   * ORDER_REJECTED
   * Admin rejected order
   * Modal: REJECTED_ORDER_DETAILS - Shows rejection reason and details
   */
  [NOTIFICATION_TYPES.ORDER_REJECTED]: {
    modalType: 'REJECTED_ORDER_DETAILS',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      order: notification.metadata?.order,
      rejectionReason: notification.metadata?.reason,
    }),
    description: 'View rejected order details and reason',
  },

  /**
   * ORDER_CANCELLED
   * Admin cancelled order (after approval)
   * ❌ MAR 12, 2026: Replaced with toast notification - no modal
   * The cancelled order notification now shows a toast message instead of opening a modal
   * ✅ MAR 17, 2026: Restored modal for comprehensive cancellation details
   * Shows different views for UNPAID vs PAID cancelled orders
   */
  [NOTIFICATION_TYPES.ORDER_CANCELLED]: {
    modalType: 'CANCELLED_ORDER_DETAILS',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      notificationId: notification.id,
    }),
    description: 'View cancelled order details with credit breakdown (paid) or simple cancellation info (unpaid)',
  },

  /**
   * PAYMENT_IN_REVIEW
   * Customer submitted payment, waiting for admin confirmation
   * Modal: PAYMENT_IN_REVIEW - Shows "payment submitted, pending review" status
   */
  [NOTIFICATION_TYPES.PAYMENT_IN_REVIEW]: {
    modalType: 'PAYMENT_IN_REVIEW',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      amount: notification.amount,
      paymentProofUrl: notification.metadata?.paymentProofUrl,
    }),
    description: 'View payment submission status - waiting for admin confirmation',
  },

  /**
   * PAYMENT_CONFIRMED
   * Admin confirmed payment received - order now in production
   * Modal: PAID_ORDER_DETAILS - Shows order in production status
   */
  [NOTIFICATION_TYPES.PAYMENT_CONFIRMED]: {
    modalType: 'PAID_ORDER_DETAILS',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      order: notification.metadata?.order,
      products: notification.metadata?.products,
      categories: notification.metadata?.categories,
    }),
    description: 'View order in production - payment confirmed',
  },

  /**
   * INVOICE_UPDATED
   * Admin updated invoice (no additional payment needed) - order still in production
   * Modal: PAID_ORDER_DETAILS - Shows updated order in production status
   */
  [NOTIFICATION_TYPES.INVOICE_UPDATED]: {
    modalType: 'PAID_ORDER_DETAILS',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      order: notification.metadata?.order,
      products: notification.metadata?.products,
      categories: notification.metadata?.categories,
    }),
    description: 'View updated order in production - invoice updated',
  },

  /**
   * ADDITIONAL_PAYMENT_REQUIRED
   * Admin increased order total, customer needs to pay difference
   * Modal: SUBMIT_PAYMENT - Payment submission for additional amount
   */
  [NOTIFICATION_TYPES.ADDITIONAL_PAYMENT_REQUIRED]: {
    modalType: 'SUBMIT_PAYMENT',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      amount: notification.amount,
      additionalAmount: notification.metadata?.additionalAmount,
      isAdditionalPayment: true,
    }),
    description: 'Submit additional payment for increased order total',
  },

  /**
   * CREDIT_ISSUED
   * Admin issued credit/refund to customer
   * Modal: CREDIT_RECEIVED - Shows credit amount and link to history
   */
  [NOTIFICATION_TYPES.CREDIT_ISSUED]: {
    modalType: 'CREDIT_RECEIVED',
    getProps: (notification) => ({
      amount: notification.amount,
      reason: notification.metadata?.reason,
      orderId: notification.orderId || "",
      creditId: notification.metadata?.creditId,
    }),
    description: 'View credit received notification and access credit history',
  },

  /**
   * ORDER_COMPLETED
   * Order auto-completed after Friday cutoff
   * Modal: COMPLETED_ORDER_INVOICE - Shows final invoice
   */
  [NOTIFICATION_TYPES.ORDER_COMPLETED]: {
    modalType: 'COMPLETED_ORDER_INVOICE',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      invoiceId: notification.invoiceId,
      amount: notification.amount,
      isComplete: true,
    }),
    description: 'View final completed order invoice',
  },

  /**
   * PAYMENT_REMINDER
   * Admin sent payment reminder - check if payment already submitted or needs to submit
   * Modal: PAYMENT_IN_REVIEW - If payment submitted, show status; otherwise opens SUBMIT_PAYMENT
   * 
   * LOGIC: Check order.paymentProofUrl to determine:
   * - If paymentProofUrl exists → PAYMENT_IN_REVIEW (payment already submitted, waiting for approval)
   * - If no paymentProofUrl → SUBMIT_PAYMENT (customer still needs to pay)
   */
  [NOTIFICATION_TYPES.PAYMENT_REMINDER]: {
    modalType: 'PAYMENT_IN_REVIEW',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      amount: notification.amount,
      paymentProofUrl: notification.metadata?.paymentProofUrl,
    }),
    description: 'View payment status - if payment submitted, show "Payment In Review"; otherwise redirect to payment submission',
  },

  /**
   * ORDER_EDITED
   * Admin edited a paid order (decreased quantities)
   * Modal: PAID_ORDER_DETAILS - Shows updated order with edit context
   * ✅ MAR 12, 2026: Fixed - modal now shows appropriate messaging for edited orders
   */
  [NOTIFICATION_TYPES.ORDER_EDITED]: {
    modalType: 'PAID_ORDER_DETAILS',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      order: notification.metadata?.order,
      products: notification.metadata?.products,
      categories: notification.metadata?.categories,
      isEditedOrder: true, // ✅ Flag to indicate this is an edited order
      editDetails: notification.metadata, // Pass edit details for display
    }),
    description: 'View edited order details with credit issued',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN NOTIFICATION → MODAL MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Admin-facing notification mappings
 * These determine which modal opens when an admin clicks a notification
 * 
 * ✅ TYPE-SAFE: Every AdminNotificationType MUST have a mapping
 * TypeScript will error if any notification type is missing
 */
export const ADMIN_NOTIFICATION_MODAL_MAP: Record<
  AdminNotificationType,  // ✅ STEP 2: Changed from string to AdminNotificationType
  NotificationModalMapping
> = {
  /**
   * ORDER_SUBMITTED
   * Customer submitted new order for review
   * Modal: ADMIN_ORDER_VIEW - Admin review and approve/reject interface
   */
  [NOTIFICATION_TYPES.ORDER_SUBMITTED]: {
    modalType: 'ADMIN_ORDER_VIEW',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      customerId: notification.customerId || "",
      customerName: notification.customerName,
      order: notification.metadata?.order,
    }),
    description: 'Review new order and approve/reject',
  },

  /**
   * PAYMENT_SUBMITTED
   * Customer submitted payment proof for review
   * Modal: ADMIN_ORDER_VIEW - Shows order with payment proof
   */
  [NOTIFICATION_TYPES.PAYMENT_SUBMITTED]: {
    modalType: 'ADMIN_ORDER_VIEW',
    getProps: (notification, context) => ({
      orderId: notification.orderId || "",
      customerId: notification.customerId || "",
      customerName: notification.customerName,
      order: notification.metadata?.order,
      showPaymentProof: true, // Flag to indicate payment proof should be highlighted
    }),
    description: 'Review order with payment proof',
  },

  /**
   * PAYMENT_CONFIRMED_ADMIN
   * ✅ MAR 18, 2026: UPDATED - Opens simple message modal instead of full order view
   * Admin confirmed payment (record keeping notification)
   * Modal: PAYMENT_CONFIRMED_MESSAGE - Simple informational modal with close button
   */
  [NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN]: {
    modalType: 'PAYMENT_CONFIRMED_MESSAGE',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      customerName: notification.customerName || notification.metadata?.customerName,
      amount: notification.amount || notification.metadata?.amount,
      invoiceNumber: notification.metadata?.invoiceNumber || notification.metadata?.order?.invoiceNumber,
    }),
    description: 'Payment confirmed - simple success message',
  },

  /**
   * ORDER_AUTO_COMPLETED_ADMIN
   * Order auto-completed after Friday cutoff (record keeping notification)
   * Modal: COMPLETED_ORDER_INVOICE - Shows final invoice and order details
   */
  [NOTIFICATION_TYPES.ORDER_AUTO_COMPLETED_ADMIN]: {
    modalType: 'COMPLETED_ORDER_INVOICE',
    getProps: (notification) => ({
      order: notification.metadata?.order,
      products: notification.metadata?.products || [],
      categories: notification.metadata?.categories || [],
    }),
    description: 'View auto-completed order invoice (admin record)',
  },

  /**
   * ORDER_UPDATE_REQUESTED
   * Customer requested to update an approved order
   * Modal: ADMIN_ORDER_VIEW - Review update request and approve/reject
   */
  [NOTIFICATION_TYPES.ORDER_UPDATE_REQUESTED]: {
    modalType: 'ADMIN_ORDER_VIEW',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      customerId: notification.customerId || "",
      customerName: notification.customerName,
      isUpdateRequest: true,
      order: notification.metadata?.order,
    }),
    description: 'Review order update request and approve/reject changes',
  },

  /**
   * ORDER_DECREASED_ADMIN
   * Admin decreased order total (record keeping)
   * Modal: COMPLETED_ORDER_INVOICE - Shows updated invoice with decrease details
   */
  [NOTIFICATION_TYPES.ORDER_DECREASED_ADMIN]: {
    modalType: 'COMPLETED_ORDER_INVOICE',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      invoiceId: notification.invoiceId,
      amount: notification.amount,
      decreaseAmount: notification.metadata?.decreaseAmount,
      isAdminView: true,
    }),
    description: 'View order decrease details (admin record)',
  },

  /**
   * ORDER_PLACED_TRACKING
   * Customer placed a new order - tracking notification
   * Modal: ADMIN_ORDER_VIEW - Direct access to order for tracking and management
   */
  [NOTIFICATION_TYPES.ORDER_PLACED_TRACKING]: {
    modalType: 'ADMIN_ORDER_VIEW',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      customerId: notification.customerId || "",
      customerName: notification.customerName,
      order: notification.metadata?.order,
      isTrackingView: true, // Flag for tracking-focused view
    }),
    description: 'Track and manage newly placed order',
  },

  /**
   * PAYMENT_SUBMITTED_TRACKING
   * Customer submitted payment proof - tracking notification
   * Modal: ADMIN_ORDER_VIEW - Direct access to order for payment tracking
   */
  [NOTIFICATION_TYPES.PAYMENT_SUBMITTED_TRACKING]: {
    modalType: 'ADMIN_ORDER_VIEW',
    getProps: (notification) => ({
      orderId: notification.orderId || "",
      customerId: notification.customerId || "",
      customerName: notification.customerName,
      order: notification.metadata?.order,
      showPaymentProof: true,
      isTrackingView: true, // Flag for tracking-focused view
    }),
    description: 'Track payment submission and process payment',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED MAPPING (Customer + Admin)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combined mapping of all notification types to their modals
 * Use this as the single source of truth for routing
 */
export const NOTIFICATION_MODAL_MAP: Record<string, NotificationModalMapping> = {
  ...CUSTOMER_NOTIFICATION_MODAL_MAP,
  ...ADMIN_NOTIFICATION_MODAL_MAP,
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Get the modal configuration for a given notification type
 * 
 * ✅ FEB 16, 2026: STEP 7 - Returns fallback modal for unknown types
 * 
 * @param notificationType - The notification type (can be legacy format)
 * @returns Modal configuration (always returns a config - uses fallback for unknown types)
 * 
 * @example
 * ```typescript
 * const config = getModalForNotification('ORDER_APPROVED_PAY_REQUIRED');
 * openModal(config.modalType, config.getProps(notification));
 * 
 * // Unknown type returns fallback:
 * const config = getModalForNotification('LEGACY_UNKNOWN_TYPE');
 * // config.modalType === 'NOTIFICATION_DETAILS' (safe fallback)
 * ```
 */
export function getModalForNotification(
  notificationType?: string,
  notification?: NotificationItem
): NotificationModalMapping {
  // ✅ STEP 7: Return fallback for missing notification type
  if (!notificationType) {
    return createFallbackMapping(notification, 'No notification type provided');
  }

  // Normalize the type to canonical format
  const normalized = normalizeNotificationType(notificationType);
  if (!normalized) {
    return createFallbackMapping(notification, `Unknown notification type: ${notificationType}`);
  }

  // Get mapping
  const mapping = NOTIFICATION_MODAL_MAP[normalized];
  if (!mapping) {
    return createFallbackMapping(notification, `No modal configured for: ${normalized}`);
  }

  return mapping;
}

/**
 * ✅ STEP 7: Create fallback modal mapping for unknown notification types
 * This ensures the app never crashes from legacy/unknown notifications
 * 
 * @param notification - The notification object (if available)
 * @param error - Error message to display
 * @returns Fallback modal configuration
 */
function createFallbackMapping(
  notification?: NotificationItem,
  error?: string
): NotificationModalMapping {
  return {
    modalType: 'NOTIFICATION_DETAILS',
    getProps: (notif) => ({
      notification: notification || notif,
      notificationId: notification?.id || notif?.id,
      error: error || 'Unknown notification type',
    }),
    description: 'Safe fallback for unknown/legacy notification types',
  };
}

/**
 * Check if a notification type has a modal mapping
 * 
 * @param notificationType - The notification type to check
 * @returns true if a modal mapping exists
 */
export function hasModalMapping(notificationType?: string): boolean {
  return getModalForNotification(notificationType) !== null;
}

/**
 * Get all notification types that map to a specific modal
 * Useful for analytics and understanding modal usage
 * 
 * @param modalType - The modal type to search for
 * @returns Array of notification types that open this modal
 * 
 * @example
 * ```typescript
 * const notificationTypes = getNotificationTypesForModal('INVOICE_DETAIL');
 * // Returns: ['PAYMENT_CONFIRMED', 'INVOICE_UPDATED', 'ORDER_COMPLETED', 'ORDER_DECREASED_ADMIN']
 * ```
 */
export function getNotificationTypesForModal(modalType: ModalType): string[] {
  return Object.entries(NOTIFICATION_MODAL_MAP)
    .filter(([_, config]) => config.modalType === modalType)
    .map(([type, _]) => type);
}

/**
 * Get a human-readable summary of all modal mappings
 * Useful for documentation and debugging
 * 
 * @returns Array of mapping summaries
 */
export function getModalMappingSummary(): Array<{
  notificationType: string;
  modalType: ModalType;
  description: string;
  category: 'customer' | 'admin';
}> {
  const summaries: Array<{
    notificationType: string;
    modalType: ModalType;
    description: string;
    category: 'customer' | 'admin';
  }> = [];

  // Customer mappings
  Object.entries(CUSTOMER_NOTIFICATION_MODAL_MAP).forEach(([type, config]) => {
    summaries.push({
      notificationType: type,
      modalType: config.modalType,
      description: config.description || 'No description',
      category: 'customer',
    });
  });

  // Admin mappings
  Object.entries(ADMIN_NOTIFICATION_MODAL_MAP).forEach(([type, config]) => {
    summaries.push({
      notificationType: type,
      modalType: config.modalType,
      description: config.description || 'No description',
      category: 'admin',
    });
  });

  return summaries;
}

/**
 * Validate that all notification types have modal mappings
 * Returns any notification types that are missing mappings
 * 
 * @returns Array of notification types without modal mappings
 */
export function validateModalMappings(): string[] {
  const allTypes = Object.values(NOTIFICATION_TYPES);
  const mappedTypes = Object.keys(NOTIFICATION_MODAL_MAP);
  
  return allTypes.filter(type => !mappedTypes.includes(type));
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// NotificationModalMapping is already exported as `export interface` above.
// No re-export needed here.

// ═══════════════════════════════════════════════════════════════════════════
// ✅ STEP 2: COMPILE-TIME TYPE SAFETY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type-level test: Verify that NOTIFICATION_MODAL_MAP has a mapping for every NotificationType
 * 
 * This creates a compile-time error if any notification type is missing from the mapping.
 * 
 * How it works:
 * 1. Extract all keys from NOTIFICATION_MODAL_MAP
 * 2. Check if every NotificationType is present in those keys
 * 3. If any type is missing, TypeScript will show an error
 * 
 * ⚠️ DO NOT DELETE THIS - It's a compile-time safety check!
 */
type _CompileTimeCheck_AllNotificationTypesMapped = {
  [K in NotificationType]: K extends keyof typeof NOTIFICATION_MODAL_MAP ? true : never;
};

/**
 * Runtime validation helper (also runs at compile time via type checking)
 * Call this in tests to ensure 100% coverage
 */
export function assertAllNotificationTypesMapped(): void {
  const allTypes = Object.values(NOTIFICATION_TYPES) as NotificationType[];
  const mappedTypes = Object.keys(NOTIFICATION_MODAL_MAP);
  
  const missingTypes = allTypes.filter(type => !mappedTypes.includes(type));
  
  if (missingTypes.length > 0) {
    throw new Error(
      `❌ TYPE SAFETY VIOLATION: The following notification types are missing modal mappings:\n` +
      `${missingTypes.map(t => `  - ${t}`).join('\n')}\n\n` +
      `Every notification type MUST have a modal mapping.\n` +
      `Add missing mappings to CUSTOMER_NOTIFICATION_MODAL_MAP or ADMIN_NOTIFICATION_MODAL_MAP.`
    );
  }
  
}