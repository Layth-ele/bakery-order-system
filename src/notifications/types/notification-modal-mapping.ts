/**
 * What clicking a notification opens: a modal, or (for registrations) a page.
 *
 * `Record<NotificationType, …>` makes this exhaustive — adding a type to
 * src/types/notification-contract.ts without a mapping is a compile error.
 * The modal's data is loaded by src/utils/notification-modal-resolver.ts.
 */
import type { ModalType } from '@/types/modals';
import { normalizeNotificationType, type NotificationType } from '@/types/notification-contract';

export interface NotificationModalMapping {
  /** Modal to open. */
  modalType: ModalType;
  /** When set, navigate to this app route instead of opening a modal. */
  route?: string;
  description: string;
}

export const NOTIFICATION_MODAL_MAP: Readonly<Record<NotificationType, NotificationModalMapping>> = {
  // ── Customer ──────────────────────────────────────────────────────────────
  ORDER_APPROVED_PAY_REQUIRED: { modalType: 'SUBMIT_PAYMENT', description: 'Pay for the approved order' },
  ORDER_REJECTED: { modalType: 'REJECTED_ORDER_DETAILS', description: 'Rejection reason and order details' },
  ORDER_CANCELLED: { modalType: 'CANCELLED_ORDER_DETAILS', description: 'Cancellation reason, credit and order details' },
  PAYMENT_CONFIRMED: { modalType: 'PAID_ORDER_DETAILS', description: 'Paid order in production' },
  ORDER_COMPLETED: { modalType: 'COMPLETED_ORDER_INVOICE', description: 'Final invoice' },
  // Opens SUBMIT_PAYMENT or PAYMENT_IN_REVIEW depending on whether the
  // customer already submitted payment (decided in notificationActions).
  PAYMENT_REMINDER: { modalType: 'PAYMENT_IN_REVIEW', description: 'Pay, or see the submitted payment' },
  CREDIT_ISSUED: { modalType: 'CREDIT_RECEIVED', description: 'Store credit received' },
  ORDER_EDITED: { modalType: 'PAID_ORDER_DETAILS', description: 'Edited paid order and credit issued' },

  // ── Admin ─────────────────────────────────────────────────────────────────
  ORDER_PLACED_TRACKING: { modalType: 'ADMIN_ORDER_VIEW', description: 'Review the new order' },
  PAYMENT_SUBMITTED: { modalType: 'ADMIN_ORDER_VIEW', description: 'Review the submitted payment' },
  PAYMENT_CONFIRMED_ADMIN: { modalType: 'PAYMENT_CONFIRMED_MESSAGE', description: 'Payment confirmed (record)' },
  NEW_REGISTRATION: {
    modalType: 'NOTIFICATION_DETAILS',
    route: '/admin/registrations',
    description: 'Review the registration request',
  },
};

const FALLBACK: NotificationModalMapping = {
  modalType: 'NOTIFICATION_DETAILS',
  description: 'Generic details for unknown notification types',
};

/**
 * Mapping for a stored notification type (current or legacy name). Unknown
 * types get the generic details modal, so a click never fails.
 */
export function getModalForNotification(notificationType?: string): NotificationModalMapping {
  const normalized = normalizeNotificationType(notificationType);
  return (normalized && NOTIFICATION_MODAL_MAP[normalized]) || FALLBACK;
}

/** True when the type has its own mapping (not the generic fallback). */
export function hasModalMapping(notificationType?: string): boolean {
  return getModalForNotification(notificationType) !== FALLBACK;
}
