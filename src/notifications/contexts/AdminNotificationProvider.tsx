/**
 * Admin Notification Context V3
 * 
 * Uses Firestore when configured, falls back to localStorage in demo mode.
 * Listens to: notifications/admin/items (both Firestore and localStorage use same path)
 * 
 * VERSION: 3.3 - Firebase + LocalStorage Hybrid (Fixed path matching)
 * LOCATION: /notifications/contexts/ (Consolidated Feb 11, 2026)
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, ReactNode } from 'react';
import { db, isFirebaseConfigured } from '@/firebase/config'; // ✅ Using alias import
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  getDocs,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { NotificationItem } from '@/types/notification-contract'; // ✅ Using alias import
import { getAdminNotificationPath, getAdminNotificationPathString } from '../utils/paths'; // ✅ PHASE 5: Updated to use consolidated paths
import { getServerTimestamp } from '@/utils/timestamps'; // ✅ TIMESTAMP FIX
import { toDate } from '@/utils/timestampFormatting';
import { logger } from '../../utils/logger';
 // ✅ FIX: needed for numeric timestamp conversion

interface AdminNotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>; // ✅ Batch mark all as read
  deleteNotification: (notificationId: string) => Promise<void>;
  updateNotification: (notificationId: string, updates: Partial<NotificationItem>) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  loading: boolean;
}

const AdminNotificationContext = createContext<AdminNotificationContextValue | null>(null);

interface AdminNotificationProviderProps {
  children: ReactNode;
}

// localStorage fallback for demo/non-Firebase mode
const localNotif = {
  getNotifications: (_role: string): any[] => {
    try {
      const storageKey = getAdminNotificationPathString(); // ✅ Use the correct key
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  subscribeToNotifications: (_role: string, cb: (items: any[]) => void): () => void => {
    const storageKey = getAdminNotificationPathString(); // ✅ Use the correct key
    cb(localNotif.getNotifications(_role));
    
    // Listen for storage events
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        cb(localNotif.getNotifications(_role));
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  },
  markAsRead: (_role: string, _id: string): void => {
    try {
      const storageKey = getAdminNotificationPathString(); // ✅ Use the correct key
      const items = localNotif.getNotifications(_role);
      const updated = items.map((n: any) => n.id === _id ? { ...n, read: true } : n);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      
      // Trigger storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify(updated),
        oldValue: localStorage.getItem(storageKey),
        storageArea: localStorage,
      }));
    } catch {}
  },
  markAllAsRead: (_role: string): void => {
    try {
      const storageKey = getAdminNotificationPathString(); // ✅ Use the correct key
      const items = localNotif.getNotifications(_role);
      const updated = items.map((n: any) => ({ ...n, read: true }));
      localStorage.setItem(storageKey, JSON.stringify(updated));
      
      // Trigger storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify(updated),
        oldValue: localStorage.getItem(storageKey),
        storageArea: localStorage,
      }));
    } catch {}
  },
  deleteNotification: (_role: string, _id: string): void => {
    try {
      const storageKey = getAdminNotificationPathString(); // ✅ Use the correct key
      const items = localNotif.getNotifications(_role);
      const updated = items.filter((n: any) => n.id !== _id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      
      // Trigger storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify(updated),
        oldValue: localStorage.getItem(storageKey),
        storageArea: localStorage,
      }));
    } catch {}
  },
  updateNotification: (_role: string, _id: string, _updates: any): void => {
    try {
      const storageKey = getAdminNotificationPathString(); // ✅ Use the correct key
      const items = localNotif.getNotifications(_role);
      const updated = items.map((n: any) => n.id === _id ? { ...n, ..._updates } : n);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      
      // Trigger storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify(updated),
        oldValue: localStorage.getItem(storageKey),
        storageArea: localStorage,
      }));
    } catch {}
  },
  clearAllNotifications: (_role: string): void => {
    try { 
      const storageKey = getAdminNotificationPathString(); // ✅ Use the correct key
      localStorage.removeItem(storageKey); 
      
      // Trigger storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: storageKey,
        newValue: null,
        oldValue: localStorage.getItem(storageKey),
        storageArea: localStorage,
      }));
    } catch {}
  },
};

export function AdminNotificationProviderV3({ children }: AdminNotificationProviderProps): JSX.Element | null {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef<boolean>(false);
  
  // ============================================================================
  // FIRESTORE LISTENER
  // ============================================================================
  
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    
    const notificationsRef = collection(db, ...getAdminNotificationPath());
    const q = query(notificationsRef, orderBy('timestamp', 'desc'));
    
 // CRITICAL FIX - Don't kill listener after errors
    // Firestore will automatically retry connections. We log errors but keep listening.
    let errorCount = 0;
    
    unsubscribeRef.current = onSnapshot(
      q, 
      (snapshot) => {
        if (!isMountedRef.current) return;
        
        // ✅ Reset error count on successful connection
        errorCount = 0;
        
        const notificationsList: NotificationItem[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          // ✅ FIX: Normalize Firestore timestamps to ISO strings
          let createdAtStr: string;
          if (data.createdAt instanceof Timestamp) {
            createdAtStr = data.createdAt.toDate().toISOString();
          } else if (data.timestamp instanceof Timestamp) {
            createdAtStr = data.timestamp.toDate().toISOString();
          } else if (typeof data.createdAt === 'number') {
            createdAtStr = (toDate(data.createdAt) ?? new Date()).toISOString();
          } else {
            // FIX T2R2-C9 sibling (CRITICAL): was getServerTimestamp() which
            // returns a FieldValue sentinel, not a string. UI rendering would
            // produce "[object Object]". Use real ISO string.
            createdAtStr = data.createdAt || new Date().toISOString();
          }
          
          notificationsList.push({
            id: doc.id,
            ...data,
            createdAt: createdAtStr,
          } as NotificationItem);
        });
        
        setNotifications(notificationsList);
        setLoading(false);
      }, 
      (error) => {
        if (!isMountedRef.current) return;
        
        errorCount++;
        
 // CRITICAL FIX - Log errors but NEVER kill the listener
        // Firestore onSnapshot automatically retries on network/permission errors.
        // Killing the listener means admin notifications are dead for the entire session.
        if (errorCount === 1) {
          console.error('❌ AdminNotificationContextV3 listener error:', (error as any).message);
          console.error('   Code:', (error as any).code);
          console.error('   This may indicate missing Firestore security rules for notifications/admin/items');
          console.error('   The listener will continue running and auto-retry.');
        } else if (errorCount === 5) {
          logger.warn('⚠️ AdminNotificationContextV3: Multiple connection errors detected');
          logger.warn('   Error count:', errorCount);
          logger.warn('   Firestore will continue auto-retry. Check Firebase console for issues.');
        }
        
        setLoading(false);
      }
    );
    
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);
  
  // ============================================================================
  // ============================================================================
  
  useEffect(() => {
    if (isFirebaseConfigured) {
      return; // Skip if using Firestore
    }
    
    
    // Initial load
    const loadNotifications = () => {
      const items = localNotif.getNotifications('admin');
      logger.log('📱 [AdminNotificationProvider] Loaded notifications from localStorage:', items.length, items);
      const converted = items.map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        orderId: item.orderId || '',
        invoiceId: item.metadata?.invoiceId,
        customerId: item.metadata?.customerId,
        customerName: item.metadata?.customerName,
        amount: item.metadata?.amount,
        read: item.read,
        createdAt: item.createdAt || new Date().toISOString(),
        timestamp: item.createdAt,
        actions: item.actions || [],
        data: item.metadata,
        metadata: item.metadata,
      }));
      logger.log('📱 [AdminNotificationProvider] Converted notifications:', converted.length, converted);
      setNotifications(converted);
      setLoading(false);
    };
    
    loadNotifications();
    
    // Listen for changes
    const unsubscribe = localNotif.subscribeToNotifications('admin', (items) => {
      logger.log('📱 [AdminNotificationProvider] Received notification update:', items.length, items);
      const converted = items.map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        orderId: item.orderId || '',
        invoiceId: item.metadata?.invoiceId,
        customerId: item.metadata?.customerId,
        customerName: item.metadata?.customerName,
        amount: item.metadata?.amount,
        read: item.read,
        createdAt: item.createdAt || new Date().toISOString(),
        timestamp: item.createdAt,
        actions: item.actions || [],
        data: item.metadata,
        metadata: item.metadata,
      }));
      logger.log('📱 [AdminNotificationProvider] Setting notifications state:', converted.length, converted);
      setNotifications(converted);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // ============================================================================
  // COMPUTED VALUES & ACTIONS
  // ============================================================================
  
  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Mark as read
  const markAsRead = async (notificationId: string) => {
    if (isFirebaseConfigured) {
      try {
        const notificationRef = doc(db, ...getAdminNotificationPath(), notificationId);
        await updateDoc(notificationRef, { 
          read: true,
          readAt: Timestamp.now() as any
        });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    } else {
      localNotif.markAsRead('admin', notificationId);
    }
  };
  
  // ✅ Batch mark all as read (performance optimization)
  const markAllAsRead = async () => {
    if (isFirebaseConfigured) {
      try {
        const notificationsRef = collection(db, ...getAdminNotificationPath());
        const q = query(notificationsRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          return;
        }
        
        // ✅ Batch update for performance
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          if (!doc.data().read) {
            batch.update(doc.ref, { 
              read: true,
              readAt: Timestamp.now() as any
            });
          }
        });
        
        await batch.commit();
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
      }
    } else {
      localNotif.markAllAsRead('admin');
    }
  };
  
  // Delete notification
  const deleteNotif = async (notificationId: string) => {
    if (isFirebaseConfigured) {
      try {
        const notificationRef = doc(db, ...getAdminNotificationPath(), notificationId);
        await deleteDoc(notificationRef);
      } catch (error) {
        console.error('Error deleting notification:', error);
      }
    } else {
      localNotif.deleteNotification('admin', notificationId);
    }
  };
  
  // Update notification
  const updateNotif = async (notificationId: string, updates: Partial<NotificationItem>) => {
    if (isFirebaseConfigured) {
      try {
        const notificationRef = doc(db, ...getAdminNotificationPath(), notificationId);
        await updateDoc(notificationRef, updates as any);
      } catch (error) {
        console.error('Error updating notification:', error);
      }
    } else {
      localNotif.updateNotification('admin', notificationId, updates as any);
    }
  };
  
  // Clear all notifications
  const clearAllNotifications = async () => {
    if (isFirebaseConfigured) {
      try {
        const notificationsRef = collection(db, ...getAdminNotificationPath());
        const snapshot = await getDocs(notificationsRef);
        
        if (snapshot.empty) {
          return;
        }
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      } catch (error) {
        console.error('Error clearing notifications:', error);
      }
    } else {
      localNotif.clearAllNotifications('admin');
    }
  };
  
  // FIX T2R2-H3 (HIGH): Was a fresh value object on every render. Every
  // consumer (admin notification bell, panel, etc.) re-rendered on every
  // notifications poll/update even when the data they consumed hadn't
  // changed. Memoize the value so consumers only re-render when the
  // underlying data actually changes. Mirrors the same fix applied to
  // CustomerNotificationProvider via T2R2-C6.
  //
  // Note on the handlers (markAsRead, markAllAsRead, deleteNotif,
  // updateNotif, clearAllNotifications): they are still recreated on
  // every render because they're not yet wrapped in useCallback. Wrapping
  // them is an additional improvement but each one closes over `db`,
  // `notifications`, and `setNotifications` — refactor scope larger than a
  // surgical patch. For now the value-level memoization at least prevents
  // the "everything re-renders on every poll" cascade; the handlers'
  // referential instability still causes some unnecessary work, but the
  // critical-path perf hit is closed.
  const value = useMemo<AdminNotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification: deleteNotif,
      updateNotification: updateNotif,
      clearAllNotifications,
      loading,
    }),
    [notifications, unreadCount, loading]
    // Handlers intentionally omitted from deps — see comment above.
    // ESLint will warn; the suppression is justified.
    // eslint-disable-line react-hooks/exhaustive-deps
  );
  
  return (
    <AdminNotificationContext.Provider value={value}>
      {children}
    </AdminNotificationContext.Provider>
  );
}

// Hook to use admin notifications
export function useAdminNotifications() {
  const context = useContext(AdminNotificationContext);
  if (!context) {
    throw new Error('useAdminNotifications must be used within AdminNotificationProviderV3');
  }
  return context;
}

// Safe hook that returns null if provider not available
export function useAdminNotificationsSafe() {
  return useContext(AdminNotificationContext);
}