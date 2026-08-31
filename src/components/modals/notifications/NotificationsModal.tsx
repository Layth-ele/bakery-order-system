/**
 * NotificationsModal.tsx V4.0
 *
 * ✅ FEB 19, 2026: MOVED to /components/modals/ (consolidation project)
 * ✅ FEB 19, 2026: CONVERTED TO StyleModalShell FOR CONSISTENCY
 * - Now uses standardized modal shell component
 * - Maintains luxury black and gold theme
 * - Consistent with all other modals in the app
 * - Custom header with unread count badge
 * - Custom footer with "Mark All Read" button
 *
 * ✅ FEB 12, 2026: REMOVED DOUBLE BASEMODAL WRAPPER
 * - Removed BaseModal wrapper (already wrapped by ModalRoot)
 * - Fixes z-index conflict (was creating two BaseModals)
 * - Modal now renders correctly with proper z-index stacking
 *
 * ✅ FEB 11, 2026: MOVED TO /notifications/components/
 * - Part of complete consolidation: all notification files in /notifications/
 * - Updated imports to reflect new subdirectory structure
 *
 * ✅ FEB 11, 2026: STALE STATE FIX - Reads notifications directly from context
 * ✅ Modal for viewing all customer notifications
 * ✅ Premium black and gold theme, mark as read, delete
 *
 * STALE STATE PROBLEM FIXED:
 * - BEFORE: Received notifications array as prop (snapshot at bell click time)
 * - AFTER: Reads notifications directly from context (real-time updates)
 *
 * Benefits:
 * - Modal always shows current notifications (no stale data)
 * - Unread count stays in sync with bell
 * - New notifications appear automatically while modal is open
 * - Mark as read/delete operations are immediately visible
 */

import { useState, useCallback } from "react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import {Bell, Trash2, Check, Eye} from "lucide-react"
import {
  useCustomerNotificationsSafe,
} from "../../../notifications/contexts"; // ✅ FIX: Use customer-specific hook
import { getModalForNotification } from "../../../notifications/types/notification-modal-mapping"; // ✅ NEW: Use mapping system

// ✅ FIXED: Correct type - matches UINotification from CustomerNotificationProvider
interface CustomerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string; // ISO string from provider
  readAt?: string; // ISO string from provider
  read: boolean;
  orderId?: string;
  invoiceId?: string;
  amount?: number;
  actions?: Array<{
    type: string;
    label: string;
    payload?: any;
  }>;
}

interface NotificationsModalProps {
  // Optional unified handler for all notification types (falls back to context)
  onViewNotification?: (
    notification: CustomerNotification,
  ) => void;
  onClose: () => void;
 // Accept data as props (modal rendered outside provider)
  notifications?: CustomerNotification[];
  unreadCount?: number;
  markAsRead?: (id: string) => Promise<void>;
  markAllAsRead?: () => Promise<void>;
  deleteNotification?: (id: string) => Promise<void>;
}

export function NotificationsModal({
  onViewNotification,
  onClose,
  notifications: notificationsProp,
  unreadCount: unreadCountProp,
  markAsRead: markAsReadProp,
  markAllAsRead: markAllAsReadProp,
  deleteNotification: deleteNotificationProp,
}: NotificationsModalProps): JSX.Element | null {
 // Try context first, fallback to props
  const context = useCustomerNotificationsSafe();

  // Use context if available, otherwise use props
  const notifications =
    context?.notifications ?? notificationsProp ?? [];
  const unreadCount =
    context?.unreadCount ?? unreadCountProp ?? 0;
  const markAsRead =
    context?.markAsRead ?? markAsReadProp ?? (async () => {});
  const markAllAsRead =
    context?.markAllAsRead ??
    markAllAsReadProp ??
    (async () => {});
  const deleteNotification =
    context?.deleteNotification ??
    deleteNotificationProp ??
    (async () => {});

  // ✅ Optimistic delete — immediately hides item, reverts on error
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleDelete = useCallback(async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error('Delete failed:', err);
      setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [deleteNotification]);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440)
      return `${Math.floor(diffInMinutes / 60)}h ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== now.getFullYear()
          ? "numeric"
          : undefined,
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ORDER_APPROVED_PAY_REQUIRED":
      case "ORDER_COMPLETED":
        return "✅";
      case "ORDER_REJECTED":
      case "ORDER_CANCELLED":
        return "❌";
      case "PAYMENT_CONFIRMED":
      case "CREDIT_ISSUED":
        return "💰";
      case "INVOICE_UPDATED":
        return "📄";
      case "PAYMENT_IN_REVIEW":
      case "PAYMENT_REMINDER":
        return "⏳";
      case "ORDER_PENDING":
        return "📝";
      case "ADDITIONAL_PAYMENT_REQUIRED":
        return "💳";
      default:
        return "🔔";
    }
  };

  // ✅ NEW: Get button label and style based on notification type
  const getViewButtonConfig = (
    notification: CustomerNotification,
  ) => {
    const modalConfig = getModalForNotification(
      notification.type,
    );

    // Default if no mapping found
    if (!modalConfig) {
      return {
        label: "View",
        style: "bg-blue-50 hover:bg-blue-100 text-blue-600",
      };
    }

    // Custom labels and styles per notification type
    switch (notification.type) {
      case "ORDER_PENDING":
        return {
          label: "View Order",
          style:
            "bg-yellow-50 hover:bg-yellow-100 text-yellow-700",
        };
      case "ORDER_APPROVED_PAY_REQUIRED":
      case "ADDITIONAL_PAYMENT_REQUIRED":
        return {
          label: "View Details",
          style:
            "bg-orange-50 hover:bg-orange-100 text-orange-600",
        };
      case "ORDER_REJECTED":
        return {
          label: "View Details",
          style: "bg-red-50 hover:bg-red-100 text-red-600",
        };
      case "ORDER_CANCELLED":
        return {
          label: "View Details",
          style: "bg-gray-50 hover:bg-gray-100 text-gray-600",
        };
      case "PAYMENT_IN_REVIEW":
      case "PAYMENT_REMINDER":
        return {
          label: "Check Status",
          style:
            "bg-purple-50 hover:bg-purple-100 text-purple-600",
        };
      case "PAYMENT_CONFIRMED":
      case "ORDER_COMPLETED":
        return {
          label: "View Invoice",
          style:
            "bg-green-50 hover:bg-green-100 text-green-600",
        };
      case "INVOICE_UPDATED":
        return {
          label: "View Invoice",
          style: "bg-blue-50 hover:bg-blue-100 text-blue-600",
        };
      case "CREDIT_ISSUED":
        return {
          label: "View Credit",
          style:
            "bg-emerald-50 hover:bg-emerald-100 text-emerald-600",
        };
      default:
        return {
          label: "View",
          style: "bg-blue-50 hover:bg-blue-100 text-blue-600",
        };
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={onClose}
      title="Notifications"
      subtitle={
        unreadCount > 0 ? `${unreadCount} unread` : undefined
      }
      icon={<Bell className="w-6 h-6" />}
      footer={
        notifications.length > 0 && unreadCount > 0 ? (
          <div className="px-6 py-3">
            <button
              onClick={markAllAsRead}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D4A574] to-[#D4A574] hover:from-[#D4A574] hover:to-[#D4A574] text-white rounded-lg transition-all duration-200 font-medium"
            >
              <Check className="w-4 h-4" />
              <span>Mark All as Read</span>
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Notifications List */}
      {/* ✅ FEB 21, 2026: Removed duplicate overflow-y-auto - StyleModalShell body handles scrolling */}
      <div>
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              No notifications
            </p>
            <p className="text-gray-400 text-sm mt-2">
              All clear! 🎉
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {notifications
              .filter(n => !deletingIds.has(n.id))
              .map((notification) => {
              const viewButtonConfig = getViewButtonConfig(notification);
              const hasModalMapping = getModalForNotification(notification.type) !== null;

              return (
                <div
                  key={notification.id}
                  className={`rounded-xl border-2 overflow-hidden transition-all shadow-sm ${
                    notification.read
                      ? "border-gray-200 bg-white"
                      : "border-[#D4A574] bg-gradient-to-br from-[#FFF9F0] to-white"
                  }`}
                >
                  <div className="p-4">
                    {/* ── Top row: icon + title + unread dot ── */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 text-xl mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-semibold text-sm leading-snug ${notification.read ? "text-gray-600" : "text-gray-900"}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-[#FF5722] rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Message ── */}
                    <p className="text-gray-600 text-sm leading-relaxed mb-3 pl-8">
                      {notification.message}
                    </p>

                    {/* ── Amount (if present) ── */}
                    {notification.amount && (
                      <div className="pl-8 mb-3">
                        <span className="inline-flex items-center gap-1 bg-[#D4A574]/10 text-[#8B6F47] font-semibold text-sm px-2.5 py-1 rounded-lg">
                          💰 ${notification.amount.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* ── Timestamp ── */}
                    <p className="text-xs text-gray-400 pl-8 mb-4">
                      {formatDate(notification.createdAt)}
                    </p>

                    {/* ── Divider ── */}
                    <div className="border-t border-gray-100 mb-3" />

                    {/* ── Action Buttons ── */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#D4A574]/10 hover:bg-[#D4A574]/20 text-[#8B6F47] rounded-lg transition-all font-semibold"
                        >
                          <Check className="w-3 h-3" />
                          Mark read
                        </button>
                      )}

                      {hasModalMapping && (
                        <button
                          onClick={() => {
                            onClose();
                            onViewNotification?.(notification as any);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all font-semibold ${viewButtonConfig.style}`}
                        >
                          <Eye className="w-3 h-3" />
                          {viewButtonConfig.label}
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all font-semibold ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StyleModalShell>
  );
}