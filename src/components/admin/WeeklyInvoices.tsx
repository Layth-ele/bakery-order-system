import type { User } from '../../services/firebase/authService';
import type { AdminPage } from '../../config/adminNavigation';
import {Order} from '../../types'
import { toast } from 'sonner';
import {Download, DollarSign, Users, RefreshCw, FileText, Receipt, Calendar, Eye} from 'lucide-react'
import { SearchBar } from '../ui/SearchBar';
import { useScrollToTop } from "../../hooks/useScrollToTop";
import { usePaginatedOrders } from "../../hooks/usePaginatedOrders";
import { Pagination } from "../ui/pagination";
import { useState, useMemo, useCallback } from 'react';
import {
  calculateGlobalStats,
  filterOrdersByYear,
  filterOrdersByCustomer,
  searchOrders,
} from "../../services/invoicing/invoiceAggregationService";

// ✅ P1 OPTIMIZATION: Import TanStack Query cache hooks (eliminates ~420KB duplicate state)
import { useCachedProducts } from "../../hooks/useCachedProducts";
import { useCachedCategories } from "../../hooks/useCachedCategories";
import { useCachedCustomers } from "../../hooks/useCachedCustomers";
import { useCachedOrders } from "../../hooks/useCachedFirebase"; // ✅ Added for orders data
import { useModal } from "../../contexts/ModalContextNew"; // Modal context for consistent pattern
import { toDate } from "../../utils/timestampFormatting";

// ✅ MAR 17, 2026: Import export utilities for Excel/PDF downloads
import { exportOrderToExcel, downloadCSV } from "../../utils/excelExport";
import { downloadOrderPDF } from "../../utils/pdf";
import { displayOrderLabel, invoiceFilename } from '../../utils/displayId';
import { StatCard } from '../shared/StatCard';

interface WeeklyInvoicesProps {
  isActive: boolean;
  user: User;
  onLogout: () => void;
  onBack: () => void;
  setCurrentPage?: (page: AdminPage | string) => void;
}

export function WeeklyInvoices({
  isActive,
  user,
  onLogout,
  onBack,
  setCurrentPage,
}: WeeklyInvoicesProps): JSX.Element | null {
  // ✅ Get all orders from TanStack Query cache
  // FIX T2R5-H4 (HIGH): Was `useCachedOrders()` with default limitCount=100.
  // For a bakery with > 100 total orders, the slice silently dropped older
  // orders past the 100th newest — including completed ones that are the
  // very subject of this Weekly Invoices view. The result: admins searching
  // for old invoices saw an "empty" result without an error, and weekly
  // revenue totals undercounted historical weeks.
  //
  // Now passes 5000 as the limit. A bakery doing 50 weekly invoices for
  // 100 weeks (~2 years of history) is comfortably under this cap; if a
  // bakery exceeds it, the proper next step is to migrate this view to
  // Firestore-side filtering with pagination (no client-side slice needed).
  // Documented in the H4 fix comment so future scaling is on the radar.
  const { data: allOrders = [], refetch: refetchOrders } = useCachedOrders(true, 5000);
  
  // Extract admin info from user
  const adminEmail = user.email;
  const adminName = user.email;
  // ✅ Auto scroll to top when page loads
  useScrollToTop("smooth");

 // Use modal context for consistent pattern
  const { openModal } = useModal();

  // ✅ P1 OPTIMIZATION: Use TanStack Query cache instead of local state (eliminates ~420KB duplicate data)
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading, refetch: refetchCategories } = useCachedCategories();
  const { data: customers = [], isLoading: customersLoading, refetch: refetchCustomers } = useCachedCustomers();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | "all">(
    new Date().getFullYear()
  );
  const [selectedCustomer, setSelectedCustomer] = useState<string | "all">("all");
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // ✅ PHASE 1 FIX: Filter completed orders (status === 'completed' ONLY)
  // Removed legacy 'paid', 'complete', 'cancelled' checks
  // Business Rule: Only completed orders generate invoices
  const completedOrders = useMemo(
    () => allOrders.filter((order) => order.status === "completed"),
    [allOrders]
  );

  // ✅ PHASE 1 FIX: Apply filters using centralized service functions
  // Performance: useMemo prevents re-filtering on every render
  const filteredOrders = useMemo(() => {
    let filtered = completedOrders;

    // Apply year filter
    filtered = filterOrdersByYear(filtered, selectedYear);

    // Apply customer filter
    filtered = filterOrdersByCustomer(filtered, selectedCustomer);

    // Apply search filter
    filtered = searchOrders(filtered, searchQuery);

    return filtered;
  }, [completedOrders, selectedYear, selectedCustomer, searchQuery]);

  // ✅ PHASE 1 FIX: Sort by completion date (newest first)
  // Uses completedAt (primary) or fallback to createdAt
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const dateA = toDate(a.completedAt || a.createdAt)?.getTime() ?? 0;
      const dateB = toDate(b.completedAt || b.createdAt)?.getTime() ?? 0;
      return dateB - dateA;
    });
  }, [filteredOrders]);

  // Year options (current year and 3 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
  ];

  // Get unique customers from completed orders
  const customersWithCompletedOrders = useMemo(
    () =>
      customers.filter((customer) =>
        completedOrders.some((order) => order.customerId === customer.id)
      ),
    [customers, completedOrders]
  );

 // Excel download handler
  const handleDownloadExcel = (order: Order) => {
    try {
      const csv = exportOrderToExcel(order, products, categories);
      // ✅ PASS 6: exportOrderToExcel returns Blob | undefined. Guard.
      if (!csv) {
        toast.error('Order has no items to export', { duration: 3000 });
        return;
      }
      downloadCSV(
        csv,
        invoiceFilename(order, order.customerName, 'csv')
      );
      toast.success('Invoice downloaded as Excel', { duration: 3000 });
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel', { duration: 3000 });
    }
  };

 // PDF download handler
  const handleDownloadPDF = (order: Order) => {
    try {
      downloadOrderPDF(order, products, categories);
      toast.success('Invoice PDF generated', { duration: 3000 });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF', { duration: 3000 });
    }
  };

  const handleViewInvoice = (order: Order) => {
    openModal('COMPLETED_ORDER_INVOICE', {
      order,
      products,
      categories,
      onDownloadExcel: handleDownloadExcel,
      onDownloadPDF: handleDownloadPDF,
    });
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchOrders(), refetchProducts(), refetchCategories(), refetchCustomers()]);
      toast.success('Invoices refreshed', { duration: 3000 });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchOrders, refetchProducts, refetchCategories, refetchCustomers]);

  // ✅ PHASE 1 FIX: Calculate summary statistics using centralized service
  // Performance: useMemo prevents recalculation on every render
  const globalStats = useMemo(
    () => calculateGlobalStats(sortedOrders),
    [sortedOrders]
  );

  // ✅ Apply pagination to sorted orders
  const pagination = usePaginatedOrders(sortedOrders, 10);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm mb-4 sm:mb-6">
          {/* Top Section */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-6 border-b border-gray-200">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="icon-container-lg md:icon-container-xl flex-shrink-0 bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-2xl shadow-md flex items-center justify-center">
                <Download className="icon-lg md:icon-xl text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="heading-3 md:heading-2 font-bold text-[#8B6F47] leading-tight truncate">
                  Weekly Invoices
                </h1>
                <p className="body-xs text-neutral-500 truncate mt-0.5 hidden sm:block">
                  View all completed order invoices
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-[#D4A574]/10 border border-[#D4A574]/40 rounded-xl transition-all shadow-sm disabled:opacity-50 flex-shrink-0 active:scale-95"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className={`icon-md text-[#D4A574] transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="body-xs text-[#8B6F47] font-semibold hidden sm:inline whitespace-nowrap">Refresh</span>
            </button>
          </div>

          {/* Section Header Bar */}
          <div className="rounded-b-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                Invoice Overview
              </h2>
            </div>
          </div>
        </div>

        {/* Info Banner - Simplified */}
        <div className="bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB] border-2 border-[#2196F3] rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-white/80 p-2 rounded-lg flex-shrink-0">
              <FileText className="w-5 h-5 text-[#2196F3]" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1976D2] mb-2">Invoice System</h3>
              <ul className="text-sm text-gray-700 space-y-1">
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
          </div>
        </div>

        {/* Statistics Cards - Shared StatCard component */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
          <StatCard icon={FileText} label="Total Invoices" value={globalStats.totalOrders} color="tan" />
          <StatCard icon={DollarSign} label="Total Revenue" value={`$${globalStats.totalRevenue.toFixed(0)}`} color="green" />
          <StatCard icon={Receipt} label="Avg Order" value={`$${globalStats.averageOrderValue.toFixed(0)}`} color="blue" />
        </div>

        {/* ── Admin Search & Filter Bar ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* 1. Invoice / order-ID search — Admin variant */}
            <SearchBar
              placeholder="Search invoices, order ID, week…"
              value={searchQuery}
              onChange={setSearchQuery}
              variant="luxury"
              showClearButton
            />

            {/* 2. Year selector */}
            <select
              value={selectedYear}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedYear(e.target.value === "all" ? "all" : parseInt(e.target.value))
              }
              className="w-full px-3 py-2.5 border border-[#D4A574]/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50 focus:border-[#D4A574] bg-white text-gray-700 transition-colors"
            >
              <option value="all">All Years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            {/* 3. Customer type-ahead search — replaces plain <select> */}
            <div className="relative">
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4A574] pointer-events-none" />
                <input
                  type="text"
                  value={
                    selectedCustomer !== "all"
                      ? (customersWithCompletedOrders.find(c => c.id === selectedCustomer)?.storeName ||
                         customersWithCompletedOrders.find(c => c.id === selectedCustomer)?.contactPerson ||
                         customerSearch)
                      : customerSearch
                  }
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomer("all");
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                  placeholder="Search business name…"
                  className="w-full pl-9 pr-8 py-2.5 border border-[#D4A574]/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50 focus:border-[#D4A574] bg-white text-gray-700 placeholder-gray-400 transition-colors"
                />
                {(customerSearch || selectedCustomer !== "all") && (
                  <button
                    type="button"
                    onClick={() => { setCustomerSearch(''); setSelectedCustomer("all"); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#8B6F47] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Type-ahead dropdown */}
              {showCustomerDropdown && (
                <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#D4A574]/30 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                  <li>
                    <button
                      type="button"
                      onMouseDown={() => { setSelectedCustomer("all"); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedCustomer === "all" ? 'bg-[#D4A574]/10 text-[#8B6F47] font-semibold' : 'text-gray-600 hover:bg-[#D4A574]/5'}`}
                    >
                      All Customers ({customersWithCompletedOrders.length})
                    </button>
                  </li>
                  {customersWithCompletedOrders
                    .filter(c => {
                      const name = (c.storeName || c.contactPerson || '').toLowerCase();
                      return !customerSearch || name.includes(customerSearch.toLowerCase());
                    })
                    .sort((a, b) => (a.storeName || a.contactPerson || '').localeCompare(b.storeName || b.contactPerson || ''))
                    .map(customer => {
                      const name = customer.storeName || customer.contactPerson || '';
                      const orderCount = completedOrders.filter(o => o.customerId === customer.id).length;
                      return (
                        <li key={customer.id}>
                          <button
                            type="button"
                            onMouseDown={() => { setSelectedCustomer(customer.id); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors border-t border-gray-50 ${selectedCustomer === customer.id ? 'bg-[#D4A574]/10 text-[#8B6F47] font-semibold' : 'text-gray-700 hover:bg-[#D4A574]/5'}`}
                          >
                            <span className="truncate">{name}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{orderCount} order{orderCount !== 1 ? 's' : ''}</span>
                          </button>
                        </li>
                      );
                    })}
                  {customersWithCompletedOrders.filter(c => {
                    const name = (c.storeName || c.contactPerson || '').toLowerCase();
                    return !customerSearch || name.includes(customerSearch.toLowerCase());
                  }).length === 0 && customerSearch && (
                    <li className="px-4 py-3 text-sm text-gray-400 italic">No customers match "{customerSearch}"</li>
                  )}
                </ul>
              )}
            </div>

          </div>

          {/* Active filters summary */}
          {(searchQuery || selectedYear !== new Date().getFullYear() || selectedCustomer !== "all") && (
            <div className="mt-3 pt-3 border-t border-[#D4A574]/10 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Filters:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-[#D4A574]/10 text-[#8B6F47] text-xs px-2 py-1 rounded-full font-medium">
                  "{searchQuery}" <button onClick={() => setSearchQuery('')} className="ml-0.5 hover:text-red-500">×</button>
                </span>
              )}
              {selectedYear !== new Date().getFullYear() && (
                <span className="inline-flex items-center gap-1 bg-[#D4A574]/10 text-[#8B6F47] text-xs px-2 py-1 rounded-full font-medium">
                  {selectedYear === "all" ? "All Years" : selectedYear} <button onClick={() => setSelectedYear(new Date().getFullYear())} className="ml-0.5 hover:text-red-500">×</button>
                </span>
              )}
              {selectedCustomer !== "all" && (
                <span className="inline-flex items-center gap-1 bg-[#D4A574]/10 text-[#8B6F47] text-xs px-2 py-1 rounded-full font-medium">
                  {customersWithCompletedOrders.find(c => c.id === selectedCustomer)?.storeName || 'Customer'}
                  <button onClick={() => { setSelectedCustomer("all"); setCustomerSearch(''); }} className="ml-0.5 hover:text-red-500">×</button>
                </span>
              )}
              <button
                onClick={() => { setSearchQuery(''); setSelectedYear(new Date().getFullYear()); setSelectedCustomer("all"); setCustomerSearch(''); }}
                className="text-xs text-red-500 hover:text-red-700 ml-auto font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Invoices List */}
        <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden">
          <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              Completed Orders ({sortedOrders.length})
            </h2>
          </div>

          <div className="p-6">
            {sortedOrders.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">
                  No completed orders found
                </p>
                <p className="text-gray-400 text-sm">
                  {searchQuery || selectedYear !== "all" || selectedCustomer !== "all"
                    ? "Try adjusting your filters"
                    : "Invoices will appear here once orders are completed"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pagination.paginatedOrders.map((order) => {
                  const customer = customers.find((c) => c.id === order.customerId);

                  return (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-[#D4A574] hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Order Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-[#8B6F47] text-lg">
                              {displayOrderLabel(order)}
                            </h3>
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                              COMPLETED
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span>{customer?.storeName || customer?.contactPerson || order.customerName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span>{order.weekRange}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold text-[#8B6F47]">
                                ${order.total?.toFixed(2) || "0.00"}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Completed:{" "}
                            {order.completedAt
                              ? (toDate(order.completedAt)?.toLocaleDateString() ?? 'N/A')
                              : "N/A"}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewInvoice(order)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#8B6F47] hover:bg-[#6B5437] text-white rounded-lg transition-colors shadow-sm"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-sm font-medium">View Invoice</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ✅ Pagination UI */}
          {pagination.totalPages > 1 && (
            <div className="px-6 pb-6">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                onPageChange={pagination.handlePageChange}
                itemLabel="invoices"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}