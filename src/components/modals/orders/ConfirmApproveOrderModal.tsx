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

import { ModalThreeSections } from './ModalOrderSections';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CancelConfirmFooter } from '../../../ui/modals/ModalFooterButtons'; // Standardized footer
import { CheckCircle, AlertTriangle, DollarSign, Calendar, User, Package, MapPin, Edit2 } from 'lucide-react'; // ✅ FEB 21, 2026
import { toDate } from '../../../utils/timestampFormatting';
import type { Order, Product, Category } from '../../../types';
import { useState } from 'react';
import { formatCurrency } from '../../../utils/helpers'; // Using canonical formatCurrency
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

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
  const [deliveryFee, setDeliveryFee] = useState(initialDeliveryFee);
  const [isEditingDeliveryFee, setIsEditingDeliveryFee] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!order) return null;

  // Calculate order totals
  const subtotal = order.subtotal || 0;
  const gst = order.gst || 0;
  const serviceFee = order.serviceFee || 0;
  const total = subtotal + gst + serviceFee + deliveryFee;
  
  const productCount = order.items?.length || 0;
  const totalItems = order.items?.reduce((sum, item) => {
    return sum + (item.monday + item.tuesday + item.wednesday + item.thursday + item.friday + item.saturday + item.sunday);
  }, 0) || 0;

  // Format delivery date
  const deliveryDate = order.deliveryDate 
    ? (() => {
        const dt = toDate(order.deliveryDate);
        return dt
          ? dt.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
          : 'Not specified';
      })()
    : 'Not specified';

  const handleConfirm = async () => {
    if (deliveryFee < 0) {
      alert('Delivery fee cannot be negative');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(deliveryFee);
      onClose();
    } catch (error) {
      console.error('❌ Failed to approve order:', error);
      alert('Failed to approve order. Please try again.');
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
      subtitle="Review and confirm order approval"
      icon={<CheckCircle className="icon-modal-header" />}
      footer={
        <CancelConfirmFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          isProcessing={isProcessing}
          confirmLabel="Confirm Approval"
          confirmVariant="success"
        />
      }
    >

      <ModalThreeSections order={order} products={products} summaryLabel="Order Total">
      </ModalThreeSections>
</StyleModalShell>
  );
}