/**
 * 📄 AdminUnpaidOrdersPage - Container Component
 * 
 * ✅ PHASE 2: Business Logic Extraction - REFACTORED
 * 
 * PURPOSE:
 * - Container/orchestrator for unpaid orders
 * - Fetches data using custom hooks
 * - Delegates business logic to hooks
 * - Passes data to presentational component
 * 
 * ARCHITECTURE:
 * - Data layer: useOrdersData() hook + local filtering
 * - Business logic: useUnpaidOrderActions() hook
 * - Presentation: AdminUnpaidOrdersView component
 * - This file: Thin orchestration layer only
 * 
 * BEFORE: 421 lines (data + logic + UI)
 * AFTER: ~180 lines (orchestration only)
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import type { AdminPage } from '../../config/adminNavigation';
import { useModal } from '../../contexts/ModalContextNew';
import { useRenderTracking } from '../../hooks/useRenderTracking';
import { useCachedOrders, invalidateCache } from '../../hooks/useCachedFirebase';
import { useUnpaidOrderActions } from '../../hooks/orders/useUnpaidOrderActions';
import { useCachedProducts } from '../../hooks/useCachedProducts';
import { useCachedCategories } from '../../hooks/useCachedCategories';
import { AdminUnpaidOrdersView } from '../../components/order/AdminUnpaidOrdersView';
import { ToastNotification } from '../../components/ToastNotification';
import { toast } from 'sonner';
import type { User } from '../../services/firebase/authService';
import type { Order } from '../../types';
import { logger } from '../../utils/logger';
import { getUnpaidBaseOrders } from '../../utils/payments/unpaidSelectors';


interface AdminUnpaidOrdersPageProps {
  isActive?: boolean;
  user: User;
  onLogout: () => void;
  onBack: () => void;
  setCurrentPage?: (page: AdminPage | string) => void;
}

/**
 * Container component for admin unpaid orders page
 * 
 * Responsibilities:
 * - Fetch data (via hooks)
 * - Filter unpaid orders
 * - Orchestrate actions (via hooks)
 * - Handle modal interactions
 * - Pass data to presentational component
 */
export function AdminUnpaidOrdersPage({
  isActive,
  user,
  onLogout,
  onBack,
  setCurrentPage,
}: AdminUnpaidOrdersPageProps): JSX.Element | null {
  // ============================================================================
  // HOOKS - Performance & Navigation
  // ============================================================================
  
  // ✅ Track render performance (increased threshold for data-heavy page)
  // Parameters: componentName, enabled, renderThreshold, mountThreshold, excessiveRenderCount
 // Increased threshold to 100 for polling-based page with auto-refresh
  useRenderTracking('AdminUnpaidOrdersPage', isActive, 100, 200, 100);
  
  // ============================================================================
  // HOOKS - Data
  // ============================================================================
  
  // ✅ Fetch orders with auto-refresh polling
  // MAR 17, 2026: Added 30-second polling to catch payment submissions in real-time
  // This ensures admins see newly submitted payments without manual refresh
  const { data: allOrders = [], isLoading: ordersLoading } = useCachedOrders(
    isActive,
    5000,
    { refetchInterval: isActive ? 30000 : undefined } // Poll every 30 seconds when page is active
  );
  
  // ✅ Fetch products and categories
  const { data: products = [], isLoading: productsLoading } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCachedCategories();
  
  // ✅ PERFORMANCE FIX: Store products/categories in ref to avoid useCallback dependency
  const productsRef = useRef(products);
  const categoriesRef = useRef(categories);
  useEffect(() => {
    productsRef.current = products;
    categoriesRef.current = categories;
  }, [products, categories]);
  
  // ✅ CRITICAL FIX (MAR 17, 2026): Force-refresh orders the moment the admin opens
  // "Awaiting Payment". Without this, TanStack Query serves the 15-minute stale cache
  // and orders where the customer has just submitted payment still show "NOT PAID"
  // instead of "⏳ PAYMENT UNDER REVIEW", making them invisible to the admin.
  useEffect(() => {
    if (!(isActive ?? false)) return;
    invalidateCache.orders().catch((err) => {
      logger.warn('[AdminUnpaidOrdersPage] Failed to refresh orders on mount:', err);
    });
  }, [isActive]);

  // ✅ Use the canonical unpaid selector. This keeps the logic aligned across the app
  // and avoids dropping valid unpaid orders when the order list exceeds the default
  // 100-row fetch cap.
  const unpaidOrders = useMemo(() => {
    const filtered = getUnpaidBaseOrders(allOrders);

    // ✅ FIX (MAR 17, 2026): Sort so "paymentSubmitted" orders surface to the top.
    // These are the ones needing admin confirmation — admin should see them first.
    filtered.sort((a, b) => {
      const aSubmitted = !!(a as any).paymentSubmitted;
      const bSubmitted = !!(b as any).paymentSubmitted;
      if (aSubmitted && !bSubmitted) return -1;  // submitted → top
      if (!aSubmitted && bSubmitted) return 1;
      // Secondary sort: most recently submitted first
      const aTime = (a as any).paymentSubmittedAt?.seconds ?? 0;
      const bTime = (b as any).paymentSubmittedAt?.seconds ?? 0;
      return bTime - aTime;
    });

    return filtered;
  }, [allOrders]);
  
  // ============================================================================
  // HOOKS - Actions
  // ============================================================================
  
  // ✅ Get action handlers
  const {
    confirmPayment,
    sendReminder,
    cancelOrder,
    notification,
    clearNotification,
  } = useUnpaidOrderActions(user, products, categories);
  
  // ✅ Modal management
  const { openModal, closeModal } = useModal();
  
  // ============================================================================
  // HANDLERS (Orchestration)
  // ============================================================================
  
  /**
   * View order details - opens unpaid order details modal
   */
  const handleViewOrder = useCallback(
    (order: Order) => {
      // ✅ Wrap sendReminder to close modal first
      const handleSendReminderFromModal = async (orderToRemind: Order) => {
        closeModal(); // Close UNPAID_ORDER_DETAILS modal first
        await sendReminder(orderToRemind); // Then show alert modal
      };

      openModal('UNPAID_ORDER_DETAILS', {
        order,
        products: productsRef.current,
        categories: categoriesRef.current,
        onConfirmPayment: confirmPayment,
        onSendReminder: handleSendReminderFromModal,
        onCancelOrder: cancelOrder,
      });
    },
    [openModal, closeModal, confirmPayment, sendReminder, cancelOrder]
  );
  
  /**
   * Confirm payment - delegates to hook
   */
  const handleConfirmPayment = useCallback(
    async (order: Order) => {
      await confirmPayment(order);
      // ✅ Toast is now shown inside the hook after successful confirmation
    },
    [confirmPayment]
  );
  
  /**
   * Send reminder - delegates to hook
   */
  const handleSendReminder = useCallback(
    async (order: Order) => {
      await sendReminder(order);
    },
    [sendReminder]
  );
  
  /**
   * Cancel order - delegates to hook
   */
  const handleCancelOrder = useCallback(
    (order: Order) => {
      cancelOrder(order);
    },
    [cancelOrder]
  );
  
  /**
   * Refresh orders
   */
  const handleRefresh = useCallback(async () => {
    try {
      await invalidateCache.orders();
      toast.success('Orders refreshed', { duration: 3000 });
    } catch (error) {
      console.error('Failed to refresh orders:', error);
      toast.error('Failed to refresh orders');
    }
  }, []);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  const loading = ordersLoading || productsLoading || categoriesLoading;
  
  return (
    <>
      {/* Success Notification Toast */}
      {notification && (
        <ToastNotification
          message={notification}
          type="success"
          onClose={clearNotification}
        />
      )}
      
      {/* Main View */}
      <AdminUnpaidOrdersView
        unpaidOrders={unpaidOrders}
        products={products}
        categories={categories}
        loading={loading}
        onViewOrder={handleViewOrder}
        onConfirmPayment={handleConfirmPayment}
        onSendReminder={handleSendReminder}
        onCancelOrder={handleCancelOrder}
        onRefresh={handleRefresh}
      />
    </>
  );
}

// ✅ Export component directly (no admin guard needed - handled by routing)
export default AdminUnpaidOrdersPage;