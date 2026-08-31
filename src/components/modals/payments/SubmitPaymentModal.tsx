/**
 * SubmitPaymentModal - Customer submits payment proof for an approved order
 *
 * ✅ FEB 20, 2026: MOVED to /components/modals/payments/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ FEB 17, 2026: Fixed getWeekRange import from weekUtils (not dateUtils)
 * 🔄 CACHE BUST: v1.0.4 - Fixed invalidateCache import (object from useCachedFirebase, not hook)
 */

import { invalidateCache } from '../../../hooks/useCachedFirebase';
import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  X,
  Upload,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Image as ImageIcon,
  Copy,
  Check,
} from "lucide-react";
import { Order, Product, Category } from "../../../types";
import { useCachedOrders } from "../../../hooks/useCachedFirebase";
import { toast } from 'sonner';
import { getServerTimestamp } from '../../../utils/timestamps'; // ✅ TIMESTAMP FIX: Import server timestamp utility
import { useModal } from "../../../contexts/ModalContextNew";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
// ✅ FEB 17, 2026: CRITICAL FIX - Import from weekUtils (NOT dateUtils)
// weekUtils exports: getWeekRange, getWeekDayDate, formatShortDate, etc.
// dateUtils exports: getWeekDates, formatRelativeDate, getWeekDayNames only
import { getWeekRange } from "../../../utils/weekUtils";
import { copyToClipboard } from "../../../utils/clipboardUtils";
import { submitPaymentWorkflow } from "../../../notifications"; // ✅ PHASE 5: Updated to use consolidated notifications
import { formatTimestamp } from "../../../utils/timestampFormatting"; // 🔥 TIMESTAMP FIX: Use new utility
import { ModalThreeSections } from '../orders/ModalOrderSections';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface SubmitPaymentModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onPaymentSubmitted?: (orderId: string) => void;
  onClose: () => void;
}

export function SubmitPaymentModal({
  order: initialOrder,
  products = [],
  categories = [],
  onPaymentSubmitted,
  onClose,
}: SubmitPaymentModalProps): JSX.Element | null {
  // ✅ PERFORMANCE: Removed excessive debug logging

  const [order, setOrder] = useState<Order>(initialOrder);
  const [transferPassword, setTransferPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // ✅ FIX: Use modal context hook
  const { openModal } = useModal();

  // Load cached orders for real-time updates
 // Fixed destructuring — useCachedOrders returns { data }, not { orders }
  const { data: orders } = useCachedOrders();

  // Sync with cached orders for real-time updates
  useEffect(() => {
    // ✅ FIX: Add null check for orders array
    if (!orders || !Array.isArray(orders)) return;

    const updated = orders.find((o) => o.id === order.id);
    if (updated) setOrder(updated);
  }, [orders, order.id]);

  // Payment email (hardcoded or from config)
  const paymentEmail = (import.meta.env.VITE_PAYMENT_EMAIL as string) || "payment@bakery.com";
  const invoiceNumber = displayInvoiceNumber(order);

  const handleCopyOrderId = async () => {
    const success = await copyToClipboard(displayOrderNumber(order));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transferPassword.trim()) {
      toast.error("Please enter the transfer password");
      return;
    }

    setSubmitting(true);

    try {
      // ✅ NEW: Use workflow service for complete payment submission + notification update
      // This handles: order update, admin notification, AND customer notification update
      await submitPaymentWorkflow(
        order.id,                    // orderId
        order.customerId,            // customerId
        order.invoiceId || order.id, // invoiceNumber (payment reference)
        transferPassword             // transferPassword (optional)
      );

      // ✅ NEW: Invalidate caches to refresh UI immediately
      await invalidateCache.orders(); // Refresh orders cache
      await invalidateCache.notifications(order.customerId); // Refresh notifications cache

      // Create updated order object for modal
      const updatedOrder = {
        ...order,
        paymentSubmitted: true,
        paymentSubmittedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX: Use server timestamp
        transferPassword: transferPassword,
      };

      // Call onPaymentSubmitted callback if provided
      if (onPaymentSubmitted) {
        onPaymentSubmitted(order.id);
      }

      toast.success(
        "Payment information submitted successfully!",
        {
          description:
            "Admin will verify your payment shortly.",
        },
      );

 // Close current modal, then open Payment Submitted modal
      onClose();

      // Open Payment Submitted modal immediately
      setTimeout(() => {
        openModal("PAYMENT_SUBMITTED", {
          order: updatedOrder,
        });
      }, 100); // Small delay to ensure smooth transition
    } catch (error) {
      console.error("❌ Error submitting payment:", error);
      toast.error("Failed to submit payment information");
    } finally {
      setSubmitting(false);
    }
  };

  const computedWeekRange =
    order.week && order.year
      ? getWeekRange(order.week, order.year)
      : order.weekRange || "N/A";

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Defensive calculations
  const subtotal = order.subtotal ?? 0;
  const gst = order.gst ?? 0;
  const deliveryFee = order.deliveryFee ?? 0;
  const serviceCharge = order.serviceCharge ?? 0;
  const total = order.total ?? 0;

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={onClose}
      title="Submit Payment"
      subtitle={`Order ${invoiceNumber}`}
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#D4A574] flex items-center justify-center shadow-lg">
          <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      headerRight={
        <div className="flex items-center bg-black/20 rounded px-2 py-1 gap-2">
          <span className="text-xs text-white/80 font-medium">
            {displayOrderNumber(order)}
          </span>
          <button
            onClick={handleCopyOrderId}
            className="hover:text-white text-white/60 transition-colors"
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        </div>
      }
    >
      {/* 1. PAYMENT FORM (TOP) */}
      <section className="mb-8 bg-white rounded-xl p-6 border-2 border-[#D4A574] shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-full bg-[#D4A574]/10 flex items-center justify-center">
            <DollarSign className="size-6 text-[#D4A574]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-800">
              E-Transfer Details
            </h3>
            <p className="text-sm text-neutral-500">
              Submit your transfer information below
            </p>
          </div>
        </div>

        <div className="bg-[#FFF8E7] rounded-lg p-4 mb-6 border border-[#D4A574]/30">
          <p className="text-sm text-neutral-600 mb-1">
            E-Transfer Email:
          </p>
          <p className="text-base font-bold text-[#D4A574]">
            {paymentEmail}
          </p>
        </div>

        <form
          onSubmit={handlePaymentSubmit}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Order #
              </label>
              <input
                type="text"
                value={invoiceNumber}
                disabled
                className="w-full px-4 py-2.5 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-500 font-medium cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Transfer Password{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={transferPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTransferPassword(e.target.value)
                }
                required
                placeholder="Enter security answer"
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-[#D4A574] outline-none transition-all text-black font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#D4A574] to-[#E8C4A2] hover:from-[#C49564] hover:to-[#D4A574] text-[#333333] font-semibold py-2.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md text-sm"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-[#333]/30 border-t-[#333] rounded-full animate-spin flex-shrink-0" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Submit Payment
              </>
            )}
          </button>
        </form>
      </section>

      {/* Order Info + Items + Summary */}
      <ModalThreeSections order={order} products={products} summaryLabel="Amount Due">
      </ModalThreeSections>
    </StyleModalShell>
  );
}