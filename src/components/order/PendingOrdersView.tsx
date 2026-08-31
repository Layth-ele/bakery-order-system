/**
 * 🎨 PendingOrdersView - Presentational Component
 * 
 * ✅ PHASE 3: Migrated to AdminPageLayout (March 10, 2026)
 * 
 * CHANGES:
 * - Now uses AdminPageLayout for consistent structure
 * - Replaced 4 inline stat cards with StatCard component
 * - 100% design system compliance
 * - Matches all other admin pages
 * 
 * ✅ PHASE 2: Business Logic Extraction
 * ✅ PERFORMANCE OPTIMIZED (March 7, 2026)
 * 
 * PURPOSE:
 * - Pure presentational component for pending orders
 * - No business logic, no data fetching
 * - Receives data and callbacks via props
 * - Easy to test and maintain
 * 
 * ARCHITECTURE:
 * - Props in → JSX out
 * - All logic delegated to parent/hooks
 * - Reusable across different contexts
 * 
 * PERFORMANCE:
 * - React.memo to prevent unnecessary re-renders
 * - Static action buttons (not recreated per order)
 * - Optimized memoization dependencies
 */

import React, { useMemo } from 'react';
import { Clock, CheckCircle, XCircle, Edit2, RefreshCw, AlertCircle, Eye } from 'lucide-react';
import { UnifiedOrderList, ActionButtonSection } from './UnifiedOrderList';
import { AdminPageLayout } from '../admin/AdminPageLayout'; // ✅ PHASE 3: Import layout
import { StatCard } from '../shared/StatCard'; // ✅ PHASE 3: Import shared component
import type { Order, Product, Category } from '../../types';

export interface PendingOrdersViewProps {
  /** Pending orders to display */
  pendingOrders: Order[];
  
  /** Update requested orders to display */
  updateRequestedOrders: Order[];
  
  /** Rejected orders to display */
  rejectedOrders: Order[];
  
  /** Products for display/calculation */
  products: Product[];
  
  /** Categories for display */
  categories: Category[];
  
  /** Loading state */
  loading: boolean;
  
  /** Number of pending registrations */
  registrationsCount?: number;
  
  /** Approve an order */
  onApproveOrder: (order: Order) => void;
  
  /** Reject an order */
  onRejectOrder: (order: Order) => void;
  
  /** Edit an order */
  onEditOrder: (order: Order) => void;
  
  /** View order details */
  onViewOrder?: (order: Order) => void;
  
  /** Navigate to registrations page */
  onNavigateToRegistrations?: () => void;
  
  /** Refresh orders */
  onRefresh?: () => void;
}

/**
 * Presentational component for displaying pending orders
 * 
 * @example
 * ```typescript
 * <PendingOrdersView
 *   pendingOrders={pendingOrders}
 *   updateRequestedOrders={updateRequestedOrders}
 *   rejectedOrders={rejectedOrders}
 *   products={products}
 *   categories={categories}
 *   loading={loading}
 *   registrationsCount={5}
 *   onApproveOrder={handleApprove}
 *   onRejectOrder={handleReject}
 *   onEditOrder={handleEdit}
 *   onViewOrder={handleViewOrder}
 *   onNavigateToRegistrations={handleNavigateToRegistrations}
 *   onRefresh={handleRefresh}
 * />
 * ```
 */
function PendingOrdersViewComponent({
  pendingOrders,
  updateRequestedOrders,
  rejectedOrders,
  products,
  categories,
  loading,
  registrationsCount = 0,
  onApproveOrder,
  onRejectOrder,
  onEditOrder,
  onViewOrder,
  onNavigateToRegistrations,
  onRefresh,
}: PendingOrdersViewProps) {
  
  /**
   * ✅ PERFORMANCE FIX: Create static action button sections (not per order)
   * UnifiedOrderList will handle passing the correct order to callbacks
   */
  const pendingActionButtons = useMemo((): ActionButtonSection[] => {
    const buttons: ActionButtonSection[] = [
      {
        title: 'View',
        buttons: [
          {
            label: 'REVIEW & EDIT',
            onClick: onEditOrder, // Opens the order view/edit modal
            icon: Eye,
            variant: 'view' as const,
            tooltip: 'View and edit order details',
          },
        ],
      },
      {
        title: 'Approve/Reject',
        buttons: [
          {
            label: 'APPROVE',
            onClick: onApproveOrder,
            icon: CheckCircle,
            variant: 'primary' as const,
            tooltip: 'Approve this order',
          },
          {
            label: 'REJECT',
            onClick: onRejectOrder,
            icon: XCircle,
            variant: 'danger' as const,
            tooltip: 'Reject this order',
          },
        ],
      },
    ];
    
    // Add VIEW DETAILS button if onViewOrder is provided
    if (onViewOrder) {
      buttons[0].buttons.push({
        label: 'VIEW DETAILS',
        onClick: onViewOrder,
        icon: Eye,
        variant: 'secondary' as const,
        tooltip: 'View order details',
      });
    }
    
    return buttons;
  }, [onApproveOrder, onRejectOrder, onEditOrder, onViewOrder]);
  
  /**
   * ✅ PERFORMANCE FIX: Create static action button sections for update requested
   */
  const updateRequestedActionButtons = useMemo((): ActionButtonSection[] => {
    return [
      {
        title: 'Review',
        buttons: [
          {
            label: 'REVIEW CHANGES',
            onClick: onApproveOrder,
            icon: CheckCircle,
            variant: 'primary' as const,
            tooltip: 'Review requested changes',
          },
        ],
      },
    ];
  }, [onApproveOrder]);
  
  /**
   * ✅ PERFORMANCE FIX: Create static action button sections for rejected orders
   */
  const rejectedActionButtons = useMemo((): ActionButtonSection[] => {
    return [
      {
        title: 'View',
        buttons: [
          {
            label: 'VIEW DETAILS',
            onClick: () => {}, // View only
            icon: AlertCircle,
            variant: 'secondary' as const,
            tooltip: 'View rejection details',
          },
        ],
      },
    ];
  }, []);
  
  // ✅ Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="size-8 animate-spin text-gray-400" />
          <p className="text-gray-600">Loading pending orders...</p>
        </div>
      </div>
    );
  }
  
  const totalPendingCount = pendingOrders.length + updateRequestedOrders.length;
  
  return (
    <AdminPageLayout
      icon={Clock}
      title="Pending Orders"
      subtitle="Review and approve customer orders"
      sectionTitle="Pending Orders Overview"
      onRefresh={onRefresh}
    >
      {/* Statistics Cards - Using Shared StatCard Component */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
        {/* Total Orders */}
        <StatCard
          icon={Clock}
          label="Total Orders"
          value={totalPendingCount}
          color="tan"
        />

        {/* Pending */}
        <StatCard
          icon={Clock}
          label="Pending"
          value={pendingOrders.length}
          color="tan"
        />

        {/* Update Requested */}
        <StatCard
          icon={Edit2}
          label="Update Requested"
          value={updateRequestedOrders.length}
          color="orange"
        />

        {/* Rejected */}
        <StatCard
          icon={XCircle}
          label="Rejected"
          value={rejectedOrders.length}
          color="red"
        />
      </div>

      {/* Pending Registrations Alert */}
      {registrationsCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 leading-tight">
                {registrationsCount} pending registration{registrationsCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">Awaiting your approval</p>
            </div>
          </div>
          {onNavigateToRegistrations && (
            <button
              onClick={onNavigateToRegistrations}
              className="flex-shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            >
              Review
            </button>
          )}
        </div>
      )}
      
      {/* Pending Orders Section */}
      {pendingOrders.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden mb-6">
          <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              Pending Orders ({pendingOrders.length})
            </h2>
          </div>
          <div className="p-6">
            <UnifiedOrderList
              orders={pendingOrders}
              products={products}
              categories={categories}
              statusFilter="pending"
              actionButtonSections={pendingActionButtons}
              emptyStateMessage="No pending orders"
              emptyStateSubtext="New orders will appear here"
              emptyStateIcon={<Clock className="w-16 h-16 text-gray-300" />}
              hideSearch={true}
              enablePagination={false}
              sortOldestFirst={true}
              showHeader={false}
              useCompactLayout={true}
              hideCustomerName={false}
              isAdmin={true}
            />
          </div>
        </div>
      )}

      {/* Update Requested Orders Section */}
      {updateRequestedOrders.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-yellow-200 shadow-lg overflow-hidden mb-6">
          <div className="px-5 py-3.5 bg-gradient-to-r from-yellow-500 to-amber-500">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              Update Requested ({updateRequestedOrders.length})
            </h2>
          </div>
          <div className="p-6">
            <UnifiedOrderList
              orders={updateRequestedOrders}
              products={products}
              categories={categories}
              statusFilter="update_requested"
              actionButtonSections={updateRequestedActionButtons}
              emptyStateMessage="No update requests"
              emptyStateSubtext="Orders with requested updates will appear here"
              emptyStateIcon={<Edit2 className="w-16 h-16 text-gray-300" />}
              hideSearch={true}
              enablePagination={false}
              sortOldestFirst={true}
              showHeader={false}
              useCompactLayout={true}
              hideCustomerName={false}
              isAdmin={true}
            />
          </div>
        </div>
      )}

      {/* ❌ REMOVED: Rejected Orders Section - Should not appear on Pending Orders page */}

      {/* Empty State - No Orders */}
      {totalPendingCount === 0 && (
        <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg p-12 text-center">
          <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Pending Orders
          </h3>
          <p className="text-gray-500">
            New orders will appear here for review
          </p>
        </div>
      )}
    </AdminPageLayout>
  );
}

/**
 * ✅ PERFORMANCE: Wrap with React.memo to prevent unnecessary re-renders
 * Component will only re-render if props actually change
 */
export const PendingOrdersView = React.memo(PendingOrdersViewComponent);