/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTIFICATION CONTRACT V3 - CANONICAL SOURCE OF TRUTH
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This is the SINGLE SOURCE OF TRUTH for all notification types and actions.
 * 
 * ✅ ALL notification creation code MUST use these types
 * ✅ ALL notification handling code MUST use these types
 * ✅ Cloud Functions, Services, Components - everyone imports from HERE
 * 
 * 🔒 DO NOT create notification types elsewhere
 * 🔒 DO NOT add new types without updating this contract
 * 
 * VERSION: 3.0.0
 * LAST UPDATED: 2026-02-03
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { logger } from '../utils/logger';
// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL NOTIFICATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Customer-facing notification types
 * These notifications appear in the customer's notification bell
 */
export const CUSTOMER_NOTIFICATION_TYPES = {
  /**
   * ORDER_PENDING
   * Sent when: Customer submits a new order
   * Action: Wait for admin approval
   * Audience: Customer
   */
  ORDER_PENDING: 'ORDER_PENDING',

  /**
   * ORDER_APPROVED_PAY_REQUIRED
   * Sent when: Admin approves order
   * Action: Customer must submit payment
   * Audience: Customer
   */
  ORDER_APPROVED_PAY_REQUIRED: 'ORDER_APPROVED_PAY_REQUIRED',

  /**
   * ORDER_REJECTED
   * Sent when: Admin rejects order
   * Action: None (informational)
   * Audience: Customer
   */
  ORDER_REJECTED: 'ORDER_REJECTED',

  /**
   * ORDER_CANCELLED
   * Sent when: Admin cancels order
   * Action: None (informational)
   * Audience: Customer
   */
  ORDER_CANCELLED: 'ORDER_CANCELLED',

  /**
   * PAYMENT_IN_REVIEW
   * Sent when: Customer submits payment proof
   * Action: Wait for admin confirmation
   * Audience: Customer
   */
  PAYMENT_IN_REVIEW: 'PAYMENT_IN_REVIEW',

  /**
   * PAYMENT_CONFIRMED
   * Sent when: Admin confirms payment
   * Action: View invoice and download
   * Audience: Customer
   */
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',

  /**
   * INVOICE_UPDATED
   * Sent when: Admin updates invoice (no additional payment needed)
   * Action: Review updated invoice
   * Audience: Customer
   */
  INVOICE_UPDATED: 'INVOICE_UPDATED',

  /**
   * ADDITIONAL_PAYMENT_REQUIRED
   * Sent when: Admin increases order total (additional payment needed)
   * Action: Submit additional payment
   * Audience: Customer
   */
  ADDITIONAL_PAYMENT_REQUIRED: 'ADDITIONAL_PAYMENT_REQUIRED',

  /**
   * CREDIT_ISSUED
   * Sent when: Admin issues credit/refund
   * Action: None (informational, credit auto-applied)
   * Audience: Customer
   */
  CREDIT_ISSUED: 'CREDIT_ISSUED',

  /**
   * ORDER_COMPLETED
   * Sent when: Order auto-completes after Friday cutoff
   * Action: View final invoice
   * Audience: Customer
   */
  ORDER_COMPLETED: 'ORDER_COMPLETED',

  /**
   * PAYMENT_REMINDER
   * Sent when: Admin sends payment reminder to customer
   * Action: View payment status (if already submitted) or submit payment
   * Audience: Customer
   */
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',

  /**
   * ORDER_EDITED
   * Sent when: Admin edits a paid order (decrease items)
   * Action: View order details and credit balance
   * Audience: Customer
   */
  ORDER_EDITED: 'ORDER_EDITED',
} as const;

/**
 * Admin-facing notification types
 * These notifications appear in the admin's notification bell
 */
export const ADMIN_NOTIFICATION_TYPES = {
  /**
   * ORDER_SUBMITTED
   * Sent when: Customer submits new order
   * Action: Review and approve/reject order
   * Audience: Admin
   */
  ORDER_SUBMITTED: 'ORDER_SUBMITTED',

  /**
   * PAYMENT_SUBMITTED
   * Sent when: Customer submits payment proof
   * Action: Review payment proof and confirm
   * Audience: Admin
   */
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',

  /**
   * PAYMENT_CONFIRMED_ADMIN
   * Sent when: Admin confirms payment (transforms from PAYMENT_SUBMITTED)
   * Action: View invoice details
   * Audience: Admin (record keeping)
   */
  PAYMENT_CONFIRMED_ADMIN: 'PAYMENT_CONFIRMED_ADMIN',

  /**
   * ORDER_AUTO_COMPLETED_ADMIN
   * Sent when: Order auto-completes after Friday cutoff
   * Action: View order details
   * Audience: Admin (record keeping)
   */
  ORDER_AUTO_COMPLETED_ADMIN: 'ORDER_AUTO_COMPLETED_ADMIN',

  /**
   * ORDER_UPDATE_REQUESTED
   * Sent when: Customer requests to update approved order
   * Action: Review and approve/reject update
   * Audience: Admin
   */
  ORDER_UPDATE_REQUESTED: 'ORDER_UPDATE_REQUESTED',

  /**
   * ORDER_DECREASED_ADMIN
   * Sent when: Admin decreases order total
   * Action: None (informational, for record keeping)
   * Audience: Admin
   */
  ORDER_DECREASED_ADMIN: 'ORDER_DECREASED_ADMIN',

  /**
   * ORDER_PLACED_TRACKING
   * Sent when: Customer places a new order
   * Action: Track and manage the new order
   * Audience: Admin
   */
  ORDER_PLACED_TRACKING: 'ORDER_PLACED_TRACKING',

  /**
   * PAYMENT_SUBMITTED_TRACKING
   * Sent when: Customer submits payment proof
   * Action: Track payment submission and process
   * Audience: Admin
   */
  PAYMENT_SUBMITTED_TRACKING: 'PAYMENT_SUBMITTED_TRACKING',
} as const;

/**
 * ALL notification types (union of customer + admin)
 */
export const NOTIFICATION_TYPES = {
  ...CUSTOMER_NOTIFICATION_TYPES,
  ...ADMIN_NOTIFICATION_TYPES,
} as const;

/**
 * TypeScript type for all notification types
 */
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type CustomerNotificationType = typeof CUSTOMER_NOTIFICATION_TYPES[keyof typeof CUSTOMER_NOTIFICATION_TYPES];
export type AdminNotificationType = typeof ADMIN_NOTIFICATION_TYPES[keyof typeof ADMIN_NOTIFICATION_TYPES];

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL ACTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Action types for notification buttons
 * These define what happens when user clicks a notification action button
 */
export const ACTION_TYPES = {
  /**
   * PAY_NOW
   * Opens: Payment submission modal
   * Context: Customer needs to submit payment
   */
  PAY_NOW: 'PAY_NOW',

  /**
   * VIEW_PAYMENT_PROOF
   * Opens: Payment proof image/details modal
   * Context: Admin reviewing submitted payment
   */
  VIEW_PAYMENT_PROOF: 'VIEW_PAYMENT_PROOF',

  /**
   * CONFIRM_PAYMENT
   * Opens: Payment confirmation modal
   * Context: Admin confirming payment is received
   */
  CONFIRM_PAYMENT: 'CONFIRM_PAYMENT',

  /**
   * VIEW_ORDER
   * Opens: Order details modal
   * Context: View full order details
   */
  VIEW_ORDER: 'VIEW_ORDER',

  /**
   * VIEW_INVOICE
   * Opens: Invoice details modal
   * Context: View and download invoice
   */
  VIEW_INVOICE: 'VIEW_INVOICE',

  /**
   * VIEW_CREDIT_HISTORY
   * Opens: Credit history modal
   * Context: View all credits/refunds
   */
  VIEW_CREDIT_HISTORY: 'VIEW_CREDIT_HISTORY',

  /**
   * REVIEW_ORDER
   * Opens: Order review modal (admin)
   * Context: Admin reviewing new order
   */
  REVIEW_ORDER: 'REVIEW_ORDER',

  /**
   * REVIEW_UPDATE
   * Opens: Order update review modal (admin)
   * Context: Admin reviewing order update request
   */
  REVIEW_UPDATE: 'REVIEW_UPDATE',

  /**
   * VIEW_STATUS
   * Opens: Order status modal
   * Context: Customer checking order status
   */
  VIEW_STATUS: 'VIEW_STATUS',

  /**
   * VIEW_HISTORY
   * Opens: Order history page
   * Context: View all past orders
   */
  VIEW_HISTORY: 'VIEW_HISTORY',
} as const;

/**
 * TypeScript type for all action types
 */
export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY TYPE MAPPING (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map legacy notification types to canonical types
 * Use this for migrating old notifications or handling Firestore data
 */
export const LEGACY_TYPE_MAP: Record<string, NotificationType> = {
  // Kebab-case legacy types
  'order-pending': NOTIFICATION_TYPES.ORDER_PENDING,
  'order-approved': NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED,
  'order-rejected': NOTIFICATION_TYPES.ORDER_REJECTED,
  'order-cancelled': NOTIFICATION_TYPES.ORDER_CANCELLED,
  'payment-submitted': NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
  'payment-in-review': NOTIFICATION_TYPES.PAYMENT_IN_REVIEW,
  'payment-confirmed': NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
  'payment-confirmed-admin': NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN,
  'invoice-updated': NOTIFICATION_TYPES.INVOICE_UPDATED,
  'additional-payment-required': NOTIFICATION_TYPES.ADDITIONAL_PAYMENT_REQUIRED,
  'credit-issued': NOTIFICATION_TYPES.CREDIT_ISSUED,
  'order-update-requested': NOTIFICATION_TYPES.ORDER_UPDATE_REQUESTED,
  'order-completed': NOTIFICATION_TYPES.ORDER_COMPLETED,
  'new-order-submitted': NOTIFICATION_TYPES.ORDER_SUBMITTED,

  // Old uppercase variations
  'PAYMENT_SUBMITTED_REVIEW': NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
  'ORDER_UPDATE_REQUESTED_REVIEW': NOTIFICATION_TYPES.ORDER_UPDATE_REQUESTED,
  'PAYMENT_CONFIRMED_THANK_YOU': NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
  'INVOICE_UPDATED_UNPAID': NOTIFICATION_TYPES.INVOICE_UPDATED,
  'ORDER_SUBMITTED_REVIEW': NOTIFICATION_TYPES.ORDER_SUBMITTED,
  
  // ❌ REMOVED TYPES - No longer supported, will show "Unknown Type" fallback
  // 'PAYMENT_PROOF_UPLOADED' was removed 2026-02-03 - use PAYMENT_SUBMITTED instead
};

/**
 * Normalize a notification type to canonical format
 * Handles kebab-case, UPPER_SNAKE, and legacy variations
 * 
 * @param type - Raw notification type from Firestore or user input
 * @returns Canonical notification type
 */
export function normalizeNotificationType(type?: string): NotificationType | null {
  if (!type) return null;

  // 1. Check if already canonical
  if (Object.values(NOTIFICATION_TYPES).includes(type as NotificationType)) {
    return type as NotificationType;
  }

  // 2. Check legacy map (handles kebab-case and old types)
  if (LEGACY_TYPE_MAP[type]) {
    return LEGACY_TYPE_MAP[type];
  }

  // 3. Try converting kebab-case to UPPER_SNAKE
  const upperSnake = type.toUpperCase().replace(/-/g, '_');
  if (Object.values(NOTIFICATION_TYPES).includes(upperSnake as NotificationType)) {
    return upperSnake as NotificationType;
  }

  // 4. Unknown type - log warning and return null
  logger.warn(`⚠️ Unknown notification type: "${type}". Add to LEGACY_TYPE_MAP or NOTIFICATION_TYPES.`);
  return null;
}

/**
 * Check if a notification type is a payment-related type
 * Useful for determining which modal to show
 */
export function isPaymentNotification(type?: string): boolean {
  const normalized = normalizeNotificationType(type);
  return normalized === NOTIFICATION_TYPES.PAYMENT_SUBMITTED ||
         normalized === NOTIFICATION_TYPES.PAYMENT_IN_REVIEW ||
         normalized === NOTIFICATION_TYPES.PAYMENT_CONFIRMED ||
         normalized === NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN;
}

/**
 * Check if a notification type requires customer action
 */
export function requiresCustomerAction(type?: string): boolean {
  const normalized = normalizeNotificationType(type);
  return normalized === NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED ||
         normalized === NOTIFICATION_TYPES.ADDITIONAL_PAYMENT_REQUIRED;
}

/**
 * Check if a notification type requires admin action
 */
export function requiresAdminAction(type?: string): boolean {
  const normalized = normalizeNotificationType(type);
  return normalized === NOTIFICATION_TYPES.PAYMENT_SUBMITTED ||
         normalized === NOTIFICATION_TYPES.ORDER_SUBMITTED ||
         normalized === NOTIFICATION_TYPES.ORDER_UPDATE_REQUESTED;
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION STRUCTURE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Notification Action
 * Represents a clickable action button in a notification
 */
export interface NotificationAction {
  type: ActionType;
  label: string;
  payload?: Record<string, any>;
}

/**
 * Notification Structure (matches Firestore schema)
 * Stored in Firestore at:
 * - notifications/admin/items/{notificationId}
 * - notifications/user_{customerId}/items/{notificationId}
 */
export interface NotificationItem {
  // Identity
  id: string;
  type: NotificationType;
  
  // Content
  title: string;
  message: string;
  
  // Related entities
  orderId: string;
  invoiceId?: string;
  customerId?: string; // For admin notifications to link back to customer
  customerName?: string; // For admin notifications
  
  // State
  read: boolean;
  readAt?: string | Date;
  
  // Timestamps
  createdAt: string | Date;
  timestamp?: string | Date; // For orderBy compatibility
  
  // Actions
  actions: NotificationAction[];
  
  // Optional data
  amount?: number;
  metadata?: Record<string, any>;
  
  // Debugging & versioning
  traceId?: string;
  version?: number;
  
  // Legacy fields (for backward compatibility)
  data?: Record<string, any>;

  // Targeting (used by notification stores for routing)
  target?: string;   // 'admin' | 'customer' | specific userId
  targetId?: string; // target entity ID
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// ✅ All exports are already done inline above with `export const`, `export interface`, and `export function`
// No re-export block needed — types are exported where declared.

// ✅ Constants and functions already exported inline:
// - NOTIFICATION_TYPES (line 160)
// - CUSTOMER_NOTIFICATION_TYPES (line 29)
// - ADMIN_NOTIFICATION_TYPES (line 115)
// - ACTION_TYPES (line 180)
// - LEGACY_TYPE_MAP (line 265)
// - normalizeNotificationType (line 300)
// - isPaymentNotification (line 328)
// - requiresCustomerAction (line 339)
// - requiresAdminAction (line 348)