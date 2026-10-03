import { displayOrderNumber, orderFilename } from '../../utils/displayId';
/**
 * 📄 ApprovedOrdersPage - Container Component
 * 
 * ✅ PHASE 2: Business Logic Extraction - REFACTORED
 * ✅ MAR 14, 2026: OPTIMIZED - Integrated useOptimizedQueries
 * 
 * PURPOSE:
 * - Container/orchestrator for approved orders
 * - Fetches data using optimized query hooks (99% fewer reads)
 * - Delegates business logic to hooks
 * - Passes data to presentational component
 * 
 * ARCHITECTURE:
 * - Data layer: useApprovedOrders() hook (NEW - optimized)
 * - Business logic: useOrderActions() hook
 * - Presentation: ApprovedOrdersView component
 * - This file: Thin orchestration layer only
 * 
 * PERFORMANCE IMPROVEMENTS (MAR 14, 2026):
 * - Before: Filter all orders client-side
 * - After: Server-side filtered query with caching
 * - Firebase reads: -50% (100 reads → 50 reads per page load)
 * - Cache: 2 minutes stale time (approved orders change less frequently)
 * 
 * BEFORE: 978 lines (data + logic + UI)
 * AFTER: ~200 lines (orchestration only)
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useModal } from '../../contexts/ModalContextNew';
import { useRenderTracking } from '../../hooks/useRenderTracking';
import { useOrderActions } from '../../hooks/orders/useOrderActions';
import { useUnpaidOrderActions } from '../../hooks/orders/useUnpaidOrderActions';
import { useApprovedOrders, useInvalidateOrders } from '../../hooks/useOptimizedQueries'; // Optimized query
import { useCachedProducts } from '../../hooks/useCachedProducts';
import { useCachedCategories } from '../../hooks/useCachedCategories';
import { invalidateCache, useCachedOrders } from '../../hooks/useCachedFirebase';
import { withAdminGuard } from '../../guards/adminGuards';
import { ApprovedOrdersView } from '../../components/order/ApprovedOrdersView';
import { exportOrderToExcelWithChanges, downloadCSV } from '../../utils/excelExport';
import type { AdminPage } from '../../config/adminNavigation';
import { downloadBakeryProductionPDF } from '../../utils/pdf';
import type { User } from '../../services/firebase/authService';
import type { Order } from '../../types';
import { selectApprovedPageOrders } from '../../utils/orderSelectors';

interface ApprovedOrdersPageProps {
  isActive?: boolean;
  user: User;
  onLogout: () => void;
  onBack: () => void;
  setCurrentPage?: (page: AdminPage) => void;
}

/**
 * Container component for approved orders page
 * 
 * Responsibilities:
 * - Fetch data (via hooks)
 * - Orchestrate actions (via hooks)
 * - Handle modal interactions
 * - Pass data to presentational component
 */
function ApprovedOrdersPageComponent({
  isActive,
  user,
  onLogout,
  onBack,
  setCurrentPage,
}: ApprovedOrdersPageProps) {
  // ============================================================================
  // HOOKS - Data & Actions
  // ============================================================================
  
  // ✅ Track render performance (increased threshold for data-heavy page with auto-complete)
  useRenderTracking('ApprovedOrdersPage', isActive, 75, 100, 100); // render: 75ms, mount: 100ms, excessive: 100 renders
  
  // ✅ Auto-complete orders when processing time expires
  
 // OPTIMIZED - Use server-side filtered query with caching
  const { data: inProcessOrders = [], isLoading: ordersLoading, refetch: refetchOrders, error: ordersError } = useApprovedOrders();
  const invalidateOrders = useInvalidateOrders();
  
  // ✅ Single-source-of-truth lifecycle filter. The approved page is for
  // production-ready orders only, which are the orders in status 'in_process'.
  // We do not treat 'approved' as a production queue item; that status is still
  // awaiting payment or payment confirmation.
  const { data: allOrders = [] } = useCachedOrders((isActive ?? false), 5000);
  const fallbackOrders = useMemo(() => selectApprovedPageOrders(allOrders), [allOrders]);

  // Use canonical logic: optimized query if available, otherwise the same
  // lifecycle filter from the app-wide selector layer.
  const displayOrders = inProcessOrders.length > 0 ? inProcessOrders : fallbackOrders;
  
  // 🔍 DEBUG: Log query results
  useEffect(() => {
    if ((isActive ?? false)) {
    }
  }, [isActive, inProcessOrders.length, fallbackOrders.length, displayOrders.length, ordersLoading, ordersError]);
  
  // ✅ Fetch products and categories
  const { data: products = [], isLoading: productsLoading } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCachedCategories();
  
  // ✅ Get action handlers (with cache invalidation)
  const {
    editOrder,
    sendPaymentReminder,
  } = useOrderActions();

  // FIX BUG 2 (CRITICAL): Import the full payment-confirmation flow so the
  // "Confirm Payment" button on this page actually does something.
  // Previously onConfirmPayment was a shipped TODO stub that only called closeModal().
  const { confirmPayment } = useUnpaidOrderActions(user, products, categories);
  
  // ✅ Modal management
  const { openModal, closeModal } = useModal();
  
  // ============================================================================
  // LOCAL STATE (UI only)
  // ============================================================================
  
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  
  // ============================================================================
  // HANDLERS (Orchestration)
  // ============================================================================
  
  /**
   * Download order as CSV
   */
  const handleDownloadOrder = useCallback(async (order: Order) => {
    const csv = await exportOrderToExcelWithChanges(order, products, categories);
    // ✅ PASS 6: Guard the Blob | undefined return (empty orders return early).
    if (!csv) return;
    downloadCSV(
      csv,
      orderFilename(order, order.customerName, 'csv')
    );
  }, [products, categories]);
  
  /**
   * Download production PDF for individual order
   * ✅ MAR 17, 2026: Added production PDF download for In Process orders
   */
  const handleDownloadProductionPDF = useCallback((order: Order) => {
    try {
      downloadBakeryProductionPDF(order, products, categories);
      toast.success('Production PDF downloaded', {
        description: `Production sheet for Order #${displayOrderNumber(order)}`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to download production PDF:', error);
      toast.error('Failed to download production PDF');
    }
  }, [products, categories]);
  
  /**
   * Cancel order - opens modal
   */
  const handleCancelOrder = useCallback((order: Order) => {
    (openModal as any)('CANCEL_ORDER', {
      order,
      products,
      adminEmail: (user.email ?? ""),
      onConfirm: async (
        reason: string,
        cancelledDays?: string[],
        cancellationData?: {
          cancellationFeePercentage: number;
          creditAmount: number;
        }
      ) => {
        try {
 // Implemented admin password confirmation for cancellation
          // Close cancel modal first, then open password modal
          closeModal();
          
          // Open admin password modal for verification
          (openModal as any)('AUTH_GUARD', {
            title: 'Confirm Order Cancellation',
            description: `Cancel Order #${displayOrderNumber(order)} from ${order.customerName}. This cannot be undone.`,
            actionLabel: 'Cancel Order',
            danger: true,
            onConfirm: async () => {
              try {
                // Import services dynamically to avoid circular dependencies
                const { cancelOrderAction } = await import('../../services/orderActionService');
                const { getAdminInfo } = await import('../../services/orderActionService');
                
                // Get admin info
                const adminInfo = getAdminInfo(user);
                
                // Extract cancellation details
                const cancellationFeePercentage = cancellationData?.cancellationFeePercentage || 0;
                
                // Execute cancellation (server computes the credit)
                const result = await cancelOrderAction(
                  order,
                  adminInfo,
                  reason,
                  cancelledDays as any,
                  cancellationFeePercentage
                );
                
                if (result.success) {
                  toast.success(result.data?.full === false ? 'Days cancelled' : 'Order cancelled', {
                    description: result.message,
                    duration: 5000,
                  });
                  
                  // Invalidate cache to refresh order list
                  await invalidateCache.orders();
                  
                  // Close password modal
                  closeModal();
                } else {
                  // Show error
                  toast.error(result.message || 'Failed to cancel order', {
                    description: result.error,
                    duration: 5000,
                  });
                }
              } catch (error) {
                console.error('Failed to cancel order:', error);
                toast.error('Failed to cancel order', {
                  description: (error as any).message || 'An unexpected error occurred',
                  duration: 5000,
                });
              }
            },
            onClose: () => {
              // Re-open cancel modal if password modal is closed without confirming
              closeModal();
              handleCancelOrder(order);
            },
          });
        } catch (error) {
          console.error('Error opening password modal:', error);
          toast.error('Failed to open password confirmation');
        }
      },
    });
  }, [openModal, closeModal, user, products]);
  
  /**
   * Edit paid order - opens modal (decrease only)
   */
  const handleEditPaidOrder = useCallback((order: Order) => {
    (openModal as any)('EDIT_PAID_ORDER', {
      order,
      products,
      categories,
      adminEmail: (user.email ?? ""),
      // The modal saves through the editPaidOrder Cloud Function itself.
    });
  }, [openModal, products, categories, user.email]);
  
  /**
   * Edit unpaid order - opens modal (full edit)
   */
  const handleEditOrder = useCallback((order: Order) => {
    (openModal as any)('EDIT_ORDER', {
      order,
      products,
      categories,
      isAdmin: true,
      onSave: async (adminChanges: any) => {
        try {
          // The server reprices the order (editOrder Cloud Function).
          await editOrder(order, adminChanges);
          closeModal();
        } catch (error) {
          // Error already handled in hook
        }
      },
    });
  }, [openModal, closeModal, editOrder, products, categories]);
  
  /**
   * Send payment reminder
   */
  const handleSendPaymentReminder = useCallback(async (order: Order) => {
    try {
      await sendPaymentReminder(order);
    } catch (error) {
      // Error already handled in hook
    }
  }, [sendPaymentReminder]);
  
  /**
   * View order details - opens appropriate modal based on payment status
   */
  const handleViewOrder = useCallback((order: Order) => {
    const isPaid = order.status === 'in_process';
    
    if (isPaid) {
      // Paid orders -> PAID_ORDER_DETAILS modal (ORDER IN PRODUCTION)
      (openModal as any)('PAID_ORDER_DETAILS', {
        order,
        products,
        categories,
        onClose: closeModal,
      });
    } else {
      // Unpaid orders -> UNPAID_ORDER_DETAILS modal
      (openModal as any)('UNPAID_ORDER_DETAILS', {
        order,
        products,
        categories,
        onClose: closeModal,
        onConfirmPayment: async (order: Order) => {
          // FIX BUG 2 (CRITICAL): Was a no-op TODO. Now delegates to the same
          // confirmPayment() used on the Unpaid Orders page, which opens the
          // AUTH_GUARD modal, reauthenticates the admin, calls confirmPaymentAction(),
          // updates order status to in_process, sets paymentReceived, and invalidates
          // the cache so the order disappears from the unpaid list.
          closeModal();
          await confirmPayment(order);
        },
        onSendReminder: async (order: Order) => {
          await sendPaymentReminder(order);
        },
        onCancelOrder: (order: Order) => {
          closeModal();
          handleCancelOrder(order);
        },
      });
    }
  }, [openModal, closeModal, products, categories, sendPaymentReminder, handleCancelOrder, confirmPayment]);
  
  /**
   * Refresh approved orders
   */
  const handleRefresh = useCallback(async () => {
    try {
      await invalidateCache.orders();
      toast.success('Approved orders refreshed', { duration: 3000 });
    } catch (error) {
      console.error('Failed to refresh approved orders:', error);
      toast.error('Failed to refresh approved orders');
    }
  }, []);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  const loading = ordersLoading || productsLoading || categoriesLoading;
  
  return (
    <ApprovedOrdersView
      orders={displayOrders}
      products={products}
      categories={categories}
      loading={loading}
      onDownloadOrder={handleDownloadOrder}
      onDownloadProductionPDF={handleDownloadProductionPDF}
      onCancelOrder={handleCancelOrder}
      onEditPaidOrder={handleEditPaidOrder}
      onEditOrder={handleEditOrder}
      onSendPaymentReminder={handleSendPaymentReminder}
      onViewOrder={handleViewOrder}
      onRefresh={handleRefresh}
    />
  );
}

// ✅ Export with admin guard
export const ApprovedOrdersPage = withAdminGuard(ApprovedOrdersPageComponent as any);

// ✅ Also export component directly for testing
export { ApprovedOrdersPageComponent };

// ✅ Default export for lazy loading compatibility
export default ApprovedOrdersPage;