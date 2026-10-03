/**
 * Order Review Modal
 *
 * Allows customers to review their order before final submission.
 * Shows products, days/dates, and quantities in a clean, mobile-friendly layout.
 * Premium black and gold aesthetic matching the bakery theme.
 */

import { useState } from "react";
import { ShoppingCart, CheckCircle, Edit } from "lucide-react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalFooterButtons, CloseFooter } from "../../../ui/modals/ModalFooterButtons";
import type { Product } from "../../../types";
import type { DayQuantities } from "../../../types/order-flow";
import { ProductImagePlaceholder } from "../../shared/ProductImagePlaceholder";
import {
  getWeekDayDate,
  formatShortDate,
  getWeekRange,
} from "../../../utils/weekUtils";
import { logger } from '../../../utils/logger';
import { OrderSummaryCard } from './OrderSummaryCard';

interface CartItem {
  product: Product;
  quantities: DayQuantities;
  total: number;
  price: number;
}

interface OrderReviewModalProps {
  cartItems: CartItem[];
  selectedWeek: number;
  selectedYear: number;
  onConfirm: () => void;
  onClose: () => void;
  /** The cart's totals (same numbers the order panel shows). */
  summary?: { subtotal: number; gst: number; deliveryFee: number; serviceCharge: number; creditApplied: number; total: number };
}

const days: Array<{
  key: keyof DayQuantities;
  label: string;
}> = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

export function OrderReviewModal({
  cartItems,
  selectedWeek,
  selectedYear,
  onConfirm,
  onClose,
  summary,
}: OrderReviewModalProps): JSX.Element | null {
  const weekRange = getWeekRange(selectedWeek, selectedYear);

 // Prevent double-submission with loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ DEFENSIVE: Ensure cartItems is always a valid array with no undefined entries
  const safeCartItems = Array.isArray(cartItems)
    ? cartItems.filter((item): item is typeof item => !!item && !!item.product && typeof item.total === 'number')
    : [];

  // Only the days something was ordered for (all seven if every day has items).
  const activeDays = days.filter((d) => safeCartItems.some((it) => (it.quantities[d.key] || 0) > 0));
  const shownDays = activeDays.length > 0 ? activeDays : days;
  
 // Add defensive logging and handler wrapper with double-submit protection
  const handleConfirmClick = async () => {
    // Prevent double-submission
    if (isSubmitting) {
      logger.warn('⚠️ [OrderReviewModal] Already submitting, ignoring duplicate click');
      return;
    }

    
    if (typeof onConfirm === 'function') {
      setIsSubmitting(true);
      try {
        await onConfirm();
      } catch (error) {
        console.error('❌ [OrderReviewModal] onConfirm failed:', error);
        setIsSubmitting(false);
      }
    } else {
      console.error('❌ [OrderReviewModal] onConfirm is not a function!', onConfirm);
    }
  };

  // If no items, show error state
  if (safeCartItems.length === 0) {
    return (
      <StyleModalShell
        width="md"
        onClose={onClose}
        title="Review Your Order"
        icon={ShoppingCart}
        footer={<CloseFooter onClose={onClose} />}
      >
        <p className="text-center text-neutral-700">No items in cart to review.</p>
      </StyleModalShell>
    );
  }

  return (
    <StyleModalShell
      width="5xl"
      onClose={isSubmitting ? () => {} : onClose}
      title="Review Your Order"
      subtitle={`Week ${selectedWeek}, ${selectedYear} • ${weekRange}`}
      icon={ShoppingCart}
      footer={
        <ModalFooterButtons
          cancelButton={{
            label: "Go Back & Edit",
            onClick: onClose,
            variant: "ghost",
            disabled: isSubmitting,
            icon: <Edit className="w-4 h-4" />,
            keyboardShortcut: "Escape",
          }}
          confirmButton={{
            label: isSubmitting ? "Submitting..." : "Confirm & Submit Order",
            onClick: handleConfirmClick,
            variant: "success",
            loading: isSubmitting,
            icon: <CheckCircle className="w-4 h-4" />,
            keyboardShortcut: "Enter",
          }}
        />
      }
    >
        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-gradient-to-r from-neutral-50 to-neutral-100 border-2 border-neutral-200 rounded-xl p-3 sm:p-4">
            <p className="text-neutral-700 text-xs sm:text-sm text-center">
              Please review your order details below. Click{" "}
              <strong className="text-[#D4A574]">
                Confirm & Submit
              </strong>{" "}
              to place your order, or{" "}
              <strong className="text-[#D4A574]">
                Go Back
              </strong>{" "}
              to make changes.
            </p>
          </div>

          {/* Order Summary */}
          <div className="bg-white border-2 border-[#D4A574]/30 rounded-xl overflow-hidden shadow-md">
            <div className="bg-gradient-to-r from-[#D4A574]/10 to-[#C8A882]/10 px-3 sm:px-4 py-2 border-b border-[#D4A574]/30">
              <h3 className="text-[#8B6F47] font-bold text-sm sm:text-base uppercase tracking-wide">
                Order Summary ({safeCartItems.length}{" "}
                {safeCartItems.length === 1
                  ? "Product"
                  : "Products"}
                )
              </h3>
            </div>

            {/* Desktop View - Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-neutral-100 to-neutral-50 border-b border-[#D4A574]/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#8B6F47] text-sm font-bold uppercase tracking-wide">
                      Product
                    </th>
                    {shownDays.map((day) => {
                      const dayDate = getWeekDayDate(
                        selectedWeek,
                        days.indexOf(day),
                        selectedYear,
                      );
                      return (
                        <th
                          key={day.key}
                          className="px-2 py-3 text-center text-[#8B6F47] text-sm font-bold"
                        >
                          <div className="whitespace-nowrap">
                            {day.label}
                          </div>
                          <div className="text-[11px] text-[#8B6F47]/70 font-normal">
                            {formatShortDate(dayDate)}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-center text-[#8B6F47] text-sm font-bold uppercase tracking-wide">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {safeCartItems.map((item, index) => (
                    <tr
                      key={item.product.id}
                      className={
                        index % 2 === 0
                          ? "bg-white"
                          : "bg-neutral-50"
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.product.image ? (
                            <img
                              src={item.product.image}
                              alt={item.product.name}
                              className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                            />
                          ) : (
                            <ProductImagePlaceholder size="sm" className="w-10 h-10 flex-shrink-0" />
                          )}
                          <span className="text-neutral-800 text-sm font-medium">
                            {item.product.name}
                          </span>
                        </div>
                      </td>
                      {shownDays.map((day) => {
                        const qty = item.quantities[day.key];
                        return (
                          <td
                            key={day.key}
                            className="px-2 py-3 text-center"
                          >
                            <span
                              className={`text-sm font-medium ${qty > 0 ? "text-[#4CAF50]" : "text-neutral-300"}`}
                            >
                              {qty > 0 ? qty : "—"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span className="text-[#D4A574] text-sm font-bold">
                          {item.total}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Cards */}
            <div className="lg:hidden divide-y divide-neutral-200">
              {safeCartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="p-4 sm:p-5 bg-white hover:bg-neutral-50 transition-colors"
                >
                  {/* Product Name */}
                  <h4 className="text-neutral-800 text-base sm:text-lg font-bold mb-1">
                    {item.product.name}
                  </h4>

                  {/* Total Units */}
                  <p className="text-[#8B6F47] text-xs sm:text-sm font-medium mb-3">
                    Total: {item.total} units
                  </p>

                  {/* Days Grid */}
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${shownDays.length}, minmax(0, 1fr))` }}>
                    {shownDays.map((day) => {
                      const dayIndex = days.indexOf(day);
                      const qty = item.quantities[day.key];
                      const dayDate = getWeekDayDate(
                        selectedWeek,
                        dayIndex,
                        selectedYear,
                      );
                      const formattedDate =
                        formatShortDate(dayDate);
                      return (
                        <div
                          key={day.key}
                          className="flex flex-col items-center justify-between p-2 bg-gradient-to-b from-neutral-50 to-neutral-100 rounded border border-[#D4A574]/40 min-h-[68px]"
                        >
                          <div className="text-[#8B6F47] text-[11px] font-bold">
                            {day.label}
                          </div>
                          <div className="text-[#8B6F47]/60 text-[11px]">
                            {formattedDate}
                          </div>
                          <div
                            className={`text-base font-bold ${qty > 0 ? "text-[#4CAF50]" : "text-neutral-300"}`}
                          >
                            {qty > 0 ? qty : "0"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {summary && (
          <div className="mt-4">
            <OrderSummaryCard
              subtotal={summary.subtotal}
              gst={summary.gst}
              deliveryFee={summary.deliveryFee}
              serviceCharge={summary.serviceCharge}
              creditApplied={summary.creditApplied}
              total={summary.total}
              label={summary.creditApplied > 0 ? 'Amount Due' : 'Order Total'}
              variant="default"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Delivery fee is an estimate; the bakery confirms it when approving your order.
            </p>
          </div>
        )}
    </StyleModalShell>
  );
}