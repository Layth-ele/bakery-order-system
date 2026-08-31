/**
 * Active Orders Page (Customer Dashboard)
 * 
 * ✅ FEB 10, 2026 REFACTOR: Full Active Orders Implementation
 * - 100% Customer Orders (no admin restrictions)
 * - Shows only IN_PROCESS orders for current customer
 * - Edit/Adjustment/Payment/Cancel actions available
 * - Integrated OrderLifecycleTimer for cutoff awareness
 * - Centralized service-based architecture
 * 
 * Business Rules:
 * - Customer sees ONLY their own orders (customerId filter)
 * - Orders in IN_PROCESS status only
 * - Cancel allowed BEFORE cutoff
 * - Edit allowed BEFORE cutoff
 * - Payment upload always allowed (drives state machine)
 * - Auto-refresh every 30 seconds
 */

import {useState, useEffect} from 'react'
import {Package, Eye, Edit2, XCircle, Clock, Upload, CheckCircle, AlertTriangle, Ban} from 'lucide-react'
import { useModal } from '../../contexts/ModalContextNew'; // ✅ FIX: Add missing import
import { useCachedOrders, useCachedCustomerOrders } from '../../hooks/useCachedFirebase';
import { OrderLifecycleTimer } from './OrderLifecycleTimer';
import { useCachedProducts } from '../../hooks/useCachedProducts';
import { useCachedCategories } from '../../hooks/useCachedCategories';
import { toast } from 'sonner';
import { canCustomerEditOrder, isPaymentPending } from '../../services/orders/orderEditRules';
// ✅ PASS 3: excelExport intentionally NOT imported at top — pulls in
// xlsx-js-style (~750KB), only needed when user clicks "Download CSV/Excel".
// Dynamic import below keeps it out of the customer entry bundle.
import { toDate } from '../../utils/timestampFormatting';
import { downloadOrderPDF } from '../../utils/pdf';
import { CustomerPageLayout, StatCard } from '../customer/CustomerPageLayout';
import { UnifiedOrderList, ActionButtonSection } from './UnifiedOrderList';
import { OrderUpdateSuccessModal } from '../modals/orders/OrderUpdateSuccessModal';
import type { User } from '../../hooks/useAuth';
import type {Order} from '../../types'
import { displayOrderNumber, orderFilename } from '../../utils/displayId';
// ✅ STEP 6: Use modal registry for all modals (eliminates duplicate systems)
// import { PendingOrderDetailsModal } from '../modals/orders/PendingOrderDetailsModal';

interface ActiveOrdersProps {
  user: User;
  onNavigateBack: () => void;
}

export function ActiveOrders({ user, onNavigateBack }: ActiveOrdersProps): JSX.Element | null {
  const { openModal, closeModal } = useModal();
  const { data: allOrders = [], isLoading: ordersLoading, refetch } = useCachedCustomerOrders(user.id);
  
  // ✅ P1 OPTIMIZATION: Use TanStack Query cache instead of local state (eliminates duplicate data)
  const { data: products = [], isLoading: productsLoading } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCachedCategories();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // ✅ STEP 6: REMOVED - State for old direct modal rendering
  // const [showPendingModal, setShowPendingModal] = useState(false);
  // const [selectedPendingOrder, setSelectedPendingOrder] = useState<Order | null>(null);
  // Products and categories now come from TanStack Query cache hooks
  // No manual loading needed - hooks automatically fetch and cache data
  
  useEffect(() => {
    // ✅ FIX: Force refetch orders when component mounts to get latest data
    refetch();
    // ❌ REMOVED: Credit balance loading - revisions feature removed
  }, [refetch, user.id]);

  // ✅ Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success('Active orders refreshed', { duration: 3000 });
    } catch (error) {
      console.error('Error refreshing orders:', error);
      toast.error('Failed to refresh orders', { duration: 3000 });
    } finally {
      setIsRefreshing(false);
    }
  };

  // ✅ CENTRALIZED: Use canCustomerEditOrder for all edit permission checks
  const canEdit = (order: Order): boolean => {
    const permission = canCustomerEditOrder(order);
    return permission.allowed;
  };

  // ✅ CENTRALIZED: Check if order has any editable delivery days (48h cutoff)
  const hasEditableDeliveryDays = (order: Order): boolean => {
    const permission = canCustomerEditOrder(order);
    // If allowed is true, it means at least one delivery day is editable
    // If allowed is false but allowedDeliveryDays exists and is not empty, some days are editable
    return permission.allowed || ((permission.allowedDeliveryDays?.length ?? 0) > 0);
  };

  // ✅ NEW: Check if order was rejected/cancelled within last 48 hours
  const isRecentlyTerminated = (order: Order): boolean => {
    if (order.status !== 'rejected' && order.status !== 'cancelled') return false;
    
    const terminatedAt = order.status === 'rejected' 
      ? order.rejectedAt 
      : order.cancelledAt;
    
    if (!terminatedAt) return false;
    
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    const terminatedDate = toDate(terminatedAt); 
    if (!terminatedDate) return false;
    const terminatedTime = terminatedDate.getTime();
    
    return terminatedTime > fortyEightHoursAgo;
  };

  // ✅ FILTER LOGIC:
  // - PENDING: Always show (awaiting admin approval) → Badge: "PENDING REVIEW"
  // - APPROVED (unpaid): REMOVED - No longer shown in Active Orders
  // - APPROVED (payment submitted): Always show (payment under review) → Badge: "WAITING CONFIRM PAYMENT"
  // - IN_PROCESS: Always show (order is in production) → Badge: "IN PRODUCTION"
  // - REJECTED: Show ONLY if within last 48h (UX improvement)
  // - CANCELLED: Show ONLY if within last 48h (UX improvement)
  // - COMPLETED: NEVER show (completed orders only appear in Order Invoices)
  const activeOrders = allOrders.filter(
    order => {
      // customerId filter not needed - useCachedCustomerOrders already filters by user.id
      
 // EXCLUDE approved orders without payment submission
      // Only show: pending, approved WITH payment, and in_process
      if (order.status === 'pending') {
        return true;
      }
      
      if (order.status === 'approved') {
        // ✅ ONLY show approved orders that have payment submitted
        return order.paymentSubmitted === true;
      }
      
      if (order.status === 'in_process') {
        return true;
      }
      
      // ✅ UX FIX: Show rejected/cancelled orders if within last 48h
      if (order.status === 'rejected' || order.status === 'cancelled') {
        return isRecentlyTerminated(order);
      }
      
      return false;
    }
  );



  const handleViewOrder = (order: Order) => {
    // ✅ STEP 6: Use modal registry for all modals (eliminates duplicate systems)
    if (order.status === 'pending') {
      // ✅ Use registry instead of direct import
      openModal('PENDING_ORDER_DETAILS', {
        order,
        products,
        categories,
        userRole: 'customer'
      });
    } else if (order.status === 'approved') {
      // ✅ FEB 10, 2026 FIX: Check if payment already submitted
      if (order.paymentSubmitted) {
        // Payment submitted, awaiting admin confirmation → Show payment in review modal
        openModal('PAYMENT_IN_REVIEW', {
          order,
          products,
          categories
        });
      } else {
        // Approved but no payment yet → Allow customer to submit payment
        openModal('SUBMIT_PAYMENT', {
          order,
          products,
          categories,
          onPaymentSubmitted: () => {
            refetch();
            toast.success('Payment submitted successfully', { duration: 3000 });
          }
        });
      }
    } else if (order.status === 'in_process') {
      // ✅ MAR 13, 2026 FIX: In-process orders → Show paid order details modal
      openModal('PAID_ORDER_DETAILS', {
        order,
        products,
        categories,
        onDownloadExcel: () => handleDownloadOrder(order),
        onDownloadPDF: () => downloadOrderPDF(order, products, categories),
      });
    } else if (order.status === 'completed') {
      // ✅ Completed orders with editable days → Use PaidOrderDetailsModal
      openModal('PAID_ORDER_DETAILS', {
        order,
        products,
        categories,
        onDownloadExcel: () => handleDownloadOrder(order),
        onDownloadPDF: () => downloadOrderPDF(order, products, categories),
      });
    } else if (order.status === 'rejected' || order.status === 'cancelled') {
      // ✅ MAR 13, 2026 FIX: Show rejected/cancelled orders in rejected order modal
      openModal('REJECTED_ORDER_DETAILS', {
        order,
        products,
        categories,
      });
    }
  };

  const handleDownloadOrder = async (order: Order) => {
    // ✅ PASS 3: Dynamic import to keep xlsx-js-style out of the entry bundle.
    const { exportOrderToExcel, downloadCSV } = await import('../../utils/excelExport');
    const csv = exportOrderToExcel(order, products, categories);
    if (csv) { downloadCSV(csv, orderFilename(order, order.customerName, 'csv')); }
  };

  const handleEditOrder = (order: Order) => {
    
    // Create a named callback function (not inline arrow function)
    const onSaveCallback = (result: any) => {
      
      // Close modal and refetch orders
      closeModal();
      refetch();
    };
    
    
    // ❌ REMOVED: UPDATE_PAID_ORDER modal - Feature disabled (dead code)
    // Customer order change requests are no longer supported
    // Show a helpful message instead
    toast.error(
      'Order changes are no longer supported after approval. ' +
      'Please contact support if you need to modify your order.',
      { duration: 5000 }
    );
  };

  // Define action buttons for active orders
  const actionButtonSections: ActionButtonSection[] = [
    {
      buttons: [
        {
          label: 'View',
          icon: Eye,
          onClick: handleViewOrder,
          variant: 'view',
        },
        {
          label: 'Edit',
          icon: Edit2,
          onClick: handleEditOrder,
          variant: 'edit',
          show: (order) => {
 // CUSTOMER - Can ONLY edit PENDING orders (before approval)
            // Once approved, customer CANNOT edit (only admin can)
            return order.status === 'pending';
          },
          disabled: (order) => {
            // Disable if payment pending
            return isPaymentPending(order);
          },
          tooltip: 'Edit order quantities',
        },
      ],
      layout: 'spread' as const,
    },
  ];

  return (
    <CustomerPageLayout
      icon={Package}
      title="Active Orders"
      subtitle="View your pending and approved orders"
      sectionTitle="Active Orders Overview"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Package}
          label="Total Active"
          value={activeOrders.length}
          color="tan"
        />
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={activeOrders.filter(o => o.status === 'pending').length}
          color="orange"
        />
        <StatCard
          icon={Upload}
          label="Payment Review"
          value={activeOrders.filter(o => o.status === 'approved' && o.paymentSubmitted).length}
          color="orange"
        />
        <StatCard
          icon={CheckCircle}
          label="In Production"
          value={activeOrders.filter(o => o.status === 'in_process').length}
          color="green"
        />
      </div>

      {/* ✅ UX IMPROVEMENT: Recently Terminated Orders Notice (48h visibility) */}
      {activeOrders.some(o => o.status === 'rejected' || o.status === 'cancelled') && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-5 shadow-sm">
          <div className="flex items-start gap-3">
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-800 font-bold text-sm sm:text-base mb-1.5 sm:mb-2">
                Recently Cancelled / Rejected Orders
              </h3>
              <div className="text-neutral-700 space-y-2">
                <p className="text-sm leading-relaxed">
                  The following orders have been{" "}
                  <strong className="text-red-700">cancelled or rejected</strong>:
                </p>
                <ul className="text-sm space-y-1.5 ml-4">
                  {activeOrders
                    .filter(o => o.status === 'rejected' || o.status === 'cancelled')
                    .map(order => (
                      <li key={order.id} className="flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span>
                          <strong>Order #{displayOrderNumber(order)}</strong> ({order.weekRange}) - 
                          <span className={order.status === 'rejected' ? 'text-red-700 font-semibold' : 'text-orange-700 font-semibold'}>
                            {' '}{order.status === 'rejected' ? 'REJECTED' : 'CANCELLED'}
                          </span>
                          {order.status === 'rejected' && order.rejectionReason && (
                            <span className="text-neutral-600 italic">
                              {' '}(Reason: {order.rejectionReason})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="text-xs text-neutral-600 mt-3 leading-relaxed">
                  ℹ️ These orders will be automatically removed from this view after <strong>48 hours</strong> and moved to "Order Invoices" for permanent record. 
                  For questions, please contact the bakery office.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Edit Policy */}
      <div className="bg-gradient-to-r from-[#FFF8E7] to-[#FFF3D6] border border-[#D4A574]/60 rounded-xl p-3 sm:p-5 mb-4 sm:mb-6 shadow-sm">
        <div className="flex items-start gap-2 sm:gap-3">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A574] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-[#8B6F47] font-bold text-sm sm:text-base mb-2 sm:mb-3">
              Order Edit Policy
            </h3>
            <div className="text-neutral-700 space-y-1.5 sm:space-y-2.5">
              <p className="text-sm leading-relaxed">
                <strong className="text-[#F57C00]">🔒 Edit Policy:</strong> Only <strong>PENDING orders</strong> can be edited. Once approved, the order is locked.
              </p>
              <p className="text-sm leading-relaxed">
                <strong className="text-[#388E3C]">Need Changes After Approval?</strong> Contact the bakery 
                directly by phone or email. Admin may be able to adjust quantities and issue credit if needed.
              </p>
              <p className="text-sm leading-relaxed">
                <strong className="text-[#D32F2F]">To cancel an order:</strong>{" "}
                Please contact the bakery office directly by phone or email. 
                Cancellation fees may apply if the order is cancelled less than 2 days before delivery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List - Clean, no search bar */}
      <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden">
        <UnifiedOrderList
          orders={activeOrders}
          products={products}
          categories={categories}
          statusFilter={'all'}
          pageTitle=""
          pageIcon={null}
          actionButtonSections={actionButtonSections}
          emptyStateMessage="No active orders"
          emptyStateIcon={<Package className="w-12 h-12 text-neutral-600" />}
          emptyStateDescription="Your pending and approved orders will appear here"
          hideSearch={true}
          usePagination={true}
          sortOldestFirst={false}
          hideCustomerName={true}
          isAdmin={false}
          useCompactLayout={true}
        />
      </div>

      {/* Info Card */}
      <div className="mt-4 sm:mt-6 bg-gradient-to-r from-[#3d3832]/95 to-[#2c2416]/95 rounded-lg border border-[#D4A574]/30 p-3 sm:p-5">
        <div className="flex items-start gap-3">
          <Package className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A574] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-[#D4A574] mb-1.5 sm:mb-2">About Active Orders</h4>
            <ul className="text-[10px] sm:text-xs text-neutral-400 space-y-1 sm:space-y-1.5">
              <li>• <span className="text-[#FFC107] font-medium">Pending Review:</span> Orders submitted but awaiting admin approval</li>
              <li>• <span className="text-[#FF9800] font-medium">Payment Review:</span> Payment submitted by you, awaiting admin verification</li>
              <li>• <span className="text-[#4CAF50] font-medium">In Production:</span> Payment confirmed - your order is being prepared!</li>
              <li>• <span className="text-neutral-500">Note:</span> Orders awaiting payment submission are not shown here - check your email for approval notifications</li>
              <li>• Completed orders appear in the "Order Invoices" tab for your records</li>
            </ul>
          </div>
        </div>
      </div>
      {/* Success Modal */}
      {showSuccessModal && (
        <OrderUpdateSuccessModal
          message={successMessage}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </CustomerPageLayout>
  );
}