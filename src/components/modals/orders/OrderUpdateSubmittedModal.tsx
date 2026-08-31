/**
 * OrderUpdateSubmittedModal - STUB (Never Used)
 * 
 * ✅ FEB 23, 2026: Updated to use StyleModalShell (modal standardization)
 * ❌ FEB 21, 2026: This is a stub file to prevent build errors
 * This modal is not used anywhere in the codebase
 * Superseded by OrderUpdateSuccessModal
 */

import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CloseFooter } from '../../../ui/modals/ModalFooterButtons';
import { AlertCircle } from 'lucide-react';

interface OrderUpdateSubmittedModalProps {
  orderId: string;
  onViewHistory: () => void;
  updateSummary?: {
    itemsAdded: number;
    itemsModified: number;
    itemsRemoved: number;
  };
  onClose: () => void;
}

/**
 * Stub modal that shows an error message
 * This modal type should not be used - use ORDER_UPDATE_SUCCESS instead
 */
export function OrderUpdateSubmittedModal({ onClose }: OrderUpdateSubmittedModalProps): JSX.Element | null {
  return (
    <StyleModalShell
      width="4xl"
      skinType="warning"
      isOpen={true}
      onClose={onClose}
      title="Modal Deprecated"
      icon={<AlertCircle className="icon-modal-header" />}
      footer={<CloseFooter onClose={onClose} />}
    >
      <div className="space-y-4">
        <p className="body-base text-neutral-600">
          This modal is deprecated. Please use ORDER_UPDATE_SUCCESS instead.
        </p>
        <p className="body-sm text-neutral-500">
          This modal has been superseded by OrderUpdateSuccessModal with improved functionality.
        </p>
      </div>
    </StyleModalShell>
  );
}