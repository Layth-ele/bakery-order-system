/**
 * CancelledOrderDetailsModal - Shows details for CANCELLED orders
 * 
 * ✅ MAR 17, 2026: Created comprehensive cancelled order details modal
 *   - Handles UNPAID cancelled orders (simple cancellation details)
 *   - Handles PAID cancelled orders (with credit refund breakdown)
 *   - Shows cancellation fees and refund calculations for paid orders
 *   - Displays professional invoice number format
 *   - Two distinct views based on payment status
 * 
 * Use Cases:
 * 1. UNPAID Orders (status: 'cancelled', !paymentReceived):
 *    - Simple cancellation notification
 *    - Shows cancellation reason
 *    - No refund calculations (no payment was made)
 * 
 * 2. PAID Orders (status: 'cancelled', paymentReceived):
 *    - Full cancellation details with credit breakdown
 *    - Shows cancellation fee percentage (if applied)
 *    - Displays refund amount (credit issued)
 *    - GST refund breakdown
 *    - Complete order details
 */

import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CloseFooter, ModalFooterButtons } from '../../../ui/modals/ModalFooterButtons';
import { 
  XCircle, 
  User, 
  Calendar, 
  MapPin, 
  DollarSign, 
  AlertTriangle, 
  FileText,
  CreditCard,
  Info,
  TrendingDown
} from 'lucide-react';
import type { Order, Product, Category } from '../../../types';
import { formatOrderDateWithFallback } from '../../../services/calculators';
import { ModalThreeSections } from './ModalOrderSections';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface CancelledOrderDetailsModalProps {
  order: Order | null;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  notificationId?: string;
  onDeleteNotification?: (id: string) => void;
}

export function CancelledOrderDetailsModal({
  order,
  products,
  categories,
  onClose,
  notificationId,
  onDeleteNotification
}: CancelledOrderDetailsModalProps): JSX.Element | null {
  
  // ✅ NULL CHECK: Return early if order is not loaded
  if (!order) {
    const handleDelete = () => {
      if (notificationId && onDeleteNotification) {
        onDeleteNotification(notificationId);
      }
      onClose();
    };
    
    return (
      <StyleModalShell
        width="4xl"
        skinType="danger"
        isOpen={true}
        onClose={onClose}
        title="ORDER NOT FOUND"
        subtitle="This order no longer exists"
        headerLeft={
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        }
        footer={
          <ModalFooterButtons
            cancelButton={{ label: "Close", onClick: onClose, variant: "secondary" }}
            confirmButton={notificationId && onDeleteNotification ? {
              label: "Delete Notification",
              onClick: handleDelete,
              variant: "danger",
            } : undefined}
          />
        }
      >
        <div className="bg-red-50 rounded-xl p-6 border-2 border-red-300">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-[#333333] font-bold text-lg mb-2">
                Order Has Been Deleted
              </h3>
              <p className="text-[#666666] text-sm mb-4">
                This order has been removed from the system and can no longer be viewed.
              </p>
              {/* Delete handled via footer */}
            </div>
          </div>
        </div>
      </StyleModalShell>
    );
  }

  // ✅ Determine if this was a paid order (payment received before cancellation)
  const wasPaid = !!(order.paymentReceived || order.paymentReceivedAt);
  
  // ✅ Calculate refund/credit details for paid orders
  const orderTotal = order.total || 0;
  const cancellationFeePercentage = order.cancellationFeePercentage || 0;
  const cancellationFeeAmount = (orderTotal * cancellationFeePercentage) / 100;
  const refundAmount = orderTotal - cancellationFeeAmount;
  
  // ✅ GST breakdown (5% of refund amount)
  const gstRate = 0.05;
  const subtotalRefund = refundAmount / (1 + gstRate);
  const gstRefund = refundAmount - subtotalRefund;

  // ✅ Get cancellation reason
  const cancellationReason = order.cancellationReason || 'No reason provided';
  
  // ✅ Get invoice number (professional format)
  const invoiceNumber = displayInvoiceNumber(order);

  return (
    <StyleModalShell
      isOpen={true}
      onClose={onClose}
      skinType="danger"
      title="ORDER CANCELLED"
      subtitle={wasPaid ? "Credit issued to your account" : "Order has been cancelled"}
      width="4xl"
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={<CloseFooter onClose={onClose} />}
    >
      {/* Cancellation Alert - Different for Paid vs Unpaid */}
      {wasPaid ? (
        // ✅ PAID ORDER: Show credit breakdown
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border-2 border-red-500">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center shadow-lg">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-[#333333] font-bold text-base sm:text-lg mb-2">
                Order Cancelled - Credit Issued
              </h3>
              <p className="text-[#666666] text-xs sm:text-sm mb-3">
                This order was cancelled after payment was received. A credit has been issued to your account.
              </p>
              <div className="bg-white/60 rounded-lg p-3 sm:p-4 space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-[#666666]">Original Order Total:</span>
                  <span className="text-[#333333] font-semibold">${orderTotal.toFixed(2)}</span>
                </div>
                {cancellationFeePercentage > 0 && (
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-[#666666]">Cancellation Fee ({cancellationFeePercentage}%):</span>
                    <span className="text-red-600 font-semibold">-${cancellationFeeAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[#333333] font-bold text-sm sm:text-base">Credit Issued:</span>
                    <span className="text-green-600 font-bold text-base sm:text-lg">${refundAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm mt-3">
                <Info className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                <span className="text-[#666666]">
                  Credit can be applied to future orders
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ✅ UNPAID ORDER: Simple cancellation notice
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-400">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center shadow-lg">
                <XCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-[#333333] font-bold text-lg mb-2">
                Order Cancelled
              </h3>
              <p className="text-[#666666] text-sm mb-3">
                This order was cancelled before payment was received.
              </p>
              <div className="bg-white/60 rounded-lg p-4">
                <p className="text-[#666666] text-sm">
                  <span className="font-semibold text-[#333333]">Reason:</span> {cancellationReason}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Section */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden mt-6">
        <div className="bg-gradient-to-r from-[#333333] to-[#4a4238] px-6 py-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Cancellation Details
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-gray-500 text-sm mb-1">Cancellation Reason</p>
            <p className="text-[#333333] font-semibold">{cancellationReason}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Cancelled On</p>
            <p className="text-[#333333] font-semibold">
              {formatOrderDateWithFallback(order.cancelledAt)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Invoice Number</p>
            <p className="text-[#333333] font-semibold">{invoiceNumber}</p>
          </div>
        </div>
      </div>

      {/* Credit Refund Breakdown - ONLY for Paid Orders */}
      {wasPaid && (
        <div className="bg-white rounded-xl border-2 border-green-200 overflow-hidden mt-6">
          <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Credit Refund Breakdown
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-green-50 rounded-lg p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 text-xs sm:text-sm">Subtotal Credit (Before GST):</span>
                <span className="text-[#333333] font-semibold">${subtotalRefund.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700 text-xs sm:text-sm">GST Refund (5%):</span>
                <span className="text-[#333333] font-semibold">${gstRefund.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-green-300">
                <div className="flex items-center justify-between">
                  <span className="text-[#333333] font-bold text-sm sm:text-base">Total Credit Issued:</span>
                  <span className="text-green-600 font-bold text-sm sm:text-base">${refundAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {cancellationFeePercentage > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 sm:p-4 border border-amber-300">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[#333333] font-semibold text-xs sm:text-sm mb-1">
                      Cancellation Fee Applied
                    </p>
                    <p className="text-[#666666] text-xs sm:text-sm">
                      A {cancellationFeePercentage}% cancellation fee (${cancellationFeeAmount.toFixed(2)}) was deducted from your refund.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-300">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[#333333] font-semibold text-xs sm:text-sm mb-1">
                    How to Use Your Credit
                  </p>
                  <p className="text-[#666666] text-xs sm:text-sm">
                    Your credit of ${refundAmount.toFixed(2)} is now available in your account. 
                    You can choose to apply it manually in your next order.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ModalThreeSections order={order} products={products ?? []} summaryLabel="Order Total">
      </ModalThreeSections>
</StyleModalShell>
  );
}