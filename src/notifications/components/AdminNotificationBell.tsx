/**
 * Admin Notification Bell V9.0 - UNIFIED MODAL MAPPING SYSTEM
 * 
 * ✅ V9.0 FEB 12, 2026: UNIFIED WITH CUSTOMER ARCHITECTURE
 * - Uses unified notification modal system
 * - Passes onViewNotification to ADMIN_NOTIFICATIONS modal
 * - All notification types open correct modals
 * - Eliminates legacy action system
 * 
 * ✅ V8.1 FEB 11, 2026: MOVED TO /notifications/components/
 * - Complete consolidation: all notification files in /notifications/
 * - Updated imports to reflect new subdirectory structure
 * 
 * ✅ V8.0 FEB 11, 2026: MOVED TO /notifications/ DIRECTORY
 * - Part of clean notification architecture
 * - All notification files in one place
 * - Updated imports to reflect new structure
 * 
 * ✅ V7.0 FEB 11, 2026: THIN COMPONENT - Uses useNotificationActions hook
 * 
 * SINGLE RESPONSIBILITY OPTIMIZATION:
 * - BEFORE: Bell handled UI + state + routing + business logic (too many responsibilities)
 * - AFTER: Bell is a thin orchestrator that just wires things together
 * - Business logic moved to useNotificationActions hook (testable, reusable)
 * 
 * Responsibilities NOW:
 * - Get data from context (notifications, unreadCount)
 * - Get actions from hook (all business logic)
 * - Render UI (delegated to NotificationBellBase)
 * - Wire up the modal (one function call)
 * 
 * Benefits:
 * - Easy to test (mock hook, test UI separately)
 * - Easy to refactor (change logic in hook, not component)
 * - Single Responsibility Principle enforced
 * - Component is now ~60 lines instead of ~285 lines
 */

import { memo, useCallback } from 'react';
import { useAdminNotificationsSafe } from '../contexts'; // ✅ Import from contexts index
import { useModal } from '@/contexts/ModalContextNew'; // ✅ Using alias import
import { useNotificationActions } from '../hooks/notificationActions';
import { NotificationBellBase } from './NotificationBellBase';
import { logger } from '../../utils/logger';


interface AdminNotificationBellProps {
  user?: any;
  onConfirmPayment?: (order: any) => void;
  onApproveOrder?: (order: any) => void;
  onRejectOrder?: (order: any) => void;
  onLogout?: () => void;
}

export const AdminNotificationBell = memo(function AdminNotificationBell({ 
  user,
  onConfirmPayment: _onConfirmPayment,
}: AdminNotificationBellProps) {
  const context = useAdminNotificationsSafe();
  const { openModal, modalStack } = useModal();
  
  // ✅ Early return with shared disabled component
  if (!context) {
    return <NotificationBellBase unreadCount={0} onClick={() => {}} ariaLabel="Notifications unavailable" disabled />;
  }
  
  const { unreadCount, markAsRead } = context;
  logger.log('🔔 [AdminNotificationBell] Context:', { unreadCount, totalNotifications: context.notifications?.length });
  
  /**
   * ✅ NEW: Use unified notification actions (same as customer)
   * All business logic delegated to hook:
   * - Modal routing via mapping table
   * - Data hydration via resolver
   * - Smart redirects
   * - Error handling
   */
  const { openNotificationModal } = useNotificationActions({
    user,
    markAsRead: async (id: string) => {
      await markAsRead(id);
    }
  });
  
  /**
   * Handle bell click - Opens ADMIN_NOTIFICATIONS modal
   * ✅ MAR 8, 2026: Added duplicate check to prevent warning
   */
  const handleBellClick = useCallback(() => {
    // ✅ Check if modal is already open to prevent duplicate warning
    const isAlreadyOpen = modalStack.some(m => m.type === 'ADMIN_NOTIFICATIONS');
    if (isAlreadyOpen) {
      return;
    }
    
    
    openModal('ADMIN_NOTIFICATIONS', {
      onViewNotification: openNotificationModal, // ✅ Uses unified mapping system
 // Pass notification data to modal (modal rendered outside provider)
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
      ariaLabel={`Admin Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      iconColor="white" // ✅ Changed to white
    />
  );
});