/**
 * 🎯 useOrdersData Hook
 * 
 * ✅ PHASE 2: Business Logic Extraction
 * 
 * PURPOSE:
 * - Centralize all order data fetching logic
 * - Handle loading and error states
 * - Provide filtered and sorted order lists
 * - Single source of truth for order data
 * 
 * REPLACES:
 * - Scattered useEffect data fetching in components
 * - Local state management for orders
 * - Duplicate filtering logic
 * 
 * USAGE:
 * ```typescript
 * const { 
 *   orders,           // All orders
 *   inProcessOrders,  // Filtered: status === 'in_process'
 *   pendingOrders,    // Filtered: status === 'pending'
 *   loading,
 *   error,
 *   refetch
 * } = useOrdersData(isActive);
 * ```
 */

import { useMemo } from 'react';
import { useCachedOrders } from '../useCachedFirebase';
import {
  selectInProcessOrders,
  selectPendingOrders,
  selectUpdateRequestedOrders,
  selectCompletedOrders,
  selectCancelledOrders,
  selectRejectedOrders,
} from '../../utils/orderSelectors';
import type { Order, User } from '../../types';

interface UseOrdersDataOptions {
  /**
   * Whether to fetch data (typically tied to page active state)
   */
  isActive?: boolean;
  
  /**
   * User for role-based filtering (admin sees all, customer sees own)
   */
  user?: User;
  
  /**
   * Optional status filter
   */
  status?: 'pending' | 'in_process' | 'completed' | 'cancelled' | 'rejected';
}

interface UseOrdersDataReturn {
  /** All orders (filtered by user role) */
  orders: Order[];
  
  /** Orders with status === 'in_process' (approved, in production) */
  inProcessOrders: Order[];
  
  /** Orders with status === 'pending' */
  pendingOrders: Order[];
  
    updateRequestedOrders: Order[];
  
  /** Orders with status === 'completed' */
  completedOrders: Order[];
  
  /** Orders with status === 'cancelled' */
  cancelledOrders: Order[];
  
  /** Orders with status === 'rejected' */
  rejectedOrders: Order[];
  
  /** Loading state */
  loading: boolean;
  
  /** Error state */
  error: Error | null;
  
  /** Refetch function */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and filtering order data
 * 
 * @param options - Configuration options
 * @returns Order data, loading state, and refetch function
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { inProcessOrders, loading } = useOrdersData({ isActive: true });
 * 
 * // With user filtering
 * const { orders, loading } = useOrdersData({ 
 *   isActive: true, 
 *   user: currentUser 
 * });
 * 
 * // With status filter
 * const { orders, loading } = useOrdersData({ 
 *   isActive: true,
 *   status: 'pending'
 * });
 * ```
 */
export function useOrdersData(
  options: UseOrdersDataOptions = {}
): UseOrdersDataReturn {
  const { isActive = true, user, status } = options;
  
  // ✅ Fetch orders using TanStack Query cache
  const { 
    data: allOrders = [], 
    isLoading: loading,
    error,
    refetch 
  } = useCachedOrders(isActive);
  
  // ✅ Filter by user role (defensive programming)
  const filteredOrders = useMemo(() => {
    if (!user) return allOrders;
    
    if (user.role === 'admin') {
      return allOrders; // Admin sees all orders
    }
    
    // Defensive filter: customer sees only own orders
    return allOrders.filter(order => order.customerId === user.id);
  }, [allOrders, user]);
  
  // ✅ Filter by status if provided
  const statusFilteredOrders = useMemo(() => {
    if (!status) return filteredOrders;
    
    switch (status) {
      case 'in_process':
        return selectInProcessOrders(filteredOrders);
      case 'pending':
        return selectPendingOrders(filteredOrders);
      case 'approved' as any: // update_requested → approved
        return selectUpdateRequestedOrders(filteredOrders);
      case 'completed':
        return selectCompletedOrders(filteredOrders);
      case 'cancelled':
        return selectCancelledOrders(filteredOrders);
      case 'rejected':
        return selectRejectedOrders(filteredOrders);
      default:
        return filteredOrders;
    }
  }, [filteredOrders, status]);
  
  // ✅ PERFORMANCE: Single-pass filtering for all status types
  const { inProcessOrders, pendingOrders, updateRequestedOrders, completedOrders, cancelledOrders, rejectedOrders } = useMemo(
    () => {
      const inProcess: Order[] = [];
      const pending: Order[] = [];
      const updateRequested: Order[] = [];
      const completed: Order[] = [];
      const cancelled: Order[] = [];
      const rejected: Order[] = [];
      
      // Single iteration instead of 6 separate filter() calls
      for (let i = 0; i < filteredOrders.length; i++) {
        const order = filteredOrders[i];
        const status = order.status;
        
        if (status === 'in_process') inProcess.push(order);
        else if (status === 'pending') pending.push(order);
        
        else if (status === 'completed') completed.push(order);
        else if (status === 'cancelled') cancelled.push(order);
        else if (status === 'rejected') rejected.push(order);
      }
      
      return {
        inProcessOrders: inProcess,
        pendingOrders: pending,
        updateRequestedOrders: updateRequested,
        completedOrders: completed,
        cancelledOrders: cancelled,
        rejectedOrders: rejected,
      };
    },
    [filteredOrders]
  );
  
  return {
    orders: statusFilteredOrders,
    inProcessOrders,
    pendingOrders,
    updateRequestedOrders,
    completedOrders,
    cancelledOrders,
    rejectedOrders,
    loading,
    error: error as Error | null,
    refetch: async () => {
      await refetch();
    },
  };
}