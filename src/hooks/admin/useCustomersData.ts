/**
 * useCustomersData.ts
 * 
 * ✅ PHASE 2: Admin Pages Standardization - Data Layer
 * 
 * PURPOSE:
 * - Consolidate all data fetching for CustomersList
 * - Apply filtering, sorting, and statistics
 * - Single source of truth for customers data
 * 
 * ARCHITECTURE:
 * - Input: isActive flag, search/filter parameters
 * - Output: Clean data object with filtered/sorted customers
 * - No business logic (just data transformation)
 * 
 * EXTRACTED FROM: /pages/admin/CustomersList.tsx
 */

import { useMemo } from 'react';
import { useCachedCustomers } from '../useCachedFirebase';
import {
  type Customer,
  type CustomerFilters,
  deduplicateCustomers,
  filterCustomers,
  sortCustomers,
  calculateCustomerStats,
} from '../../services/customersService';

interface UseCustomersDataProps {
  isActive: boolean;
  searchTerm: string;
  filterType: 'all' | 'commercial' | 'individual' | 'admin';
  filterStatus: 'all' | 'approved' | 'suspended' | 'active';  // ✅ Added 'active'
}

interface CustomersData {
  // Raw data
  allCustomers: Customer[];
  
  // Loading state
  customersLoading: boolean;
  
  // Processed data
  processedCustomers: Customer[];
  
  // Statistics
  stats: {
    total: number;
    active: number;  // ✅ Added: active = total - suspended
    commercial: number;
    individual: number;
    admin: number;
    suspended: number;
    thisMonth: number;
  };
}

/**
 * Hook to fetch and process customer data
 * 
 * Handles:
 * - Fetching customers from cache
 * - Deduplication
 * - Filtering by search term, type, and status
 * - Sorting
 * - Statistics calculation
 * 
 * @param props - Search and filter parameters
 * @returns Clean data object with processed customers
 */
export function useCustomersData({
  isActive,
  searchTerm,
  filterType,
  filterStatus,
}: UseCustomersDataProps): CustomersData {
  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  
  const {
    data: allCustomers = [],
    isLoading: customersLoading,
  } = useCachedCustomers(isActive);
  
  // ============================================================================
  // DATA PROCESSING (Memoized for performance)
  // ============================================================================
  
  // Deduplicate, filter, and sort customers
  const processedCustomers = useMemo(() => {
    if (!isActive) return [];
    
    const uniqueCustomers = deduplicateCustomers(allCustomers);
    
    // Step 2: Filter
    const filters: CustomerFilters = {
      searchTerm,
      customerType: filterType,
      status: filterStatus,
    };
    const filtered = filterCustomers(uniqueCustomers, filters);
    
    // Step 3: Sort
    return sortCustomers(filtered);
  }, [isActive, allCustomers, searchTerm, filterType, filterStatus]);
  
  // ============================================================================
  // STATISTICS (Memoized for performance)
  // ============================================================================
  
  const stats = useMemo(
    () => calculateCustomerStats(allCustomers),
    [allCustomers]
  );
  
  // ============================================================================
  // RETURN DATA
  // ============================================================================
  
  return {
    allCustomers,
    customersLoading,
    processedCustomers,
    stats: {
      total: stats?.total ?? 0,
      active: stats?.active ?? 0,
      commercial: stats?.commercial ?? 0,
      individual: stats?.individual ?? 0,
      admin: stats?.admin ?? 0,
      suspended: stats?.suspended ?? 0,
      thisMonth: stats?.thisMonth ?? 0,
    },
  };
}