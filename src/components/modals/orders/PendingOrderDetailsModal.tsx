/**
 * PendingOrderDetailsModal - Shows details for PENDING orders (awaiting approval)
 *
 * ✅ MAR 16, 2026: Fixed Order Total showing $0.00 - now uses order.total instead of incorrect calculateTotal()
 * ✅ MAR 16, 2026: Added Service Charge to breakdown if applied and not waived
 * ✅ MAR 13, 2026: Updated Order Items to be READ-ONLY (view only)
 *   - Removed editing functionality (no state management, no onSave)
 *   - Inputs are now readonly for display purposes
 *   - Editing should be done through EditOrderModal instead
 * ✅ MAR 13, 2026: Major UI Refactor - Admin Editing Support
 *   - Replaced Products table with editable Order Items section (grouped by category)
 *   - Added Order Summary section with amber gradient styling
 *   - Implemented inline editing for admins with Save/Cancel functionality
 *   - Products now show in individual cards with date display (Mon 3/16, etc.)\
 *   - Matches design from EditOrderPage with day/date inputs
 * ✅ MAR 13, 2026: Removed Order Items section (redundant with Order Summary table)
 * ✅ FEB 21, 2026: Updated to use warning skin (skin system)
 * ✅ FEB 19, 2026: MOVED to /components/modals/orders/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * - Consistent header gradient (tan/beige)
 * - Status alert box with circular icon
 * - Dark section headers matching Payment In Review
 * - Clean two-column layout
 * - Professional typography and spacing
 *
 * Specialized modal for viewing pending order details (READ-ONLY)
 * Shows order information awaiting admin approval
 * For editing, use the EditOrderModal instead
 */

import { useMemo } from "react";
import { formatTimestamp, toDate } from '../../../utils/timestampFormatting';
import { ModalThreeSections } from './ModalOrderSections';
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { CloseFooter } from "../../../ui/modals/ModalFooterButtons";
import {
  Clock,
  User,
  Calendar,
  MapPin,
  DollarSign,
  Edit,
  XCircle,
  FileText,
  Package,
  Save,
  X,
} from "lucide-react";
import type { Order, Product, Category } from "../../../types";
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface PendingOrderDetailsModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  userRole?: "customer" | "admin";
  onSave?: (updatedOrder: Order) => void | Promise<void>;
}

export function PendingOrderDetailsModal({
  order,
  products,
  categories,
  onClose,
  userRole = "customer",
  onSave,
}: PendingOrderDetailsModalProps): JSX.Element | null {
  // Days of week for delivery schedule
  // Helper to parse week range and get dates
  const getWeekDates = () => {
    if (!order.weekRange) return null;
    
    // Parse "Week X, YYYY - Mon DD - Sun DD, MMM YYYY" format
    const match = order.weekRange.match(/Mon\s+(\d+)\s*-\s*Sun\s+(\d+),\s*(\w+)\s+(\d{4})/);
    if (!match) return null;
    
    const [, startDay, endDay, month, year] = match;
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const monthNum = monthMap[month];
    if (monthNum === undefined) return null;
    
    // Create date for Monday (start of week)
    const mondayDate = new Date(parseInt(year), monthNum, parseInt(startDay));
    
    // Generate all 7 dates
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayDate);
      date.setDate(mondayDate.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  // Calculate days since submission
  const daysSinceSubmission = order.createdAt
    ? Math.floor(
        (Date.now() - (toDate(order.createdAt)?.getTime() ?? Date.now())) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // Group items by category
  const isAdmin = userRole === "admin";

  return (
    <StyleModalShell
      width="4xl"
      skinType="warning"
      onClose={onClose}
      title="PENDING APPROVAL"
      subtitle={`Order #${displayOrderNumber(order)}`}
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={<CloseFooter onClose={onClose} />}
    >
      {/* Status Banner - compact mobile-friendly */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 bg-[#D4A574] rounded-full flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-900 text-sm">⏳ Awaiting Approval</p>
            <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
              {userRole === "customer"
                ? "Being reviewed by our team. You'll be notified once approved."
                : "Review the details below and approve or reject."}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Submitted {formatTimestamp(order.createdAt)}
              </span>
              {daysSinceSubmission > 0 && (
                <span className="text-xs text-amber-600">
                  {daysSinceSubmission} {daysSinceSubmission === 1 ? "day" : "days"} ago
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <ModalThreeSections order={order} products={products}>

        {/* Payment Status Note */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
        <XCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-600 leading-relaxed">
          {userRole === "customer"
            ? "Payment will be required once this order is approved by the admin."
            : "Customer will be notified to make payment once you approve this order."}
        </p>
      </div>
      </ModalThreeSections>
      {/* Notes Section (if any) */}
      {order.notes && (
        <div className="bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-xl p-6 border-2 border-neutral-200 mt-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-neutral-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-neutral-600" />
            </div>
            <div>
              <h4 className="font-bold text-neutral-800 text-lg mb-2">
                Order Notes
              </h4>
              <p className="text-neutral-600 text-sm leading-relaxed">
                {order.notes}
              </p>
            </div>
          </div>
        </div>
      )}
    
    </StyleModalShell>
  );
}
