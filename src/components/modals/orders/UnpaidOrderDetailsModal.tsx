/**
 * UnpaidOrderDetailsModal - Shows details for orders in APPROVED (unpaid) state
 *
 * ✅ MAR 18, 2026: UI Update - Replaced cancel order with close button + added payment details section
 *   - Removed CANCEL ORDER button from footer (replaced with CLOSE)
 *   - Added comprehensive Payment Details section with order number, e-transfer password, and submission time
 * ✅ MAR 13, 2026: Major UI Refactor
 *   - Matched style and layout to PaidOrderDetailsModal (ORDER IN PRODUCTION)
 *   - Replaced custom table with OrderItemsTable component (includes day/date display)
 *   - Added consistent section styling with proper spacing (mt-6)
 *   - Updated to use dark gradient headers matching other modals
 *   - Improved payment status alert boxes with gradient backgrounds
 *   - Enhanced Customer & Delivery information cards
 * ✅ FEB 22, 2026: Fixed missing DollarSign import
 * ✅ FEB 19, 2026: MOVED to /components/modals/orders/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell (Batch 9) for consistency
 */

import { ModalThreeSections } from './ModalOrderSections';
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalFooterButtons } from "../../../ui/modals/ModalFooterButtons";
import { 
  DollarSign, 
  Package, 
  AlertCircle, 
  Bell, 
  Mail,
  XCircle, 
  AlertTriangle, 
  Check, 
  Clock, 
  FileText, 
  User, 
  Calendar,
  MapPin,
  CheckCircle2
} from "lucide-react";
import type { Order, Product, Category } from "../../../types";
import { toDate } from '../../../utils/timestampFormatting';
import { formatShortDate } from "../../../utils/weekUtils";
import { useCachedOrders } from '../../../hooks/useCachedFirebase';
import { useMemo } from 'react';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface UnpaidOrderDetailsModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onConfirmPayment: (order: Order) => void;
  onSendReminder: (order: Order) => void;
  onCancelOrder?: (order: Order) => void; // ✅ MAR 18: Made optional since we removed the cancel button
}

export function UnpaidOrderDetailsModal({
  order,
  products,
  categories,
  onClose,
  onConfirmPayment,
  onSendReminder,
  onCancelOrder,
}: UnpaidOrderDetailsModalProps): JSX.Element | null {
  // ✅ Safety check: if order is undefined, close modal
  if (!order) {
    onClose();
    return null;
  }

  // ✅ Get live order data from cache to reflect real-time updates
  const { data: orders } = useCachedOrders();
  const liveOrder = useMemo(() => {
    return orders?.find((o) => o.id === order.id) || order;
  }, [orders, order.id, order]);
  
  // Calculate payment reminder info from live order
  const paymentReminderCount = liveOrder.paymentReminderCount || 0;
  const emailReminderCount = liveOrder.emailReminderCount || 0;
  const lastReminderSentAt = liveOrder.lastReminderSentAt;
  const lastEmailReminderSentAt = liveOrder.lastEmailReminderSentAt;
  const paymentSubmitted = liveOrder.paymentSubmitted && !liveOrder.paymentReceived;
  const transferPassword = liveOrder.transferPassword;
  const paymentSubmittedAt = liveOrder.paymentSubmittedAt;

  // ✅ Determine if we're in email reminder mode (after 2 notification reminders)
  const isEmailMode = paymentReminderCount >= 2;

  // Calculate order total
  const orderTotal = liveOrder.total || 0;
  const amountDue = liveOrder.amountDue || orderTotal;

  return (
    <StyleModalShell
      width="4xl"
      skinType="warning"
      onClose={onClose}
      title="UNPAID ORDER DETAILS"
      subtitle={paymentSubmitted ? "Payment submitted • Awaiting confirmation" : "Awaiting payment from customer"}
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={
        <ModalFooterButtons
          cancelButton={{ label: "Close", onClick: onClose, variant: "secondary" }}
          confirmButton={paymentSubmitted ? {
            label: "Confirm Payment",
            onClick: () => onConfirmPayment(liveOrder),
            variant: "success",
            icon: <Check className="w-4 h-4" />,
          } : {
            label: isEmailMode
              ? `Send Email Reminder${emailReminderCount > 0 ? ` (${emailReminderCount})` : ''}`
              : paymentReminderCount > 0
                ? `Send Reminder (${paymentReminderCount}/2)`
                : 'Send Payment Reminder',
            onClick: async () => { await onSendReminder(liveOrder); },
            variant: isEmailMode ? "warning" : "primary",
            icon: isEmailMode ? <Mail className="w-4 h-4" /> : <Bell className="w-4 h-4" />,
          }}
        />
      }
    >
      <ModalThreeSections order={order} products={products}>
      </ModalThreeSections>
</StyleModalShell>
  );
}