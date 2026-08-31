/**
 * CustomerCancelOrderModal - Customer-initiated order cancellation
 * 
 * ✅ FEB 21, 2026: Updated to use danger skin (skin system)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ CREATED FEB 16, 2026: Customer self-service order cancellation
 * ✅ FEB 18, 2026: Removed isOpen prop - modal context handles rendering
 * 
 * Simple confirmation modal for customers to cancel their own PENDING orders.
 * Unlike the admin CancelOrderModal, this is customer-focused with:
 * - Simple order summary (not full breakdown)
 * - Optional reason (customer-friendly options)
 * - Optional notes field
 * - No cancellation fees or password required
 * - Clear "cannot be undone" warning
 * 
 * Business Rules:
 * - Customers can only cancel PENDING orders
 * - Cannot cancel approved/in_process/completed orders
 * - Admin is notified when customer cancels
 * - Order moves to cancelled status immediately
 */

import { AlertTriangle, Package, Calendar, DollarSign } from 'lucide-react';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CancelConfirmFooter } from '../../../ui/modals/ModalFooterButtons'; // ✅ FEB 21, 2026
import type {Order} from '../../../types'
import { useState } from 'react';
import { formatCurrency } from '../../../utils/helpers'; // Using canonical formatCurrency
import { invalidateCache } from '../../../hooks/useCachedFirebase';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface CustomerCancelOrderModalProps {
  onClose: () => void;
  order: Order;
  onConfirm: (reason?: string, notes?: string) => void | Promise<void>;
}

export function CustomerCancelOrderModal({
  onClose,
  order,
  onConfirm
}: CustomerCancelOrderModalProps): JSX.Element | null {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!order) return null;

  // Customer-friendly cancellation reasons
  const customerReasons = [
    'Changed my mind',
    'Ordered wrong items',
    'Ordered duplicate by mistake',
    'Need to modify order',
    'Delivery date doesn\'t work',
    'Found better price elsewhere',
    'Budget constraints',
    'Other'
  ];

  // Calculate order summary
  const orderTotal = order.total || 0;
  const productCount = order.items?.length || 0;
  const totalItems = order.items?.reduce((sum, item) => {
    return sum + (item.monday + item.tuesday + item.wednesday + item.thursday + item.friday + item.saturday + item.sunday);
  }, 0) || 0;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm(reason || undefined, notes || undefined);
      onClose();
      await invalidateCache.orders(); // Invalidate cache to reflect changes
    } catch (error) {
      console.error('❌ Failed to cancel order:', error);
      alert('Failed to cancel order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="danger"
      onClose={onClose}
      title="Cancel Order"
      subtitle="This action cannot be undone"
      icon={<AlertTriangle className="icon-modal-header" />}
      footer={
        <CancelConfirmFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          isProcessing={isProcessing}
        />
      }
    >
      <div className="space-y-6">
        {/* Order Summary Box */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl p-5 shadow-md">
          <h3 className="heading-5 text-orange-900 mb-4 flex items-center gap-2">
            <Package className="icon-md" />
            Order Summary
          </h3>
          
          <div className="space-y-3">
            {/* Order ID */}
            <div className="flex items-center justify-between">
              <span className="body-base text-gray-700 font-medium">Order ID:</span>
              <span className="body-base text-gray-900 font-bold">{displayOrderNumber(order)}</span>
            </div>

            {/* Delivery Week */}
            <div className="flex items-start justify-between">
              <span className="body-base text-gray-700 font-medium flex items-center gap-2">
                <Calendar className="icon-button" />
                Delivery Week:
              </span>
              <span className="body-base text-gray-900 font-semibold text-right">
                Week {order.week} ({order.weekRange})
              </span>
            </div>

            {/* Items Count */}
            <div className="flex items-center justify-between">
              <span className="body-base text-gray-700 font-medium">Items:</span>
              <span className="body-base text-gray-900 font-semibold">
                {productCount} products ({totalItems} units)
              </span>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-orange-300">
              <span className="heading-5 text-gray-900 flex items-center gap-2">
                <DollarSign className="icon-md" />
                Total:
              </span>
              <span className="heading-4 text-orange-700">{formatCurrency(orderTotal)}</span>
            </div>
          </div>
        </div>

        {/* Cancellation Reason (Optional) */}
        <div>
          <label className="form-label text-gray-700 mb-2">
            Why are you cancelling? <span className="body-sm text-gray-500">(Optional)</span>
          </label>
          <select
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReason(e.target.value)}
            disabled={isProcessing}
            className="form-input w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
          >
            <option value="">Select a reason...</option>
            {customerReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Additional Notes (Optional) */}
        <div>
          <label className="form-label text-gray-700 mb-2">
            Additional notes <span className="body-sm text-gray-500">(Optional)</span>
          </label>
          <textarea
            id="cancel-notes"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            disabled={isProcessing}
            placeholder="Any additional information you'd like to share..."
            rows={3}
            className="form-input w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition-colors resize-none"
          />
        </div>

        {/* Warning Box */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 border-3 border-red-400 rounded-xl p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="icon-alert text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="body-sm text-gray-700 font-medium">
                <span className="body-base text-red-600 font-bold">⚠️</span>
                {' '}This action <strong>CANNOT BE UNDONE</strong>.
              </p>
              <p className="body-sm text-gray-600 mt-1">
                Your order will be cancelled immediately and removed from your pending orders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </StyleModalShell>
  );
}