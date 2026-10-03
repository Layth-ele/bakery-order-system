/**
 * Notification contract — the notification types and actions the app
 * writes and understands. Single source of truth for the web app.
 *
 * Who writes each type:
 *   Server (onOrderLifecycle trigger, src/functions/src/lib/orderNotifications.ts)
 *     customer: ORDER_APPROVED_PAY_REQUIRED, ORDER_REJECTED, ORDER_CANCELLED,
 *               PAYMENT_CONFIRMED, ORDER_COMPLETED
 *     admin:    ORDER_PLACED_TRACKING, PAYMENT_SUBMITTED, PAYMENT_CONFIRMED_ADMIN
 *   Server (createCustomerWithCode)
 *     admin:    NEW_REGISTRATION
 *   Admin screens (src/notifications/domain/orderNotifications.ts)
 *     customer: PAYMENT_REMINDER, CREDIT_ISSUED, ORDER_EDITED
 *
 * A unit test (src/functions/src/lib/__tests__/orderLifecycle.test.ts)
 * fails if the server writes a type that isn't listed here.
 */

import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Notifications shown in a customer's bell. */
export const CUSTOMER_NOTIFICATION_TYPES = {
  /** Admin approved the order; customer must pay. */
  ORDER_APPROVED_PAY_REQUIRED: 'ORDER_APPROVED_PAY_REQUIRED',
  /** Admin declined a pending order (with reason). */
  ORDER_REJECTED: 'ORDER_REJECTED',
  /** Order cancelled (with reason, and store credit if any). */
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  /** Admin confirmed payment; order is in production. */
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  /** Order completed; final invoice available. */
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  /** Admin sent a payment reminder for an unpaid order. */
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
  /** Admin issued store credit. */
  CREDIT_ISSUED: 'CREDIT_ISSUED',
  /** Admin reduced a paid order and issued credit for the difference. */
  ORDER_EDITED: 'ORDER_EDITED',
  /** Admin paid out store credit the customer asked for. */
  CREDIT_PAYOUT_COMPLETED: 'CREDIT_PAYOUT_COMPLETED',
  /** Admin declined a payout request; the credit is spendable again. */
  CREDIT_PAYOUT_DECLINED: 'CREDIT_PAYOUT_DECLINED',
} as const;

/** Notifications shown in the admin bell. */
export const ADMIN_NOTIFICATION_TYPES = {
  /** A customer placed a new order. */
  ORDER_PLACED_TRACKING: 'ORDER_PLACED_TRACKING',
  /** A customer submitted payment; needs review. */
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  /** The PAYMENT_SUBMITTED alert, resolved after payment was confirmed. */
  PAYMENT_CONFIRMED_ADMIN: 'PAYMENT_CONFIRMED_ADMIN',
  /** A new customer registered and awaits approval. */
  NEW_REGISTRATION: 'NEW_REGISTRATION',
  /** A customer asked for a store-credit note to be paid out. */
  CREDIT_PAYOUT_REQUESTED: 'CREDIT_PAYOUT_REQUESTED',
} as const;

export const NOTIFICATION_TYPES = {
  ...CUSTOMER_NOTIFICATION_TYPES,
  ...ADMIN_NOTIFICATION_TYPES,
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type CustomerNotificationType = typeof CUSTOMER_NOTIFICATION_TYPES[keyof typeof CUSTOMER_NOTIFICATION_TYPES];
export type AdminNotificationType = typeof ADMIN_NOTIFICATION_TYPES[keyof typeof ADMIN_NOTIFICATION_TYPES];

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS (buttons on a notification)
// ═══════════════════════════════════════════════════════════════════════════

export const ACTION_TYPES = {
  VIEW_ORDER: 'VIEW_ORDER',
  SUBMIT_PAYMENT: 'SUBMIT_PAYMENT',
  CONFIRM_PAYMENT: 'CONFIRM_PAYMENT',
  VIEW_INVOICE: 'VIEW_INVOICE',
  VIEW_ACCOUNT: 'view_account',
  VIEW_REGISTRATION: 'VIEW_REGISTRATION',
} as const;

export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

// ═══════════════════════════════════════════════════════════════════════════
// STORED LEGACY TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type names found on notifications written by earlier versions of the app.
 * They stay readable (and clickable) by mapping to the current type.
 */
const LEGACY_TYPE_MAP: Record<string, NotificationType> = {
  new_registration: NOTIFICATION_TYPES.NEW_REGISTRATION,
  PAYMENT_SUBMITTED_TRACKING: NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
  ORDER_SUBMITTED: NOTIFICATION_TYPES.ORDER_PLACED_TRACKING,
  'new-order-submitted': NOTIFICATION_TYPES.ORDER_PLACED_TRACKING,
  'order-approved': NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED,
  'order-rejected': NOTIFICATION_TYPES.ORDER_REJECTED,
  'order-cancelled': NOTIFICATION_TYPES.ORDER_CANCELLED,
  'order-completed': NOTIFICATION_TYPES.ORDER_COMPLETED,
  'payment-submitted': NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
  PAYMENT_SUBMITTED_REVIEW: NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
  'payment-confirmed': NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
  PAYMENT_CONFIRMED_THANK_YOU: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
  'payment-confirmed-admin': NOTIFICATION_TYPES.PAYMENT_CONFIRMED_ADMIN,
  'credit-issued': NOTIFICATION_TYPES.CREDIT_ISSUED,
};

/**
 * Current type for any stored type string (current, legacy, or
 * kebab/lower-case variants). Returns null for unknown types.
 */
export function normalizeNotificationType(type?: string): NotificationType | null {
  if (!type) return null;
  const known = Object.values(NOTIFICATION_TYPES) as string[];
  if (known.includes(type)) return type as NotificationType;
  if (LEGACY_TYPE_MAP[type]) return LEGACY_TYPE_MAP[type];
  const upperSnake = type.toUpperCase().replace(/-/g, '_');
  if (known.includes(upperSnake)) return upperSnake as NotificationType;
  logger.warn(`⚠️ Unknown notification type: "${type}".`);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE (Firestore: notifications/admin/items/{id}, notifications/user_{uid}/items/{id})
// ═══════════════════════════════════════════════════════════════════════════

export interface NotificationAction {
  type: ActionType;
  label: string;
  payload?: Record<string, any>;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;

  title: string;
  message: string;

  orderId: string;
  invoiceId?: string;
  customerId?: string;
  customerName?: string;

  read: boolean;
  readAt?: string | Date;

  createdAt: string | Date;
  timestamp?: string | Date;

  actions: NotificationAction[];

  amount?: number;
  metadata?: Record<string, any>;

  /** "server" (Cloud Function) or "client" (admin screen). */
  source?: 'server' | 'client';
}
