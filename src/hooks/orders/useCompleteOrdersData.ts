/**
 * 🎯 useCompleteOrdersData Hook
 * 
 * ✅ PHASE 2: Business Logic Extraction
 * 
 * PURPOSE:
 * - Centralize complete orders filtering & statistics logic
 * - Handle complex multi-filter combinations
 * - Calculate statistics using centralized services
 * - Manage filter state and derived data
 * 
 * REPLACES:
 * - Complex filtering logic in CompleteOrders component
 * - Statistics calculations
 * - Customer filtering with performance optimization
 * - Year/status/search filtering
 * 
 * USAGE:
 * ```typescript
 * const {
 *   filteredOrders,
 *   statistics,
 *   filters,
 *   setSearchQuery,
 *   setSelectedYear,
 *   setSelectedStatus,
 *   setSelectedCustomer,
 *   customersWithHistoricalOrders,
 *   yearOptions
 * } = useCompleteOrdersData(isActive);
 * ```
 */

import { useState, useMemo } from 'react';
import { useCachedOrders } from '../useCachedFirebase';
import { useCachedCustomers } from '../useCachedCustomers';
import { useDebounce } from '../useDebounce';
import { selectHistoricalOrders } from '../../utils/orderSelectors';
// FIX T2R1-F12 (HIGH): Use Vancouver-anchored current year for yearOptions.
import { getCurrentWeekNumber } from '../../services/orders/orderHistoryService';
import type { Order, Customer } from '../../types';
import { toDate } from '../../utils/timestampFormatting';

interface CompleteOrdersStatistics {
  completed: Order[];
  rejected: Order[];
  cancelled: Order[];
  totalRevenue: number;
  totalOrders: number;
}

interface CompleteOrdersFilters {
  /** Current search query */
  searchQuery: string;
  
  /** Debounced search query (used for actual filtering) */
  debouncedSearch: string;
  
  /** Selected year filter */
  selectedYear: number | 'all';
  
  /** Selected status filter */
  selectedStatus: string | 'all';
  
  /** Selected customer filter */
  selectedCustomer: string | 'all';
}

interface UseCompleteOrdersDataReturn {
  /** Filtered and sorted orders */
  filteredOrders: Order[];
  
  /** Statistics (counts, revenue) */
  statistics: any;
  
  /** Current filter values */
  filters: CompleteOrdersFilters;
  
  /** Set search query */
  setSearchQuery: (query: string) => void;
  
  /** Set year filter */
  setSelectedYear: (year: number | 'all') => void;
  
  /** Set status filter */
  setSelectedStatus: (status: string | 'all') => void;
  
  /** Set customer filter */
  setSelectedCustomer: (customerId: string | 'all') => void;
  
  /** Customers that have historical orders */
  customersWithHistoricalOrders: Customer[];
  
  /** Available year options */
  yearOptions: number[];
  
  /** Loading state */
  loading: boolean;
}

/**
 * Hook for complete orders data and filtering
 * 
 * Handles:
 * - Fetching historical orders (completed, rejected, cancelled)
 * - Multi-dimensional filtering (search, year, status, customer)
 * - Statistics calculations (revenue, counts)
 * - Performance optimization (debouncing, memoization)
 * 
 * @param isActive - Whether the component is active
 * @returns Object with filtered orders, statistics, and filter controls
 * 
 * @example
 * ```typescript
 * const {
 *   filteredOrders,
 *   statistics,
 *   filters,
 *   setSearchQuery,
 *   customersWithHistoricalOrders
 * } = useCompleteOrdersData(true);
 * 
 * // Render stats
 * <div>Total: {statistics.totalOrders}</div>
 * <div>Revenue: ${statistics.totalRevenue.toFixed(2)}</div>
 * 
 * // Apply filters
 * <input value={filters.searchQuery} onChange={e => setSearchQuery(e.target.value)} />
 * ```
 */
export function useCompleteOrdersData(isActive: boolean): UseCompleteOrdersDataReturn {
  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  
  const { data: allOrders = [], isLoading: ordersLoading } = useCachedOrders(isActive);
  const { data: customers = [], isLoading: customersLoading } = useCachedCustomers();
  
  // ============================================================================
  // FILTER STATE
  // ============================================================================
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all'); // ✅ Changed from current year to 'all'
  const [selectedStatus, setSelectedStatus] = useState<string | 'all'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string | 'all'>('all');
  
  // ✅ PERFORMANCE: Debounce search to reduce filter operations by 80-90%
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // ============================================================================
  // YEAR OPTIONS
  // ============================================================================
  
  const yearOptions = useMemo(() => {
    // FIX T2R1-F12 (HIGH — analytics drift across timezones): Was
    // `new Date().getFullYear()` which returns the runtime's local-timezone
    // year. An admin in Sydney loading the page on January 1 PST 11pm
    // (already January 2 in Sydney) would see the wrong "current year"
    // dropdown. The bakery is registered in Vancouver, BC (CRA), so the
    // canonical year for this UI is Vancouver's year.
    const { year: currentYear } = getCurrentWeekNumber();
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  }, []);
  
  // ============================================================================
  // DATA PROCESSING
  // ============================================================================
  
  /**
   * Filter historical orders (completed, rejected, cancelled)
   */
  const historicalOrders = useMemo(
    () => selectHistoricalOrders(allOrders),
    [allOrders]
  );
  
  /**
   * Get customers that have historical orders
   * ✅ PERFORMANCE: Use Set for O(1) lookup instead of O(n) with .some()
   */
  const customersWithHistoricalOrders = useMemo(() => {
    const customerIdsInHistoricalOrders = new Set(
      historicalOrders.map((order) => order.customerId)
    );
    
    return customers.filter((customer) =>
      customerIdsInHistoricalOrders.has(customer.id)
    );
  }, [customers, historicalOrders]);
  
  /**
   * Apply all filters, calculate statistics, and sort - optimized for maximum performance
   * ✅ PERFORMANCE: Filter cheap -> Parse dates once -> Sort with cached values
   * ✅ PERFORMANCE: ISO string comparison for sort (faster than Date parsing)
   */
  const { filteredAndSortedOrders, statistics } = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    const hasSearch = !!debouncedSearch;
    const hasYearFilter = selectedYear !== 'all';
    const hasStatusFilter = selectedStatus !== 'all';
    const hasCustomerFilter = selectedCustomer !== 'all';
    
    // Step 1: Apply cheap filters first (no Date parsing)
    let filtered = historicalOrders;
    
    if (hasSearch || hasStatusFilter || hasCustomerFilter) {
      filtered = historicalOrders.filter((order) => {
        // Search filter
        if (hasSearch) {
          const matchesSearch =
            order.id.toLowerCase().includes(searchLower) ||
            (order.orderNumber?.toLowerCase() || '').includes(searchLower) ||
            (order.invoiceNumber?.toLowerCase() || '').includes(searchLower) ||
            order.weekRange?.toLowerCase().includes(searchLower) ||
            order.customerName?.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;
        }
        
        // Status filter
        if (hasStatusFilter && order.status !== selectedStatus) return false;
        
        // Customer filter
        if (hasCustomerFilter && order.customerId !== selectedCustomer) return false;
        
        return true;
      });
    }
    
    // Step 2: Year filter + statistics (parse Date only if year filter active)
    let yearFiltered = filtered;
    let completedCount = 0, rejectedCount = 0, cancelledCount = 0, totalRevenue = 0;
    
    if (hasYearFilter) {
      yearFiltered = [];
      for (let i = 0; i < filtered.length; i++) {
        const order = filtered[i];
        const year = (toDate(order.completedAt || order.createdAt) ?? new Date()).getFullYear();
        
        if (year === selectedYear) {
          yearFiltered.push(order);
          
          // Calculate statistics
          const status = order.status;
          if (status === 'completed') {
            completedCount++;
            totalRevenue += Number(order.total || order.finalTotal || 0);
          } else if (status === 'rejected') {
            rejectedCount++;
          } else if (status === 'cancelled') {
            cancelledCount++;
          }
        }
      }
    } else {
      // No year filter - calculate statistics only
      for (let i = 0; i < filtered.length; i++) {
        const order = filtered[i];
        const status = order.status;
        if (status === 'completed') {
          completedCount++;
          totalRevenue += Number(order.total || order.finalTotal || 0);
        } else if (status === 'rejected') {
          rejectedCount++;
        } else if (status === 'cancelled') {
          cancelledCount++;
        }
      }
    }
    
    // Step 3: Sort using ISO string comparison (faster than Date parsing!)
    // ISO 8601 strings are lexicographically sortable
    yearFiltered.sort((a, b) => {
      const dateA = a.completedAt || a.createdAt || '';
      const dateB = b.completedAt || b.createdAt || '';
      return dateB > dateA ? 1 : dateB < dateA ? -1 : 0;
    });
    
    return {
      filteredAndSortedOrders: yearFiltered,
      statistics: {
        completed: { length: completedCount },
        rejected: { length: rejectedCount },
        cancelled: { length: cancelledCount },
        totalRevenue,
        totalOrders: yearFiltered.length,
      },
    };
  }, [historicalOrders, debouncedSearch, selectedYear, selectedStatus, selectedCustomer]);
  
  // ============================================================================
  // RETURN API
  // ============================================================================
  
  return {
    filteredOrders: filteredAndSortedOrders,
    statistics,
    filters: {
      searchQuery,
      debouncedSearch,
      selectedYear,
      selectedStatus,
      selectedCustomer,
    },
    setSearchQuery,
    setSelectedYear,
    setSelectedStatus,
    setSelectedCustomer,
    customersWithHistoricalOrders,
    yearOptions,
    loading: ordersLoading || customersLoading,
  };
}