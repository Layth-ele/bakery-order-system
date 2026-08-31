/**
 * Balance Widget
 * 
 * Displays customer's outstanding balance (amount owed)
 * Shows on customer dashboard header
 * 
 * ✅ FEB 17, 2026: REFACTORED — Async with TanStack Query (useCachedOrders)
 * ✅ Uses same data pipeline as CustomerUnpaidOrders & useDashboardBadges
 * ✅ Balance auto-updates when TanStack Query cache invalidates
 * ✅ ALWAYS VISIBLE: Shows even when balance is $0.00
 * ✅ CLICK ACTION: Navigates to Outstanding tab (no modal needed)
 * ✅ FEB 17, 2026: POLLING FIX — 60s refetchInterval so customer sees
 *    admin-side payment confirmations without manual page refresh
 * ✅ FEB 17, 2026: BALANCE FIX — Balance only removed when admin confirms
 *    payment (status → 'in_process'), NOT when customer submits payment proof
 */

import React, { useMemo } from 'react';
import { AlertCircle, Info, Loader2 } from 'lucide-react';
import { useCachedOrders } from '../../hooks/useCachedFirebase';
import { getUnpaidRows } from '../../utils/payments/unpaidSelectors';

// ✅ FEB 17, 2026: Poll every 60 seconds to pick up admin-side changes
// (e.g., admin confirms payment → order moves from approved to in_process)
// This is the ONLY way the customer's browser learns about cross-browser mutations
const BALANCE_POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

interface BalanceWidgetProps {
  customerId: string;
  customerEmail?: string; // ✅ Support email-based matching (same as useDashboardBadges)
  variant?: 'compact' | 'full';
  onNavigateToOutstanding?: () => void;
}

export function BalanceWidget({ customerId, customerEmail, variant = 'full', onNavigateToOutstanding }: BalanceWidgetProps): JSX.Element | null {
 // Use TanStack Query cache — same source as CustomerUnpaidOrders & useDashboardBadges
  // realtime=true ensures we get live Firestore updates
  // ✅ POLLING FIX: 60s refetchInterval so balance updates when admin confirms payment
  // Without this, customer would never see balance change (staleTime=15min, no refetchOnMount)
  const { data: allOrders = [], isLoading } = useCachedOrders(true, 100, {
    refetchInterval: BALANCE_POLL_INTERVAL_MS,
  });

  // ✅ Compute outstanding balance from the canonical unpaid pipeline
  // Same filter logic as useDashboardBadges and CustomerUnpaidOrders
  const { outstandingBalance, unpaidCount } = useMemo(() => {
    // Filter to this customer's orders (supports both ID and email matching)
    const customerOrders = allOrders.filter((o) => {
      const matchesId = o.customerId && o.customerId === customerId;
      const matchesEmail = customerEmail && o.customerEmail && o.customerEmail === customerEmail;
      return matchesId || matchesEmail;
    });

    // Use the canonical unpaid selector — identical to CustomerUnpaidOrders
    const unpaidRows = getUnpaidRows(customerOrders);

    // ✅ CRITICAL FIX (Mar 17, 2026): DO NOT filter out paymentSubmitted orders
    // Balance must remain visible until admin confirms payment and changes status to 'in_process'
    // The unpaid selector already handles this correctly - we should use it as-is
    // Removed: filteredRows with paymentSubmitted check

    // Sum amounts per row kind (same fix as balanceService.ts)
    const balance = unpaidRows.reduce((sum, row) => {
      if (row.kind === 'base_order') {
        const total = Number(row.order.total);
        return sum + (Number.isFinite(total) ? total : 0);
      } else if (row.kind === 'adjustment_increase') {
        const adj = row.adjustment;
        const amount = Number(adj?.paid?.amount ?? adj?.deltaTotal ?? 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }
      return sum;
    }, 0);

    const count = unpaidRows.filter(r => r.kind === 'base_order').length;

    return { outstandingBalance: Math.max(0, balance), unpaidCount: count };
  }, [allOrders, customerId, customerEmail]);

  const handleViewDetails = () => {
    if (onNavigateToOutstanding) {
      onNavigateToOutstanding();
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (variant === 'compact') {
    const hasBalance = outstandingBalance > 0;
    const colorClass = hasBalance ? 'text-red-400' : 'text-green-400';
    const bgClass = hasBalance ? 'bg-red-400/10' : 'bg-green-400/10';
    const borderClass = hasBalance ? 'border-red-400/30' : 'border-green-400/30';
    const hoverClass = hasBalance ? 'hover:bg-red-400/20' : 'hover:bg-green-400/20';

    return (
      <button
        onClick={handleViewDetails}
        className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 ${bgClass} border ${borderClass} rounded-lg ${hoverClass} transition-colors`}
        aria-label={`Outstanding balance: ${formatAmount(outstandingBalance)}${hasBalance ? `. ${unpaidCount} unpaid order${unpaidCount !== 1 ? 's' : ''}` : ''}`}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 md:w-4 md:h-4 text-neutral-400 animate-spin" />
        ) : (
          <AlertCircle className={`w-3 h-3 md:w-4 md:h-4 ${colorClass}`} />
        )}
        <span className={`text-xs md:text-sm font-medium ${colorClass}`}>
          {isLoading ? '...' : `${formatAmount(outstandingBalance)} ${hasBalance ? 'Due' : 'Owed'}`}
        </span>
      </button>
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${
      outstandingBalance > 0 
        ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 dark:from-red-900/20 dark:to-red-800/20 dark:border-red-800/30' 
        : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 dark:from-green-900/20 dark:to-green-800/20 dark:border-green-800/30'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            outstandingBalance > 0 
              ? 'bg-red-100 dark:bg-red-800/30' 
              : 'bg-green-100 dark:bg-green-800/30'
          }`}>
            {isLoading ? (
              <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
            ) : (
              <AlertCircle className={`w-6 h-6 ${
                outstandingBalance > 0 ? 'text-red-500' : 'text-green-500'
              }`} />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Outstanding Balance</p>
            <p className={`text-2xl font-bold ${
              outstandingBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }`}>
              {isLoading ? '...' : formatAmount(outstandingBalance)}
            </p>
            {unpaidCount > 0 && !isLoading && (
              <p className="text-xs text-gray-500 mt-0.5">
                {unpaidCount} unpaid order{unpaidCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        
        <button
          onClick={handleViewDetails}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            outstandingBalance > 0
              ? 'text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30'
              : 'text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>Details</span>
        </button>
      </div>
      
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {isLoading
          ? 'Loading balance...'
          : outstandingBalance > 0 
            ? `You have ${unpaidCount} unpaid invoice${unpaidCount !== 1 ? 's' : ''}. Click Details to view and pay.`
            : 'All invoices paid! You have no outstanding balance.'
        }
      </p>
    </div>
  );
}