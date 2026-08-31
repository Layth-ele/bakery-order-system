/**
 * useDashboardBadges.ts
 * ✅ Custom hook for dashboard badge counts
 * ✅ Calculates active orders, outstanding, and notification counts
 * ✅ Optimized with memoization
 */

import { useMemo } from 'react';
import type { Order } from '../types';
import type { User } from '../hooks/useAuth';
import { getUnpaidRows } from '../utils/payments/unpaidSelectors';
import { toDate } from '../utils/timestampFormatting';

interface UseDashboardBadgesProps {
  user: User;
  allOrders: Order[];
  notifications?: any[];
}

interface BadgeCounts {
  activeOrders: number;
  outstanding: number;
}

interface UseDashboardBadgesReturn {
  badgeCounts: BadgeCounts;
  unreadCount: number;
  pendingAdjustmentsCount: number;
}

export function useDashboardBadges({
  user,
  allOrders,
  notifications,
}: UseDashboardBadgesProps): UseDashboardBadgesReturn {
  // ✅ Filter customer's orders
  const customerOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const matchesId = o.customerId && o.customerId === user.id;
      const matchesEmail = o.customerEmail && o.customerEmail === user.email;
      return matchesId || matchesEmail;
    });
  }, [allOrders, user.id, user.email]);

  // ✅ Calculate pending adjustments count (unpaid base orders)
  const pendingAdjustmentsCount = useMemo(() => {
    const rows = getUnpaidRows(customerOrders);

    return rows.reduce((total, row) => {
      // Only count base unpaid orders
      if (row.kind === 'base_order') {
        return total + (row.order.total || 0);
      }
      return total;
    }, 0);
  }, [customerOrders]);

  // ✅ Calculate badge counts
  const badgeCounts = useMemo(() => {
 // MATCH ActiveOrders.tsx FILTER LOGIC
    // Active Orders badge should count:
    // - PENDING orders (awaiting admin approval)
    // - APPROVED orders WITH paymentSubmitted=true (payment under review)
    // - IN_PROCESS orders (in production)
    // - REJECTED/CANCELLED orders (within last 48h)
    // 
    // EXCLUDED:
    // - APPROVED orders WITHOUT paymentSubmitted (shown in Outstanding tab)
    
    const now = Date.now();
    const fortyEightHoursAgo = now - (48 * 60 * 60 * 1000);
    
    const activeCount = customerOrders.filter((o) => {
      // Include pending orders
      if (o.status === 'pending') return true;
      
      // Include approved orders ONLY if payment submitted
      if (o.status === 'approved') {
        return o.paymentSubmitted === true;
      }
      
      // Include in_process orders
      if (o.status === 'in_process') return true;
      
      // Include rejected/cancelled orders within last 48h
      if (o.status === 'rejected' || o.status === 'cancelled') {
        const terminatedAt = o.status === 'rejected' 
          ? o.rejectedAt 
          : o.cancelledAt;
        
        if (!terminatedAt) return false;
        
        const terminatedDate = toDate(terminatedAt);
        const terminatedTime = terminatedDate ? terminatedDate.getTime() : 0;
        return terminatedTime > fortyEightHoursAgo;
      }
      
      return false;
    }).length;

 // CRITICAL FIX - Outstanding badge should show ALL approved orders
    // Balance must remain visible until admin confirms payment (status → 'in_process')
    // Outstanding badge = count of ALL orders with status="approved"
    // This matches the Outstanding tab page filter (CustomerUnpaidOrders.tsx)
    // Includes:
    // - Orders awaiting payment submission (paymentSubmitted=false) → "WAITING PAYMENT"
    // - Orders with payment under review (paymentSubmitted=true) → "WAITING CONFIRM PAYMENT"
    // Excludes:
    // - Pending orders (status='pending' - appear in Active Orders)
    // - In-process orders (status='in_process' - payment confirmed by admin)
    // - Completed/cancelled orders
    const rows = getUnpaidRows(customerOrders);
    const unpaidCount = rows
      .filter(row => row.kind === 'base_order')
      .length; // REMOVED paymentSubmitted filter - show ALL approved orders

    return {
      activeOrders: activeCount,
      outstanding: unpaidCount, // ✅ Shows count of ONLY "WAITING PAYMENT" orders (matches page filter)
    };
  }, [customerOrders]);

  // ✅ Calculate unread notification count
  const unreadCount = useMemo(() => {
    if (!notifications) return 0;
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  return {
    badgeCounts,
    unreadCount,
    pendingAdjustmentsCount,
  };
}