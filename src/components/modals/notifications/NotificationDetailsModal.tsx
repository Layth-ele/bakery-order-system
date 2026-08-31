/**
 * NotificationDetailsModal - Shows full notification details
 *
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ FEB 16, 2026: STEP 7 - Safe Fallback Modal
 *
 * PURPOSE:
 * - Fallback modal for unknown/legacy notification types
 * - Prevents app crashes from unrecognized notifications
 * - Shows notification data in a safe, readable format
 * - Provides debugging information for developers
 *
 * WHEN USED:
 * - Unknown notification type in database
 * - Legacy notification type not in mapping
 * - Error resolving modal props
 * - Development/debugging
 *
 * Created: February 16, 2026
 */

import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { CloseFooter } from "../../../ui/modals/ModalFooterButtons"; // ✅ FEB 21, 2026
import {
  Bell,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  Clock,
  FileText,
  Package,
} from "lucide-react";
import type { NotificationItem } from "../../../types/notification-contract"; // Changed to relative path for consistency
import { toDate } from '../../../utils/timestampFormatting';

interface NotificationDetailsModalProps {
  notification?: NotificationItem;
  notificationId?: string;
  error?: string;
  onClose: () => void;
}

/**
 * Safe fallback modal for unknown notification types
 * Shows notification details instead of crashing
 */
// PASS 12: Removed `type AnyNotification = any` and the 22 `notif.x`
// casts that built up around it. The canonical `NotificationItem` already
// has every field this modal reads (`orderId`, `invoiceId`, `customerId`,
// `amount`, `read`, `createdAt`, `metadata`) — the casts were purely
// redundant, originally added because the fallback object on line ~60 below
// was missing a `target` field that the type required.
//
// Two fields the modal accesses (`orderNumber`, `invoiceNumber`) are NOT on
// the contract but are sometimes denormalized into the notification doc by
// older writers. Modeled here as an optional extension type so the access
// is explicit, narrowed, and lets the rest of the file stay typed.
type NotifWithLegacyFields = NotificationItem & {
  orderNumber?: string;
  invoiceNumber?: string;
};

export function NotificationDetailsModal({
  notification,
  notificationId,
  error,
  onClose,
}: NotificationDetailsModalProps): JSX.Element | null {
  // PASS 12: Fallback was missing required NotificationItem fields (title,
  // orderId, actions). Adding them as empty/sensible defaults so `notif` can
  // be typed without resorting to `as any`.
  const notif: NotifWithLegacyFields = notification ?? {
    id: notificationId || "unknown",
    type: "UNKNOWN" as NotificationItem['type'],
    title: "",
    message: "No notification data available",
    orderId: "",
    createdAt: new Date().toISOString(),
    read: false,
    actions: [],
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={onClose}
      title="Notification Details"
      subtitle={
        error
          ? "Error loading notification"
          : "Unknown notification type"
      }
      icon={
        <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
      }
      footer={<CloseFooter onClose={onClose} />}
    >
      <div className="space-y-4">
        {/* Error Message (if any) */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">
                  Error
                </h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Warning Message */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-1">
                Unknown Notification Type
              </h3>
              <p className="text-sm text-yellow-800">
                This notification type is not recognized. This
                may be a legacy notification or a notification
                type that is no longer supported. The
                notification data is shown below for reference.
              </p>
            </div>
          </div>
        </div>

        {/* Notification Type */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <h3 className="font-semibold text-gray-900">
              Notification Type
            </h3>
          </div>
          <p className="text-base font-mono bg-white px-3 py-2 rounded-lg border border-gray-200 text-[#333]">
            {notif.type || "UNKNOWN"}
          </p>
        </div>

        {/* Notification Message */}
        {notif.message && (
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900">
                Message
              </h3>
            </div>
            <p className="text-gray-800">
              {notif.message}
            </p>
          </div>
        )}

        {/* Key Details */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-600" />
            Key Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Notification Ref:</span>
              <span className="font-mono text-gray-900 text-sm">
                {notif.id && notif.id.length > 20
                  ? `···${notif.id.slice(-6)}`
                  : notif.id || 'N/A'}
              </span>
            </div>

            {notif.orderId && (
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Order Ref:</span>
                <span className="font-mono text-gray-900 text-sm">
                  {notif.orderNumber || notif.invoiceNumber ||
                    (notif.orderId.length > 20
                      ? `ORD-···${notif.orderId.slice(-6).toUpperCase()}`
                      : notif.orderId)}
                </span>
              </div>
            )}

            {notif.customerId && (
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Customer Ref:</span>
                <span className="font-mono text-gray-900 text-sm">
                  {notif.customerId.length > 20
                    ? `···${notif.customerId.slice(-6)}`
                    : notif.customerId}
                </span>
              </div>
            )}

            {notif.invoiceId && (
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Invoice Ref:</span>
                <span className="font-mono text-gray-900 text-sm">
                  {notif.invoiceNumber || notif.orderNumber ||
                    ((notif.invoiceId?.length ?? 0) > 20
                      ? `···${notif.invoiceId.slice(-6)}`
                      : notif.invoiceId)}
                </span>
              </div>
            )}

            {notif.amount !== undefined &&
              notif.amount !== null && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-gray-900">
                    ${(notif.amount as number).toFixed(2)}
                  </span>
                </div>
              )}

            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Created:</span>
              <span className="text-gray-900">
                {(toDate(notif.createdAt) ?? new Date()).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-gray-600">Status:</span>
              <span
                className={`font-medium ${notif.read ? "text-gray-500" : "text-blue-600"}`}
              >
                {notif.read ? "Read" : "Unread"}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata (if any) */}
        {notif.metadata &&
          Object.keys(notif.metadata).length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-600" />
                Additional Metadata
              </h3>
              <pre className="bg-white p-3 rounded border border-gray-200 text-xs font-mono overflow-x-auto">
                {JSON.stringify(notif.metadata, null, 2)}
              </pre>
            </div>
          )}

        {/* Contact support message */}
        <div className="bg-[#faf8f5] border border-[#D4A574]/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-[#D4A574] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-[#8B6F47] mb-1 text-sm">
                Need Help?
              </h3>
              <p className="text-sm text-[#5a4535]">
                If you have questions about this notification, please contact our support team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </StyleModalShell>
  );
}