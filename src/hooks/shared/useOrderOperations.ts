/**
 * useOrderOperations Hook
 * 🟢 HOOK - Shared order operations
 * 
 * REFACTORED - Phase 3: Shared Logic Extraction
 * - Reusable across customer and admin pages
 * - Performance optimized with useMemo
 * - Order filtering, sorting, and statistics
 * 
 * Responsibilities:
 * - Order filtering by status, date, customer
 * - Order sorting and grouping
 * - Order statistics calculation
 * - Memoized for performance
 * 
 * Performance Optimizations:
 * - useMemo for expensive operations
 * - Prevents unnecessary recalculations
 * - Optimized for large order lists
 * 
 * Used by: Customer dashboard, Admin order pages
 * Location: /hooks/shared/useOrderOperations.ts
 */

import { useMemo } from 'react';
import type { Order } from '../../types';
import { toDate } from '../../utils/timestampFormatting';

// ============================================================================
// TYPES
// ============================================================================

export interface OrderFilters {
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}

export interface OrderStatistics {
  totalOrders: number;
  pendingCount: number;
  approvedCount: number;
  completedCount: number;
  rejectedCount: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface OptimizedOrders {
  filteredOrders: Order[];
  statistics: OrderStatistics;
  ordersByStatus: Map<string, Order[]>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateOrderTotal(order: Order): number {
  return (order.total || 0) + (order.deliveryFee || 0);
}

// ============================================================================
// HOOK
// ============================================================================

export function useOrderOperations(
  orders: Order[],
  filters: OrderFilters = {}
): OptimizedOrders {
  
  const { status, customerId, startDate, endDate, searchTerm } = filters;
  
  // ============================================================================
  // MEMOIZED FILTERING - Performance optimization
  // ============================================================================
  
  const filteredOrders = useMemo(() => {
    let result = [...orders];
    
    // Filter by status
    if (status && status !== 'all') {
      result = result.filter((o) => o.status === status);
    }
    
    // Filter by customer
    if (customerId) {
      result = result.filter((o) => o.customerId === customerId);
    }
    
    // Filter by date range
    if (startDate) {
      result = result.filter((o) => {
        const d = toDate(o.createdAt);
        return d ? d.toISOString().slice(0, 10) >= startDate : false;
      });
    }
    if (endDate) {
      result = result.filter((o) => {
        const d = toDate(o.createdAt);
        return d ? d.toISOString().slice(0, 10) <= endDate : false;
      });
    }
    
    // Filter by search term (order ID, customer name, etc.)
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(term) ||
          ((o as any).orderNumber?.toLowerCase() || '').includes(term) ||
          (o.invoiceNumber?.toLowerCase() || '').includes(term) ||
          o.customerName?.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [orders, status, customerId, startDate, endDate, searchTerm]);
  
  // ============================================================================
  // MEMOIZED STATISTICS - Performance optimization
  // ============================================================================
  
  const statistics = useMemo((): OrderStatistics => {
    const totalOrders = filteredOrders.length;
    
    const pendingCount = filteredOrders.filter(
      (o) => o.status === 'pending'
    ).length;
    
    const approvedCount = filteredOrders.filter(
      (o) => o.status === 'approved'
    ).length;
    
    const completedCount = filteredOrders.filter(
      (o) => o.status === 'completed'
    ).length;
    
    const rejectedCount = filteredOrders.filter(
      (o) => o.status === 'rejected'
    ).length;
    
    const totalRevenue = filteredOrders.reduce(
      (sum, order) => sum + calculateOrderTotal(order),
      0
    );
    
    const averageOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    return {
      totalOrders,
      pendingCount,
      approvedCount,
      completedCount,
      rejectedCount,
      totalRevenue,
      averageOrderValue,
    };
  }, [filteredOrders]);
  
  // ============================================================================
  // MEMOIZED GROUPING - Group orders by status
  // ============================================================================
  
  const ordersByStatus = useMemo(() => {
    const grouped = new Map<string, Order[]>();
    
    filteredOrders.forEach((order) => {
      const status = order.status || 'unknown';
      if (!grouped.has(status)) {
        grouped.set(status, []);
      }
      grouped.get(status)!.push(order);
    });
    
    return grouped;
  }, [filteredOrders]);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    filteredOrders,
    statistics,
    ordersByStatus,
  };
}
