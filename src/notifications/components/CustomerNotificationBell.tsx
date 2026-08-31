/**
 * Customer Notification Bell V7.0 - UNIFIED MODAL MAPPING SYSTEM
 * 
 * ✅ V7.0 FEB 12, 2026: UNIFIED WITH ADMIN ARCHITECTURE
 * - Uses useNotificationActions hook (same as admin)
 * - Uses getModalForNotification + resolveModalProps
 * - All 11 customer notification types properly wired
 * - Eliminates legacy hardcoded modal routing
 * 
 * ✅ V6.1 FEB 11, 2026: MOVED TO /notifications/components/
 * - Complete consolidation: all notification files in /notifications/
 * - Updated imports to reflect new subdirectory structure
 * 
 * ✅ V6.0 FEB 11, 2026: MOVED TO /notifications/ DIRECTORY
 * - Part of clean notification architecture
 * - All notification files in one place
 * - Updated imports to reflect new structure
 * 
 * Uses CustomerNotificationContextV3 (Firestore + Cloud Functions)
 * Displays notifications from: notifications/user_{customerId}/items
 * 
 * VERSION HISTORY:
 * - V7.0: Unified modal mapping system (same as admin)
 * - V6.1: Moved to /notifications/components/ (complete consolidation)
 * - V6.0: Moved to /notifications/ directory (clean architecture)
 * - V5.0: Refactored to use NotificationBellBase (DRY principle)
 */

import { memo, useCallback } from 'react';
import { useCustomerNotificationsSafe } from '../contexts'; // ✅ Import from contexts index
import { useNotificationActions } from '../hooks/notificationActions'; // ✅ NEW: Use unified actions hook
import { NotificationBellBase } from './NotificationBellBase';
import { useModal } from '@/contexts/ModalContextNew'; // ✅ Using alias import

interface CustomerNotificationBellProps {
  user?: any;
}

export const CustomerNotificationBell = memo(function CustomerNotificationBell({ 
  user
}: CustomerNotificationBellProps) {
  const context = useCustomerNotificationsSafe();
  const { openModal, modalStack } = useModal();
  
  // ✅ Early return with shared disabled component
  if (!context) {
    return <NotificationBellBase unreadCount={0} onClick={() => {}} ariaLabel="Notifications unavailable" disabled />;
  }
  
  const { unreadCount, markAsRead } = context;
  
  // ✅ NEW: Use unified notification actions (same as admin)
  const { openNotificationModal } = useNotificationActions({
    user,
    markAsRead: async (id: string) => {
      await markAsRead(id);
    }
  });
  
  // ✅ SIMPLIFIED: Just open the NOTIFICATIONS modal with unified handler
 // Added duplicate check to prevent warning
  const handleBellClick = useCallback(() => {
    // ✅ Check if modal is already open to prevent duplicate warning
    const isAlreadyOpen = modalStack.some(m => m.type === 'NOTIFICATIONS');
    if (isAlreadyOpen) {
      return;
    }
    
    
    openModal('NOTIFICATIONS', {
      onViewNotification: openNotificationModal, // ✅ Restored - powers all View buttons
      notifications: context.notifications,
      unreadCount: context.unreadCount,
      markAsRead: context.markAsRead,
      markAllAsRead: context.markAllAsRead,
      deleteNotification: context.deleteNotification,
    });
  }, [openModal, openNotificationModal, context, modalStack]);

  // ✅ Pure UI rendering delegated to shared component
  return (
    <NotificationBellBase
      unreadCount={unreadCount}
      onClick={handleBellClick}
      ariaLabel={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      iconColor="white" // ✅ Changed to white
    />
  );
});