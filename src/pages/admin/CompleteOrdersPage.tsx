/**
 * 📄 CompleteOrdersPage - Container Component
 * 
 * ✅ PHASE 2: Business Logic Extraction - REFACTORED
 * 
 * PURPOSE:
 * - Container/orchestrator for order history
 * - Fetches data using custom hooks
 * - Delegates filtering/statistics to hooks
 * - Passes data to presentational component
 * 
 * ARCHITECTURE:
 * - Data layer: useCompleteOrdersData() hook
 * - Business logic: Minimal (just view order & refresh)
 * - Presentation: CompleteOrdersView component
 * - This file: Thin orchestration layer only
 * 
 * BEFORE: 468 lines (data + filtering + stats + UI)
 * AFTER: ~150 lines (orchestration only)
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import type { AdminPage } from '../../config/adminNavigation';
import { toast } from 'sonner';
import { Eye } from 'lucide-react';
import { useModal } from '../../contexts/ModalContextNew';
import { useRenderTracking } from '../../hooks/useRenderTracking';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { useCachedProducts } from '../../hooks/useCachedProducts';
import { useCachedCategories } from '../../hooks/useCachedCategories';
import { invalidateCache } from '../../hooks/useCachedFirebase';
import { useCompleteOrdersData } from '../../hooks/orders/useCompleteOrdersData';
import { CompleteOrdersView } from '../../components/order/CompleteOrdersView';
import { backfillDeliveryDate } from '../../services/migrations/backfillDeliveryDate';
import type { User } from '../../services/firebase/authService';
import type { Order } from '../../types';
import type { ActionButtonSection } from '../../components/order/UnifiedOrderList';
import { displayOrderNumber } from '../../utils/displayId';
import { downloadOrderPDF as downloadCompleteOrderPDF } from '../../utils/pdf';

interface CompleteOrdersPageProps {
  isActive?: boolean;
  user: User;
  onLogout: () => void;
  onBack: () => void;
  setCurrentPage?: (page: AdminPage | string) => void;
}

/**
 * Container component for admin order history page
 * 
 * Responsibilities:
 * - Fetch data (via hooks)
 * - Handle view order action
 * - Handle refresh action
 * - Pass data to presentational component
 */
export function CompleteOrdersPage({
  isActive,
  user,
  onLogout,
  onBack,
  setCurrentPage,
}: CompleteOrdersPageProps): JSX.Element | null {
  // ============================================================================
  // HOOKS - Performance & Navigation
  // ============================================================================
  
  // ✅ Track render performance (increased thresholds for data-heavy history page)
  // CompleteOrdersPage handles ALL historical orders (completed, rejected, cancelled)
  // with complex multi-dimensional filtering (search, year, status, customer) and statistics
  // Render threshold: 150ms (complex filtering operations)
  // Mount threshold: 200ms (initial data loading + processing)
  // Excessive renders: 100 (multiple async data sources + filters + statistics)
  useRenderTracking('CompleteOrdersPage', isActive, 150, 200, 100);
  
  // ✅ Auto scroll to top when page loads
  useScrollToTop('smooth');
  
  // ============================================================================
  // HOOKS - Data
  // ============================================================================
  
  // ✅ Get complete orders data (filtering, statistics, etc.)
  const {
    filteredOrders,
    statistics,
    filters,
    setSearchQuery,
    setSelectedYear,
    setSelectedStatus,
    setSelectedCustomer,
    customersWithHistoricalOrders,
    yearOptions,
    loading: ordersLoading,
  } = useCompleteOrdersData((isActive ?? false));
  
  // ✅ Get products and categories
  const { data: products = [], isLoading: productsLoading } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCachedCategories();
  
  // ✅ Modal management
  const { openModal } = useModal();
  
  // ============================================================================
  // MIGRATIONS
  // ============================================================================
  
 // One-time migration to backfill deliveryDate for completed orders
  const migrationCompleted = useRef(false);
  
  useEffect(() => {
    if (migrationCompleted.current || !isActive || ordersLoading || filteredOrders.length === 0) {
      return;
    }
    
    (async () => {
      try {
        // Only backfill for completed orders missing deliveryDate
        const completedOrders = filteredOrders.filter(
          (order) => order.status === 'completed' && !order.deliveryDate
        );
        
        if (completedOrders.length > 0) {
          await backfillDeliveryDate(filteredOrders.filter(o => o.status === 'completed'));
          
          // Invalidate cache to reload with updated data
          await invalidateCache.orders();
        }
        
        migrationCompleted.current = true;
      } catch (error) {
        console.error('❌ [CompleteOrdersPage] Migration failed:', error);
        migrationCompleted.current = true; // Don't retry on every render
      }
    })();
  }, [isActive, ordersLoading, filteredOrders]);
  
  // ============================================================================
  // HANDLERS (Orchestration)
  // ============================================================================
  
  /**
   * Handle view order action
   * Opens different modals based on order status
   */
  const handleViewOrder = useCallback(
    (order: Order) => {
      // If order is cancelled, show toast notification instead of modal
      if (order.status === 'cancelled') {
 // Replaced modal with toast notification
        toast.success(`Order ${displayOrderNumber(order)} has been cancelled`, {
          description: order.cancellationReason ? `Reason: ${order.cancellationReason}` : 'The customer has been notified.',
          duration: 5000,
        });
      } else {
        // Show completed order invoice modal (unified with customer dashboard)
        openModal('COMPLETED_ORDER_INVOICE', {
          order,
          products,
          categories,
          onDownloadPDF: (o: any) => downloadCompleteOrderPDF(o, products, categories),
        });
      }
    },
    [openModal, products, categories]
  );
  
  /**
   * Refresh order history
   */
  const handleRefresh = useCallback(async () => {
    try {
      await invalidateCache.orders();
      toast.success('Order history refreshed', { duration: 3000 });
    } catch (error) {
      console.error('Failed to refresh order history:', error);
      toast.error('Failed to refresh order history');
    }
  }, []);
  
  // ============================================================================
  // ACTION BUTTONS
  // ============================================================================
  
  /**
   * Action buttons for UnifiedOrderList
   */
  const actionButtonSections = useMemo<ActionButtonSection[]>(
    () => [
      {
        buttons: [
          {
            label: 'VIEW',
            icon: Eye,
            variant: 'view',
            onClick: handleViewOrder,
          },
        ],
        layout: 'spread' as const,
      },
    ],
    [handleViewOrder]
  );
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  const loading = ordersLoading || productsLoading || categoriesLoading;
  
  return (
    <CompleteOrdersView
      orders={filteredOrders}
      products={products}
      categories={categories}
      statistics={statistics}
      searchQuery={filters.searchQuery}
      selectedYear={filters.selectedYear}
      selectedStatus={filters.selectedStatus}
      selectedCustomer={filters.selectedCustomer}
      customersWithHistoricalOrders={customersWithHistoricalOrders}
      yearOptions={yearOptions}
      actionButtonSections={actionButtonSections}
      loading={loading}
      onSearchChange={setSearchQuery}
      onYearChange={setSelectedYear}
      onStatusChange={setSelectedStatus}
      onCustomerChange={setSelectedCustomer}
      onRefresh={handleRefresh}
    />
  );
}

// ✅ Export component directly (no admin guard needed - handled by routing)
export default CompleteOrdersPage;