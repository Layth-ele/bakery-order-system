/**
 * Unified Notification Provider
 * 
 * ✅ FEB 11, 2026: Role-based filtering moved from UI layer to provider layer
 * LOCATION: /notifications/contexts/ (Consolidated Feb 11, 2026)
 * 
 * Single provider that handles both admin and customer notifications.
 * Automatically selects the correct Firestore collection based on user role.
 * 
 * Benefits:
 * - Separation of concerns: Business logic in provider, not UI
 * - Single source of truth for notification logic
 * - Easier to test and maintain
 * - UI layer doesn't need to know about roles
 * 
 * Architecture:
 * - Admin: Listens to notifications/admin/items
 * - Customer: Listens to notifications/user_{customerId}/items
 * - No user: Returns empty state (graceful fallback)
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { 
  AdminNotificationProviderV3, 
  useAdminNotificationsSafe,
  CustomerNotificationProvider,
  useCustomerNotificationsSafe
} from './index'; // ✅ Updated path
import type { NotificationItem } from '@/types/notification-contract'; // ✅ Using alias import

interface UnifiedNotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void> | void;
  markAllAsRead: () => Promise<void> | void;
  deleteNotification: (notificationId: string) => Promise<void> | void;
  updateNotification?: (notificationId: string, updates: Partial<NotificationItem>) => Promise<void> | void;
  clearAllNotifications: () => Promise<void> | void;
  loading: boolean;
  userRole: 'admin' | 'customer' | null;
}

const UnifiedNotificationContext = createContext<UnifiedNotificationContextValue | null>(null);

interface User {
  id: string;
  role?: 'admin' | 'customer';
  customerType?: string;
}

interface UnifiedNotificationProviderProps {
  children: ReactNode;
  user: User | null;
}

/**
 * Internal component that bridges to the correct provider
 * This runs INSIDE the role-specific provider
 *
 * Note on T2R2-H2 (HIGH finding) re-examined and downgraded:
 * The original finding flagged "calls both useAdminNotificationsSafe AND
 * useCustomerNotificationsSafe regardless of role". On closer reading,
 * both *Safe hooks just call `useContext(...)` — a cheap read. They do
 * not subscribe; subscription happens inside each Provider's own
 * useEffect, and only the Provider for the active role is mounted (see
 * `UnifiedNotificationProvider` selection at line 116/127 below). So
 * the "unused hook" call is essentially free. Original HIGH severity was
 * an over-call — keeping the documentation here so the same finding
 * isn't re-raised by future audits.
 */
function NotificationBridge({ children, user }: { children: ReactNode; user: User | null }) {
  const role = user?.role || user?.customerType;
  
  // Get context from whichever provider is active
  const adminContext = useAdminNotificationsSafe();
  const customerContext = useCustomerNotificationsSafe();
  
  // Determine which context to use based on role
  const activeContext = role === 'admin' ? adminContext : customerContext;
  
  // Provide unified interface - with fallback for no user state
  const isAdminContext = user?.role === 'admin';
  const value: UnifiedNotificationContextValue = {
    notifications: (activeContext?.notifications as NotificationItem[]) || [],
    unreadCount: activeContext?.unreadCount || 0,
    markAsRead: activeContext?.markAsRead || (async () => {}),
    markAllAsRead: activeContext?.markAllAsRead || (async () => {}),
    deleteNotification: activeContext?.deleteNotification || (async () => {}),
    updateNotification: (activeContext as any)?.updateNotification || (async () => {}),
    clearAllNotifications:
      isAdminContext
        ? (activeContext as any)?.clearAllNotifications || (async () => {})
        : (activeContext as any)?.clearAll || (async () => {}),
    loading:
      isAdminContext
        ? (activeContext as any)?.loading || false
        : false,
    userRole: (role as 'admin' | 'customer') || null,
  };
  
  return (
    <UnifiedNotificationContext.Provider value={value}>
      {children}
    </UnifiedNotificationContext.Provider>
  );
}

/**
 * Unified Notification Provider
 * 
 * Automatically selects the correct notification provider based on user role.
 * UI components don't need to know about roles.
 * 
 * @example
 * ```tsx
 * <UnifiedNotificationProvider user={user}>
 *   <App />
 * </UnifiedNotificationProvider>
 * ```
 */
export function UnifiedNotificationProvider({ children, user }: UnifiedNotificationProviderProps): JSX.Element | null {
  const role = user?.role || user?.customerType;
  
  // ✅ BUSINESS LOGIC: Role-based provider selection (not in UI layer)
  
  // Admin: Use AdminNotificationProviderV3
  if (role === 'admin') {
    return (
      <AdminNotificationProviderV3>
        <NotificationBridge user={user}>
          {children}
        </NotificationBridge>
      </AdminNotificationProviderV3>
    );
  }
  
  // Customer: Use CustomerNotificationProvider
  if (role === 'customer' && user?.id) {
    return (
      <CustomerNotificationProvider customerId={user.id}>
        <NotificationBridge user={user}>
          {children}
        </NotificationBridge>
      </CustomerNotificationProvider>
    );
  }
  
  // No user or invalid state: Provide empty customer provider (graceful fallback)
  return (
    <NotificationBridge user={null}>
      {children}
    </NotificationBridge>
  );
}

/**
 * Hook to use unified notifications
 * 
 * Works for both admin and customer contexts automatically.
 * 
 * @example
 * ```tsx
 * const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
 * ```
 */
export function useNotifications() {
  const context = useContext(UnifiedNotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within UnifiedNotificationProvider');
  }
  return context;
}

/**
 * Safe hook that returns null if provider not available
 * 
 * @example
 * ```tsx
 * const notifications = useNotificationsSafe();
 * if (!notifications) return <div>Loading...</div>;
 * ```
 */
export function useNotificationsSafe() {
  return useContext(UnifiedNotificationContext);
}