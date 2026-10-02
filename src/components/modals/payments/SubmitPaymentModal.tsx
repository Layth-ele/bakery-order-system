/**
 * SubmitPaymentModal - Customer submits payment proof for an approved order
 *
 * ✅ FEB 20, 2026: MOVED to /components/modals/payments/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ FEB 17, 2026: Fixed getWeekRange import from weekUtils (not dateUtils)
 * 🔄 CACHE BUST: v1.0.4 - Fixed invalidateCache import (object from useCachedFirebase, not hook)
 */

import { invalidateCache, useCachedSettings } from '../../../hooks/useCachedFirebase';
import { ModalFooterButtons, submitForm } from "../../../ui/modals/ModalFooterButtons";
import { useState, useEffect } from "react";
import { DollarSign, CheckCircle } from "lucide-react";
import { Order, Product, Category } from "../../../types";
import { useCachedCustomerOrders } from "../../../hooks/useCachedFirebase";
import { toast } from 'sonner';
import { getServerTimestamp } from '../../../utils/timestamps'; // ✅ TIMESTAMP FIX: Import server timestamp utility
import { useModal } from "../../../contexts/ModalContextNew";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
// ✅ FEB 17, 2026: CRITICAL FIX - Import from weekUtils (NOT dateUtils)
// weekUtils exports: getWeekRange, getWeekDayDate, formatShortDate, etc.
// dateUtils exports: getWeekDates, formatRelativeDate, getWeekDayNames only

import { CopyButton } from "../../shared/CopyButton";
import { submitPaymentAction } from "../../../services/orders/paymentActionService";
 // 🔥 TIMESTAMP FIX: Use new utility
import { ModalThreeSections } from '../orders/ModalOrderSections';
import { displayOrderNumber, displayInvoiceNumber } from '../../../utils/displayId';

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

  // ✅ FIX: Use modal context hook
  const { openModal } = useModal();

  // Load cached orders for real-time updates
 // Fixed destructuring — useCachedOrders returns { data }, not { orders }
  const { data: orders } = useCachedCustomerOrders(initialOrder?.customerId || null);

  // Sync with cached orders for real-time updates
  useEffect(() => {
    // ✅ FIX: Add null check for orders array
    if (!orders || !Array.isArray(orders)) return;

    const updated = orders.find((o) => o.id === order.id);
    if (updated) setOrder(updated);
  }, [orders, order.id]);

  // Where to send the e-transfer: Admin → System Settings → Payment address
  // (the same value the PDF invoice and payment emails use).
  const { data: settings } = useCachedSettings();
  const paymentEmail = ((settings as any)?.paymentAddress || (settings as any)?.businessEmail || '').trim();
  const invoiceNumber = displayInvoiceNumber(order);


  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transferPassword.trim()) {
      toast.error("Please enter the transfer password");
      return;
    }

    setSubmitting(true);

    try {
      // Server-side submission (submitPaymentProof); the admin notification
      // comes from the onOrderLifecycle trigger.
      await submitPaymentAction(
        order.id,                    // orderId
        order.customerId,            // customerId
        order.invoiceId || order.id, // invoiceNumber (payment reference)
        transferPassword             // transferPassword (optional)
      );

      // ✅ NEW: Invalidate caches to refresh UI immediately
      await invalidateCache.orders(); // Refresh orders cache

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

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={onClose}
      title="Submit Payment"
      subtitle={`Order ${invoiceNumber}`}
      footer={
        <ModalFooterButtons
          cancelButton={{ label: "Cancel", onClick: onClose, variant: "secondary", disabled: submitting, keyboardShortcut: "Escape" }}
          confirmButton={{
            label: submitting ? "Submitting..." : "Submit Payment",
            onClick: () => submitForm("submit-payment-form"),
            variant: "primary",
            loading: submitting,
            icon: <CheckCircle className="w-4 h-4" />,
          }}
        />
      }
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#D4A574] flex items-center justify-center shadow-lg">
          <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
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
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 [overflow-wrap:anywhere] text-base font-bold text-[#8B6F47]">
              {paymentEmail || 'Ask the bakery for the e-transfer address'}
            </p>
            {paymentEmail && <CopyButton text={paymentEmail} label="E-transfer email" />}
          </div>
        </div>

        <form id="submit-payment-form" onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Order #
              </label>
              {/* Customers paste this into the e-transfer message */}
              <div className="flex items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-neutral-50 pl-4 pr-1 py-1">
                <span className="whitespace-nowrap font-mono text-sm font-semibold tracking-tight text-neutral-800">{invoiceNumber}</span>
                <CopyButton text={invoiceNumber} label="Order number" />
              </div>
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

        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </section>

      {/* Order Info + Items + Summary */}
      <ModalThreeSections order={order} products={products} summaryLabel="Amount Due">
      </ModalThreeSections>
    </StyleModalShell>
  );
}