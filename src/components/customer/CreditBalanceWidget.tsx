/**
 * Credit Balance Widget
 * 
 * Displays customer's available credit balance with option to view details
 * Shows on customer dashboard header
 * 
 * ✅ FEB 17, 2026: REFACTORED — Async with TanStack Query (useCachedCreditBalance)
 * ✅ Uses same cache/invalidation pattern as BalanceWidget & useCachedOrders
 * ✅ No more manual useState, setInterval polling, or event listeners
 * ✅ 60s refetchInterval + refetchOnWindowFocus for cross-browser updates
 * ✅ ALWAYS VISIBLE: Shows even when balance is $0.00
 * ✅ CLICK ACTION: Optional navigation (no modal required)
 */

import React from 'react';
import { DollarSign, Info, Loader2 } from 'lucide-react';
import { useCachedCreditBalance } from '../../hooks/useCachedFirebase';
import { formatCreditAmount } from '../../services/creditService';

// ✅ FEB 17, 2026: Poll every 60 seconds to pick up admin-side changes
// (e.g., admin edits a paid order → credit note issued to customer)
// Same interval as BalanceWidget for consistency
const CREDIT_POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

interface CreditBalanceWidgetProps {
  customerId: string;
  variant?: 'compact' | 'full';
  onNavigateToCredit?: () => void; // ✅ Optional callback for navigation
}

export function CreditBalanceWidget({ customerId, variant = 'full', onNavigateToCredit }: CreditBalanceWidgetProps): JSX.Element | null {
 // TanStack Query — same pattern as BalanceWidget
  // - Polls every 60s so customer sees admin-side credit changes
  // - refetchOnWindowFocus: true (built into the hook) for instant update on tab focus
  // - Replaces: useState + setInterval(5s) + storage events + custom events
  const { data: availableCredit = 0, isLoading } = useCachedCreditBalance(customerId, {
    refetchInterval: CREDIT_POLL_INTERVAL_MS,
  });

  const handleViewDetails = () => {
    if (onNavigateToCredit) {
      onNavigateToCredit();
    }
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={handleViewDetails}
        className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-[#D4A574]/10 border border-[#D4A574]/30 rounded-lg hover:bg-[#D4A574]/20 transition-colors"
        aria-label={`Available credit: ${formatCreditAmount(availableCredit)}`}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 md:w-4 md:h-4 text-[#D4A574] animate-spin" />
        ) : (
          <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-[#D4A574]" />
        )}
        <span className="text-xs md:text-sm font-medium text-[#D4A574]">
          {isLoading ? '...' : `${formatCreditAmount(availableCredit)} Credit`}
        </span>
      </button>
    );
  }

  return (
    <div className="bg-white border border-[#D4A574]/30 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-container-lg flex items-center justify-center bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-2xl shadow-md flex-shrink-0">
            {isLoading ? (
              <Loader2 className="icon-lg text-white animate-spin" />
            ) : (
              <DollarSign className="icon-lg text-white" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Available Credit</p>
            <p className="text-2xl font-bold text-[#D4A574]">
              {isLoading ? '...' : formatCreditAmount(availableCredit)}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleViewDetails}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#D4A574] hover:bg-[#D4A574]/10 rounded-lg transition-colors"
        >
          <Info className="w-4 h-4" />
          <span>Details</span>
        </button>
      </div>
      
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {isLoading
          ? 'Loading credit balance...'
          : availableCredit > 0
            ? 'Apply this credit to your next order and reduce your total cost'
            : 'No credit available. Credits are issued when admin reduces a paid order.'
        }
      </p>
    </div>
  );
}