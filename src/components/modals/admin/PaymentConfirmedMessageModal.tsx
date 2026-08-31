/**
 * Payment Confirmed Message Modal
 * 
 * ✅ MAR 18, 2026: CREATED
 * ✅ MAR 18, 2026: Updated background to match other modals (bg-white instead of dark gradient)
 * Simple informational modal for admin when payment is confirmed
 * Shows minimal details - just confirmation message and close button
 * 
 * Purpose:
 * - Inform admin that payment was successfully confirmed
 * - Order is now in production
 * - No actions needed - just informational
 */

import React from 'react';
import { X, CheckCircle } from 'lucide-react';

interface PaymentConfirmedMessageModalProps {
  orderId: string;
  customerName?: string;
  amount?: number;
  invoiceNumber?: string;
  onClose: () => void;
}

export function PaymentConfirmedMessageModal({
  orderId,
  customerName,
  amount,
  invoiceNumber,
  onClose,
}: PaymentConfirmedMessageModalProps): JSX.Element | null {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-[#D4A574]/30 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600/20 to-green-600/20 border-b border-[#D4A574]/20 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-emerald-600">Payment Confirmed</h2>
                <p className="text-sm text-neutral-600">Order In Production</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Success Message */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-emerald-700 text-center font-medium">
              ✅ Payment successfully confirmed
            </p>
          </div>

          {/* Order Details */}
          <div className="space-y-3">
            {invoiceNumber && (
              <div className="flex justify-between items-center py-2 border-b border-neutral-200">
                <span className="text-neutral-600 text-sm">Invoice Number:</span>
                <span className="text-neutral-900 font-medium">{invoiceNumber}</span>
              </div>
            )}
            
            {customerName && (
              <div className="flex justify-between items-center py-2 border-b border-neutral-200">
                <span className="text-neutral-600 text-sm">Customer:</span>
                <span className="text-neutral-900 font-medium">{customerName}</span>
              </div>
            )}

            {amount !== undefined && (
              <div className="flex justify-between items-center py-2 border-b border-neutral-200">
                <span className="text-neutral-600 text-sm">Amount:</span>
                <span className="text-emerald-600 font-bold">${amount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-2">
              <span className="text-neutral-600 text-sm">Status:</span>
              <span className="text-emerald-600 font-medium">In Production</span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700 text-sm text-center">
              🎉 Order is now being prepared by the bakery team
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-neutral-50 border-t border-neutral-200 p-4">
          <button
            onClick={onClose}
            className="w-full bg-[#D4A574] hover:bg-[#D4A574] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}