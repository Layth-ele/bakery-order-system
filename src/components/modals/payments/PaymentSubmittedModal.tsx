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

import { displayOrderNumber } from '../../../utils/displayId';
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
import { displayInvoiceNumber } from '../../../utils/displayId';
import { orderAmountDue } from '../../../utils/orderMoney';

const STEPS = [
  {
    icon: Clock, ring: 'bg-blue-100', color: 'text-blue-600',
    title: '1. Payment Verification',
    body: <>Our admin team will verify your e-transfer payment. This typically takes <span className="font-semibold text-blue-600">1-2 business hours</span> during business hours.</>,
  },
  {
    icon: Bell, ring: 'bg-emerald-100', color: 'text-emerald-600',
    title: '2. Confirmation Notification',
    body: <>Once your payment is verified, you'll receive a notification confirming that payment has been received and your order is moving to production.</>,
  },
  {
    icon: Package, ring: 'bg-[#D4A574]/20', color: 'text-[#D4A574]',
    title: '3. Production Begins',
    body: <>After payment confirmation, your order will enter production and be prepared for delivery according to your scheduled week.</>,
  },
];

interface PaymentSubmittedModalProps {
  order: Order;
  onClose?: () => void;
}

export function PaymentSubmittedModal({
  order,
  onClose,
}: PaymentSubmittedModalProps): JSX.Element | null {
  const invoiceNumber = displayInvoiceNumber(order);
  // What the customer sends: the total less any store credit used.
  const amountPaid = orderAmountDue(order as any);

  return (
    <StyleModalShell
      width="md"
      skinType="success"
      onClose={onClose || (() => {})}
      title="PAYMENT SUBMITTED"
      subtitle={`${displayOrderNumber(order)} · Thank you for your payment`}
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={<CloseFooter onClose={onClose || (() => {})} />}
    >
      {/* Success Message */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl p-4 sm:p-6 border sm:border-2 border-emerald-500 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
          <div className="flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md">
            <CheckCircle className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <h3 className="text-[#333333] font-bold text-base sm:text-xl leading-snug">
            Payment Successfully Submitted!
          </h3>
        </div>
        <p className="text-[#666666] text-sm mb-3 sm:mb-4">
          We've received your payment information for Order #{invoiceNumber}.
          Your payment is now being verified by our team.
        </p>
        <div className="bg-white rounded-lg px-3 py-2.5 sm:p-4 border border-emerald-200 flex items-center justify-between gap-3">
          <span className="text-xs sm:text-sm font-semibold text-[#666666] whitespace-nowrap">
            Amount Submitted
          </span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-600 tabular-nums whitespace-nowrap">
            ${amountPaid.toFixed(2)}
          </span>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="mb-4 sm:mb-6">
        <h3 className="text-xs sm:text-sm font-bold text-neutral-400 uppercase tracking-widest mb-3 sm:mb-4 px-1">
          What Happens Next
        </h3>

        <div className="space-y-2.5 sm:space-y-4">
          {STEPS.map(({ icon: Icon, ring, color, title, body }) => (
            <div key={title} className="bg-white rounded-xl p-3 sm:p-5 border border-neutral-200 shadow-sm">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 ${ring} rounded-full flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm sm:text-base text-neutral-800 mb-0.5 sm:mb-1">{title}</h4>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-5 border border-blue-200">
        <div className="flex items-start gap-3">
          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
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