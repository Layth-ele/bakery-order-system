import React, { useMemo, useCallback, useState, useDeferredValue, useEffect, useRef } from 'react';
import {Search, Filter, X} from 'lucide-react'
import { scrollToElement } from '../../utils/scrollUtils';
import { useTransitionTimeout } from '../../hooks/useTransitionTimeout';
import { usePagination, useUrlFilters } from '../../routes';
import { Pagination } from '../ui/pagination';
import type { Order, Product, Category } from '../../types';
import { toDate } from '../../utils/timestampFormatting';
import { SearchFiltersPanel } from '../SearchFiltersPanel';
import { OrderRow } from './OrderRow';

export interface ActionButton {
  label: string | ((order: Order) => string);
  icon: React.ComponentType<{ className?: string }> | ((order: Order) => React.ComponentType<{ className?: string }>);
  onClick: (order: Order) => void;
  variant: 'view' | 'download' | 'approve' | 'reject' | 'cancel' | 'complete' | 'upload' | 'primary' | 'secondary' | 'danger' | 'edit' | 'pending' | ((order: Order) => 'view' | 'download' | 'approve' | 'reject' | 'cancel' | 'complete' | 'upload' | 'primary' | 'secondary' | 'danger' | 'edit' | 'pending');
  show?: (order: Order) => boolean;
  disabled?: boolean | ((order: Order) => boolean);
  tooltip?: string | ((order: Order) => string);
}

export interface ActionButtonSection {
  title?: string;
  buttons: ActionButton[];
  layout?: 'spread' | 'center';
}

interface UnifiedOrderListProps {
  orders: Order[];
  products: Product[];
  categories: Category[];
  statusFilter: 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'update-requested' | 'update_requested';
  pageTitle?: string;
  pageIcon?: React.ReactNode;
  actionButtonSections: ActionButtonSection[] | ((order: Order) => ActionButtonSection[]);
  showApprovedBy?: boolean;
  showRejectedInfo?: boolean;
  showCancelledInfo?: boolean;
  showCompletedInfo?: boolean;
  showUpdateRequested?: boolean;
  emptyStateMessage?: string;
  emptyStateIcon?: React.ReactNode;
  hideSearch?: boolean;
  enableStatusFilter?: boolean;
  sortOldestFirst?: boolean;
  hideCustomerName?: boolean;
  isAdmin?: boolean;
  useCardLayout?: boolean;
  useCompactLayout?: boolean;
  emptyStateDescription?: string;
  showHeader?: boolean;
  renderOrderExtra?: (order: Order) => React.ReactNode;
  emptyStateSubtext?: string;
  onDeleteOrder?: (order: Order) => void;
  onDeleteItem?: (order: Order, itemId: string) => void;
  disableDelete?: boolean;
  highlightedOrderId?: string;
  allowItemDeletion?: boolean;
  showDate?: boolean;
  enablePagination?: boolean;
  usePagination?: boolean; // alias for enablePagination
}

// Extended order type with precomputed search data
interface OrderWithSearchData extends Order {
  searchString: string;
}

export function UnifiedOrderList({
  orders,
  products = [],
  categories = [],
  statusFilter,
  pageTitle,
  pageIcon,
  actionButtonSections,
  showApprovedBy = false,
  showRejectedInfo = false,
  showCancelledInfo = false,
  showCompletedInfo = false,
  showUpdateRequested = false,
  emptyStateMessage = 'No orders found',
  emptyStateIcon,
  hideSearch = false,
  enableStatusFilter = false,
  sortOldestFirst = false,
  hideCustomerName = false,
  isAdmin = true,
  useCardLayout = false,
  useCompactLayout = false,
  emptyStateDescription,
  showHeader = true,
  renderOrderExtra,
  emptyStateSubtext,
  onDeleteOrder,
  onDeleteItem,
  disableDelete = false,
  highlightedOrderId,
  allowItemDeletion = false,
  showDate = true,
  enablePagination = true,
  // ✅ PASS 6: Destructure with rename so it doesn't collide with the
  // `usePagination` hook imported above. The prop was previously undestructured,
  // and `(enablePagination || usePagination)` was silently always-true because
  // it referenced the hook function (always truthy).
  usePagination: usePaginationProp = false,
}: UnifiedOrderListProps): JSX.Element | null {
  const { addTimeout, clearAllTimeouts: clearTimeouts } = useTransitionTimeout();
  
  // ✅ ROUTE-DRIVEN: Use URL state for filters and pagination (March 10, 2026)
  const { filters, updateFilters, clearFilters, hasActiveFilters } = useUrlFilters({
    search: '',
    dateFilter: 'all' as 'all' | 'week' | 'month' | '3months' | '6months' | 'custom',
    orderStatus: 'all',
    customStartDate: '',
    customEndDate: '',
  });
  
  const { page: currentPage, setPage: setCurrentPage } = usePagination(5);
  const itemsPerPage = 5;
  
  // Destructure filters for easier access
  const searchQuery = filters.search;
  const dateFilter = filters.dateFilter;
  const orderStatusFilter = filters.orderStatus;
  const customStartDate = filters.customStartDate;
  const customEndDate = filters.customEndDate;
  
  // Setters that update URL
  const setSearchQuery = (value: string) => updateFilters({ search: value });
  const setDateFilter = (value: typeof filters.dateFilter) => updateFilters({ dateFilter: value });
  const setOrderStatusFilter = (value: string) => updateFilters({ orderStatus: value });
  const setCustomStartDate = (value: string) => updateFilters({ customStartDate: value });
  const setCustomEndDate = (value: string) => updateFilters({ customEndDate: value });
  
  // Local UI state (not in URL)
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // ✅ PERFORMANCE: Debounce search from URL (already debounced by typing)
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // 🔥 PERFORMANCE FIX: Create product lookup map - O(1) instead of O(n)
  const productById = useMemo(() => 
    new Map(products.map(p => [p.id, p])), 
    [products]
  );

  // Helper: Get product names for an order
  const getOrderProductNames = useCallback((order: Order): string[] => {
    const productNames: string[] = [];
    
    // Safety check: ensure items exists and is an array
    if (!order.items || !Array.isArray(order.items)) {
      return productNames;
    }
    
    // Iterate over items array
    order.items.forEach((item) => {
      const product = productById.get(item.productId);
      if (product && item.total > 0) {
        productNames.push((product.name ?? ""));
      }
    });
    
    return productNames;
  }, [productById]);

  // 🔥 PERFORMANCE FIX: Precompute search strings for all orders
  const ordersWithSearchData = useMemo<OrderWithSearchData[]>(() => {
    return orders.map(order => {
      const productNames = getOrderProductNames(order);
      const totalStr = order.total != null ? order.total.toFixed(2) : '0.00';
      const searchString = [
        order.id,
        order.orderNumber || '',
        order.invoiceNumber || '',
        order.customerName,
        order.customerId,
        order.week != null ? order.week.toString() : '',
        order.weekRange || '',
        ...productNames,
        totalStr,
        `$${totalStr}`
      ].join(' ').toLowerCase();

      return {
        ...order,
        searchString
      };
    });
  }, [orders, getOrderProductNames]);

  // Memoize filtered orders to prevent recalculation
  const filteredOrders = useMemo(() => {
    // Apply status filter
    let filtered = ordersWithSearchData.filter(order => {
      if (statusFilter === 'update-requested' || statusFilter === 'update_requested') {
        return false; // No more update-requested orders
      }
      if (statusFilter === 'pending') {
        return order.status === 'pending';
      }
      if (statusFilter === 'approved') {
        return order.status === 'in_process';
      }
      return statusFilter === 'all' || order.status === statusFilter;
    });

    // Apply search filter
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(order => order.searchString.includes(query));
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      filtered = filtered.filter(order => {
        const orderDate = toDate(order.createdAt) ?? new Date();
        orderDate.setHours(0, 0, 0, 0);

        switch (dateFilter) {
          case 'week': {
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(now.getDate() - 7);
            return orderDate >= sevenDaysAgo && orderDate <= now;
          }
          case 'month': {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(now.getDate() - 30);
            return orderDate >= thirtyDaysAgo && orderDate <= now;
          }
          case '3months': {
            const ninetyDaysAgo = new Date(now);
            ninetyDaysAgo.setDate(now.getDate() - 90);
            return orderDate >= ninetyDaysAgo && orderDate <= now;
          }
          case '6months': {
            const oneEightyDaysAgo = new Date(now);
            oneEightyDaysAgo.setDate(now.getDate() - 180);
            return orderDate >= oneEightyDaysAgo && orderDate <= now;
          }
          case 'custom': {
            if (!customStartDate || !customEndDate) return true;
            const startDate = new Date(customStartDate);
            const endDate = new Date(customEndDate);
            return orderDate >= startDate && orderDate <= endDate;
          }
        }
        return true;
      });
    }

    // Apply order status filter if enabled
    if (enableStatusFilter && orderStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === orderStatusFilter);
    }
    
    return filtered;
  }, [ordersWithSearchData, statusFilter, deferredSearchQuery, dateFilter, orderStatusFilter, enableStatusFilter, customStartDate, customEndDate]);

  // Memoize flat list (sorted)
  const flatOrderList = useMemo(() => {
    return filteredOrders.sort((a, b) => {
      const dateA = toDate(a.createdAt)?.getTime() ?? 0;
      const dateB = toDate(b.createdAt)?.getTime() ?? 0;
      return sortOldestFirst ? dateA - dateB : dateB - dateA;
    });
  }, [filteredOrders, sortOldestFirst]);

  // Memoize paginated orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return flatOrderList.slice(startIndex, endIndex);
  }, [flatOrderList, currentPage, itemsPerPage]);

  // Calculate total pages
  const totalPages = Math.ceil(flatOrderList.length / itemsPerPage);

  // Enhanced page change handler with smooth transitions
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage === currentPage) return;
    
    setIsTransitioning(true);
    
    addTimeout(() => {
      setCurrentPage(newPage);
      // Scroll to the list container, not the window top
      scrollToElement(contentTopRef.current, 8);
      
      addTimeout(() => {
        setIsTransitioning(false);
      }, 100);
    }, 150);
  }, [currentPage, addTimeout, setCurrentPage]);

  // Scroll to list top when page changes
  useEffect(() => {
    if (currentPage > 1) {
      scrollToElement(contentTopRef.current, 8);
    }
  }, [currentPage]);

  // Scroll anchor for pagination
  const contentTopRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`${useCardLayout ? 'bg-transparent' : 'bg-white'} rounded-xl shadow-md p-2 sm:p-4 md:p-6`}>
      {/* Scroll anchor for pagination */}
      <div ref={contentTopRef} className="scroll-mt-20" />
      
      {/* Page Header */}
      {showHeader && pageTitle && (
        <div className="flex-center-gap-2 mb-3 sm:mb-6">
          {pageIcon}
          <h2 className={`${useCardLayout ? 'text-white' : 'text-[#333333]'} text-base sm:text-xl md:text-2xl`}>{pageTitle} ({filteredOrders.length})</h2>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="text-center py-20">
          <div className={`w-20 h-20 rounded-full ${useCardLayout ? 'bg-[#D4A574]/20' : 'bg-[#E8C4A2] bg-opacity-30'} flex items-center justify-center mx-auto mb-4`}>
            {emptyStateIcon || <div className="text-4xl">📦</div>}
          </div>
          <h3 className={`${useCardLayout ? 'text-white' : 'text-[#333333]'} text-xl mb-2`}>{emptyStateMessage}</h3>
          <p className={`${useCardLayout ? 'text-neutral-400' : 'text-[#333333] opacity-60'}`}>{emptyStateDescription || 'Orders will appear here when available'}</p>
          {emptyStateSubtext && <p className={`${useCardLayout ? 'text-neutral-400' : 'text-[#333333] opacity-60'} mt-1`}>{emptyStateSubtext}</p>}
        </div>
      ) : (
        <>
          {/* Search and Filter Row */}
          {!hideSearch && (
            <SearchFiltersPanel
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              orderStatusFilter={orderStatusFilter}
              setOrderStatusFilter={setOrderStatusFilter}
              customStartDate={customStartDate}
              setCustomStartDate={setCustomStartDate}
              customEndDate={customEndDate}
              setCustomEndDate={setCustomEndDate}
              enableStatusFilter={enableStatusFilter}
            />
          )}

          {/* Pagination Mode - Flat List */}
          {flatOrderList.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 rounded-full bg-[#E8C4A2] bg-opacity-30 flex items-center justify-center mx-auto mb-6">
                <div className="text-6xl text-[#D4A574]">☹️</div>
              </div>
              <h3 className="text-[#333333] text-2xl font-bold mb-2">No Orders Found</h3>
              <p className="text-[#666666] text-lg mb-2">No orders match your current filters.</p>
            </div>
          ) : (
            <>
              {/* Orders List - Paginated with Smooth Fade Transition */}
              <div className={`space-y-2 sm:space-y-3 transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}`}>
                {paginatedOrders.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    actionButtonSections={typeof actionButtonSections === 'function' ? actionButtonSections(order) : actionButtonSections}
                    showApprovedBy={showApprovedBy}
                    showRejectedInfo={showRejectedInfo}
                    showCancelledInfo={showCancelledInfo}
                    showCompletedInfo={showCompletedInfo}
                    showUpdateRequested={showUpdateRequested}
                    hideCustomerName={hideCustomerName}
                    isAdmin={isAdmin}
                    isMobileLayout={!useCardLayout}
                    useCardLayout={useCardLayout}
                    useCompactLayout={useCompactLayout}
                    renderExtra={renderOrderExtra}
                  />
                ))}
              </div>

              {/* Pagination */}
              {(enablePagination || usePaginationProp) && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={flatOrderList.length}
                  pageSize={itemsPerPage}
                  onPageChange={handlePageChange}
                  itemLabel="orders"
                  className="mt-4"
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default React.memo(UnifiedOrderList);