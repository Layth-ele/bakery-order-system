/**
 * Confirm Approve Order Modal
 * 
 * ✅ FEB 21, 2026: Updated to use warning skin (skin system)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ CREATED FEB 16, 2026: Security confirmation for order approval
 * ✅ FEB 18, 2026: Removed isOpen prop - modal context handles rendering
 * 
 * Critical safety modal that prevents accidental order approvals.
 * Forces admin to review order details and confirm delivery fee before approval.
 * 
 * Why this is needed:
 * - Approval is a financial commitment (customer expects order)
 * - One wrong click = wrong order approved
 * - No undo mechanism exists
 * - Consistent with other major actions (reject, cancel, payment)
 * 
 * Features:
 * - Order summary display
 * - Editable delivery fee
 * - Clear consequences warning
 * - "Cannot be undone" alert
 * - Link to full order review
 */

import { displayOrderNumber } from '../../../utils/displayId';
import { ModalThreeSections } from './ModalOrderSections';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CancelConfirmFooter } from '../../../ui/modals/ModalFooterButtons'; // Standardized footer
import { CheckCircle } from 'lucide-react'; // ✅ FEB 21, 2026

import type { Order, Product, Category } from '../../../types';
import { useState } from 'react';
import { useCachedSettings } from '../../../hooks/useCachedFirebase';
import { normalizeItems, orderTotals } from '../../../functions/src/lib/orderRevision';
import { resolveTaxRate } from '../../../functions/src/lib/settingsValues';
import { passedDeliveryDays, passedDaysMessage } from '../../../functions/src/lib/orderPlacement';
 // Using canonical formatCurrency

interface ConfirmApproveOrderModalProps {
  onClose: () => void;
  order: Order;
  deliveryFee: number;
  products?: Product[];
  categories?: Category[];
  onConfirm: (deliveryFee: number) => void | Promise<void>;
  onReviewDetails?: () => void; // Optional: Open full AdminOrderViewModal
}

export function ConfirmApproveOrderModal({
  onClose,
  order,
  deliveryFee: initialDeliveryFee,
  products = [],
  categories = [],
  onConfirm,
  onReviewDetails
}: ConfirmApproveOrderModalProps): JSX.Element | null {
  const [feeInput, setFeeInput] = useState(String(initialDeliveryFee ?? order?.deliveryFee ?? 0));
  const [feeError, setFeeError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: settings } = useCachedSettings();

  if (!order) return null;

  // What approveOrder will save for this fee (same rules: lib/orderRevision).
  const previewFee = Number(feeInput);
  const preview = Number.isFinite(previewFee) && previewFee >= 0
    ? orderTotals(normalizeItems(order.items), order as any, resolveTaxRate((settings ?? null) as Record<string, unknown> | null), {
        deliveryFee: Math.round(previewFee * 100) / 100,
      })
    : null;
  const creditOnOrder = Number((order as any).creditApplied) || 0;
  // Same rule as approveOrder: days already over can't be approved.
  const passedDays = passedDeliveryDays(order as any, new Date());
  const previewCredit = preview ? Math.min(creditOnOrder, preview.total) : 0;

  const handleConfirm = async () => {
    if (passedDays.length > 0) return; // also blocks the Enter shortcut
    const fee = Number(feeInput);
    if (feeInput.trim() === '' || !Number.isFinite(fee) || fee < 0) {
      setFeeError('Enter a delivery fee of $0 or more.');
      return;
    }
    setIsProcessing(true);
    try {
      // The approveOrder Cloud Function recomputes GST and totals with this fee.
      await onConfirm(Math.round(fee * 100) / 100);
      onClose();
    } catch (error) {
      console.error('❌ Failed to approve order:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="success"
      onClose={onClose}
      title="Approve Order"
      subtitle={displayOrderNumber(order)}
      icon={<CheckCircle className="icon-modal-header" />}
      footer={
        <CancelConfirmFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          isProcessing={isProcessing}
          disabled={passedDays.length > 0}
          confirmLabel="Confirm Approval"
          confirmVariant="success"
        />
      }
    >

      <section className="mb-4 rounded-xl border-2 border-green-200 bg-green-50/60 p-4">
        <label htmlFor="approve-fee" className="mb-2 block text-sm font-semibold text-green-900">
          Delivery fee
        </label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-neutral-600">$</span>
          <input
            id="approve-fee"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={feeInput}
            onChange={(e) => { setFeeInput(e.target.value); setFeeError(''); }}
            className="w-full max-w-[10rem] rounded-lg border border-green-300 bg-white px-3 py-2.5 text-sm font-semibold focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
          />
        </div>
        <p className="mt-2 text-xs text-green-800">
          Pre-filled with the estimate the customer saw. Change it if needed — GST and the total are recalculated on approval.
        </p>
        {passedDays.length > 0 && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {passedDaysMessage(passedDays, 'approved')}
          </p>
        )}
        {preview && (
          <div className="mt-3 rounded-lg bg-white/80 border border-green-200 px-3 py-2 text-sm text-green-900 space-y-1">
            <div className="flex justify-between"><span>Total after approval</span><strong>${preview.total.toFixed(2)}</strong></div>
            {previewCredit > 0 && (
              <div className="flex justify-between"><span>Amount due after store credit</span><strong>${Math.max(0, preview.total - previewCredit).toFixed(2)}</strong></div>
            )}
            {previewCredit > 0 && preview.total - previewCredit <= 0 && (
              <p className="text-xs text-green-800">Store credit covers it all — the order goes straight to production (nothing to pay).</p>
            )}
          </div>
        )}
        {feeError && <p className="mt-2 text-sm font-medium text-red-700">{feeError}</p>}
      </section>

      <ModalThreeSections order={order} products={products} summaryLabel="Order Total">
      </ModalThreeSections>
</StyleModalShell>
  );
}