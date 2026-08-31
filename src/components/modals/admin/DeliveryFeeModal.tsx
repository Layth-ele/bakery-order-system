/**
 * DeliveryFeeModal - Edit delivery fee for a specific customer
 *
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ FEB 18, 2026: Extracted from inline modal in AdminDashboard.tsx and useOrderActionHandlers.tsx
 *
 * Prompts admin to enter a delivery fee for orders below the free delivery minimum.
 * Used during order approval flow when subtotal doesn't meet the threshold.
 */

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
      width="4xl"
      skinType="default"
      onClose={handleCancel}
      title="SET DELIVERY FEE"
      icon={<DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />}
      footer={
        <div className="flex gap-3 w-full">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-3 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg transition-colors font-semibold"
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-[#4CAF50] text-white rounded-lg hover:bg-[#45a049] transition-colors font-semibold"
          >
            APPROVE ORDER
          </button>
        </div>
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