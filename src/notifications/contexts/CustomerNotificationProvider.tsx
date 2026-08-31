/**
 * Customer Notification Context V3
 * 
 * Provides notification management for customer users.
 * Uses Firestore for real-time notifications.
 * 
 * Path: notifications/user_{customerId}/items
 * 
 * VERSION 3.3: FIXED - Corrected Firestore path to use 3 segments (valid collection)
 * LOCATION: /notifications/contexts/ (Consolidated Feb 11, 2026)
 */

import {createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback} from 'react'
import { collection, query, onSnapshot, orderBy, Unsubscribe, Timestamp, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/firebase/config'; // ✅ Using alias import
import type { NotificationItem } from '@/types/notification-contract'; // ✅ Using alias import
import { getServerTimestamp } from '@/utils/timestamps'; // ✅ TIMESTAMP FIX
import { toDate } from '@/utils/timestampFormatting';
import { logger } from '../../utils/logger';
 // ✅ FIX: needed for numeric timestamp conversion

// ============================================================================
// TYPE ADAPTER - Bridge between storage schema and UI schema
// ============================================================================

/**
 * Storage schema stores data nested in `data` object.
 * UI schema (CustomerNotificationBell) expects flat structure.
 * This adapter transforms storage → UI format.
 */
interface UINotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;  // ISO string for UI display
  readAt?: string;    // ISO string for UI display
  orderId?: string;   // Top-level for easy access
  invoiceId?: string;
  amount?: number;    // Top-level for easy access
  actions?: Array<{   // Top-level for easy access
    type: string;
    label: string;
    payload?: any;
  }>;
  read: boolean;
  // Include original fields for compatibility
  target?: string;
  targetId?: string;
  traceId?: string;
  version?: number;
}

/**
 * Adapter: Transforms storage NotificationItem → UI-friendly format
 */
function adaptNotificationForUI(item: NotificationItem | any): UINotification {
  let readAtStr: string | undefined;
  if (item.readAt instanceof Timestamp) {
    readAtStr = item.readAt.toDate().toISOString();
  } else if (typeof item.readAt === 'number') {
    readAtStr = (toDate(item.readAt) ?? new Date()).toISOString();
  } else {
    readAtStr = item.readAt;
  }

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    // FIX T2R2-C9 (CRITICAL — runtime crash): Was falling back to
    // getServerTimestamp() which returns a FieldValue SENTINEL object, NOT a
    // string.  React would render `[object Object]` or warn "Objects are not
    // valid as a React child".  Real ISO string fallback now.
    createdAt: item.createdAt || item.timestamp || new Date().toISOString(),
    readAt: readAtStr,
    // ✅ Extract from BOTH top-level AND data object (defensive)
    orderId: item.orderId || item.data?.orderId,
    invoiceId: item.invoiceId || item.data?.invoiceId,
    amount: item.amount ?? item.data?.amount,
    actions: item.actions || item.data?.actions || [],
    read: item.read ?? false,
    // Metadata
    target: item.target,
    targetId: item.targetId,
    traceId: item.traceId,
    version: item.version,
  };
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface CustomerNotificationContextType {
  notifications: UINotification[];  // ✅ Returns UI-friendly format
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => void;
}

const CustomerNotificationContext = createContext<CustomerNotificationContextType | null>(null);

// ============================================================================
// LOCAL STORAGE FALLBACK
// ============================================================================

/**
 * localStorage fallback used when Firebase is not configured (local dev only).
 * In production isFirebaseConfigured is always true so these are never called.
 * The original service that provided these methods was removed during a refactor
 * leaving the call-sites dangling — this stub re-establishes the contract.
 */
const localNotif = {
  getNotifications: (_customerId: string): any[] => {
    try {
      const raw = localStorage.getItem(`notifications_${_customerId}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  markAsRead: (_customerId: string, _id: string): void => {
    try {
      const items = localNotif.getNotifications(_customerId);
      const updated = items.map((n: any) => n.id === _id ? { ...n, read: true } : n);
      localStorage.setItem(`notifications_${_customerId}`, JSON.stringify(updated));
    } catch {}
  },
  markAllAsRead: (_customerId: string): void => {
    try {
      const items = localNotif.getNotifications(_customerId);
      const updated = items.map((n: any) => ({ ...n, read: true }));
      localStorage.setItem(`notifications_${_customerId}`, JSON.stringify(updated));
    } catch {}
  },
  deleteNotification: (_customerId: string, _id: string): void => {
    try {
      const items = localNotif.getNotifications(_customerId);
      const updated = items.filter((n: any) => n.id !== _id);
      localStorage.setItem(`notifications_${_customerId}`, JSON.stringify(updated));
    } catch {}
  },
  clearAllNotifications: (_customerId: string): void => {
    try {
      localStorage.removeItem(`notifications_${_customerId}`);
    } catch {}
  },
};

// ============================================================================
// PROVIDER
// ============================================================================

interface CustomerNotificationProviderProps {
  children: ReactNode;
  customerId: string; // Required: customer's unique ID
}

export function CustomerNotificationProvider({ children, customerId }: CustomerNotificationProviderProps): JSX.Element | null {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  // 🔍 DEBUG: Log initialization


  // ============================================================================
  // UNIFIED LISTENER SETUP (Firestore + LocalStorage)
  // ============================================================================
  
  useEffect(() => {
    // ✅ FIX: Single effect with proper cleanup for both modes
    let unsubscribe: Unsubscribe | undefined;
    let storageHandler: ((e: StorageEvent) => void) | undefined;
    let customEventHandler: ((e: Event) => void) | undefined; // ✅ NEW: Store reference for cleanup
    
    if (!customerId) {
      logger.warn('⚠️ CustomerNotificationProvider: No customerId provided');
      setNotifications([]);
      return;
    }
    
    // FIREBASE MODE
    if (isFirebaseConfigured) {
      
      try {
        // ✅ FIXED: Use 3-segment path (valid collection in Firestore)
        const notificationsRef = collection(db, 'notifications', `user_${customerId}`, 'items');
        // FIX T2R2-H7 (HIGH): Was orderBy('timestamp', 'desc'). Firestore
        // queries with orderBy on a field silently EXCLUDE documents that
        // don't have the field set. Legacy notifications (written before
        // the CF added the timestamp alias) may only have `createdAt` —
        // those would never appear in the customer's notification list.
        // The canonical sort field is `createdAt`; the CF writes BOTH
        // (see customers.ts:102-103, _shared.ts createCustomerNotificationServer)
        // so switching to `createdAt` covers all cases without losing CF-written
        // notifications.
        const q = query(notificationsRef, orderBy('createdAt', 'desc'));
        
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const items: NotificationItem[] = snapshot.docs.map(doc => {
              const data = doc.data();
              // Convert createdAt to ISO string for compatibility
              let createdAtStr: string;
              if (data.createdAt instanceof Timestamp) {
                createdAtStr = data.createdAt.toDate().toISOString();
              } else if (data.timestamp instanceof Timestamp) {
                createdAtStr = data.timestamp.toDate().toISOString();
              } else if (typeof data.createdAt === 'number') {
                createdAtStr = (toDate(data.createdAt) ?? new Date()).toISOString();
              } else {
                // FIX T2R2-C9 sibling (CRITICAL): same FieldValue-sentinel
                // fallback bug as in adaptNotificationForUI above.
                createdAtStr = data.createdAt || new Date().toISOString();
              }
              
              return {
                id: doc.id,
                target: data.target || 'user',
                targetId: data.targetId || customerId,
                type: data.type,
                title: data.title,
                message: data.message,
                orderId: data.orderId || "",
                invoiceId: data.invoiceId,
                amount: data.amount ?? data.metadata?.amount ?? data.metadata?.creditAmount,
                // ✅ FIX: Map customerId so resolveCreditReceivedProps can find it
                customerId: data.customerId || data.metadata?.customerId || customerId,
                // ✅ FIX: Pass through metadata so resolvers can access all fields
                metadata: data.metadata || {},
                read: data.read ?? false,
                createdAt: createdAtStr,
                actions: data.actions || [],
                traceId: data.traceId || `legacy_${doc.id}`,
                version: data.version || 3,
              } as any;
            });
            setNotifications(items);
          },
          (error) => {
            console.error('❌ Firestore listener error:', error);
            setNotifications([]);
          }
        );
      } catch (error) {
        console.error('❌ Failed to set up Firestore listener:', error);
        setNotifications([]);
      }
    }
    else {
      
      // Initial load
      const loadNotifications = () => {
        const items = localNotif.getNotifications(customerId);
        setNotifications(items);
      };
      
      loadNotifications();
      
      // ✅ Listen to custom event for same-tab updates (when notifications are created/updated)
      customEventHandler = (e: Event) => {
        const customEvent = e as CustomEvent;
        const storageKey = `notifications_user_${customerId}`;
        if (customEvent.detail?.key === storageKey) {
          loadNotifications();
        }
      };
      
      // Firebase notifications handled via Firestore real-time listener
      
      // Listen to storage changes from other tabs/windows
      storageHandler = (e: StorageEvent) => {
        if (e.key === `notifications_user_${customerId}`) {
          loadNotifications();
        }
      };
      
      window.addEventListener('storage', storageHandler);
    }
    
    // ✅ CRITICAL: Cleanup function that handles both modes
    return () => {
      
      if (unsubscribe) {
        unsubscribe();
      }
      
      if (storageHandler) {
        window.removeEventListener('storage', storageHandler);
      }
      
      if (!isFirebaseConfigured) {
        if (customEventHandler) {
          // No legacy event listener to remove
        }
      }
    };
  }, [customerId]); // ✅ Only re-run when customerId changes

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const unreadCount = notifications.filter(n => !n.read).length;

  // ============================================================================
  // ACTIONS (work for both Firebase and localStorage)
  // ============================================================================

  const markAsRead = (id: string): Promise<void> => {
    if (!customerId) return Promise.resolve();
    
    if (isFirebaseConfigured) {
      const notificationRef = doc(db, 'notifications', `user_${customerId}`, 'items', id);
      return updateDoc(notificationRef, { 
        read: true,
        readAt: Timestamp.now() as any
      })
        .then(() => {})
        .catch((error) => {
          console.error('❌ Firestore markAsRead error:', error);
        });
    } else {
      localNotif.markAsRead(customerId, id);
      return Promise.resolve();
    }
  };

  const markAllAsRead = (): Promise<void> => {
    if (!customerId) return Promise.resolve();
    
    if (isFirebaseConfigured) {
      // ✅ FIXED: Use getDocs instead of onSnapshot to prevent listener leak
      const notificationsRef = collection(db, 'notifications', `user_${customerId}`, 'items');
      // FIX T2R2-H7 (HIGH): orderBy('timestamp') silently excludes legacy
      // docs without the field. See line 189 for full rationale.
      const q = query(notificationsRef, orderBy('createdAt', 'desc'));
      
      return getDocs(q)
        .then((snapshot) => {
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => {
            if (!doc.data().read) {
              batch.update(doc.ref, { 
                read: true,
                readAt: Timestamp.now() as any
              });
            }
          });
          
          return batch.commit();
        })
        .then(() => {})
        .catch((error) => {
          console.error('❌ Firestore markAllAsRead error:', error);
        });
    } else {
      localNotif.markAllAsRead(customerId);
      return Promise.resolve();
    }
  };

  const deleteNotification = (id: string): Promise<void> => {
    if (!customerId) return Promise.resolve();
    
    if (isFirebaseConfigured) {
      const notificationRef = doc(db, 'notifications', `user_${customerId}`, 'items', id);
      return deleteDoc(notificationRef)
        .then(() => {})
        .catch((error) => {
          console.error('❌ Firestore deleteNotification error:', error);
        });
    } else {
      localNotif.deleteNotification(customerId, id);
      return Promise.resolve();
    }
  };

  const clearAll = () => {
    if (!customerId) return;
    
    if (isFirebaseConfigured) {
      // ✅ FIXED: Use getDocs instead of onSnapshot to prevent listener leak
      const notificationsRef = collection(db, 'notifications', `user_${customerId}`, 'items');
      // FIX T2R2-H7 (HIGH): orderBy('timestamp') silently excludes legacy
      // docs. clearAll must remove ALL the customer's notifications,
      // including ones missing `timestamp`. See line 189.
      const q = query(notificationsRef, orderBy('createdAt', 'desc'));
      
      getDocs(q)
        .then((snapshot) => {
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          return batch.commit();
        })
        .then(() => {
        })
        .catch((error) => {
          console.error('❌ Firestore clearAll error:', error);
        });
    } else {
      localNotif.clearAllNotifications(customerId);
    }
  };

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  // FIX T2R2-H3 (HIGH): Memoize the adaption pass and the value object.
  // Without this, every render rebuilds the array (n items × every render)
  // and creates a new value object → all consumers re-render even when
  // nothing relevant changed.
  const adaptedNotifications = useMemo(
    () => notifications.map(adaptNotificationForUI),
    [notifications]
  );

  const value = useMemo<CustomerNotificationContextType>(
    () => ({
      notifications: adaptedNotifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
    }),
    [adaptedNotifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll]
  );

  return (
    <CustomerNotificationContext.Provider value={value}>
      {children}
    </CustomerNotificationContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useCustomerNotifications(): CustomerNotificationContextType {
  const context = useContext(CustomerNotificationContext);
  if (!context) {
    throw new Error('useCustomerNotifications must be used within CustomerNotificationProvider');
  }
  return context;
}

// Safe hook that returns null if provider not available
export function useCustomerNotificationsSafe(): CustomerNotificationContextType | null {
  return useContext(CustomerNotificationContext);
}