/**
 * Payment Confirmed Message Modal
 * 
 * ✅ MAR 18, 2026: CREATED
 * ✅ MAR 18, 2026: Updated background to match other modals (bg-white instead of dark gradient)
 * Simple informational modal for admin when payment is confirmed
 * Shows minimal details - just confirmation message and close button
 * 
 * Purpose:
 * - Inform admin that payment was successfully confirmed
 * - Order is now in production
 * - No actions needed - just informational
 */

import { CheckCircle } from 'lucide-react';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { CloseFooter } from '../../../ui/modals/ModalFooterButtons';

interface PaymentConfirmedMessageModalProps {
  orderId: string;
  customerName?: string;
  amount?: number;
  invoiceNumber?: string;
  onClose: () => void;
}

export function PaymentConfirmedMessageModal({
  customerName,
  amount,
  invoiceNumber,
  onClose,
}: PaymentConfirmedMessageModalProps): JSX.Element | null {
  const rows: Array<[string, string, string?]> = [
    ...(invoiceNumber ? [["Invoice Number", invoiceNumber] as [string, string]] : []),
    ...(customerName ? [["Customer", customerName] as [string, string]] : []),
    ...(amount !== undefined ? [["Amount", `$${amount.toFixed(2)}`, 'text-emerald-600 font-bold'] as [string, string, string]] : []),
    ['Status', 'In Production', 'text-emerald-600'],
  ];
  return (
    <StyleModalShell
      width="md"
      skinType="success"
      onClose={onClose}
      title="Payment Confirmed"
      subtitle="Order in production"
      icon={CheckCircle}
      footer={<CloseFooter onClose={onClose} />}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center font-medium text-emerald-700">
          ✅ Payment successfully confirmed
        </div>
        <dl className="divide-y divide-neutral-200">
          {rows.map(([label, value, cls]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-neutral-600">{label}</dt>
              <dd className={`text-right font-medium text-neutral-900 break-all ${cls ?? ''}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center text-sm text-blue-700">
          🎉 Order is now being prepared by the bakery team
        </div>
      </div>
    </StyleModalShell>
  );
}
