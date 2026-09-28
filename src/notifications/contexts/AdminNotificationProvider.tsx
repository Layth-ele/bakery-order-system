/**
 * AdminNotificationProvider — the admin's single real-time notification feed
 * (notifications/admin/items). Mounted once in the admin layout.
 *
 * Writes to this feed come from Cloud Functions (order lifecycle trigger,
 * new registrations); this provider only reads, marks read and deletes.
 */
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { db } from '@/firebase/config';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  getDocs,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { getAdminNotificationPath } from '../utils/paths';
import { logger } from '../../utils/logger';
import { safeSubscribe, isExpectedFirestoreListenerError } from '../../utils/subscriptionSafety';
import { toNotificationItem, type FeedNotification } from './toNotificationItem';

interface AdminNotificationContextValue {
  notifications: FeedNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  /** Rejects on failure so callers doing optimistic removal can revert. */
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  loading: boolean;
}

const AdminNotificationContext = createContext<AdminNotificationContextValue | null>(null);

const BATCH_LIMIT = 450; // Firestore allows 500 writes per batch

async function commitInBatches(refs: Array<{ ref: any }>, apply: (b: ReturnType<typeof writeBatch>, ref: any) => void) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((d) => apply(batch, d.ref));
    await batch.commit();
  }
}

export function AdminNotificationProviderV3({ children }: { children: ReactNode }): JSX.Element {
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let errorCount = 0;

    const unsubscribe = safeSubscribe('admin-notifications-listener', () =>
      onSnapshot(
        query(collection(db, ...getAdminNotificationPath()), orderBy('timestamp', 'desc')),
        (snapshot) => {
          if (!active) return;
          errorCount = 0;
          setNotifications(snapshot.docs.map((d) => toNotificationItem(d.id, d.data())));
          setLoading(false);
        },
        (error) => {
          if (!active) return;
          errorCount += 1;
          // Firestore retries on its own; log the first failure and a
          // reminder if it keeps failing.
          if (!isExpectedFirestoreListenerError(error) && (errorCount === 1 || errorCount === 5)) {
            logger.warn(`[AdminNotificationProvider] listener error (#${errorCount}):`, error.code, error.message);
          }
          setLoading(false);
        }
      )
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await updateDoc(doc(db, ...getAdminNotificationPath(), notificationId), {
        read: true,
        readAt: Timestamp.now(),
      });
    } catch (error) {
      // Non-critical: never block opening the notification.
      logger.warn('[AdminNotificationProvider] mark as read failed:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unread = await getDocs(
        query(collection(db, ...getAdminNotificationPath()), where('read', '==', false))
      );
      await commitInBatches(unread.docs, (b, ref) => b.update(ref, { read: true, readAt: Timestamp.now() }));
    } catch (error) {
      logger.warn('[AdminNotificationProvider] mark all as read failed:', error);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await deleteDoc(doc(db, ...getAdminNotificationPath(), notificationId));
  }, []);

  const clearAllNotifications = useCallback(async () => {
    const all = await getDocs(collection(db, ...getAdminNotificationPath()));
    await commitInBatches(all.docs, (b, ref) => b.delete(ref));
  }, []);

  const value = useMemo<AdminNotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAllNotifications,
      loading,
    }),
    [notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, loading]
  );

  return <AdminNotificationContext.Provider value={value}>{children}</AdminNotificationContext.Provider>;
}

/** Admin notification context, or null outside the admin layout. */
export function useAdminNotificationsSafe() {
  return useContext(AdminNotificationContext);
}
