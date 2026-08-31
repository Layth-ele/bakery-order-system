/**
 * PAYMENT IN REVIEW MODAL
 *
 * ✅ FEB 19, 2026: MOVED to /components/modals/payments/ (consolidation project)
 *
 * Shows clear status when customer's payment is under review by admin.
 * Displayed when customer clicks "View Status" button on payment-in-review notification.
 * ✅ NOW SUPPORTS: Regular order payments AND adjustment payments
 */

import React, { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  Package,
  DollarSign,
  Calendar,
  MapPin,
  User,
  AlertTriangle,
} from "lucide-react";
import type { Order, Product, Category, OrderAdjustment } from "../../../types"; // Import proper types
import { getWeekRange } from "../../../utils/weekUtils";
import { isFirebaseConfigured } from "../../../firebase/config";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { CloseFooter } from "../../../ui/modals/ModalFooterButtons"; // ✅ FEB 21, 2026
import { formatTimestamp } from "../../../utils/timestampFormatting"; // 🔥 TIMESTAMP FIX: Use new utility
import { ModalThreeSections } from '../orders/ModalOrderSections';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface PaymentInReviewModalProps {
  order: Order;
  adjustment?: OrderAdjustment; // Properly typed
  viewMode?: "customer" | "admin";
  products?: Product[]; // Properly typed
  categories?: Category[]; // Properly typed
  onClose?: () => void;
}

export function PaymentInReviewModal({
  order: initialOrder,
  adjustment,
  viewMode = "customer",
  products = [],
  categories = [],
  onClose,
}: PaymentInReviewModalProps): JSX.Element | null {
  const [order, setOrder] = useState<Order>(initialOrder);

  useEffect(() => {
 // In Firebase mode, orders are managed via Firestore real-time
    if (isFirebaseConfigured) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "bakery_orders") {
        const orders: Order[] = ((() => { try { return JSON.parse(e.newValue || "[]"); } catch { return null; } })());
        const updated = orders.find((o) => o.id === order.id);
        if (updated) setOrder(updated);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () =>
      window.removeEventListener(
        "storage",
        handleStorageChange,
      );
  }, [order.id]);

  // Calculate order total (either base order or adjustment)
  const paymentAmount = adjustment
    ? adjustment.paid?.amount || Math.abs(adjustment.deltaTotal)
    : order.total || 0;

  // Get week range
  const weekRange =
    order.weekRange ||
    getWeekRange(Number(order.weekYear) || 0, Number(order.isoWeek) || 0);

  // Determine payment type and status
  const isAdjustmentPayment = !!adjustment;
  const paymentStatus = isAdjustmentPayment
    ? adjustment.paid?.status || "unpaid"
    : order.paymentSubmitted
      ? "submitted"
      : "unpaid";

  return (
    <StyleModalShell
      width="4xl"
      skinType="info"
      onClose={onClose || (() => {})}
      title="PAYMENT IN REVIEW"
      subtitle="Your payment is being processed"
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#333333] animate-pulse" />
        </div>
      }
      footer={<CloseFooter onClose={onClose || (() => {})} />}
    >
      <ModalThreeSections order={order} products={products}>
      </ModalThreeSections>
</StyleModalShell>
  );
}