/**
 * Pending orders page container.
 */

import type { AdminPage } from '../../config/adminNavigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useModal } from '../../contexts/ModalContextNew';
import { useRenderTracking } from '../../hooks/useRenderTracking';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { usePendingOrderActions } from '../../hooks/orders/usePendingOrderActions';
import { useCachedActiveOrders, useCachedOrders } from '../../hooks/useCachedFirebase';
import { useCachedProducts } from '../../hooks/useCachedProducts';
import { useCachedCategories } from '../../hooks/useCachedCategories';
import { withAdminGuard } from '../../guards/adminGuards';
import { PendingOrdersView } from '../../components/order/PendingOrdersView';
import { ToastNotification } from '../../components/ToastNotification';
import { canExportInvoiceDocument, selectPendingOrderGroups } from '../../utils/orderSelectors';
// FIX T2R2-H8 (HIGH): Was `getAllCustomers` from the service layer,
// called inside a useEffect that re-ran every isActive flip. Each tab
// activation triggered a fresh Firestore read of the entire customers
// collection. Now uses `useCachedCustomers` which shares one cached
// query across all consumers via TanStack Query.
import { useCachedCustomers } from '../../hooks/useCachedFirebase';
import { exportOrderToExcel, downloadCSV } from '../../utils/excelExport';
import { downloadOrderPDF, downloadBakeryProductionPDF } from '../../utils/pdf';
import { displayOrderNumber, orderFilename } from '../../utils/displayId';
import type { User } from '../../services/firebase/authService';
import type { Order } from '../../types'

interface PendingOrdersPageProps {
  isActive?: boolean;
  user: User;
  onLogout: () => void;
  onBack: () => void;
  setCurrentPage?: (page: AdminPage) => void;
}

/**
 * Container component for pending orders page
 * 
 * Responsibilities:
 * - Fetch data (via hooks)
 * - Orchestrate actions (via hooks)
 * - Handle modal interactions
 * - Pass data to presentational component
 */
function PendingOrdersPageComponent({
  isActive,
  user,
  onLogout,
  onBack,
  setCurrentPage,
}: PendingOrdersPageProps) {
  // ============================================================================
  // HOOKS - Performance & Navigation
  // ============================================================================
  
  // ✅ Track render performance
  // Custom thresholds for data-heavy admin page with multiple async data sources
  // (orders, products, categories, registrations)
  useRenderTracking('PendingOrdersPage', isActive, 100, 200, 100);
  
  // ✅ Auto scroll to top when page loads
  useScrollToTop('smooth');
  
  // ============================================================================
  // HOOKS - Data & Actions
  // ============================================================================
  
  // FIX T2R2-C8 (CRITICAL — performance/cost): Was useCachedOrders (full collection)
  // then client-side filter. For 5,000 orders that meant transferring all 5,000
  // to display ~10 pending. The "TEMP FIX" comment confirmed this was meant to be
  // replaced. useCachedActiveOrders does server-side `where('status','in',['pending','approved','in_process'])`
  // — narrow query, no transfer waste.
  const { data: activeOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useCachedActiveOrders((isActive ?? false));

  // FIX: The active-order query intentionally excludes terminal/rejected records,
  // so the page must derive pending/update-requested/rejected groups from the
  // full order set rather than from the active subset. This preserves all valid
  // queues without making the page look empty for legitimate update-requested orders.
  const { data: allOrders = [] } = useCachedOrders((isActive ?? false));
  const { pendingOrders, updateRequestedOrders, rejectedOrders } = useMemo(
    () => selectPendingOrderGroups(allOrders),
    [allOrders]
  );

  // Combine loading states
  const loading = ordersLoading || false;
  
  // ✅ Fetch products and categories
  const { data: products = [], isLoading: productsLoading } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCachedCategories();
  
  // ✅ Get action handlers (with cache invalidation)
  const {
    approveOrder,
    rejectOrder,
    editOrder,
    notification,
    clearNotification,
  } = usePendingOrderActions(user);
  
  // ✅ Modal management
  const { openModal, closeModal } = useModal();
  
  // ============================================================================
  // LOCAL STATE (UI only)
  // ============================================================================
  // FIX T2R2-H8 (HIGH): Was a useEffect that called `getAllCustomers()`
  // every time `isActive` changed. Now uses the shared cached hook —
  // one Firestore read across all admin pages, deduplicated and reused.
  // The pending count is derived synchronously from the cached data via
  // useMemo, so it updates in real time as customer subscriptions arrive
  // (no stale count after admin approves a registration).
  // ============================================================================
  const { data: cachedCustomers = [] } = useCachedCustomers(isActive ?? false);
  const registrationsCount = useMemo(
    () => cachedCustomers.filter((c) => c.status === 'pending').length,
    [cachedCustomers]
  );
  
  // ============================================================================
  // HANDLERS (Orchestration)
  // ============================================================================
  
  /**
   * Download order as Excel/CSV
   */
  const handleDownloadExcel = useCallback((order: Order) => {
    if (!canExportInvoiceDocument(order)) {
      toast.error('Invoice export is only available for completed paid orders', { duration: 3000 });
      return;
    }

    const csv = exportOrderToExcel(order, products, categories);
    // ✅ PASS 6: Guard Blob | undefined return.
    if (!csv) return;
    downloadCSV(csv, orderFilename(order, order.customerName, 'csv'));
  }, [products, categories]);

  /**
   * Download order invoice as PDF
   */
  const handleDownloadPDF = useCallback((order: Order) => {
    if (!canExportInvoiceDocument(order)) {
      toast.error('Invoice PDF is only available for completed paid orders', { duration: 3000 });
      return;
    }

    try {
      downloadOrderPDF(order, products, categories);
      toast.success('Invoice PDF downloaded', {
        description: `Invoice for ${displayOrderNumber(order)}`,
        duration: 3000,
      });
    } catch (error) {
      toast.error('Failed to download PDF');
    }
  }, [products, categories]);

  /**
   * Download bakery production sheet PDF
   */
  const handleDownloadBakeryPDF = useCallback((order: Order) => {
    try {
      downloadBakeryProductionPDF(order, products, categories);
      toast.success('Production sheet downloaded', {
        description: `Production PDF for ${displayOrderNumber(order)}`,
        duration: 3000,
      });
    } catch (error) {
      toast.error('Failed to download production PDF');
    }
  }, [products, categories]);

  /**
   * Approve order - opens confirmation modal
   */
  const handleApprove = useCallback(
    (order: Order) => {
      (openModal as any)('CONFIRM_APPROVE_ORDER', {
        order,
        deliveryFee: order.deliveryFee || 0,
        onConfirm: async (confirmedDeliveryFee: number) => {
          try {
            await approveOrder(order, confirmedDeliveryFee);
            // Modal closes itself on success
          } catch (error) {
            // Error already handled in hook
          }
        },
        onReviewDetails: () => {
          // Open order details modal
          (openModal as any)('ADMIN_ORDER_VIEW', {
            order,
            products,
            categories,
            onApprove: async (orderId: string) => {
              // Close the details modal first
              closeModal(); // Close ADMIN_ORDER_VIEW
              
              // Open the CONFIRM_APPROVE_ORDER modal for confirmation
              (openModal as any)('CONFIRM_APPROVE_ORDER', {
                order,
                deliveryFee: order.deliveryFee || 0,
                onConfirm: async (confirmedDeliveryFee: number) => {
                  try {
                    await approveOrder(order, confirmedDeliveryFee);
                    closeModal(); // Close CONFIRM_APPROVE_ORDER
                  } catch (error) {
                    // Error already handled in hook
                  }
                },
                onReviewDetails: undefined, // Prevent nested modals
                onClose: closeModal,
              });
            },
            onReject: async (orderId: string) => {
              // Close details modal, open reject modal
              closeModal();
              (openModal as any)('REJECT_ORDER', {
                order,
                products,
                adminEmail: (user.email ?? ""),
                onConfirm: async (reason: string) => {
                  try {
                    await rejectOrder(order, reason);
                    closeModal(); // Close REJECT_ORDER
                    closeModal(); // Close CONFIRM_APPROVE_ORDER (if still open)
                  } catch (error) {
                    // Error already handled in hook
                  }
                },
                onClose: closeModal,
              });
            },
            onDownloadExcel: () => handleDownloadExcel(order),
            onDownloadPDF: () => handleDownloadPDF(order),
            onDownloadBakeryPDF: () => handleDownloadBakeryPDF(order),
            onClose: closeModal,
          });
        },
      });
    },
    [
      openModal,
      closeModal,
      approveOrder,
      rejectOrder,
      products,
      categories,
      (user.email ?? ""),
    ]
  );
  
  /**
   * Reject order - opens rejection modal
   */
  const handleReject = useCallback(
    (order: Order) => {
      (openModal as any)('REJECT_ORDER', {
        order,
        products,
        adminEmail: (user.email ?? ""),
        onConfirm: async (reason: string) => {
          try {
            await rejectOrder(order, reason);
            closeModal();
          } catch (error) {
            // Error already handled in hook
          }
        },
      });
    },
    [openModal, closeModal, rejectOrder, user.email]
  );
  
  /**
   * Edit order - opens edit modal
   */
  const handleEditOrder = useCallback(
    (order: Order) => {
      (openModal as any)('EDIT_ORDER', {
        order,
        products,
        categories,
        isAdmin: true,
        onSave: async (adminChanges: any) => {
          try {
            // ✅ Convert editedItems Record<productId, DayQtys> → OrderItem[]
            // editedItems from EditOrderPage is a map keyed by productId
            // editOrder expects updatedItems as an array
            const editedMap: Record<string, any> = adminChanges.editedItems || {};
            const updatedItems = Object.entries(editedMap).map(([productId, qtys]: [string, any]) => {
              // Look up product name + price from original order items
              const originalItem = order.items?.find(i => i.productId === productId);
              const total = (qtys.monday || 0) + (qtys.tuesday || 0) + (qtys.wednesday || 0) +
                           (qtys.thursday || 0) + (qtys.friday || 0) + (qtys.saturday || 0) + (qtys.sunday || 0);
              return {
                productId,
                productName: qtys.productName || originalItem?.productName || '',
                price: qtys.price ?? originalItem?.price ?? 0,
                monday: qtys.monday || 0,
                tuesday: qtys.tuesday || 0,
                wednesday: qtys.wednesday || 0,
                thursday: qtys.thursday || 0,
                friday: qtys.friday || 0,
                saturday: qtys.saturday || 0,
                sunday: qtys.sunday || 0,
                total,
              };
            });
            
            // Build the correct EditOrderData shape
            const orderData = {
              updatedItems,
              updatedTotal: adminChanges.total,
              deliveryFee: adminChanges.deliveryFee,
              discount: adminChanges.discount,
              discountNote: adminChanges.discountNote || '',
              discountType: adminChanges.discountType,
            };
            
            await editOrder(order, orderData);
            closeModal();
          } catch (error: any) {
            console.error('Failed to save order:', error);
          }
        },
      });
    },
    [openModal, closeModal, editOrder, approveOrder, products, categories]
  );
  
  /**
   * View order details - opens admin order view modal with approval flow
   */
  const handleViewOrder = useCallback(
    (order: Order) => {
      (openModal as any)('ADMIN_ORDER_VIEW', {
        order,
        products,
        categories,
        onApprove: async (orderId: string) => {
          // Close the details modal first
          closeModal(); // Close ADMIN_ORDER_VIEW
          
          // Open the CONFIRM_APPROVE_ORDER modal for confirmation
          (openModal as any)('CONFIRM_APPROVE_ORDER', {
            order,
            deliveryFee: order.deliveryFee || 0,
            onConfirm: async (confirmedDeliveryFee: number) => {
              try {
                await approveOrder(order, confirmedDeliveryFee);
                closeModal(); // Close CONFIRM_APPROVE_ORDER
              } catch (error) {
                // Error already handled in hook
              }
            },
            onReviewDetails: undefined, // Prevent nested modals
            onClose: closeModal,
          });
        },
        onReject: async (orderId: string) => {
          // Close details modal, open reject modal
          closeModal();
          (openModal as any)('REJECT_ORDER', {
            order,
            adminEmail: (user.email ?? ""),
            onConfirm: async (reason: string) => {
              try {
                await rejectOrder(order, reason);
                closeModal(); // Close REJECT_ORDER
              } catch (error) {
                // Error already handled in hook
              }
            },
            onClose: closeModal,
          });
        },
        onDownloadExcel: () => handleDownloadExcel(order),
        onDownloadPDF: () => handleDownloadPDF(order),
        onDownloadBakeryPDF: () => handleDownloadBakeryPDF(order),
        onClose: closeModal,
      });
    },
    [openModal, closeModal, approveOrder, rejectOrder, products, categories, user.email, handleDownloadExcel, handleDownloadPDF, handleDownloadBakeryPDF]
  );
  
  /**
   * Navigate to registrations page
   */
  const handleNavigateToRegistrations = useCallback(() => {
    if (setCurrentPage) {
      setCurrentPage('registrations');
    }
  }, [setCurrentPage]);
  
  /**
   * Refresh pending orders
   */
  const handleRefresh = useCallback(async () => {
    try {
      await refetchOrders();
      toast.success('Pending orders refreshed', { duration: 3000 });
    } catch (error) {
      console.error('Failed to refresh pending orders:', error);
      toast.error('Failed to refresh pending orders');
    }
  }, [refetchOrders]);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  const combinedLoading = ordersLoading || productsLoading || categoriesLoading;
  
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
      <PendingOrdersView
        pendingOrders={pendingOrders}
        updateRequestedOrders={updateRequestedOrders}
        rejectedOrders={rejectedOrders}
        products={products}
        categories={categories}
        loading={combinedLoading}
        registrationsCount={registrationsCount}
        onApproveOrder={handleApprove}
        onRejectOrder={handleReject}
        onEditOrder={handleEditOrder}
        onViewOrder={handleViewOrder}
        onNavigateToRegistrations={handleNavigateToRegistrations}
        onRefresh={handleRefresh}
      />
    </>
  );
}

// ✅ Export with admin guard
export const PendingOrdersPage = withAdminGuard(PendingOrdersPageComponent as any);

// ✅ Also export component directly for testing
export { PendingOrdersPageComponent };