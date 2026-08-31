/**
 * ConfirmCustomProductModal - Simple confirmation for custom product addition
 * ✅ MAR 2, 2026: Simplified confirmation matching payment reminder design
 */

import { Info } from 'lucide-react';

interface CustomProductData {
  name: string;
  price: number;
  selectedDays: { [key: string]: boolean };
  quantity: number;
}

interface ConfirmCustomProductModalProps {
  productData: CustomProductData;
  onClose: () => void;
}

// Day labels mapping
const DAY_LABELS: { [key: string]: string } = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export function ConfirmCustomProductModal({
  productData,
  onClose,
}: ConfirmCustomProductModalProps): JSX.Element | null {
  const { name, selectedDays, quantity } = productData;

  // Get selected day names
  const selectedDayNames = Object.entries(selectedDays)
    .filter(([_, selected]) => selected)
    .map(([dayKey]) => DAY_LABELS[dayKey] || dayKey);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-4 border-white">
        {/* Gold gradient header */}
        <div className="bg-gradient-to-r from-[#C9A572] via-[#D4A574] to-[#E0B87E] px-6 py-4 flex items-center gap-3">
          <div className="icon-container-sm bg-white/30 rounded-full flex-shrink-0">
            <Info className="icon-md text-white" />
          </div>
          <h2 className="modal-title text-white uppercase">
            CUSTOM PRODUCT ADDED
          </h2>
        </div>

        {/* White body */}
        <div className="px-6 py-8 text-center">
          {/* Large blue circular icon */}
          <div className="flex justify-center mb-6">
            <div className="icon-container-2xl bg-gradient-to-br from-[#5DADE2] to-[#3498DB] rounded-full shadow-lg">
              <div className="icon-container-xl bg-white/30 backdrop-blur-sm rounded-xl">
                <Info className="icon-2xl text-white" />
              </div>
            </div>
          </div>

          {/* Main message */}
          <p className="heading-5 text-neutral-800 mb-4 leading-relaxed">
            Product "{name}" added
          </p>

          {/* Quantity and days */}
          <p className="body-base text-neutral-700 font-semibold mb-6">
            Quantity: {quantity} on {selectedDayNames.join(', ')}
          </p>

          {/* Description */}
          <p className="body-sm text-neutral-600 leading-relaxed">
            This custom product has been added to the order. Don't forget to save your changes when you're done editing.
          </p>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 space-y-3">
          {/* Primary button - Gold/brown */}
          <button
            onClick={onClose}
            className="button-text-base w-full bg-gradient-to-r from-[#C9A572] to-[#D4A574] hover:from-[#B8956A] hover:to-[#C39465] text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg uppercase"
          >
            OK
          </button>

          {/* Secondary button - Gray */}
          <button
            onClick={onClose}
            className="button-text-base w-full bg-neutral-300 hover:bg-neutral-400 text-neutral-700 font-bold py-3 rounded-xl transition-all uppercase"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}