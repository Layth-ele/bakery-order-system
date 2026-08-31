import { CreditCard, CheckCircle, DollarSign, MapPin, Package, AlertCircle, User as UserIcon } from 'lucide-react';
/**
 * CustomerUnpaidOrderDetailsModal - Customer view of their unpaid (APPROVED) order details
 *
 * ✅ FEB 19, 2026: MOVED to /components/modals/orders/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ FEB 10, 2026: Updated to match PAYMENT IN REVIEW modal style
 * - Blue gradient header (action required theme)
 * - Status alert box with circular icon
 * - Dark section headers matching Payment In Review
 * - Clean two-column layout
 * - PAY NOW button for easy payment submission
 *
 * Read-only modal for customers viewing their unpaid orders
 * Shows order details, payment status, and timeline
 */

import { ModalThreeSections } from './ModalOrderSections';
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalFooterButtons } from "../../../ui/modals/ModalFooterButtons"; // ✅ FEB 21, 2026
import type { Order, Product, Category } from "../../../types";
import { formatTimestamp } from "../../../utils/timestampFormatting"; // 🔥 TIMESTAMP FIX: Use new utility
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface CustomerUnpaidOrderDetailsModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onPayNow?: (order: Order) => void;
}

export function CustomerUnpaidOrderDetailsModal({
  order,
  products,
  categories,
  onClose,
  onPayNow,
}: CustomerUnpaidOrderDetailsModalProps): JSX.Element | null {
  // Calculate payment info
  const paymentSubmitted =
    order.paymentSubmitted && !order.paymentReceived;

  // Calculate order total
  const orderTotal = order.total || 0;
  const amountDue = order.amountDue || orderTotal;

  return (
    <StyleModalShell
      width="4xl"
      skinType="warning"
      onClose={onClose}
      title="PAYMENT REQUIRED"
      subtitle="Order approved • Payment pending"
      icon={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center">
          <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={
        <ModalFooterButtons
          leftAction={
            onPayNow && !paymentSubmitted
              ? {
                  label: `PAY NOW - $${amountDue.toFixed(2)}`,
                  onClick: () => {
                    onClose();
                    setTimeout(() => onPayNow?.(order), 100);
                  },
                  variant: "success",
                  icon: <CreditCard className="w-5 h-5" />,
                }
              : undefined
          }
          confirmButton={{
            label: "Close",
            onClick: onClose,
            variant: "primary",
          }}
        />
      }
    >
      <ModalThreeSections order={order} products={products ?? []}>
      </ModalThreeSections>
    </StyleModalShell>
  );
}