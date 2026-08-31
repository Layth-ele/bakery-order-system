/**
 * Customer Unpaid Orders Page
 * ✅ REFACTORED Feb 9, 2026
 * ✅ FIXED Feb 16, 2026 - Removed React Router, fixed imports
 * ✅ BALANCE FIX Feb 17, 2026 - Shows ALL approved orders (payment timing fix)
 * ✅ BALANCE FIX Mar 17, 2026 - Show ALL approved orders until admin confirms payment
 * 
 * FIXES APPLIED:
 * 1. ✅ Removed inline aggregation logic → uses invoiceAggregationService
 * 2. ✅ Performance optimized (all calculations memoized)
 * 3. ✅ Single source of truth (no duplicate logic)
 * 4. ✅ Centralized unpaid row selector (same as AdminUnpaidOrders)
 * 5. ✅ Safety checks removed (handled in service layer)
 * 6. ✅ Balance timing fix - Shows ALL approved orders until admin confirms payment
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { CreditCard, AlertTriangle, FileText, Eye } from 'lucide-react';
import { User } from '../../hooks/useAuth';
import { Order } from '../../types';
import { useModal } from '../../contexts/ModalContextNew';
import { getUnpaidRows, UnpaidRow } from '../../utils/payments/unpaidSelectors';
import { useCachedSettings } from '../../hooks/useCachedFirebase';
import { toast } from 'sonner';
import { UnifiedOrderList, ActionButtonSection } from '../order/UnifiedOrderList';
import { CustomerPageLayout, StatCard } from './CustomerPageLayout';
import { useCachedOrders } from '../../hooks/useCachedFirebase';
import { useCachedProducts } from '../../hooks/useCachedProducts';
import { useCachedCategories } from '../../hooks/useCachedCategories';
import { toDate } from '../../utils/timestampFormatting';
import { logger } from '../../utils/logger';


const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

interface CustomerUnpaidOrdersProps {
  user: User;
  onNavigateBack: () => void;
}

export function CustomerUnpaidOrders({ user, onNavigateBack }: CustomerUnpaidOrdersProps): JSX.Element | null {
  const { openModal } = useModal();

  // ============================================
  // STEP 2: Performance - Load data
  // ============================================
  const { data: allOrders = [], isLoading: ordersLoading, refetch } = useCachedOrders(true);
  
  // ✅ P1 OPTIMIZATION: Use TanStack Query cache instead of local state (eliminates duplicate data)
  const { data: products = [], isLoading: productsLoading } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCachedCategories();

  const [isRefreshing, setIsRefreshing] = useState(false);
  
 // Load bakery email from settings
  const { data: cachedSettings } = useCachedSettings();
  const bakeryEmail = cachedSettings?.businessEmail || 'orders@example.com';

  // ✅ Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success('Unpaid orders refreshed', { duration: 3000 });
    } catch (error) {
      console.error('Error refreshing orders:', error);
      toast.error('Failed to refresh orders', { duration: 3000 });
    } finally {
      setIsRefreshing(false);
    }
  };

  // ============================================
  // STEP 2: Performance - Memoized selectors
  // ============================================
  const unpaidOrders = useMemo(() => {
 // CRITICAL FIX - Show ALL approved orders until admin confirms payment
    // Balance must remain visible even after customer submits payment proof
    // Balance only goes to $0 when admin confirms payment (status → 'in_process')
    // 
    // Includes:
    // - Orders with status="approved" AND paymentSubmitted=false (awaiting payment submission)
    //   → Badge shows: "💰 WAITING PAYMENT"
    // - Orders with status="approved" AND paymentSubmitted=true (payment under review)
    //   → Badge shows: "⏳ WAITING CONFIRM PAYMENT"
    // 
    // Excludes:
    // - Pending orders (status="pending" - appear in "Active Orders" tab)
    // - In-process orders (status="in_process" - payment confirmed by admin, balance cleared)
    // - Completed/cancelled orders
    
    // Use canonical unpaid selector - only show BASE unpaid orders
    const allUnpaidRows = getUnpaidRows(allOrders);
    
    // ✅ DEBUG: Log what we get from getUnpaidRows

    
    // Filter for base_order rows only (not adjustments)
    const baseUnpaidOrders = allUnpaidRows
      .filter((row): row is Extract<UnpaidRow, { kind: 'base_order' }> => row.kind === 'base_order')
      .map(row => row.order)
      // ✅ FIX: Filter by customerId OR customerEmail (support both data models)
      .filter(order => {
        const matchesId = order.customerId && order.customerId === user.id;
        const matchesEmail = order.customerEmail && order.customerEmail === user.email;
        return matchesId || matchesEmail;
      });
 // REMOVED paymentSubmitted filter
      // Show ALL approved orders until admin confirms payment
      // Customer needs to see their outstanding balance even after submitting payment proof
    
    return baseUnpaidOrders;
  }, [allOrders, user.id, user.email]);

  // ============================================
  // STEP 2: Performance - Stable filter state
  // ============================================
  // ✅ FEB 7, 2026 FIX: Removed paymentFilter - show ALL unpaid orders
  // Since there's no UI to change this filter, it should always show all
  // (The stats cards already break down by payment status)
  const [sortBy, setSortBy] = useState<'date' | 'week'>('date');

  // ============================================
  // STEP 2: Performance - Memoized filtered orders
  // ============================================
  const filteredOrders = useMemo(() => {
    if (DEBUG) logger.log('🔍 [CustomerUnpaidOrders] filteredOrders: Starting with', unpaidOrders.length, 'unpaid orders');
    
    let filtered = [...unpaidOrders];

    // ✅ REMOVED: Payment filter (no UI to control it)
    // All unpaid orders are shown (stats cards break down by status)

    // ✅ FEB 7, 2026 FIX: Safe sorting with Firebase timestamp compatibility
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = toDate(a.createdAt)?.getTime() ?? 0;
        const dateB = toDate(b.createdAt)?.getTime() ?? 0;
        return dateB - dateA;
      } else {
        // Sort by week (descending)
        if (a.week !== b.week) {
          return (b.week || 0) - (a.week || 0);
        }
        // If same week, sort by date
        const dateA = toDate(a.createdAt)?.getTime() ?? 0;
        const dateB = toDate(b.createdAt)?.getTime() ?? 0;
        return dateB - dateA;
      }
    });

    return filtered;
  }, [unpaidOrders, sortBy]);

  // ============================================
  // STEP 2: Performance - Stable callbacks
  // ============================================
 // Download functionality removed - customers use Active tab to download orders
  
  const safeRefetch = useCallback(() => {
    try {
      refetch();
    } catch (error) {
      console.error('Failed to refetch orders:', error);
    }
  }, [refetch]);

  const handlePaymentSubmission = useCallback(
    (order: Order) => {
      try {
        
        openModal('SUBMIT_PAYMENT', {
          order,
          products,
          categories,
          onPaymentSubmitted: () => {
            safeRefetch();
          },
        });
        
      } catch (error) {
        console.error('❌ [UNPAID ORDERS DEBUG] Error calling openModal:', error);
      }
    },
    [openModal, products, categories, safeRefetch]
  );

  // ✅ NEW: View unpaid order details modal
  const handleViewUnpaidOrder = useCallback(
    (order: Order) => {
      openModal('CUSTOMER_UNPAID_ORDER_DETAILS', {
        order,
        products,
        categories,
        onPayNow: handlePaymentSubmission, // ✅ Pass payment callback to enable PAY NOW button
      });
    },
    [openModal, products, categories, handlePaymentSubmission]
  );

  // Action buttons configuration
  // ✅ CUSTOMER RESTRICTION: Outstanding tab shows ONLY view modal & submit payment
  // ❌ NO EDIT - customers must use Active tab to edit
  // ❌ NO DOWNLOAD - customers must use Active tab to download
  const actionButtonSections: ActionButtonSection[] = [
    {
      title: 'Payment',
      buttons: [
        {
          label: 'SUBMIT PAYMENT',
          icon: CreditCard,
          variant: 'primary',
          onClick: (order) => handlePaymentSubmission(order),
          show: (order) => {
            // ✅ FEB 7, 2026 FIX: Payment should NOT depend on edit permission
            // Show payment button if payment not submitted and not already received
            // (Even if order is within 48h delivery window and can't be edited, customer still needs to pay)
            return !order.paymentSubmitted && !order.paymentReceived;
          },
        },
      ],
      layout: 'spread',
    },
    {
      title: 'Actions',
      buttons: [
        {
          label: 'Preview Invoice',
          icon: FileText,
          variant: 'view',
          onClick: (order) => {
            openModal('INVOICE_PREVIEW', {
              order,
              products,
              categories,
            });
          },
          tooltip: 'Preview invoice details before payment',
        },
        {
          label: 'View Details',
          icon: Eye,
          variant: 'primary',
          onClick: (order) => {
            handleViewUnpaidOrder(order);
          },
        },
      ],
      layout: 'spread',
    },
  ];

  // ============================================
  // STEP 3: Container & Layout Constraints
  // ============================================
  return (
    <CustomerPageLayout
      icon={CreditCard}
      title="Outstanding (Unpaid)"
      subtitle="Shows approved orders awaiting payment submission (WAITING PAYMENT badge)"
      sectionTitle="Outstanding Orders Overview"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <StatCard
          icon={CreditCard}
          label="Unpaid"
          value={unpaidOrders.length}
          color="red"
        />
        <StatCard
          icon={AlertTriangle}
          label="Total Orders"
          value={unpaidOrders.length}
          color="tan"
        />
      </div>

      {/* Payment Submission Policy — compact on mobile */}
      <div className="bg-gradient-to-r from-[#FFF8E7] to-[#FFF3D6] border border-[#D4A574]/60 rounded-xl p-3 sm:p-5 mb-4 sm:mb-6 shadow-sm">
        <div className="flex items-start gap-2 sm:gap-3">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A574] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-[#8B6F47] font-bold text-sm sm:text-base mb-2 sm:mb-3">
              Payment Submission Policy
            </h3>
            <div className="text-neutral-700 space-y-1.5 sm:space-y-2.5">
              <p className="text-xs sm:text-sm leading-relaxed">
                <strong className="text-[#F57C00]">📋 Pending:</strong> Awaiting admin approval — payment not available yet.
              </p>
              <p className="text-xs sm:text-sm leading-relaxed">
                <strong className="text-[#388E3C]">✅ Approved:</strong> Use "SUBMIT PAYMENT" button. To edit, go to the Active tab (48h rule applies).
              </p>
              <p className="text-xs sm:text-sm leading-relaxed">
                <strong className="text-[#333333]">💳 Payment:</strong> E-transfer or credit card.
              </p>
              <p className="text-xs sm:text-sm text-[#D32F2F] font-semibold leading-relaxed">
                ⚠️ After confirmation, order moves to production.{' '}
                <a href={`mailto:${bakeryEmail}`} className="underline hover:text-[#B71C1C] break-all">
                  {bakeryEmail}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List - Clean, no search bar */}
      <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden">
          <UnifiedOrderList
          orders={filteredOrders}
          products={products}
          categories={categories}
          statusFilter={'all'}
          pageTitle=""
          pageIcon={null}
          actionButtonSections={actionButtonSections}
          emptyStateMessage="No unpaid orders found"
          emptyStateIcon={<CreditCard className="w-12 h-12 text-neutral-600" />}
          emptyStateDescription="Orders will appear here when available"
          hideSearch={true}
          usePagination={true}
          sortOldestFirst={false}
          hideCustomerName={true}
          isAdmin={false}
          useCompactLayout={true}
        />
      </div>

      {/* Info Card */}
      <div className="mt-4 sm:mt-6 bg-white border border-[#D4A574]/30 rounded-xl p-3 sm:p-5 shadow-sm">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-xl shadow-sm">
            <CreditCard className="icon-sm text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-[#8B6F47] mb-1.5 sm:mb-2">About Outstanding Orders</h4>
            <ul className="text-[10px] sm:text-xs text-neutral-500 space-y-1 sm:space-y-1.5">
              <li>• <span className="text-[#EF4444] font-bold">WAITING PAYMENT:</span> Approved orders — payment not yet submitted</li>
              <li>• <span className="text-[#F57C00] font-medium">Pending / Under Review / Confirmed</span> orders appear in the Active tab</li>
              <li>• After submitting payment, order moves to Active Orders</li>
            </ul>
          </div>
        </div>
      </div>
    </CustomerPageLayout>
  );
}