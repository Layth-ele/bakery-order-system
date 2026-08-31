/**
 * UnpaidOrderCard - Memoized order card for AdminUnpaidOrders
 * 
 * ✅ FEB 22, 2026: Created to fix 70ms performance issue
 * - Extracted from AdminUnpaidOrders inline JSX
 * - Wrapped in React.memo for optimized re-renders
 * - All IIFE expressions converted to useMemo
 * 
 * ✅ MAR 7, 2026: Fixed prop mismatch
 * - Removed unused products and categories props
 * - Added displayName for better debugging
 */

import React, { useMemo } from 'react';
import { Eye, Check, Bell, Mail, XCircle, User, ExternalLink } from 'lucide-react';
import { Order } from '../../types';
import { useModal } from '../../contexts/ModalContextNew';

interface UnpaidOrderCardProps {
  order: Order;
  onViewOrder: (order: Order) => void;
  onConfirmPayment: (order: Order) => void;
  onSendReminder: (order: Order) => void;
  onCancelOrder: (order: Order) => void;
}

function UnpaidOrderCardComponent({
  order,
  onViewOrder,
  onConfirmPayment,
  onSendReminder,
  onCancelOrder,
}: UnpaidOrderCardProps) {
  const { openModal } = useModal();

  // ✅ PERFORMANCE: Memoize expensive calculations
  const productCount = useMemo(() => order.items?.length || 0, [order.items]);
  
  const totalQuantity = useMemo(
    () => order.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0,
    [order.items]
  );

  const paymentSubmitted = useMemo(
    () => !!(order.paymentSubmitted && !order.paymentReceived),
    [order.paymentSubmitted, order.paymentReceived]
  );

  const reminderCount = order.paymentReminderCount || 0;
  const emailCount = order.emailReminderCount || 0;
  const isEmailMode = reminderCount >= 2;

  const handleCustomerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (openModal as any)('CUSTOMER_PROFILE', {
      customerEmail: order.customerEmail || order.customerId || "",
      onClose: () => {},
      isAdmin: true,
      openModal,
    }, 'lg');
  };

  return (
    <div className="border border-[#E8C4A2] rounded-lg p-3 sm:p-4 hover:border-[#D4A574] transition-all bg-white shadow-sm hover:shadow-md">
      {/* DESKTOP LAYOUT */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8C4A2]/50">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wide">Store</span>
              <div className="text-[#8B6F47] font-bold text-lg">
                {order.customerName || 'Unknown Customer'}
              </div>
            </div>

            <div className="h-10 w-px bg-[#E8C4A2]"></div>

            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wide">Week</span>
              <div className="text-[#333] font-semibold text-base">
                Week {order.week || 'N/A'} {order.weekRange && `(${order.weekRange})`}
              </div>
            </div>

            <div className="h-10 w-px bg-[#E8C4A2]"></div>

            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wide">Products</span>
              <div className="text-[#333] font-semibold text-base">
                {productCount} {productCount === 1 ? 'item' : 'items'}
              </div>
            </div>
          </div>

          {paymentSubmitted ? (
            <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white text-xs font-bold uppercase shadow-md">
              ⏳ PAYMENT UNDER REVIEW
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#F44336] to-[#D32F2F] text-white text-xs font-bold uppercase shadow-md">
              💰 NOT PAID
            </span>
          )}
        </div>

        <div className="flex items-center justify-around gap-4 w-full">
          <button
            onClick={async () => {
              await onViewOrder(order);
            }}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8B6F47] to-[#A67C52] hover:from-[#7A5F3E] hover:to-[#8B6F47] text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg"
            type="button"
          >
            <Eye className="w-4 h-4" />
            <span className="uppercase tracking-wide">VIEW</span>
          </button>

          {paymentSubmitted ? (
            <button
              onClick={async () => {
                await onConfirmPayment(order);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] hover:from-[#45A049] hover:to-[#4CAF50] text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg"
              type="button"
            >
              <Check className="w-4 h-4" />
              <span className="uppercase tracking-wide">CONFIRM PAYMENT</span>
            </button>
          ) : isEmailMode ? (
            <button
              onClick={async () => {
                await onSendReminder(order);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#9C27B0] to-[#7B1FA2] hover:from-[#7B1FA2] hover:to-[#6A1B9A] text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg"
              type="button"
            >
              <Mail className="w-4 h-4" />
              <span className="uppercase tracking-wide">
                {emailCount > 0 ? `SEND EMAIL (${emailCount})` : 'SEND EMAIL REMINDER'}
              </span>
            </button>
          ) : (
            <button
              onClick={async () => {
                await onSendReminder(order);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#29B6F6] to-[#039BE5] hover:from-[#039BE5] hover:to-[#0288D1] text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg"
              type="button"
            >
              <Bell className="w-4 h-4" />
              <span className="uppercase tracking-wide">
                {reminderCount > 0 ? `SEND REMINDER (${reminderCount}/2)` : 'SEND REMINDER'}
              </span>
            </button>
          )}

          <button
            onClick={async () => {
              await onCancelOrder(order);
            }}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#F44336] to-[#D32F2F] hover:from-[#D32F2F] hover:to-[#B71C1C] text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg"
            type="button"
          >
            <XCircle className="w-4 h-4" />
            <span className="uppercase tracking-wide">CANCEL ORDER</span>
          </button>
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="block sm:hidden">
        {/* Row 1: Store Name (Clickable Link) + Status Badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Store Name Button - Mobile Optimized */}
          <div>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1 block">Store</span>
            <button
              onClick={handleCustomerClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#8B6F47] to-[#A67C52] hover:from-[#7A5F3E] hover:to-[#8B6F47] text-white transition-all duration-200 shadow-sm text-xs"
              type="button"
            >
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-bold uppercase truncate max-w-[140px]">
                {order.customerName || 'Unknown'}
              </span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </button>
          </div>
          
          {/* Status Badge - Compact Mobile Version */}
          <div className="flex-shrink-0">
            {paymentSubmitted ? (
              <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white text-[9px] font-bold uppercase shadow-sm whitespace-nowrap">
                <span className="flex-shrink-0">⏳</span>
                <span>REVIEW</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-gradient-to-r from-[#F44336] to-[#D32F2F] text-white text-[9px] font-bold uppercase shadow-sm whitespace-nowrap">
                💰 NOT PAID
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Total Qty + Products */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1 block">Total Qty</span>
            <div className="text-[#333] font-bold text-sm leading-tight">
              {totalQuantity} units
            </div>
          </div>

          <div className="flex-1 text-right">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1 block">Products</span>
            <div className="text-[#333] font-bold text-sm leading-tight">
              {productCount} {productCount === 1 ? 'item' : 'items'}
            </div>
          </div>
        </div>

        {/* Row 3: Week (Centered) - Reduced Font Size */}
        <div className="flex justify-center mb-4 pb-4 border-b border-[#E8C4A2]/50">
          <div className="text-center">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1 block">Week</span>
            <div className="text-[#333] font-bold text-sm">
              Week {order.week || 'N/A'}
            </div>
            {order.weekRange && (
              <div className="text-[10px] text-neutral-400 mt-1">
                {order.weekRange}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - Vertical Stack for Consistent Sizing */}
        <div className="flex flex-col items-stretch gap-2 w-full">
          {/* VIEW Button */}
          <button
            onClick={async () => {
              await onViewOrder(order);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#8B6F47] to-[#A67C52] hover:from-[#7A5F3E] hover:to-[#8B6F47] text-white transition-all duration-300 font-medium shadow-md hover:shadow-lg"
            type="button"
          >
            <Eye className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-bold leading-tight uppercase tracking-wide">VIEW</span>
          </button>

          {/* CONFIRM PAYMENT or SEND REMINDER Button */}
          {paymentSubmitted ? (
            <button
              onClick={async () => {
                await onConfirmPayment(order);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] hover:from-[#45A049] hover:to-[#4CAF50] text-white transition-all duration-300 font-medium shadow-md hover:shadow-lg"
              type="button"
            >
              <Check className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-bold leading-tight uppercase tracking-wide">CONFIRM PAYMENT</span>
            </button>
          ) : isEmailMode ? (
            <button
              onClick={async () => {
                await onSendReminder(order);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#9C27B0] to-[#7B1FA2] hover:from-[#7B1FA2] hover:to-[#6A1B9A] text-white transition-all duration-300 font-medium shadow-md hover:shadow-lg"
              type="button"
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-bold leading-tight uppercase tracking-wide">
                {emailCount > 0 ? `SEND EMAIL (${emailCount})` : 'SEND EMAIL REMINDER'}
              </span>
            </button>
          ) : (
            <button
              onClick={async () => {
                await onSendReminder(order);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#29B6F6] to-[#039BE5] hover:from-[#039BE5] hover:to-[#0288D1] text-white transition-all duration-300 font-medium shadow-md hover:shadow-lg"
              type="button"
            >
              <Bell className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-bold leading-tight uppercase tracking-wide">
                {reminderCount > 0 ? `SEND REMINDER (${reminderCount}/2)` : 'SEND REMINDER'}
              </span>
            </button>
          )}

          {/* CANCEL ORDER Button */}
          <button
            onClick={async () => {
              await onCancelOrder(order);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#F44336] to-[#D32F2F] hover:from-[#D32F2F] hover:to-[#B71C1C] text-white transition-all duration-300 font-medium shadow-md hover:shadow-lg"
            type="button"
          >
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-bold leading-tight uppercase tracking-wide">CANCEL ORDER</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ✅ PERFORMANCE: Memoize component - only re-render when order or callbacks change
export const UnpaidOrderCard = React.memo(UnpaidOrderCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.order === nextProps.order &&
    prevProps.onViewOrder === nextProps.onViewOrder &&
    prevProps.onConfirmPayment === nextProps.onConfirmPayment &&
    prevProps.onSendReminder === nextProps.onSendReminder &&
    prevProps.onCancelOrder === nextProps.onCancelOrder
  );
});

// ✅ DEBUGGING: Add displayName for better debugging
UnpaidOrderCard.displayName = 'UnpaidOrderCard';