/**
 * CancelOrderModal - Admin cancels a pending order
 *
 * ✅ MAR 12, 2026: Added 3-tab interface with partial day cancellation
 * ✅ MAR 12, 2026: Updated to match EditPaidOrderModal structure
 * ✅ FEB 21, 2026: Updated to use danger skin (skin system)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from 'sonner';
import { AlertTriangle, FileText, Info, Calendar as CalendarIcon, CheckCircle, XCircle, CreditCard } from "lucide-react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { CancelConfirmFooter, CloseFooter } from "../../../ui/modals/ModalFooterButtons";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import type { Order, Product, Category } from "../../../types";
import { toDate } from '../../../utils/timestampFormatting';
import { 
  calculateDaySubtotal, 
  calculateDayItemCount, 
  calculateRefundAmount,
  getActiveDays,
  isFullOrderCancellation,
  DAYS,
  type DayKey 
} from "../../../utils/orderCancellationUtils";
import { useSystemSettingsData } from '../../../hooks/admin/useSystemSettingsData';
import { ModalThreeSections } from './ModalOrderSections';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface CancelOrderModalProps {
  onClose: () => void;
  order: Order;
  products?: Product[];
  categories?: Category[];
  adminEmail?: string;
  onConfirm?: (
    reason: string, 
    cancelledDays?: DayKey[], 
    cancellationData?: {
      cancellationFeePercentage: number;
      creditAmount: number;
    }
  ) => void;
}

export function CancelOrderModal({
  onClose,
  order,
  products = [],
  categories = [],
  adminEmail = "",
  onConfirm,
}: CancelOrderModalProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState('info');
  const [selectedDays, setSelectedDays] = useState<Set<DayKey>>(new Set());
  // Load system settings for default fee % and policy text
  const { settings } = useSystemSettingsData();
  const defaultFeePercent = (settings?.cancellationFeePercent as number | undefined) ?? 0;
  const cancellationPolicyText = (settings?.cancellationPolicy as string | undefined) || '';
  const lateCancellationFeeText = (settings?.lateCancellationFee as string | undefined) || '';

  const [cancellationFeePercentage, setCancellationFeePercentage] = useState<number | ''>(defaultFeePercent);

  // FIX T2R3-H1 (HIGH): Was unconditionally `setCancellationFeePercentage(
  // defaultFeePercent)` whenever settings re-loaded.  Settings can refetch
  // mid-form-fill (window-focus refetch in TanStack Query), which would
  // wipe the admin's manual override of the cancellation fee %.  Now only
  // applies the default on the FIRST settings load (when current state is
  // still the initial 0).  Subsequent refetches do not clobber edits.
  const hasUserEditedFeeRef = useRef(false);
  useEffect(() => {
    if (!hasUserEditedFeeRef.current && defaultFeePercent > 0) {
      setCancellationFeePercentage(defaultFeePercent);
    }
  }, [defaultFeePercent]);

  // Wrap setter so any user interaction marks the field as edited.
  const setCancellationFeePercentageUserEdit = (value: number | '') => {
    hasUserEditedFeeRef.current = true;
    setCancellationFeePercentage(value);
  };
  const [cancellationReason, setCancellationReason] = useState(
    order.cancellationReason || "Non-payment",
  );
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check if this is a read-only view (order already cancelled)
  const isReadOnly = order.status === "cancelled" && !onConfirm;

  const predefinedReasons = [
    "Non-payment",
    "Customer request",
    "Inventory unavailable",
    "Delivery issues",
    "Duplicate order",
    "Fraud suspected",
    "Other",
  ];

  // Get active days from order
  const activeDays = useMemo(() => getActiveDays(order.items), [order.items]);

  // Toggle day selection
  const toggleDay = (day: DayKey) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  // Select all days
  const selectAllDays = () => {
    setSelectedDays(new Set(activeDays));
  };

  // Clear all days
  const clearAllDays = () => {
    setSelectedDays(new Set());
  };

  // Calculate refund for selected days
  const refundCalculation = useMemo(() => {
    if (selectedDays.size === 0) {
      return {
        subtotalRefund: 0,
        gstRefund: 0,
        deliveryFeeRefund: 0,
        serviceChargeRefund: 0,
        cancellationFee: 0,
        totalRefund: 0,
        totalCredit: 0,
        percentageCancelled: 0,
      };
    }
    return calculateRefundAmount(order, selectedDays, typeof cancellationFeePercentage === "number" ? cancellationFeePercentage : 0);
  }, [order, selectedDays, cancellationFeePercentage]);

  // Check if this is a full order cancellation
  const isFullCancellation = useMemo(
    () => isFullOrderCancellation(order.items, selectedDays),
    [order.items, selectedDays]
  );

  // Calculate items count for selected days
  const selectedDayItemCount = useMemo(
    () => calculateDayItemCount(order.items, selectedDays),
    [order.items, selectedDays]
  );

  const handleConfirm = async () => {
    const finalReason =
      cancellationReason === "Other"
        ? customReason
        : cancellationReason;
    
    if (!finalReason || !finalReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }

    if (selectedDays.size === 0) {
      toast.error("Please select at least one day to cancel");
      return;
    }

    setIsSubmitting(true);
    try {
      const feePercent = typeof cancellationFeePercentage === 'number' ? cancellationFeePercentage : 0;
      onConfirm && (await onConfirm(finalReason, Array.from(selectedDays), {
        cancellationFeePercentage: feePercent,
        creditAmount: refundCalculation.totalCredit,
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate order totals
  const orderTotal = order.total || 0;
  const productCount = order.items?.length || 0;
  const totalItems =
    order.items?.reduce((sum, item) => {
      return (
        sum +
        (item.monday +
          item.tuesday +
          item.wednesday +
          item.thursday +
          item.friday +
          item.saturday +
          item.sunday)
      );
    }, 0) || 0;

  // Can submit check
  const canSubmit = useMemo(() => {
    return (
      selectedDays.size > 0 &&
      cancellationReason &&
      cancellationReason.trim().length > 0 &&
      (cancellationReason !== "Other" || (customReason && customReason.trim().length > 0))
    );
  }, [selectedDays.size, cancellationReason, customReason]);

  return (
    <StyleModalShell
      width="4xl"
      skinType="danger"
      onClose={() => { setSubmitError(null); onClose(); }}
      title={
        isReadOnly ? "CANCELLED ORDER DETAILS" : "CANCEL ORDER"
      }
      subtitle={displayOrderNumber(order)}
      hideBody
      className="h-[90vh]"
      footer={
        isReadOnly ? (
          <CloseFooter onClose={onClose} />
        ) : (
          <CancelConfirmFooter
            onCancel={onClose}
            onConfirm={handleConfirm}
            isProcessing={isSubmitting}
            confirmLabel={isFullCancellation ? "CANCEL ENTIRE ORDER" : "CANCEL SELECTED DAYS"}
            cancelLabel="KEEP ORDER"
          />
        )
      }
    >
      {/* Custom Body with Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* Tab Navigation */}
          <div className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-2 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8]">
            <TabsList className="w-full bg-white border-2 border-red-300 p-1">
              <TabsTrigger 
                value="info" 
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-400 data-[state=active]:text-white text-red-700 font-bold uppercase text-xs sm:text-sm"
              >
                <Info className="w-4 h-4 mr-2" />
                Order Info
              </TabsTrigger>
              <TabsTrigger 
                value="days" 
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-400 data-[state=active]:text-white text-red-700 font-bold uppercase text-xs sm:text-sm"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Days {selectedDays.size > 0 && `(${selectedDays.size})`}
              </TabsTrigger>
              <TabsTrigger 
                value="review" 
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-400 data-[state=active]:text-white text-red-700 font-bold uppercase text-xs sm:text-sm"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Review
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Tab 1: Order Info */}
            <TabsContent value="info" className="p-4 sm:p-6 space-y-4 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8] m-0">
              {/* Warning Banner */}
              {!isReadOnly ? (
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border-2 border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-red-900 mb-2">⚠️ Permanent Action</h3>
                      <ul className="text-xs text-red-800 space-y-1">
                        <li>• You can cancel specific days or the entire order</li>
                        <li>• Refunds will be calculated proportionally for partial cancellations</li>
                        <li>• The customer will be notified of the cancellation</li>
                        <li>• This action cannot be undone</li>
                      </ul>
                      {cancellationPolicyText && (
                        <div className="mt-3 pt-3 border-t border-red-200">
                          <p className="text-[10px] font-bold text-red-700 uppercase mb-1">📋 Store Cancellation Policy</p>
                          <p className="text-xs text-red-800">{cancellationPolicyText}</p>
                        </div>
                      )}
                      {lateCancellationFeeText && (
                        <div className="mt-2">
                          <p className="text-[10px] text-red-700">
                            <strong>Late cancellation fee:</strong> {lateCancellationFeeText}{/^\d+$/.test(lateCancellationFeeText) ? '%' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-4 border-2 border-neutral-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-neutral-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-neutral-900 mb-2">❌ Order Cancelled</h3>
                      <p className="text-xs text-neutral-800">
                        This order was cancelled on{" "}
                        {new Date(
                          toDate(order.cancelledAt) || new Date(),
                        ).toLocaleDateString()}{" "}
                        by {order.cancelledBy}. The customer was notified of the cancellation.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <ModalThreeSections order={order} products={products}>
              </ModalThreeSections>

              {/* Navigation Hint */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-blue-900">Next Step</h3>
                    <p className="text-xs text-blue-700 mt-1">
                      Click the "Days" tab above to select which days to cancel.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Days */}
            <TabsContent value="days" className="p-4 sm:p-6 space-y-4 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8] m-0">
              {/* Day Selection Controls */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border-2 border-[#E8C4A2] shadow-lg">
                <div className="flex items-center justify-between mb-4 border-b border-[#E8C4A2] pb-2">
                  <h3 className="text-sm sm:text-base text-[#333333] font-bold uppercase tracking-wider">
                    Select Days to Cancel
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllDays}
                      className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearAllDays}
                      className="px-3 py-1 bg-neutral-200 text-neutral-700 text-xs font-bold rounded hover:bg-neutral-300 transition"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Day Checkboxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DAYS.filter(day => activeDays.includes(day.key)).map((day) => {
                    const isSelected = selectedDays.has(day.key);
                    const daySubtotal = calculateDaySubtotal(order.items, new Set([day.key]));
                    const dayItemCount = calculateDayItemCount(order.items, new Set([day.key]));
                    
                    return (
                      <button
                        key={day.key}
                        onClick={() => toggleDay(day.key)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-600 shadow-md'
                            : 'bg-white text-[#333333] border-[#E8C4A2] hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold">{day.fullLabel}</span>
                          {isSelected ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                        <div className={`text-[10px] ${isSelected ? 'text-red-100' : 'text-[#8B6F47]'}`}>
                          {dayItemCount} items
                        </div>
                        <div className={`text-xs font-bold mt-1 ${isSelected ? 'text-white' : 'text-[#333333]'}`}>
                          ${daySubtotal.toFixed(2)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Refund Calculation */}
              {selectedDays.size > 0 && (
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 sm:p-6 border-2 border-red-200">
                  <div className="flex items-center gap-2 mb-4 border-b border-red-300 pb-2">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                    <h3 className="text-sm sm:text-base text-red-900 font-bold uppercase tracking-wider">
                      Credit Calculation
                    </h3>
                  </div>
                  
                  {/* Cancellation Fee Input */}
                  <div className="mb-4 p-3 bg-white rounded-lg border border-red-300">
                    <label className="text-xs font-semibold text-neutral-700 mb-2 block">
                      Cancellation Fee %
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={cancellationFeePercentage === 0 ? '' : cancellationFeePercentage}
                        placeholder={defaultFeePercent > 0 ? String(defaultFeePercent) : '0'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          // FIX T2R3-H1: route through wrapper so settings
                          // refetches stop overwriting the admin's edit.
                          const val = e.target.value;
                          if (val === '') { setCancellationFeePercentageUserEdit(''); return; }
                          setCancellationFeePercentageUserEdit(Math.max(0, Math.min(100, parseFloat(val) || 0)));
                        }}
                        className="w-24 px-3 py-2 bg-white border border-red-300 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      />
                      <span className="text-sm text-neutral-700">% of refund amount</span>
                    </div>
                    <p className="text-[10px] text-neutral-600 mt-1">
                      {defaultFeePercent > 0
                        ? <>Default fee: <strong>{defaultFeePercent}%</strong>{lateCancellationFeeText ? <> · {lateCancellationFeeText}</> : null} · Enter 0 for no fee, or up to 100%.</>
                        : lateCancellationFeeText
                          ? <>Policy: <strong>{lateCancellationFeeText}</strong> · Enter 0 for no fee, or up to 100%.</>
                          : 'Enter 0 for no fee, or up to 100% to charge a cancellation penalty.'}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-red-800">Items to Cancel:</span>
                      <span className="font-bold text-red-900">{selectedDayItemCount} items</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-800">Subtotal Refund:</span>
                      <span className="font-bold text-red-900">${refundCalculation.subtotalRefund.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-800">GST Refund (5%):</span>
                      <span className="font-bold text-red-900">${refundCalculation.gstRefund.toFixed(2)}</span>
                    </div>
                    {refundCalculation.deliveryFeeRefund > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-800">Delivery Fee Refund:</span>
                        <span className="font-bold text-red-900">${refundCalculation.deliveryFeeRefund.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-red-800">Service Charge Refund:</span>
                      <span className="font-bold text-red-900">${refundCalculation.serviceChargeRefund.toFixed(2)}</span>
                    </div>
                    {Number(cancellationFeePercentage) > 0 && (
                      <div className="flex justify-between border-t border-red-300 pt-2">
                        <span className="text-red-800">Cancellation Fee ({cancellationFeePercentage}%):</span>
                        <span className="font-bold text-red-900">-${refundCalculation.cancellationFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t-2 border-red-300">
                      <span className="text-red-900 font-bold">CREDIT TO CUSTOMER:</span>
                      <span className="font-bold text-lg text-red-900">${refundCalculation.totalCredit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-red-700">Percentage of Order:</span>
                      <span className="font-bold text-red-800">{(refundCalculation.percentageCancelled * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Credit Notice */}
                  <div className="mt-4 p-3 bg-gradient-to-r from-[#8B6F47]/10 to-[#D4A574]/10 rounded-lg border border-[#D4A574]">
                    <p className="text-xs font-bold text-[#8B6F47]">
                      💳 This amount will be added as credit to the customer's account and can be used for future orders.
                    </p>
                  </div>

                  {isFullCancellation && (
                    <div className="mt-4 p-3 bg-red-200 rounded-lg border border-red-400">
                      <p className="text-xs font-bold text-red-900">
                        ⚠️ This will cancel the ENTIRE ORDER and issue credit to the customer.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedDays.size === 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="text-sm font-bold text-blue-900">No Days Selected</h3>
                      <p className="text-xs text-blue-700 mt-1">
                        Select at least one day above to see the refund calculation.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancellation Reason */}
              <div className="bg-red-500/10 border-2 border-red-500 rounded-xl p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                  <h3 className="text-sm sm:text-base text-black font-bold uppercase tracking-wider">
                    Cancellation Reason (Required)
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 mb-2 block">
                      Select Reason
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {predefinedReasons.map((reason) => (
                        <button
                          key={reason}
                          onClick={() => setCancellationReason(reason)}
                          type="button"
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            cancellationReason === reason
                              ? "bg-red-600 text-white shadow-md"
                              : "bg-white text-neutral-700 hover:bg-red-50 border border-red-300"
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>

                  {cancellationReason === "Other" && (
                    <div>
                      <label className="text-xs font-semibold text-neutral-700 mb-2 block">
                        Specify Reason
                      </label>
                      <textarea
                        id="cancel-reason"
                        value={customReason}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomReason(e.target.value)}
                        placeholder="Please provide a detailed reason for cancellation..."
                        className="w-full px-3 py-2 bg-white border border-red-300 rounded-lg text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
                        rows={3}
                      />
                    </div>
                  )}

                  {cancellationReason !== "Other" && (
                    <div className="bg-white border border-red-300 rounded-lg p-3">
                      <p className="text-[10px] uppercase font-bold text-neutral-600 mb-1">
                        Selected Reason:
                      </p>
                      <p className="text-sm font-semibold text-neutral-900">
                        {cancellationReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Review */}
            <TabsContent value="review" className="p-4 sm:p-6 space-y-4 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8] m-0">
              {/* Summary Banner */}
              <div className={`rounded-xl p-6 border-2 ${
                isFullCancellation 
                  ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' 
                  : 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-6 h-6 mt-0.5 flex-shrink-0 ${
                    isFullCancellation ? 'text-red-600' : 'text-yellow-600'
                  }`} />
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold mb-2 ${
                      isFullCancellation ? 'text-red-900' : 'text-yellow-900'
                    }`}>
                      {isFullCancellation ? '🚫 Full Order Cancellation' : '📅 Partial Order Cancellation'}
                    </h3>
                    <p className={`text-sm ${
                      isFullCancellation ? 'text-red-800' : 'text-yellow-800'
                    }`}>
                      {isFullCancellation 
                        ? 'You are about to cancel this entire order and issue credit to the customer.' 
                        : `You are cancelling ${selectedDays.size} day(s) from this order.`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Cancellation Summary */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border-2 border-[#E8C4A2] shadow-lg">
                <div className="flex items-center gap-2 mb-4 border-b border-[#E8C4A2] pb-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A574]" />
                  <h3 className="text-sm sm:text-base text-[#333333] font-bold uppercase tracking-wider">
                    Cancellation Summary
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Days Being Cancelled */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#8B6F47] mb-2">
                      Days Being Cancelled:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedDays).map(day => {
                        const dayInfo = DAYS.find(d => d.key === day);
                        return (
                          <span key={day} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded">
                            {dayInfo?.fullLabel}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#8B6F47] mb-2">
                      Cancellation Reason:
                    </p>
                    <div className="bg-[#F5E9D9] border border-[#E8C4A2] rounded-lg p-3">
                      <p className="text-sm font-semibold text-[#333333]">
                        {cancellationReason === "Other" ? customReason : cancellationReason}
                      </p>
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#8B6F47] mb-2">
                      Financial Details:
                    </p>
                    <div className="bg-[#F5E9D9] border border-[#E8C4A2] rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Items to Cancel:</span>
                        <span className="font-bold text-[#333333]">{selectedDayItemCount} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Subtotal:</span>
                        <span className="font-bold text-[#333333]">${refundCalculation.subtotalRefund.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#666666]">GST:</span>
                        <span className="font-bold text-[#333333]">${refundCalculation.gstRefund.toFixed(2)}</span>
                      </div>
                      {refundCalculation.deliveryFeeRefund > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Delivery Fee:</span>
                          <span className="font-bold text-[#333333]">${refundCalculation.deliveryFeeRefund.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Service Charge:</span>
                        <span className="font-bold text-[#333333]">${refundCalculation.serviceChargeRefund.toFixed(2)}</span>
                      </div>
                      {Number(cancellationFeePercentage) > 0 && (
                        <>
                          <div className="border-t border-[#E8C4A2] pt-2 mt-2"></div>
                          <div className="flex justify-between">
                            <span className="text-red-700">Cancellation Fee ({cancellationFeePercentage}%):</span>
                            <span className="font-bold text-red-700">-${refundCalculation.cancellationFee.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      <div className="border-t-2 border-[#D4A574] pt-3 mt-3"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#8B6F47] font-bold text-base">CREDIT TO CUSTOMER:</span>
                        <span className="font-bold text-base text-[#8B6F47]">${refundCalculation.totalCredit.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credit Notice */}
              <div className="bg-gradient-to-r from-[#8B6F47]/10 to-[#D4A574]/10 rounded-xl p-4 border-2 border-[#D4A574]">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-[#8B6F47] mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-[#8B6F47] mb-1">💳 Account Credit</h3>
                    <p className="text-xs text-[#666666]">
                      The credit amount of <span className="font-bold text-[#8B6F47]">${refundCalculation.totalCredit.toFixed(2)}</span> will be added to the customer's account and can be used for future orders.
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Notification Notice */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-blue-900 mb-1">📧 Customer Notification</h3>
                    <p className="text-xs text-blue-700">
                      The customer will be automatically notified of this cancellation via email and will see the details in their account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Final Warning */}
              {!canSubmit && (
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border-2 border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-red-900 mb-1">⚠️ Action Required</h3>
                      <ul className="text-xs text-red-700 space-y-1">
                        {selectedDays.size === 0 && <li>• Select at least one day to cancel</li>}
                        {(!cancellationReason || cancellationReason.trim().length === 0) && <li>• Provide a cancellation reason</li>}
                        {cancellationReason === "Other" && (!customReason || customReason.trim().length === 0) && <li>• Specify the custom reason</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </StyleModalShell>
  );
}