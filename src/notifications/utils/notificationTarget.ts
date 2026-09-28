/**
 * What clicking a notification opens — a page or a modal. Pure decision
 * logic used by notificationActions (tested in
 * src/tests/smoke/notificationTarget.test.ts).
 */
import { getModalForNotification } from '../types/notification-modal-mapping';
import { normalizeNotificationType } from '@/types/notification-contract';

export type NotificationTarget =
  | { kind: 'route'; route: string }
  | { kind: 'modal'; modalType: string };

/** Loads one order the current user may read (customers: their own only). */
export type LoadOrder = (orderId: string) => Promise<{ paymentSubmitted?: boolean } | null>;

export async function resolveNotificationTarget(
  notification: { type?: string; orderId?: string },
  modalTypeOverride: string | undefined,
  loadOrder: LoadOrder
): Promise<NotificationTarget> {
  if (modalTypeOverride) return { kind: 'modal', modalType: modalTypeOverride };

  const mapping = getModalForNotification(notification.type);
  if (mapping.route) return { kind: 'route', route: mapping.route };

  // Payment reminder: pay now, or show the payment already submitted.
  if (normalizeNotificationType(notification.type) === 'PAYMENT_REMINDER' && notification.orderId) {
    const order = await loadOrder(notification.orderId).catch(() => null);
    return { kind: 'modal', modalType: order?.paymentSubmitted ? 'PAYMENT_IN_REVIEW' : 'SUBMIT_PAYMENT' };
  }

  return { kind: 'modal', modalType: mapping.modalType };
}
