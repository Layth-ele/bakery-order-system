/**
 * AdminNotificationsModal.tsx V4.0
 *
 * ✅ FEB 20, 2026: MOVED to /components/modals/admin/ (modal organization project)
 * ✅ FEB 19, 2026: MOVED to /components/modals/ (consolidation project)
 * ✅ FEB 19, 2026: CONVERTED TO StyleModalShell FOR CONSISTENCY
 * - Now uses standardized modal shell component
 * - Maintains luxury black and gold theme
 * - Consistent with all other modals in the app
 * - Matches customer notifications modal structure
 *
 * ✅ FEB 12, 2026: REMOVED DOUBLE BASEMODAL WRAPPER
 * - Removed BaseModal wrapper (already wrapped by ModalRoot)
 * - Fixes z-index conflict (was creating two BaseModals)
 * - Modal now renders correctly with proper z-index stacking
 *
 * ✅ FEB 12, 2026: UNIFIED MODAL MAPPING SYSTEM
 * - All notifications now show "View" button
 * - Uses getModalForNotification() + resolveModalProps()
 * - Each notification type opens correct modal
 * - Matches customer notification architecture
 *
 * ✅ FEB 11, 2026: MOVED TO /notifications/components/
 * - Complete consolidation: all notification files in /notifications/
 * - Updated imports to reflect new subdirectory structure
 *
 * ✅ FEB 11, 2026: STALE STATE FIX - Reads notifications directly from context
 * ✅ Modal for viewing all admin notifications
 * ✅ Matches Customer NotificationsModal styling exactly
 * ✅ Gold gradient header, action buttons, mark as read, delete
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

import { toDate, formatTimestamp } from '../../../utils/timestampFormatting';
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { Bell, Trash2, Check, Eye } from "lucide-react";
import { NotificationItem } from "../../../types/notification-contract"; // Changed to relative path for consistency
import { useAdminNotificationsSafe } from "../../../notifications/contexts"; // ✅ FEB 20: Updated for admin subfolder
import { getModalForNotification } from "../../../notifications/types/notification-modal-mapping"; // ✅ FEB 20: Updated for admin subfolder
import { startTransition, useState, useCallback } from "react";

interface AdminNotificationsModalProps {
  // ✅ Unified handler for all notification types (optional — falls back to context)
  onViewNotification?: (notification: NotificationItem) => void;
  onClose: () => void;
 // Accept data as props (modal rendered outside provider)
  notifications?: NotificationItem[];
  unreadCount?: number;
  markAsRead?: (id: string) => Promise<void>;
  markAllAsRead?: () => Promise<void>;
  deleteNotification?: (id: string) => Promise<void>;
}

export function AdminNotificationsModal({
  onViewNotification,
  onClose,
  notifications: notificationsProp,
  unreadCount: unreadCountProp,
  markAsRead: markAsReadProp,
  markAllAsRead: markAllAsReadProp,
  deleteNotification: deleteNotificationProp,
}: AdminNotificationsModalProps): JSX.Element | null {
  // ✅ NEW: Try context first, fallback to props
  const context = useAdminNotificationsSafe();

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

  // ✅ Optimistic delete — instantly hides item, reverts on error
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleDelete = useCallback(async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error('Admin delete failed:', err);
      setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [deleteNotification]);

  const formatDate = (timestamp: string) => {
    // ✅ Safety check: Handle undefined or invalid timestamps
    if (!timestamp) return "Date unavailable";

    const date = new Date(timestamp);

    // ✅ Check if date is valid
    if (isNaN(date.getTime())) return "Invalid date";

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
    // Map admin notification types to emojis
    switch (type) {
      case "ORDER_SUBMITTED":
        return "📝";
      case "PAYMENT_SUBMITTED":
        return "💰";
      case "ORDER_UPDATE_REQUESTED":
        return "🔄";
      case "PAYMENT_CONFIRMED_ADMIN":
        return "✅";
      case "ORDER_AUTO_COMPLETED_ADMIN":
        return "🎊";
      case "ORDER_DECREASED_ADMIN":
        return "📉";
      default:
        return "🔔";
    }
  };

  // ✅ NEW: Get button label and style based on notification type
  const getViewButtonConfig = (
    notification: NotificationItem,
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

    // Custom labels and styles per admin notification type
    switch (notification.type) {
      case "ORDER_SUBMITTED":
        return {
          label: "Review Order",
          style: "bg-blue-50 hover:bg-blue-100 text-blue-600",
        };
      case "PAYMENT_SUBMITTED":
        return {
          label: "Review Payment",
          style:
            "bg-green-50 hover:bg-green-100 text-green-600",
        };
      case "ORDER_UPDATE_REQUESTED":
        return {
          label: "Review Update",
          style:
            "bg-orange-50 hover:bg-orange-100 text-orange-600",
        };
      case "PAYMENT_CONFIRMED_ADMIN":
        return {
          label: "View Details",
          style:
            "bg-emerald-50 hover:bg-emerald-100 text-emerald-600",
        };
      case "ORDER_AUTO_COMPLETED_ADMIN":
        return {
          label: "View Invoice",
          style:
            "bg-purple-50 hover:bg-purple-100 text-purple-600",
        };
      case "ORDER_DECREASED_ADMIN":
        return {
          label: "View Changes",
          style:
            "bg-yellow-50 hover:bg-yellow-100 text-yellow-600",
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
      title="Admin Notifications"
      subtitle={
        unreadCount > 0 ? `${unreadCount} unread` : undefined
      }
      icon={<Bell className="w-6 h-6" />}
      footer={
        notifications.length > 0 && unreadCount > 0 ? (
          <button
            onClick={markAllAsRead}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D4A574] to-[#D4A574] hover:from-[#D4A574] hover:to-[#D4A574] text-white rounded-lg transition-all duration-200 font-medium"
          >
            <Check className="w-4 h-4" />
            <span>Mark All as Read</span>
          </button>
        ) : undefined
      }
    >
      {/* Notifications List */}
      {/* ✅ FEB 21, 2026: Removed duplicate overflow-y-auto - StyleModalShell body handles scrolling */}
      <div>
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              No notifications
            </p>
            <p className="text-gray-400 text-sm mt-2">
              You're all caught up! 🎉
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
                      {formatTimestamp(notification.createdAt)}
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
                            startTransition(() => onViewNotification?.(notification));
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