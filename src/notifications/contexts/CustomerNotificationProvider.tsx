/**
 * CustomerNotificationProvider — a customer's single real-time notification
 * feed (notifications/user_{uid}/items). Mounted once in the customer layout.
 *
 * Writes to this feed come from the server (order lifecycle trigger) and
 * from admin-initiated notices; customers can only read, mark read and
 * delete their own notifications (see firestore.rules).
 */
import { createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, where, Timestamp, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getCustomerNotificationPath } from '../utils/paths';
import { logger } from '../../utils/logger';
import { safeSubscribe, isExpectedFirestoreListenerError } from '../../utils/subscriptionSafety';
import { toNotificationItem, type FeedNotification } from './toNotificationItem';

interface CustomerNotificationContextType {
  notifications: FeedNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  /** Rejects on failure so callers doing optimistic removal can revert. */
  deleteNotification: (id: string) => Promise<void>;
}

const CustomerNotificationContext = createContext<CustomerNotificationContextType | null>(null);

interface CustomerNotificationProviderProps {
  children: ReactNode;
  customerId: string;
}

export function CustomerNotificationProvider({ children, customerId }: CustomerNotificationProviderProps): JSX.Element {
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);

  useEffect(() => {
    if (!customerId) {
      setNotifications([]);
      return;
    }
    const unsubscribe = safeSubscribe(`customer-notifications:${customerId}`, () =>
      onSnapshot(
        // createdAt (not timestamp): every writer sets it, including older docs.
        query(collection(db, ...getCustomerNotificationPath(customerId)), orderBy('createdAt', 'desc')),
        (snapshot) => setNotifications(snapshot.docs.map((d) => toNotificationItem(d.id, d.data()))),
        (error) => {
          if (!isExpectedFirestoreListenerError(error)) {
            logger.warn('[CustomerNotificationProvider] listener error:', error.code, error.message);
          }
          setNotifications([]);
        }
      )
    );
    return unsubscribe;
  }, [customerId]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!customerId) return;
      try {
        await updateDoc(doc(db, ...getCustomerNotificationPath(customerId), id), {
          read: true,
          readAt: Timestamp.now(),
        });
      } catch (error) {
        // Non-critical: never block opening the notification.
        logger.warn('[CustomerNotificationProvider] mark as read failed:', error);
      }
    },
    [customerId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!customerId) return;
    try {
      const unread = await getDocs(
        query(collection(db, ...getCustomerNotificationPath(customerId)), where('read', '==', false))
      );
      if (unread.empty) return;
      const batch = writeBatch(db);
      unread.docs.forEach((d) => batch.update(d.ref, { read: true, readAt: Timestamp.now() }));
      await batch.commit();
    } catch (error) {
      logger.warn('[CustomerNotificationProvider] mark all as read failed:', error);
    }
  }, [customerId]);

  const deleteNotification = useCallback(
    async (id: string) => {
      if (!customerId) return;
      await deleteDoc(doc(db, ...getCustomerNotificationPath(customerId), id));
    },
    [customerId]
  );

  const value = useMemo<CustomerNotificationContextType>(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification }),
    [notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification]
  );

  return <CustomerNotificationContext.Provider value={value}>{children}</CustomerNotificationContext.Provider>;
}

/** Customer notification context, or null outside the customer layout. */
export function useCustomerNotificationsSafe(): CustomerNotificationContextType | null {
  return useContext(CustomerNotificationContext);
}
