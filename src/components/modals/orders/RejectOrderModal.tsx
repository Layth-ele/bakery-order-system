/**
 * RejectOrderModal - Admin rejects a pending order
 * 
 * ✅ FEB 21, 2026: Updated to use danger skin (skin system)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 */

import { CloseFooter } from '../../../ui/modals/ModalFooterButtons';
import { ModalThreeSections } from './ModalOrderSections';
import { XCircle, User, Calendar, MapPin, AlertTriangle } from 'lucide-react'; // Icon imports
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CancelConfirmFooter } from '../../../ui/modals/ModalFooterButtons'; // ✅ FEB 21, 2026
import type { Order, Product } from '../../../types';
import { useState } from 'react';
import { toDate } from '../../../utils/timestampFormatting';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface RejectOrderModalProps {
  onClose: () => void;
  order: Order;
  products?: Product[];
  onConfirm?: (reason: string) => void;
}

export function RejectOrderModal({
  onClose,
  order,
  products = [],
  onConfirm
}: RejectOrderModalProps): JSX.Element | null {
  const [rejectionReason, setRejectionReason] = useState(order?.rejectionReason || 'Insufficient minimum order');
  const [customReason, setCustomReason] = useState('');

  // ✅ REMOVED: isOpen check - BaseModal handles open/close state
  // Modal is only rendered when in the modal stack
  if (!order) return null;

  // Check if this is a read-only view (order already rejected)
  const isReadOnly = order.status === 'rejected' && !onConfirm;

  const predefinedReasons = [
    'Insufficient minimum order',
    'Delivery area not serviced',
    'Payment issue',
    'Product unavailable',
    'Duplicate order',
    'Business policy violation',
    'Delivery schedule conflict',
    'Other'
  ];

  const handleConfirm = () => {
    const finalReason = rejectionReason === 'Other' ? customReason : rejectionReason;
    if (!finalReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onConfirm && onConfirm(finalReason);
  };

  // Calculate order totals
  const orderTotal = order.total || 0;
  const productCount = order.items?.length || 0;
  const totalItems = order.items?.reduce((sum, item) => {
    return sum + (item.monday + item.tuesday + item.wednesday + item.thursday + item.friday + item.saturday + item.sunday);
  }, 0) || 0;

  return (
    <StyleModalShell
      width="4xl"
      skinType="danger"
      onClose={onClose}
      title="Reject Order"
      subtitle={displayOrderNumber(order)}
      icon={<XCircle className="icon-modal-header" />}
      footer={
        isReadOnly ? (
          <CloseFooter onClose={onClose} />
        ) : (
          <CancelConfirmFooter
            onCancel={onClose}
            onConfirm={handleConfirm}
            confirmLabel="REJECT ORDER"
            confirmVariant="danger"
          />
        )
      }
    >
      <ModalThreeSections order={order} products={products} summaryLabel="Order Total">
      </ModalThreeSections>
</StyleModalShell>
  );
}