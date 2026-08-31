/**
 * OrderUpdateSuccessModal - Displays success message after order update
 * 
 * ✅ FEB 21, 2026: Updated to use success skin (skin system)
 * ✅ FEB 19, 2026: MOVED to /components/modals/orders/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for modal consistency
 * ✅ FEB 17, 2026: Removed duplicate overlay - using modal root backdrop
 * 
 * A simple success modal displayed after a customer successfully submits an order update request.
 * Used in ActiveOrders.tsx.
 */

import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CloseFooter } from '../../../ui/modals/ModalFooterButtons'; // ✅ FEB 21, 2026
import { CheckCircle } from 'lucide-react';

interface OrderUpdateSuccessModalProps {
  message: string;
  onClose: () => void;
}

/**
 * OrderUpdateSuccessModal - Success notification for order updates
 */
export function OrderUpdateSuccessModal({ message, onClose }: OrderUpdateSuccessModalProps): JSX.Element | null {
  return (
    <StyleModalShell
      width="4xl"
      skinType="success"
      onClose={onClose}
      title="Request Submitted"
      subtitle="Bakery Order Management System"
      headerLeft={
        <div className="icon-container-md rounded-lg bg-green-500 shadow-lg">
          <CheckCircle className="icon-modal-header text-white" />
        </div>
      }
      footer={
        <CloseFooter onClose={onClose} />
      }
    >
      <div className="text-center mb-6">
        <h3 className="heading-4 text-[#D4A574] mb-4">
          Update Request Received
        </h3>
        <p className="body-base text-gray-700 leading-relaxed">
          {message}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-green-50 border-2 border-green-500/30 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle className="icon-md text-green-600 mt-0.5 flex-shrink-0" />
        <p className="body-sm text-green-800 font-medium">
          Your request is being reviewed by the bakery team. We will notify you via email and push notification once your changes are approved.
        </p>
      </div>
    </StyleModalShell>
  );
}