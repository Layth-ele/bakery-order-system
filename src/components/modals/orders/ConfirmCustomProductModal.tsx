/**
 * ConfirmCustomProductModal - Simple confirmation for custom product addition
 * ✅ MAR 2, 2026: Simplified confirmation matching payment reminder design
 */

import { Info } from 'lucide-react';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { ModalFooterButtons } from '../../../ui/modals/ModalFooterButtons';

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
    <StyleModalShell
      width="md"
      onClose={onClose}
      title="Custom Product Added"
      icon={Info}
      footer={
        <ModalFooterButtons
          confirmButton={{ label: 'OK', onClick: onClose, variant: 'primary', keyboardShortcut: 'Enter' }}
        />
      }
    >
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold text-neutral-800 break-words">Product “{name}” added</p>
        <p className="font-medium text-neutral-700">
          Quantity: {quantity} on {selectedDayNames.join(', ') || 'no days selected'}
        </p>
        <p className="text-sm text-neutral-600">
          Don't forget to save your changes when you're done editing.
        </p>
      </div>
    </StyleModalShell>
  );
}