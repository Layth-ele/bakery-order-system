/**
 * RejectOrderModal - Admin rejects a pending order
 * 
 * ✅ FEB 21, 2026: Updated to use danger skin (skin system)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 */

import { CloseFooter } from '../../../ui/modals/ModalFooterButtons';
import { ModalThreeSections } from './ModalOrderSections';
import { XCircle } from 'lucide-react'; // Icon imports
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CancelConfirmFooter } from '../../../ui/modals/ModalFooterButtons'; // ✅ FEB 21, 2026
import type { Order, Product } from '../../../types';
import { useState } from 'react';

import { displayOrderNumber } from '../../../utils/displayId';

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
  const [reasonError, setReasonError] = useState('');

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

  const finalReason = (rejectionReason === 'Other' ? customReason : rejectionReason).trim();

  const handleConfirm = () => {
    if (!finalReason) {
      setReasonError('Please give a reason — the customer sees it.');
      return;
    }
    onConfirm && onConfirm(finalReason);
  };

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
            confirmLabel="Reject Order"
            confirmVariant="danger"
          />
        )
      }
    >
      {!isReadOnly && (
        <section className="mb-4 rounded-xl border-2 border-red-200 bg-red-50/60 p-4">
          <label htmlFor="reject-reason" className="mb-2 block text-sm font-semibold text-red-900">
            Reason for rejecting <span className="font-normal text-red-700">(sent to the customer)</span>
          </label>
          <select
            id="reject-reason"
            value={rejectionReason}
            onChange={(e) => { setRejectionReason(e.target.value); setReasonError(''); }}
            className="w-full rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            {predefinedReasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {rejectionReason === 'Other' && (
            <textarea
              value={customReason}
              onChange={(e) => { setCustomReason(e.target.value); setReasonError(''); }}
              rows={3}
              maxLength={500}
              placeholder="Explain why the order can't be accepted…"
              className="mt-3 w-full resize-none rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          )}
          {reasonError && <p className="mt-2 text-sm font-medium text-red-700">{reasonError}</p>}
        </section>
      )}

      <ModalThreeSections order={order} products={products} summaryLabel="Order Total">
      </ModalThreeSections>
</StyleModalShell>
  );
}