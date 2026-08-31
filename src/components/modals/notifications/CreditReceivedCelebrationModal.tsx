/**
 * CreditReceivedCelebrationModal - Celebratory modal shown to customers when they receive credit
 *
 * ✅ MAR 4, 2026: Created for customer credit celebration experience
 */

import { useEffect, useState } from "react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { Gift, Sparkles, PartyPopper, CreditCard } from "lucide-react";
import { formatCreditAmount } from "../../../services/creditService";

interface CreditReceivedCelebrationModalProps {
  amount: number;
  reason: string;
  creditType: string;
  onClose: () => void;
}

export function CreditReceivedCelebrationModal({
  amount,
  reason,
  creditType,
  onClose,
}: CreditReceivedCelebrationModalProps): JSX.Element | null {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setIsAnimating(true), 100);
  }, []);

  // Get icon and color based on credit type
  const getCreditTypeDisplay = (type: string) => {
    const displays: Record<string, { icon: JSX.Element; color: string; label: string }> = {
      refund: { icon: <CreditCard className="w-6 h-6" />, color: "blue", label: "Refund" },
      overpayment: { icon: <CreditCard className="w-6 h-6" />, color: "blue", label: "Overpayment" },
      admin_edit: { icon: <Sparkles className="w-6 h-6" />, color: "purple", label: "Order Adjustment" },
      quality_issue: { icon: <Gift className="w-6 h-6" />, color: "amber", label: "Quality Issue" },
      damaged_goods: { icon: <Gift className="w-6 h-6" />, color: "amber", label: "Damaged Goods" },
      missing_items: { icon: <Gift className="w-6 h-6" />, color: "amber", label: "Missing Items" },
      late_delivery: { icon: <Gift className="w-6 h-6" />, color: "amber", label: "Late Delivery" },
      customer_complaint: { icon: <Gift className="w-6 h-6" />, color: "amber", label: "Service Recovery" },
      promotional_credit: { icon: <PartyPopper className="w-6 h-6" />, color: "green", label: "Promotional Credit" },
      loyalty_reward: { icon: <PartyPopper className="w-6 h-6" />, color: "green", label: "Loyalty Reward" },
      goodwill: { icon: <Gift className="w-6 h-6" />, color: "pink", label: "Goodwill" },
      pricing_error: { icon: <CreditCard className="w-6 h-6" />, color: "blue", label: "Price Adjustment" },
      double_payment: { icon: <CreditCard className="w-6 h-6" />, color: "blue", label: "Duplicate Payment" },
      order_cancellation: { icon: <CreditCard className="w-6 h-6" />, color: "blue", label: "Order Cancellation" },
      quantity_shortage: { icon: <Gift className="w-6 h-6" />, color: "amber", label: "Quantity Adjustment" },
    };

    return displays[type] || { icon: <Gift className="w-6 h-6" />, color: "gold", label: "Credit" };
  };

  const display = getCreditTypeDisplay(creditType);

  return (
    <StyleModalShell
      width="4xl"
      skinType="success"
      onClose={onClose}
      title="🎉 YOU RECEIVED CREDIT!"
      subtitle="Your account has been credited"
      icon={<Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />}
    >
      {/* Animated Content */}
      <div className="relative">
        {/* Floating Sparkles Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`absolute ${
                isAnimating ? "animate-pulse" : "opacity-0"
              }`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <Sparkles className="w-4 h-4 text-[#D4A574] opacity-30" />
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="relative z-10">
          {/* Credit Amount Display */}
          <div
            className={`text-center mb-8 transform transition-all duration-700 ${
              isAnimating
                ? "translate-y-0 opacity-100 scale-100"
                : "-translate-y-4 opacity-0 scale-95"
            }`}
          >
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#D4A574] to-[#C5A028] rounded-full mb-4 shadow-lg">
              <div className="text-white">{display.icon}</div>
            </div>

            {/* Amount */}
            <div className="mb-3">
              <div className="text-6xl font-bold bg-gradient-to-r from-[#D4A574] via-[#FFD700] to-[#C5A028] bg-clip-text text-transparent">
                {formatCreditAmount(amount)}
              </div>
              <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mt-1">
                Credit Added
              </div>
            </div>

            {/* Credit Type Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D4A574]/10 to-[#C5A028]/10 border-2 border-[#D4A574]/30 rounded-full">
              <span className="text-[#D4A574]">{display.icon}</span>
              <span className="font-semibold text-gray-800">{display.label}</span>
            </div>
          </div>

          {/* Reason Section */}
          <div
            className={`bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 mb-6 border border-gray-200 shadow-sm transform transition-all duration-700 delay-200 ${
              isAnimating
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <div className="w-2 h-2 bg-[#D4A574] rounded-full"></div>
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Reason
                </div>
                <div className="text-gray-800 leading-relaxed">{reason}</div>
              </div>
            </div>
          </div>

          {/* Info Boxes */}
          <div
            className={`grid grid-cols-2 gap-4 mb-6 transform transition-all duration-700 delay-300 ${
              isAnimating
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
          >
            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
              <div className="text-2xl font-bold text-[#D4A574] mb-1">
                {formatCreditAmount(amount)}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Available Now
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">✓</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Auto-Applied
              </div>
            </div>
          </div>

          {/* Usage Info */}
          <div
            className={`bg-blue-50 border-l-4 border-blue-500 rounded p-4 mb-6 transform transition-all duration-700 delay-400 ${
              isAnimating
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">i</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-blue-900 text-sm mb-1">
                  How to use your credit
                </div>
                <div className="text-blue-800 text-sm">
                  Your credit will automatically apply to your next order during checkout.
                  You can view your credit balance anytime in your account dashboard.
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            className={`flex gap-3 transform transition-all duration-700 delay-500 ${
              isAnimating
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
          >
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-[#D4A574] to-[#C5A028] text-white rounded-lg hover:from-[#C5A028] hover:to-[#B59020] transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Awesome! 🎉
            </button>
          </div>
        </div>
      </div>
    </StyleModalShell>
  );
}
