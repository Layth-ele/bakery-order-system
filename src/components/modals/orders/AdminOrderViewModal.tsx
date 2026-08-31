/**
 * AdminOrderViewModal - Display order details in read-only mode for approved/in-process orders
 * 
 * ✅ MAR 18, 2026: Added Payment Details section + replaced REJECT ORDER with CLOSE button
 * ✅ FEB 22, 2026: Optimized performance with useMemo
 * ✅ FEB 19, 2026: MOVED to /components/modals/orders/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 */

import { useMemo } from "react"; // 🚀 PERFORMANCE: Memoize expensive computations
import { formatTimestamp, toDate } from '../../../utils/timestampFormatting';
import { ModalThreeSections } from './ModalOrderSections';
import {
  Package,
  User,
  Calendar,
  Truck,
  Clock,
  DollarSign,
  Info,
  AlertCircle,
  CheckCircle2 as CheckCircle,
  XCircle,
  FileText,
  Copy,
} from "lucide-react";
import type { Order, Product, Category } from "../../../types";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalFooterButtons } from '../../../ui/modals/ModalFooterButtons';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface AdminOrderViewModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onApprove?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  onDownloadExcel: () => void;
  onDownloadPDF: () => void;
  onDownloadBakeryPDF: () => void;
  onCancelOrder?: (orderId: string) => void;
  onClose: () => void;
}

export function AdminOrderViewModal({
  order,
  products,
  categories,
  onApprove,
  onReject,
  onDownloadExcel,
  onDownloadPDF,
  onDownloadBakeryPDF,
  onCancelOrder,
  onClose,
}: AdminOrderViewModalProps): JSX.Element | null {
 // Defensive check - handle missing order
  if (!order) {
    console.error('❌ [AdminOrderViewModal] Order is null or undefined');
    return (
      <StyleModalShell
        width="4xl"
        skinType="info"
        title="Error"
        onClose={onClose}
      >
        <div className="p-6 text-center">
          <p className="body-base text-gray-700 mb-4">Unable to load order details.</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-[#D4A574] to-[#F4E5C3] text-black rounded-lg hover:from-[#C5A028] hover:to-[#D4A574] transition-all font-bold button-text-base"
          >
            Close
          </button>
        </div>
      </StyleModalShell>
    );
  }
  
 // Detect if order is in process (production mode)
  const isInProcess = order.status === "in_process";
  const isPending = order.status === "pending";

  // Calculate order info
  const orderTotal = order.total || 0;
  // 🚀 PERFORMANCE: Memoize expensive category grouping operation
  // This prevents recalculation on every render (was 30-50ms, now <1ms)
  return (
    <StyleModalShell
      onClose={onClose}
      title={isInProcess ? "ORDER IN PROCESS" : "ORDER DETAILS"}
      subtitle={displayOrderNumber(order)}
      width="4xl"
      headerLeft={
        <div className="icon-container-md bg-[#D4A574] rounded-lg shadow-lg">
          <DollarSign className="icon-modal-header text-white" />
        </div>
      }
      footer={
        <ModalFooterButtons
          cancelButton={{ label: "Close", onClick: onClose, variant: "secondary" }}
          confirmButton={isInProcess ? {
            label: "Cancel Order",
            onClick: () => onCancelOrder && onCancelOrder(order.id),
            variant: "danger",
            icon: <XCircle className="w-4 h-4" />,
          } : {
            label: "Approve Order",
            onClick: () => onApprove && onApprove(order.id),
            variant: "success",
            icon: <CheckCircle className="w-4 h-4" />,
          }}
        />
      }
    >
      {/* ✅ Wrapper with spacing between all sections */}
      <div className="space-y-6">
        {/* ✅ STATUS BANNER - Shows status context */}
        {isInProcess && (
          <div className="bg-blue-500/10 border-2 border-blue-500 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="icon-alert text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-blue-900 text-sm">
                  🏭 In Production
                </p>
                <div className="space-y-1 text-xs text-blue-800 mt-0.5">
                  <p>
                    Payment confirmed - order is currently in
                    production.
                  </p>
                  {order.paymentReceivedAt && (
                    <div className="flex items-center gap-2 caption-text">
                      <Clock className="icon-status-sm" />
                      Payment received:{" "}
                      {formatTimestamp(
                        (toDate(order.paymentReceivedAt) ?? new Date()),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isPending && (
          <div className="bg-amber-500/10 border-2 border-amber-500 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="icon-alert text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-amber-900 text-sm">
                  ⏳ Awaiting Approval
                </p>
                <div className="space-y-1 text-xs text-amber-800 mt-0.5">
                  <p>
                    This order is pending admin review and
                    approval.
                  </p>
                  <div className="flex items-center gap-2 caption-text">
                    <Clock className="icon-status-sm" />
                    Submitted:{" "}
                    {order.createdAt
                      ? formatTimestamp(order.createdAt)
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ PAYMENT DETAILS - Brown/Tan theme (matches ORDER TOTAL) */}
        {order.paymentSubmitted && (
          <div className="rounded-xl overflow-hidden shadow-md">
            {/* Brown/Tan header with icon */}
            <div className="bg-gradient-to-r from-[#8B6F47] to-[#A67C52] px-5 py-4 flex items-center gap-3">
              <FileText className="w-7 h-7 text-white" />
              <h3 className="heading-4 text-white font-semibold">
                Payment Details
              </h3>
            </div>
            
            {/* Light blue/gray body */}
            <div className="bg-gradient-to-br from-blue-50 to-slate-100 p-5 space-y-4">
              {/* Top row: Order Number and E-Transfer Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Order Number Card */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-neutral-500 mb-2">
                    <FileText className="w-5 h-5" />
                    <p className="caption-text uppercase">Order Number</p>
                  </div>
                  <div className="flex items-center gap-2 justify-between">
                    <p className="heading-5 text-neutral-900 font-bold break-all">
                      {displayInvoiceNumber(order)}
                    </p>
                    <button
                      onClick={() => {
                        const orderNumber = displayInvoiceNumber(order);
                        const copyToClipboard = (text: string) => {
                          // Try modern Clipboard API first
                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(text)
                              .catch(() => {
                                fallbackCopy(text);
                              });
                          } else {
                            // Use fallback immediately
                            fallbackCopy(text);
                          }
                        };
                        
                        const fallbackCopy = (text: string) => {
                          const textArea = document.createElement('textarea');
                          textArea.value = text;
                          textArea.style.position = 'fixed';
                          textArea.style.left = '-999999px';
                          textArea.style.top = '-999999px';
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          try {
                            document.execCommand('copy');
                          } catch (err) {
                            console.error('Failed to copy:', err);
                          }
                          document.body.removeChild(textArea);
                        };
                        
                        copyToClipboard(orderNumber);
                      }}
                      className="p-2 hover:bg-neutral-100 rounded-lg transition-colors flex-shrink-0"
                      title="Copy order number"
                    >
                      <Copy className="w-5 h-5 text-neutral-600 hover:text-neutral-900" />
                    </button>
                  </div>
                </div>
                
                {/* E-Transfer Password Card */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-neutral-500 mb-2">
                    <FileText className="w-5 h-5" />
                    <p className="caption-text uppercase">E-Transfer Password</p>
                  </div>
                  <p className="heading-5 text-neutral-900 font-bold">
                    {order.transferPassword || "N/A"}
                  </p>
                </div>
              </div>
              
              {/* Bottom: Payment Submitted */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-neutral-500 mb-2">
                  <Clock className="w-5 h-5" />
                  <p className="caption-text uppercase">Payment Submitted</p>
                </div>
                <p className="body-base text-neutral-900 font-semibold">
                  {order.paymentSubmittedAt
                    ? formatTimestamp(order.paymentSubmittedAt)
                    : "N/A"}
                </p>
                <p className="caption-text text-neutral-500 mt-1">
                  {order.paymentSubmittedAt
                    ? (toDate(order.paymentSubmittedAt) ?? new Date()).toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : "Invalid Date"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ✅ 3-SECTION ORDER LAYOUT */}
        <ModalThreeSections order={order} products={products} summaryLabel="Order Total">
        </ModalThreeSections>

        {/* ✅ TIMELINE */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
          <h3 className="modal-label text-neutral-700 uppercase mb-3">
            Timeline
          </h3>
          <div className="space-y-2 body-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">
                Order Created:
              </span>
              <span className="font-semibold text-neutral-900">
                {order.createdAt
                  ? formatTimestamp(order.createdAt)
                  : "N/A"}
              </span>
            </div>
            {order.approvedAt && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">
                  Order Approved:
                </span>
                <span className="font-semibold text-neutral-900">
                  {formatTimestamp((toDate(order.approvedAt) ?? new Date()))} by{" "}
                  {order.approvedBy || "N/A"}
                </span>
              </div>
            )}
            {order.paymentReceivedAt && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">
                  Payment Received:
                </span>
                <span className="font-semibold text-green-600">
                  {formatTimestamp(
                    (toDate(order.paymentReceivedAt) ?? new Date()),
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </StyleModalShell>
  );
}

// Default export for lazy loading
export default AdminOrderViewModal;