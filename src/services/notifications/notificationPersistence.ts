/**
 * Notification persistence (browser side).
 *
 * The browser writes only admin-initiated customer notices; order lifecycle
 * notifications come from the onOrderLifecycle Cloud Function. Reading,
 * marking read and deleting live in the notification providers.
 */

import { db } from '../../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCustomerNotificationPath } from '../../notifications/utils/paths';

/**
 * Write a customer notification (admin-initiated notices only — payment
 * reminder, store credit, paid-order edit). Order lifecycle notifications
 * are written by the onOrderLifecycle Cloud Function, never from here.
 *
 * Errors propagate to the caller: a failed write is surfaced, not hidden.
 */
export async function createCustomerNotification(
  customerId: string,
  notificationId: string,
  type: string,
  title: string,
  message: string,
  orderId: string,
  actions: Array<{ type: string; label: string; payload?: any }>,
  metadata?: Record<string, any>
): Promise<void> {
  if (!customerId) throw new Error('createCustomerNotification: customerId is required');
  const ref = doc(db, ...getCustomerNotificationPath(customerId), notificationId);
  await setDoc(ref, {
    id: notificationId,
    type,
    title,
    message,
    orderId,
    customerId,
    actions,
    metadata: metadata || {},
    read: false,
    source: 'client',
    createdAt: serverTimestamp(),
    timestamp: serverTimestamp(),
  });
}
