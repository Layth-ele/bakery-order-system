import React, { useState, useMemo } from "react";
import {Order} from "../../types"
import { User } from "../../hooks/useAuth";
import { FileText, XCircle, DollarSign, Download, Eye, CheckCircle2 } from "lucide-react";
import { SearchBar } from "../ui/SearchBar";
// ✅ STEP 6: Use modal registry for all modals (eliminates duplicate systems)
import { useModal } from "../../contexts/ModalContextNew";
import { useCachedOrders } from "../../hooks/useCachedFirebase";
import { useCachedProducts } from "../../hooks/useCachedProducts";
import { useCachedCategories } from "../../hooks/useCachedCategories";
import { CustomerPageLayout, StatCard } from "./CustomerPageLayout";
import { UnifiedOrderList, ActionButtonSection } from "../order/UnifiedOrderList";
// ✅ PASS 3: excelExport intentionally NOT imported at the top — it pulls in
// xlsx-js-style (~750KB) which is only needed when the user clicks "Download".
// Loading it on demand keeps it out of the customer entry bundle.
import { toast } from 'sonner';
import { toDate } from "../../utils/timestampFormatting";
import { displayOrderNumber, invoiceFilename } from '../../utils/displayId';
import { canExportInvoiceDocument } from '../../utils/orderSelectors';

interface CustomerInvoicesProps {
  user: User;
  onNavigateBack?: () => void;
  isActive: boolean;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function CustomerInvoices({
  user,
  onNavigateBack,
  isActive,
}: CustomerInvoicesProps): JSX.Element | null {
  const { openModal } = useModal();
  const { data: allOrders = [] } = useCachedOrders(isActive);
  
  // ✅ P1 OPTIMIZATION: Use TanStack Query cache instead of local state (eliminates duplicate data)
  const { data: products = [], isLoading: productsLoading } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCachedCategories();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | "all">(new Date().getFullYear());
  
  // ✅ STEP 6: REMOVED - State for old direct modal rendering
  // const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  // const [showCompletedInvoiceModal, setShowCompletedInvoiceModal] = useState(false);
  // const [showCancelledOrderModal, setShowCancelledOrderModal] = useState(false);


  // Products and categories now come from TanStack Query cache hooks
  // No manual loading needed - hooks automatically fetch and cache data

  // Filter completed orders for this customer (only show orders placed by the customer themselves)
 // Filter by placedByCustomer flag to ensure customer only sees their own orders
  // This prevents admin-placed orders from showing in customer's "My Invoices"
  const completedOrders = useMemo(() => {
    const filtered = allOrders.filter((order) => {
      const matchesCustomerId = order.customerId === user.id;
      const matchesStatus = order.status === "completed" || order.status === "cancelled" || order.status === "rejected";
      
      // ✅ Only show orders placed by customer (not admin-placed orders)
      // If placedByCustomer is undefined (legacy orders), show them for backward compatibility
      const isCustomerPlaced = order.placedByCustomer !== false;
      
      return matchesCustomerId && matchesStatus && isCustomerPlaced;
    });
    
    return filtered;
  }, [allOrders, user.id]);

  // Apply search and year filters
  const filteredOrders = completedOrders.filter((order) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      order.id.toLowerCase().includes(searchLower) ||
      (order.orderNumber?.toLowerCase() || '').includes(searchLower) ||
      (order.invoiceNumber?.toLowerCase() || '').includes(searchLower) ||
      order.weekRange?.toLowerCase().includes(searchLower) ||
      order.customerName?.toLowerCase().includes(searchLower);

    // Year filter
    const orderYear = (toDate(order.createdAt) ?? new Date()).getFullYear();
    const matchesYear = selectedYear === "all" || orderYear === selectedYear;

    return matchesSearch && matchesYear;
  });

  // Sort by creation date (newest first)
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    return (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0);
  });

  // Year options (current year and 3 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const handleViewInvoice = (order: Order) => {
    // ✅ STEP 6: Use modal registry to open modals
    if (order.status === 'cancelled') {
 // Show toast notification instead of modal for cancelled orders
      toast.success(`Order ${displayOrderNumber(order)} has been cancelled`, {
        description: order.cancellationReason ? `Reason: ${order.cancellationReason}` : undefined,
        duration: 5000,
      });
    } else if (order.status === 'rejected') {
      // ✅ Rejected orders have their own modal
      openModal('REJECTED_ORDER_DETAILS', {
        order,
        products,
        categories,
      });
    } else {
      openModal('COMPLETED_ORDER_INVOICE', {
        order,
        products,
        categories,
        onDownloadExcel: () => handleDownloadOrder(order),
      });
    }
  };

  const handleDownloadOrder = async (order: Order) => {
    if (!canExportInvoiceDocument(order)) {
      toast.error('Invoice export is only available for completed paid orders', { duration: 3000 });
      return;
    }

    // ✅ PASS 3: Dynamic import keeps xlsx-js-style out of the customer entry chunk.
    const { exportOrderToExcel, downloadCSV } = await import("../../utils/excelExport");
    const csv = exportOrderToExcel(order, products, categories);
    if (csv) { downloadCSV(csv, invoiceFilename(order, order.customerName, 'csv')); }
  };

  const handleRefresh = () => {
    // Note: Products and categories are automatically managed by TanStack Query cache
    // This refresh is mainly for user feedback
    toast.success("Invoices refreshed", { duration: 3000 });
  };

  // Calculate stats
  const totalInvoices = sortedOrders.length;
  const totalCompleted = sortedOrders.filter(o => o.status === 'completed').length; // ✅ Removed legacy 'complete' check
  const totalCancelled = sortedOrders.filter(o => o.status === 'cancelled').length;
  const totalAmount = sortedOrders.reduce((sum, order) => sum + (order.total || 0), 0);

  // Action buttons for invoices
  const actionButtonSections: ActionButtonSection[] = [
    {
      buttons: [
        {
          label: 'View Invoice',
          icon: Eye,
          onClick: handleViewInvoice,
          variant: 'view',
        },
        {
          label: 'Download',
          icon: Download,
          onClick: handleDownloadOrder,
          variant: 'download',
        },
      ],
      layout: 'spread' as const,
    },
  ];

  return (
    <CustomerPageLayout
      icon={FileText}
      title="My Invoices"
      subtitle="View completed orders and final invoices"
      sectionTitle="Invoice Overview"
      onRefresh={handleRefresh}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <StatCard icon={FileText} label="Total Invoices" value={totalInvoices} color="tan" />
        <StatCard icon={CheckCircle2} label="Completed" value={totalCompleted} color="green" />
        <StatCard icon={XCircle} label="Cancelled" value={totalCancelled} color="red" />
        <StatCard icon={DollarSign} label="Total Value" value={`$${totalAmount.toFixed(0)}`} color="blue" />
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-400 rounded-lg p-3 sm:p-5 shadow-sm mb-3 sm:mb-5">
        <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Invoice Process
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>
              <strong>Final invoice created automatically</strong> when order is marked as
              complete
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>
              Orders are marked complete <strong>manually by admin</strong> or{" "}
              <strong>automatically</strong> when the order lifecycle ends
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>
              <strong>One invoice per order</strong> - simple order list and totals
            </span>
          </li>
        </ul>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#D4A574]/30 shadow-sm p-3 sm:p-5 mb-3 sm:mb-5">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <SearchBar
              placeholder="Search invoices, order ID, week…"
              value={searchQuery}
              onChange={setSearchQuery}
              variant="luxury"
              showClearButton
            />
          </div>

          {/* Year Filter */}
          <div className="sm:w-48">
            <select
              value={selectedYear}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedYear(
                  e.target.value === "all" ? "all" : parseInt(e.target.value)
                )
              }
              className="w-full px-3 py-2.5 border border-[#D4A574]/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50 focus:border-[#D4A574] bg-white text-gray-700 transition-colors"
            >
              <option value="all">All Years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden">
          <UnifiedOrderList
          orders={sortedOrders}
          products={products}
          categories={categories}
          statusFilter="all"
          pageTitle=""
          pageIcon={null}
          actionButtonSections={actionButtonSections}
          hideSearch={true}
          hideCustomerName={true}
          isAdmin={false}
          useCompactLayout={true}
          usePagination={true}
          emptyStateMessage="No completed orders yet"
          emptyStateDescription="Invoices will appear here once your orders are completed"
          emptyStateIcon={<FileText className="w-12 h-12 text-neutral-600" />}
        />
      </div>
    </CustomerPageLayout>
  );
}