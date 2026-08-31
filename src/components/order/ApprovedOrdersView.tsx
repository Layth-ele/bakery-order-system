/**
 * 🎨 ApprovedOrdersView - Presentational Component
 * 
 * ✅ PHASE 2: Business Logic Extraction
 * 
 * PURPOSE:
 * - Pure presentational component
 * - No business logic, no data fetching
 * - Receives data and callbacks via props
 * - Easy to test and maintain
 * 
 * ARCHITECTURE:
 * - Props in → JSX out
 * - All logic delegated to parent/hooks
 * - Reusable across different contexts
 */

import React, { useCallback } from 'react';
import { DollarSign, Edit2, Eye, Download, XCircle, RefreshCw, CheckCircle, Loader2, FileText } from 'lucide-react';
import { UnifiedOrderList, ActionButtonSection } from './UnifiedOrderList';
import { OrderLifecycleTimer } from './OrderLifecycleTimer';
import { toDate } from '../../utils/timestampFormatting';
import { AdminPageLayout } from '../admin/AdminPageLayout';
import type { Order, Product, Category } from '../../types';

export interface ApprovedOrdersViewProps {
  /** Orders to display (in_process status) */
  orders: Order[];
  
  /** Products for display/calculation */
  products: Product[];
  
  /** Categories for display */
  categories: Category[];
  
  /** Loading state */
  loading: boolean;
  
  /** Download order as CSV */
  onDownloadOrder: (order: Order) => void;
  
  /** Download production PDF */
  onDownloadProductionPDF?: (order: Order) => void;
  
  /** Cancel an order */
  onCancelOrder: (order: Order) => void;
  
  /** Edit a paid order */
  onEditPaidOrder: (order: Order) => void;
  
  /** Edit an unpaid order */
  onEditOrder: (order: Order) => void;
  
  /** Send payment reminder */
  onSendPaymentReminder: (order: Order) => void;
  
  /** View order details */
  onViewOrder?: (order: Order) => void;
  
  /** Refresh orders */
  onRefresh?: () => void;
}

/**
 * Presentational component for displaying approved/in-process orders
 * 
 * @example
 * ```typescript
 * <ApprovedOrdersView
 *   orders={inProcessOrders}
 *   products={products}
 *   categories={categories}
 *   loading={loading}
 *   onDownloadOrder={handleDownload}
 *   onCancelOrder={handleCancel}
 *   onEditPaidOrder={handleEditPaid}
 *   onEditOrder={handleEdit}
 *   onSendPaymentReminder={handleReminder}
 * />
 * ```
 */
export function ApprovedOrdersView({
  orders,
  products,
  categories,
  loading,
  onDownloadOrder,
  onDownloadProductionPDF,
  onCancelOrder,
  onEditPaidOrder,
  onEditOrder,
  onSendPaymentReminder,
  onViewOrder,
  onRefresh,
}: ApprovedOrdersViewProps): JSX.Element | null {
  
  /**
   * ✅ PERFORMANCE FIX: Create action button factory function
   * Instead of creating button configs for EVERY order upfront,
   * create them on-demand as needed by UnifiedOrderList
   */
  const getActionButtonSections = useCallback((order: Order): ActionButtonSection[] => {
 // FIXED - Check status instead of paymentStatus
    // Orders with status 'in_process' have confirmed payment and need decrease-only editing
    const isPaid = order.status === 'in_process';
    const sections: ActionButtonSection[] = [];
    
    // ✅ SECTION 1: View
    sections.push({
      title: 'View',
      buttons: [
        {
          label: 'VIEW',
          onClick: () => onViewOrder ? onViewOrder(order) : onEditOrder(order), // Fallback to edit if view not provided
          icon: Eye,
          variant: 'view' as const,
          tooltip: 'View order details',
        },
      ],
    });
    
    // ✅ SECTION 2: Download
    sections.push({
      title: 'Export',
      buttons: [
        {
          label: 'CSV',
          onClick: () => onDownloadOrder(order),
          icon: Download,
          variant: 'secondary' as const,
          tooltip: 'Download as CSV',
        },
        ...(onDownloadProductionPDF ? [
          {
            label: 'PDF',
            onClick: () => onDownloadProductionPDF(order),
            icon: FileText,
            variant: 'secondary' as const,
            tooltip: 'Download production PDF',
          },
        ] : []),
      ],
    });
    
    // ✅ SECTION 3: Edit Actions
    sections.push({
      title: 'Edit',
      buttons: [
        {
          label: 'Edit',
          onClick: () => (isPaid ? onEditPaidOrder(order) : onEditOrder(order)),
          icon: Edit2,
          variant: 'secondary' as const,
          tooltip: isPaid
            ? 'Can only decrease items (credit will be issued)'
            : 'Can add or remove items',
        },
      ],
    });
    
    // ✅ SECTION 4: Payment Reminder (only for unpaid orders)
    if (!isPaid) {
      const reminderCount = order.paymentReminderCount || 0;
      const lastReminderSent = order.lastReminderSentAt;
      
      sections.push({
        title: 'Payment',
        buttons: [
          {
            label: reminderCount > 0
              ? `Send Reminder (#${reminderCount + 1})`
              : 'Send Payment Reminder',
            onClick: () => onSendPaymentReminder(order),
            icon: DollarSign,
            variant: 'secondary' as const,
            tooltip: lastReminderSent
              ? `Last reminder sent: ${toDate(lastReminderSent)?.toLocaleDateString() ?? 'Unknown'}`
              : 'Send email reminder to customer',
          },
        ],
      });
    }
    
    // ✅ REMOVED: SECTION 5: Complete Order button - no longer needed
    
    // ✅ SECTION 6: Cancel (danger zone)
    sections.push({
      title: 'Danger Zone',
      buttons: [
        {
          label: 'Cancel',
          onClick: () => onCancelOrder(order),
          icon: XCircle,
          variant: 'danger' as const,
          tooltip: 'Cancel this order',
        },
      ],
    });
    
    return sections;
  }, [
    onDownloadOrder,
    onEditOrder,
    onEditPaidOrder,
    onSendPaymentReminder,
    onCancelOrder,
    onViewOrder,
    onDownloadProductionPDF,
  ]);
  
  /**
   * ✅ MOVED: Render lifecycle timer for each order card
   * Instead of displaying separately in header, integrate with order
   */
  const renderOrderExtra = useCallback((order: Order) => {
    return <OrderLifecycleTimer order={order} />;
  }, []);
  
  // ✅ Loading state — wrapped in AdminPageLayout for consistent header
  if (loading) {
    return (
      <AdminPageLayout
        icon={Loader2}
        title="In Process"
        subtitle="Approved orders currently being processed"
        sectionTitle="Approved Orders"
        onRefresh={onRefresh}
        isRefreshing={loading}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#D4A574]" />
            <p className="text-gray-500 text-sm">Loading approved orders...</p>
          </div>
        </div>
      </AdminPageLayout>
    );
  }

  // ✅ Empty state — wrapped in AdminPageLayout for consistent header
  if (orders.length === 0) {
    return (
      <AdminPageLayout
        icon={Loader2}
        title="In Process"
        subtitle="Approved orders currently being processed"
        sectionTitle="Approved Orders (0)"
        onRefresh={onRefresh}
        isRefreshing={false}
      >
        <div className="bg-white rounded-xl border border-[#D4A574]/25 shadow-sm p-6">
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Approved Orders</h3>
            <p className="text-gray-500">Approved orders in production will appear here</p>
          </div>
        </div>
      </AdminPageLayout>
    );
  }

  // ✅ Main content — wrapped in AdminPageLayout for consistent header
  return (
    <AdminPageLayout
      icon={Loader2}
      title="In Process"
      subtitle="Approved orders currently being processed"
      sectionTitle={`Approved Orders (${orders.length})`}
      onRefresh={onRefresh}
      isRefreshing={false}
    >
      <div className="bg-white rounded-xl border border-[#D4A574]/25 shadow-sm">
        <div className="p-6">
          <UnifiedOrderList
            orders={orders}
            products={products}
            categories={categories}
            statusFilter="approved"
            actionButtonSections={getActionButtonSections}
            emptyStateMessage="No approved orders"
            emptyStateSubtext="Orders in production will appear here"
            emptyStateIcon={<CheckCircle className="w-16 h-16 text-gray-300" />}
            hideSearch={false}
            enablePagination={false}
            sortOldestFirst={true}
            showHeader={false}
            useCompactLayout={true}
            hideCustomerName={false}
            isAdmin={true}
            renderOrderExtra={renderOrderExtra}
          />
        </div>
      </div>
    </AdminPageLayout>
  );
}