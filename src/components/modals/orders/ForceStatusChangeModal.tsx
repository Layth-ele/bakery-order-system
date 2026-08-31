/**
 * ForceStatusChangeModal - STUB (Never Used)
 * 
 * ✅ FEB 23, 2026: Updated to use StyleModalShell (modal standardization)
 * ❌ FEB 21, 2026: This is a stub file to prevent build errors
 * This modal is not used anywhere in the codebase
 * Admin emergency feature was planned but never implemented
 */

import { AlertTriangle } from 'lucide-react';
import { Order } from '../../../types/order';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CloseFooter } from '../../../ui/modals/ModalFooterButtons';

interface ForceStatusChangeModalProps {
  order: Order;
  onConfirm: (targetStatus: Order['status'], reason: string, password: string) => void | Promise<void>;
  onClose: () => void;
}

/**
 * Stub modal that shows an error message
 * This modal type should not be used - feature not implemented
 */
export function ForceStatusChangeModal({ onClose }: ForceStatusChangeModalProps): JSX.Element | null {
  return (
    <StyleModalShell
      width="4xl"
      skinType="danger"
      isOpen={true}
      onClose={onClose}
      title="Feature Not Available"
      icon={AlertTriangle}
    >
      <div className="space-y-4">
        <p className="body-base text-neutral-600">
          This admin emergency feature is not implemented.
        </p>
        <p className="body-sm text-neutral-500">
          Force status change functionality was planned but never completed. Use the standard order workflow instead.
        </p>
      </div>

      <CloseFooter onClose={onClose} />
    </StyleModalShell>
  );
}