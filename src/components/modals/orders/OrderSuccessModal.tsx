/**
 * OrderSuccessModal
 * Shown to the customer after successfully placing an order.
 * Custom design — intentionally not using StyleModalShell.
 */

import React from 'react';
import { CheckCircle, Clock, Bell, CreditCard, ArrowRight } from 'lucide-react';

interface OrderSuccessModalProps {
  week: number;
  year: number;
  onClose: () => void;
}

export function OrderSuccessModal({ week, year, onClose }: OrderSuccessModalProps): JSX.Element | null {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white w-full mx-auto" style={{ maxWidth: 440 }}>
      {/* Header band */}
      <div
        className="flex flex-col items-center pt-10 pb-8 px-8"
        style={{ background: 'linear-gradient(135deg, #8B6F47 0%, #D4A574 100%)' }}
      >
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight text-center">Order Placed!</h2>
        <p className="text-white/80 text-sm mt-1 text-center">
          Week {week}, {year}
        </p>
      </div>

      {/* Body */}
      <div className="px-6 py-6 flex flex-col gap-4">
        <p className="text-gray-600 text-sm text-center">
          Your order has been submitted. Here's what to expect:
        </p>

        <div className="flex flex-col gap-3">
          <Step
            icon={<Clock className="w-4 h-4" style={{ color: '#8B6F47' }} />}
            title="Pending Review"
            desc="Our team will review your order shortly"
          />
          <Step
            icon={<Bell className="w-4 h-4" style={{ color: '#8B6F47' }} />}
            title="Approval Notification"
            desc="You'll be notified once it's approved"
          />
          <Step
            icon={<CreditCard className="w-4 h-4" style={{ color: '#8B6F47' }} />}
            title="Payment Details"
            desc="Payment info will be sent upon approval"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-6">
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl text-white transition-all active:scale-[0.98] hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #8B6F47 0%, #D4A574 100%)' }}
        >
          Got it
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Step({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 rounded-xl px-4 py-3">
      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
