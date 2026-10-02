/**
 * DeliveryFeeModal - Edit delivery fee for a specific customer
 *
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ Delivery fee editing modal for the current order flow
 *
 * Prompts admin to enter a delivery fee for orders below the free delivery minimum.
 * Used during order approval flow when subtotal doesn't meet the threshold.
 */

import { CancelConfirmFooter } from '../../../ui/modals/ModalFooterButtons';
import { useState } from "react";
import { DollarSign } from "lucide-react";
import { useModal } from "../../../contexts/ModalContextNew";
import { useAlert } from "../../../contexts/AlertContext";
import { validateDeliveryFee } from "../../../services/ordersService";
import {
  updateCustomer,
  getCustomers,
} from "../../../services/dataService";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";

interface DeliveryFeeModalProps {
  orderId: string;
  onConfirm: (orderId: string, fee: number) => void;
}

export function DeliveryFeeModal({
  orderId,
  onConfirm,
}: DeliveryFeeModalProps): JSX.Element | null {
  const { closeModal } = useModal();
  const { showAlert } = useAlert();
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("");

  const handleConfirm = () => {
    const fee = parseFloat(deliveryFeeInput) || 0;

    // Validate fee
    const validationError = validateDeliveryFee(fee);
    if (validationError) {
      showAlert({
        title: "Invalid Delivery Fee",
        message: validationError,
        icon: "warning",
      });
      return;
    }

    // Call the confirmation handler
    onConfirm(orderId, fee);
    closeModal();
  };

  const handleCancel = () => {
    closeModal();
  };

  return (
    <StyleModalShell
      width="md"
      skinType="default"
      onClose={handleCancel}
      title="SET DELIVERY FEE"
      icon={<DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />}
      footer={
        <CancelConfirmFooter
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          confirmLabel="Approve Order"
          confirmVariant="success"
        />
      }
    >
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="bg-[#FFF3E0] border-2 border-[#FF9800] rounded-lg p-4">
          <p className="text-sm text-[#333333] flex items-start gap-2">
            <span className="text-lg">💡</span>
            <span>
              This order's subtotal is below the free delivery
              minimum. Please enter the delivery fee determined
              by the bakery office.
            </span>
          </p>
        </div>

        {/* Delivery Fee Input */}
        <div>
          <label className="block text-[#333333] mb-2 font-medium">
            Delivery Fee Amount
          </label>
          <div className="flex items-center">
            <span className="text-[#333333] mr-2 text-lg">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={deliveryFeeInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDeliveryFeeInput(e.target.value)
              }
              className="flex-1 px-4 py-3 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#D4A574]"
              placeholder="0.00"
              autoFocus
            />
          </div>
        </div>
      </div>
    </StyleModalShell>
  );
}