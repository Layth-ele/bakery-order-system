/**
 * PaymentSubmittedModal - Confirmation modal shown after payment submission
 *
 * ✅ MAR 7, 2026: Created to replace PAYMENT IN REVIEW modal after payment submission
 * - Shows thank you message
 * - Explains next steps in the payment verification process
 * - Provides clear timeline expectations
 * 
 * Flow:
 * 1. Customer submits payment in SubmitPaymentModal
 * 2. This modal opens showing success confirmation
 * 3. Explains 3-step process: Verification → Notification → Production
 * 4. User can track status in dashboard
 */

import React from "react";
import {
  CheckCircle,
  Clock,
  Bell,
  Package,
  DollarSign,
} from "lucide-react";
import type { Order } from "../../../types";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { CloseFooter } from "../../../ui/modals/ModalFooterButtons";
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface PaymentSubmittedModalProps {
  order: Order;
  onClose?: () => void;
}

export function PaymentSubmittedModal({
  order,
  onClose,
}: PaymentSubmittedModalProps): JSX.Element | null {
  const invoiceNumber = displayInvoiceNumber(order);
  const amountPaid = order.total || 0;

  return (
    <StyleModalShell
      width="4xl"
      skinType="success"
      onClose={onClose || (() => {})}
      title="PAYMENT SUBMITTED"
      subtitle="Thank you for your payment!"
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={<CloseFooter onClose={onClose || (() => {})} />}
    >
      {/* Success Message */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl p-6 border-2 border-emerald-500 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-[#333333] font-bold text-xl mb-2">
              Payment Successfully Submitted!
            </h3>
            <p className="text-[#666666] text-sm mb-4">
              We've received your payment information for Order #{invoiceNumber}. 
              Your payment is now being verified by our team.
            </p>
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#666666]">
                  Amount Submitted:
                </span>
                <span className="text-2xl font-bold text-emerald-600">
                  ${amountPaid.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4 px-1">
          What Happens Next
        </h3>
        
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-neutral-800 mb-1">
                  1. Payment Verification
                </h4>
                <p className="text-sm text-neutral-600">
                  Our admin team will verify your e-transfer payment. This typically 
                  takes <span className="font-semibold text-blue-600">1-2 business hours</span> during 
                  business hours.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-neutral-800 mb-1">
                  2. Confirmation Notification
                </h4>
                <p className="text-sm text-neutral-600">
                  Once your payment is verified, you'll receive a notification confirming 
                  that payment has been received and your order is moving to production.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-[#D4A574]/20 rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-[#D4A574]" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-neutral-800 mb-1">
                  3. Production Begins
                </h4>
                <p className="text-sm text-neutral-600">
                  After payment confirmation, your order will enter production and be 
                  prepared for delivery according to your scheduled week.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
        <div className="flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-neutral-800 mb-1 text-sm">
              Track Your Payment Status
            </h4>
            <p className="text-xs text-neutral-600 leading-relaxed">
              You can check your payment status anytime in your dashboard. 
              We'll notify you immediately when your payment is confirmed and 
              your order moves to production.
            </p>
          </div>
        </div>
      </div>
    </StyleModalShell>
  );
}