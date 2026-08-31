/**
 * 🎨 AdminUnpaidOrdersView - Presentational Component
 * 
 * ✅ PHASE 2: Business Logic Extraction
 * 
 * PURPOSE:
 * - Pure presentational component for unpaid orders
 * - No business logic, no data fetching
 * - Receives data and callbacks via props
 * - Easy to test and maintain
 * 
 * ARCHITECTURE:
 * - Props in → JSX out
 * - All logic delegated to parent/hooks
 * - Reusable across different contexts
 */

import React, { useState } from 'react';
import { DollarSign, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { UnpaidOrderCard } from './UnpaidOrderCard';
import { Pagination } from '../../components/ui/pagination';
import type { Order, Product, Category } from '../../types';

export interface AdminUnpaidOrdersViewProps {
  /** Unpaid orders to display */
  unpaidOrders: Order[];
  
  /** Products for display/calculation */
  products: Product[];
  
  /** Categories for display */
  categories: Category[];
  
  /** Loading state */
  loading: boolean;
  
  /** View order details */
  onViewOrder: (order: Order) => void;
  
  /** Confirm payment received */
  onConfirmPayment: (order: Order) => void;
  
  /** Send payment reminder */
  onSendReminder: (order: Order) => void;
  
  /** Cancel order */
  onCancelOrder: (order: Order) => void;
  
  /** Refresh orders */
  onRefresh: () => void;
}

/**
 * Presentational component for displaying unpaid orders
 * 
 * @example
 * ```typescript
 * <AdminUnpaidOrdersView
 *   unpaidOrders={unpaidOrders}
 *   products={products}
 *   categories={categories}
 *   loading={loading}
 *   onViewOrder={handleViewOrder}
 *   onConfirmPayment={handleConfirmPayment}
 *   onSendReminder={handleSendReminder}
 *   onCancelOrder={handleCancelOrder}
 *   onRefresh={handleRefresh}
 * />
 * ```
 */
export function AdminUnpaidOrdersView({
  unpaidOrders,
  products,
  categories,
  loading,
  onViewOrder,
  onConfirmPayment,
  onSendReminder,
  onCancelOrder,
  onRefresh,
}: AdminUnpaidOrdersViewProps): JSX.Element | null {

 // Split unpaid orders into two categories
  // 1. Payment submitted (needs admin confirmation) → paymentSubmitted=true
  // 2. Awaiting customer payment → paymentSubmitted=false
  const submittedOrders = unpaidOrders.filter((o) => !!o.paymentSubmitted);
  const awaitingOrders  = unpaidOrders.filter((o) => !o.paymentSubmitted);

  // ── Pagination ──────────────────────────────────────────────────────────
  const PAGE_SIZE = 10;
  const [submittedPage, setSubmittedPage] = useState(1);
  const [awaitingPage,  setAwaitingPage]  = useState(1);

  const pagedSubmitted = submittedOrders.slice((submittedPage - 1) * PAGE_SIZE, submittedPage * PAGE_SIZE);
  const pagedAwaiting  = awaitingOrders.slice((awaitingPage  - 1) * PAGE_SIZE, awaitingPage  * PAGE_SIZE);
  const submittedTotalPages = Math.max(1, Math.ceil(submittedOrders.length / PAGE_SIZE));
  const awaitingTotalPages  = Math.max(1, Math.ceil(awaitingOrders.length  / PAGE_SIZE));

  // ✅ Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="size-8 animate-spin text-gray-400" />
          <p className="text-gray-600">Loading unpaid orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] via-[#e8e8e8] to-[#f0f0f0] py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="icon-container-lg md:icon-container-xl flex items-center justify-center bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-2xl shadow-md flex-shrink-0">
                <DollarSign className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="heading-3 md:heading-2 font-bold text-[#8B6F47] truncate">
                  Awaiting Payment
                </h1>
                <p className="text-neutral-600 text-xs truncate">
                  {submittedOrders.length > 0
                    ? `${submittedOrders.length} payment${submittedOrders.length === 1 ? '' : 's'} to confirm · ${awaitingOrders.length} awaiting customer`
                    : `${awaitingOrders.length} order${awaitingOrders.length === 1 ? '' : 's'} awaiting payment`}
                </p>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-[#D4A574]/10 border border-[#D4A574]/40 rounded-xl transition-all shadow-sm flex-shrink-0 active:scale-95"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className="icon-md text-[#D4A574]" />
              <span className="body-xs text-[#8B6F47] font-semibold hidden md:inline whitespace-nowrap">
                Refresh
              </span>
            </button>
          </div>
        </div>

        {/* ── SECTION 1: Payment Submitted — Needs Admin Confirmation ── */}
        {submittedOrders.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-[#FF9800]/50 shadow-lg overflow-hidden mb-6">
            <div className="px-5 py-3.5 bg-gradient-to-r from-[#FF9800] to-[#F57C00] flex items-center gap-2">
              <CheckCircle2 className="icon-sm text-white flex-shrink-0" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-white leading-tight">
                ⏳ Payment Submitted — Needs Confirmation ({submittedOrders.length})
              </h2>
            </div>

            <div className="p-3 sm:p-5">
              <div className="space-y-3">
                {pagedSubmitted.map((order) => (
                  <UnpaidOrderCard
                    key={order.id}
                    order={order}
                    onViewOrder={onViewOrder}
                    onConfirmPayment={onConfirmPayment}
                    onSendReminder={onSendReminder}
                    onCancelOrder={onCancelOrder}
                  />
                ))}
                <Pagination
                  currentPage={submittedPage}
                  totalPages={submittedTotalPages}
                  totalItems={submittedOrders.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setSubmittedPage}
                  itemLabel="payments"
                  className="mt-4"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 2: Awaiting Customer Payment ── */}
        <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden">
          <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574] flex items-center gap-2">
            <Clock className="icon-sm text-white flex-shrink-0" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-white leading-tight">
              💰 Awaiting Customer Payment ({awaitingOrders.length})
            </h2>
          </div>

          <div className="p-3 sm:p-5">
            {unpaidOrders.length === 0 ? (
              // Empty state (no orders at all)
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Unpaid Orders
                </h3>
                <p className="text-gray-500">
                  All orders have been paid.
                </p>
              </div>
            ) : awaitingOrders.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  All approved orders have submitted payment — see section above.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pagedAwaiting.map((order) => (
                  <UnpaidOrderCard
                    key={order.id}
                    order={order}
                    onViewOrder={onViewOrder}
                    onConfirmPayment={onConfirmPayment}
                    onSendReminder={onSendReminder}
                    onCancelOrder={onCancelOrder}
                  />
                ))}
                <Pagination
                  currentPage={awaitingPage}
                  totalPages={awaitingTotalPages}
                  totalItems={awaitingOrders.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setAwaitingPage}
                  itemLabel="orders"
                  className="mt-4"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}