/**
 * AdminDashboard.tsx
 * 🟡 ROUTE PAGE - Main admin dashboard with order management
 *
 * ✅ PHASE 2: Admin Pages Standardization - REFACTORED (March 8, 2026)
 *
 * BEFORE: 566 lines (orchestration layer with mixed concerns)
 * AFTER:  ~150 lines (thin orchestration layer only)
 *
 * ARCHITECTURE (Data-Logic-View Pattern):
 * - Data Layer: useAdminDashboardData() hook
 * - Navigation Logic: useAdminDashboardNavigation() hook  
 * - Business Logic: useAdminNotificationHandlers(), useOrderActionHandlers()
 * - Presentation: AdminDashboardView component
 * - This file: Thin orchestration layer only
 *
 * EXTRACTED MODULES:
 * - useAdminDashboardData() - Data fetching and aggregation
 * - useAdminDashboardNavigation() - Navigation logic and keyboard shortcuts
 * - AdminDashboardView - Pure presentation layer
 * 
 * PREVIOUS REFACTORING (February 16, 2026):
 * - AdminTopBar, AdminSidebar, AdminPageRenderer components
 * - AdminOrderDetailsModal
 * - useAdminNotificationHandlers, useOrderActionHandlers hooks
 */

import { useEffect } from 'react';
import { User } from '../../hooks/useAuth';
import { withAdminGuard } from '../../guards/adminGuards';
import { invalidateCache } from '../../hooks/useCachedFirebase';
import { useAdminNotificationHandlers } from '../../hooks/useAdminNotificationHandlers';
import { useOrderActionHandlers } from '../../hooks/useOrderActionHandlers';
import { useAdminDashboardData } from '../../hooks/admin/useAdminDashboardData';
import { useAdminDashboardNavigation } from '../../hooks/admin/useAdminDashboardNavigation';
import { AdminDashboardView } from '../../components/admin/AdminDashboardView';
import type { AdminPage } from '../../config/adminNavigation';
import { isFirebaseConfigured } from '../../firebase/config';
import { logger } from '../../utils/logger';


const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

interface AdminDashboardProps {
  isActive?: boolean;
  user: User;
  onLogout: () => void;
  setCurrentPage: (page: AdminPage) => void;
  currentPage: AdminPage; // ✅ FIXED: Changed from string to AdminPage type
  onBack: () => void;
}

function AdminDashboardComponent({
  isActive,
  user,
  onLogout,
  setCurrentPage,
  currentPage = 'pending',
}: AdminDashboardProps) {
  if (DEBUG) logger.log('AdminDashboard currentPage:', currentPage);

  // ============================================================================
  // DATA LAYER - Fetch all dashboard data
  // ============================================================================

  const {
    allOrders,
    allCustomers,
    products,
    categories,
    settings,
    ordersLoading,
    customersLoading,
    productsLoading,
    categoriesLoading,
    settingsLoading,
    pendingOrders,
    approvedUnpaidOrders,
    inProcessOrders,
    pendingRegistrations,
    inProcessCount,
    unpaidOrdersCount,
    badgeCounts,
    invalidateProducts,
    invalidateCategories,
  } = useAdminDashboardData({ isActive: isActive ?? false, user });

  // ============================================================================
  // BUSINESS LOGIC - Notification and order action handlers
  // ============================================================================

  const {
    notification,
    showNotification,
    clearNotification,
    handleConfirmPaymentFromNotification,
  } = useAdminNotificationHandlers({ user, allOrders });

  const {
    selectedOrder,
    setSelectedOrder,
    isEditMode,
    editedItems,
    setEditedItems,
    editedDeliveryFee,
    setEditedDeliveryFee,
    isSendingEmail,
    handleApprove,
    completeApprovalHandler,
    completeUpdateApprovalHandler,
    handleReject,
    handleEditOrder,
    handleCancelEdit,
    updateItemQuantity,
    handleSaveOrder,
    toggleServiceChargeWaived,
    handleSaveDeliveryFee,
    handleDownloadOrder,
  } = useOrderActionHandlers({
    user,
    allOrders,
    products,
    categories,
    showNotification,
  });

  // ============================================================================
  // NAVIGATION LOGIC - Page navigation and keyboard shortcuts
  // ============================================================================

  const {
    sidebarOpen,
    showKeyboardShortcuts,
    setSidebarOpen,
    setShowKeyboardShortcuts,
    handlePageChange,
    getBadgeCount,
  } = useAdminDashboardNavigation({
    isActive: isActive ?? false,
    currentPage,
    setCurrentPage,
    badgeCounts,
    onShowNotification: showNotification,
    selectedOrder,
    setSelectedOrder,
  });

  // ============================================================================
  // ============================================================================

  useEffect(() => {
    if (!isActive) return;
 // In Firebase mode, cache invalidation is handled by Firestore
    if (isFirebaseConfigured) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bakery_orders' && e.newValue !== e.oldValue) {
        invalidateCache.orders();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isActive]);

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (productsLoading || categoriesLoading) {
    return (
      <div className="page">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A574] mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Loading products and categories...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PRESENTATION LAYER - Delegate to view component
  // ============================================================================

  return (
    <AdminDashboardView
      isActive={isActive ?? false}
      currentPage={currentPage}
      user={user}
      allOrders={allOrders}
      sidebarOpen={sidebarOpen}
      showKeyboardShortcuts={showKeyboardShortcuts}
      notification={notification}
      onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      onCloseSidebar={() => setSidebarOpen(false)}
      onPageChange={handlePageChange}
      onLogout={onLogout}
      getBadgeCount={getBadgeCount}
      setCurrentPage={setCurrentPage}
      onConfirmPayment={handleConfirmPaymentFromNotification}
      onClearNotification={clearNotification}
      onCloseKeyboardShortcuts={() => setShowKeyboardShortcuts(false)}
    />
  );
}

// ✅ Export with admin guard
export default withAdminGuard(AdminDashboardComponent as any);