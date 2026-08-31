/**
 * RejectedOrderDetailsModal - Shows details for REJECTED orders
 * 
 * ✅ FEB 21, 2026: Updated to use danger skin (skin system)
 * ✅ FEB 19, 2026: MOVED to /components/modals/orders/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell (Modal Consistency Project - Batch 12)
 * ✅ FEB 10, 2026: Updated to match PAYMENT IN REVIEW modal style
 * - Red gradient header (rejected/negative theme)
 * - Status alert box with circular icon
 * - Dark section headers matching Payment In Review
 * - Clean two-column layout
 * - Shows rejection reason prominently
 * 
 * Specialized modal for viewing rejected order details
 * Shows rejection information, reasons, and complete order details
 */

import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { ModalThreeSections } from './ModalOrderSections';
import { CloseFooter, ModalFooterButtons } from '../../../ui/modals/ModalFooterButtons'; // ✅ FEB 21, 2026
import {XCircle, User, Calendar, MapPin, DollarSign, AlertTriangle, FileText, Mail} from 'lucide-react'
import type { Order, Product, Category } from '../../../types';
import { formatOrderDateWithFallback } from '../../../services/calculators'; // Migrated from utils
import { CONTACT_DEFAULTS } from '../../../constants/businessDefaults'; // Import bakery email
import { getWeekDayDate, formatShortDate } from '../../../utils/weekUtils'; // Import date utilities
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface RejectedOrderDetailsModalProps {
  order: Order | null; // ✅ Allow null for deleted orders
  products: Product[];
  categories: Category[];
  onClose: () => void;
  rejectionReason?: string;
  notificationId?: string; // ✅ For deleting invalid notifications
  onDeleteNotification?: (id: string) => void; // ✅ Callback to delete notification
}

export function RejectedOrderDetailsModal({
  order,
  products,
  categories,
  onClose,
  rejectionReason,
  notificationId,
  onDeleteNotification
}: RejectedOrderDetailsModalProps): JSX.Element | null {
  
  // ✅ NULL CHECK: Return early if order is not loaded
  if (!order) {
    const handleDelete = () => {
      if (notificationId && onDeleteNotification) {
        onDeleteNotification(notificationId);
      }
      onClose();
    };
    
    return (
      <StyleModalShell
        width="4xl"
        skinType="danger"
        isOpen={true}
        onClose={onClose}
        title="Order Not Found"
        footer={
          <ModalFooterButtons
            cancelButton={{ label: "Close", onClick: onClose, variant: "secondary" }}
            confirmButton={notificationId && onDeleteNotification ? {
              label: "Delete Notification",
              onClick: handleDelete,
              variant: "danger",
            } : undefined}
          />
        }
      >
        <div className="p-6 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <p className="text-lg text-gray-700 mb-2">
            Unable to load order details. The order may have been deleted.
          </p>
          {notificationId && onDeleteNotification && (
            <p className="text-sm text-gray-500">
              You can delete this notification to remove it from your list.
            </p>
          )}
        </div>
      </StyleModalShell>
    );
  }
  
  // Calculate order details
  const orderTotal = order.total || 0;
  

  // Determine rejection context
  const reason = rejectionReason || order.rejectionReason || 'No reason provided';
  
  // Calculate total product count
  const totalProducts = order.items.length;

  return (
    <StyleModalShell
      skinType="danger"
      onClose={onClose}
      title="ORDER REJECTED"
      subtitle={`Order #${displayOrderNumber(order)}`}
      width="4xl"
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={
        <CloseFooter onClose={onClose} />
      }
    >

      <ModalThreeSections order={order} products={products} summaryLabel="Order Total">
      </ModalThreeSections>
</StyleModalShell>
  );
}