/**
 * Order Review Modal
 *
 * Allows customers to review their order before final submission.
 * Shows products, days/dates, and quantities in a clean, mobile-friendly layout.
 * Premium black and gold aesthetic matching the bakery theme.
 */

import React, { useState } from "react";
import {
  ShoppingCart,
  X,
  Calendar,
  CheckCircle,
  Edit,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { BaseModal } from "../../../ui/modals/BaseModal";
import type { Product } from "../../../types";
import type { DayQuantities } from "../../../types/order-flow";
import { ProductImagePlaceholder } from "../../shared/ProductImagePlaceholder";
import {
  getWeekDayDate,
  formatShortDate,
  getWeekRange,
} from "../../../utils/weekUtils";
import { logger } from '../../../utils/logger';


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
}: OrderReviewModalProps): JSX.Element | null {
  const weekRange = getWeekRange(selectedWeek, selectedYear);

 // Prevent double-submission with loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ DEFENSIVE: Ensure cartItems is always a valid array with no undefined entries
  const safeCartItems = Array.isArray(cartItems)
    ? cartItems.filter((item): item is typeof item => !!item && !!item.product && typeof item.total === 'number')
    : [];
  
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
      <BaseModal
        isOpen={true}
        onClose={onClose}
        size="xl"
        ariaLabel="No Items"
        overlayBlur="md"
      >
        <div className="bg-white rounded-2xl border-4 border-[#D4A574] p-6 text-center">
          <p className="text-neutral-700 mb-4">No items in cart to review.</p>
          <button
            onClick={onClose}
            className="bg-gradient-to-r from-[#D4A574] to-[#C8A882] text-white px-6 py-2 rounded-lg hover:shadow-lg transition-shadow font-bold"
          >
            Close
          </button>
        </div>
      </BaseModal>
    );
  }

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      size="xl"
      ariaLabel="Review Your Order"
      closeOnBackdropClick={false}
      overlayBlur="md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl border-4 border-[#D4A574] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#D4A574] to-[#C8A882] px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between border-b-4 border-[#D4A574]/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 sm:p-3 rounded-full backdrop-blur-sm">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-tight text-white">
                Review Your Order
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-white/80" />
                <p className="text-xs sm:text-sm text-white/90 font-medium">
                  Week {selectedWeek}, {selectedYear} •{" "}
                  {weekRange}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
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
                    {days.map((day, dayIndex) => {
                      const dayDate = getWeekDayDate(
                        selectedWeek,
                        dayIndex,
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
                          <div className="text-[10px] text-[#8B6F47]/70 font-normal">
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
                      {days.map((day) => {
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
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((day, dayIndex) => {
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
                          <div className="text-[#8B6F47] text-[10px] font-bold">
                            {day.label}
                          </div>
                          <div className="text-[#8B6F47]/60 text-[9px]">
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

        {/* Footer Actions */}
        <div className="bg-gradient-to-r from-neutral-50 to-neutral-100 border-t-4 border-[#D4A574]/30 px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            data-keyboard-shortcut="Escape"
            className={`flex-1 sm:flex-none sm:min-w-[160px] px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all border-2 border-[#D4A574] text-[#D4A574] flex items-center justify-center gap-2 ${
              isSubmitting
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-[#D4A574]/10"
            }`}
          >
            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
            Go Back & Edit
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={isSubmitting}
            data-keyboard-shortcut="Enter"
            className={`flex-1 sm:flex-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all shadow-lg flex items-center justify-center gap-2 border-2 ${
              isSubmitting
                ? "bg-neutral-400 border-neutral-400 cursor-not-allowed"
                : "bg-gradient-to-r from-[#4CAF50] to-[#45a049] text-white hover:from-[#45a049] hover:to-[#3d8b40] border-[#4CAF50]"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                Confirm & Submit Order
              </>
            )}
          </button>
        </div>
      </motion.div>
    </BaseModal>
  );
}