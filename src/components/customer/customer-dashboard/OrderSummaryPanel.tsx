import React from 'react';
/**
 * OrderSummaryPanel.tsx
 * Phase 5 Extract: ~300 lines
 * 
 * ✅ FEB 10, 2026: Updated to match REVIEW YOUR ORDER modal style
 * - White background with clean light theme
 * - Tan/beige gradient header
 * - Dark text for readability
 * - Light borders and subtle shadows
 * - Professional appearance
 * 
 * Unified component for order summary display:
 * - Desktop: Sticky sidebar (right side, 24% width)
 * - Mobile: Bottom sheet (collapsible)
 * 
 * Features:
 * - Cart items list (scrollable)
 * - Price breakdown (subtotal, GST, delivery, service charge)
 * - Apply credit section
 * - Final total display
 * - Order note textarea (desktop only)
 * - Submit order button
 */

import {ChevronUp, ChevronDown} from "lucide-react"
import { OrderSummaryCard } from '../../modals/orders/OrderSummaryCard';
import { ApplyCreditSection } from "../../ordering/ApplyCreditSection";
import type { Product, DayQuantities } from "../../../types";

export interface OrderSummaryPanelProps {
  // Cart data
  cartItems: Array<{
    product: Product;
    quantities: DayQuantities;
    total: number;
    price: number;
  }>;
  
  // Pricing
  subtotal: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  baseTotal: number;
  total: number; // After credit applied
  
  // Credit
  applyCreditEnabled: boolean;
  creditToApply: number;
  customerId: string;
  onCreditChange: (creditAmount: number, shouldApply: boolean) => void;
  
  // Order note
  orderNote: string;
  onOrderNoteChange: (note: string) => void;
  
  // Submit
  onSubmit: () => void;
  isSubmitting: boolean;
  
  // UI state
  headerHeight: number;
  isExpanded: boolean; // Mobile only
  onToggleExpanded: () => void; // Mobile only
  onHeightChange?: (height: number) => void;
}

export function OrderSummaryPanel({
  cartItems,
  subtotal,
  gst,
  deliveryFee,
  serviceCharge,
  baseTotal,
  total,
  applyCreditEnabled,
  creditToApply,
  customerId,
  onCreditChange,
  orderNote,
  onOrderNoteChange,
  onSubmit,
  isSubmitting,
  headerHeight,
  isExpanded,
  onToggleExpanded,
  onHeightChange,
}: OrderSummaryPanelProps): JSX.Element | null {
  // Measure real panel height → passed up so layout clears it correctly
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!panelRef.current || !onHeightChange) return;
    const obs = new ResizeObserver(() => {
      if (panelRef.current) onHeightChange(panelRef.current.offsetHeight);
    });
    obs.observe(panelRef.current);
    onHeightChange(panelRef.current.offsetHeight);
    return () => obs.disconnect();
  }, [onHeightChange]);

  return (
    <>
      {/* ========================================
          UNIVERSAL: Bottom Sheet (ALL SCREEN SIZES)
          ======================================== */}
      <div
        ref={panelRef}
        className={`fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#D4A574]/30 pb-safe shadow-2xl transition-all duration-300 ease-in-out ${
          isExpanded
            ? "h-[min(55vh,700px)]"
            : "h-auto"
        }`}
        style={{
          contain: "layout style paint",
          willChange: isExpanded
            ? "height"
            : "auto",
          zIndex: "var(--z-summary-panel)",
        }}
      >
        <div
          className={`${isExpanded ? "h-full flex flex-col" : ""}`}
        >
          {/* Toggle Bar - Always Visible */}
          <button
            onClick={onToggleExpanded}
            className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors active:bg-neutral-100"
            aria-label={
              isExpanded
                ? "Collapse order summary"
                : "Expand order summary"
            }
            aria-expanded={isExpanded}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-[#8B6F47] font-bold text-xs sm:text-sm tracking-wide text-left uppercase">
                  ORDER SUMMARY
                </h3>
                <p className="text-neutral-500 text-[10px] sm:text-xs mt-0.5 text-left">
                  {cartItems.length}{" "}
                  {cartItems.length === 1
                    ? "item"
                    : "items"}
                </p>
              </div>
              <div className="text-[#D4A574] font-extrabold text-base sm:text-lg flex-shrink-0">
                ${total.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {applyCreditEnabled && creditToApply > 0 && (
                <div className="text-green-600 text-[10px] sm:text-xs font-medium">
                  Credit
                </div>
              )}
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-[#D4A574]" />
              ) : (
                <ChevronUp className="w-5 h-5 text-[#D4A574]" />
              )}
            </div>
          </button>

          {/* Collapsed View - Horizontal Breakdown */}
          {!isExpanded && (
            <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2">
              {/* Horizontal breakdown */}
              <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-lg p-2 overflow-x-auto border border-neutral-200">
                <span className="text-neutral-600 whitespace-nowrap">
                  Subtotal:{" "}
                  <span className="text-[#333333] font-medium">
                    ${subtotal.toFixed(2)}
                  </span>
                </span>
                <span className="text-neutral-300">|</span>
                <span className="text-neutral-600 whitespace-nowrap">
                  GST:{" "}
                  <span className="text-[#333333] font-medium">
                    ${gst.toFixed(2)}
                  </span>
                </span>
                <span className="text-neutral-300">|</span>
                <span className="text-neutral-600 whitespace-nowrap">
                  Delivery:{" "}
                  <span className="text-[#333333] font-medium">
                    ${deliveryFee.toFixed(2)}
                  </span>
                </span>
              </div>

              {/* Review Button */}
              <button
                type="button"
                onClick={onSubmit}
                disabled={
                  cartItems.length === 0 ||
                  isSubmitting
                }
                className={`
                  w-full px-4 py-3 rounded-lg font-bold text-sm uppercase
                  transition-all shadow-lg min-h-[48px]
                  ${
                    cartItems.length === 0 ||
                    isSubmitting
                      ? "bg-neutral-300 text-neutral-500 cursor-not-allowed opacity-50"
                      : "bg-gradient-to-r from-[#D4A574] to-[#D4A574] text-white hover:from-[#D4A574] hover:to-[#B88F4E] active:scale-98"
                  }
                `}
              >
                {isSubmitting
                  ? "Submitting..."
                  : cartItems.length === 0
                    ? "Cart Empty"
                    : `Review Order (${cartItems.length})`}
              </button>
            </div>
          )}

          {/* Expanded View - Full Details */}
          {isExpanded && (
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
              <div className="space-y-3">
                {/* Cart Items List - Scrollable (Mobile) */}
                {cartItems.length > 0 && (
                  <div className="mb-3">
                    <h3 className="text-xs text-[#8B6F47] font-semibold mb-2 uppercase tracking-wide">
                      Cart Items
                    </h3>
                    <div className="max-h-[150px] overflow-y-auto custom-scrollbar bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-lg border border-neutral-200">
                      <div className="divide-y divide-neutral-200">
                        {cartItems.map((item, index) => (
                          <div
                            key={`mobile-${item.product.id}-${index}`}
                            className="p-2.5 hover:bg-white/50 transition-colors"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-[#333333] font-medium truncate">
                                  {item.product.name}
                                </p>
                                <p className="text-[10px] text-neutral-500">
                                  Qty: {item.total}
                                </p>
                              </div>
                              <p className="text-xs text-[#D4A574] font-semibold whitespace-nowrap">
                                $
                                {(
                                  item.price * item.total
                                ).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Breakdown */}
                <OrderSummaryCard
                  subtotal={subtotal}
                  gst={gst}
                  deliveryFee={deliveryFee > 0 ? deliveryFee : 0}
                  serviceCharge={serviceCharge}
                  creditApplied={applyCreditEnabled && creditToApply > 0 ? creditToApply : 0}
                  total={total}
                  label="Order Total"
                  variant="default"
                />

                {/* Credit Section */}
                <ApplyCreditSection
                  customerId={customerId}
                  orderTotal={baseTotal}
                  onCreditChange={onCreditChange}
                />

                {/* Review Button */}
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={cartItems.length === 0}
                  className={`w-full px-4 py-3 rounded-lg font-bold text-sm sm:text-base transition-all shadow-lg uppercase ${
                    cartItems.length === 0
                      ? "bg-neutral-300 text-neutral-500 cursor-not-allowed opacity-50"
                      : "bg-gradient-to-r from-[#D4A574] to-[#D4A574] text-white hover:from-[#D4A574] hover:to-[#B88F4E] active:scale-98"
                  }`}
                >
                  {cartItems.length === 0
                    ? "Cart Empty"
                    : `Review Order (${cartItems.length})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}