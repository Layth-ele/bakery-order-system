/**
 * NotificationsModal — the notification list for both bells.
 *
 *   audience "customer" (default): CustomerNotificationBell
 *   audience "admin":              AdminNotificationBell
 *
 * Same layout for both; only the data source (context), the per-type
 * "View" button and the title differ. Clicking "View" closes the list and
 * hands the notification to onViewNotification (notificationActions), which
 * opens the matching modal.
 */
import { toDate } from "../../../utils/timestampFormatting";
import { ModalFooterButtons } from "../../../ui/modals/ModalFooterButtons";
import { startTransition, useState, useCallback } from "react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import {Bell, Trash2, Check, Eye} from "lucide-react"
import { useAdminNotificationsSafe, useCustomerNotificationsSafe } from "../../../notifications/contexts";
import { normalizeNotificationType } from "../../../types/notification-contract";


const CUSTOMER_TYPE_UI: Record<string, { icon: string; label: string; style: string }> = {
  ORDER_APPROVED_PAY_REQUIRED: { icon: "✅", label: "Pay Now", style: "bg-orange-50 hover:bg-orange-100 text-orange-600" },
  ORDER_REJECTED: { icon: "❌", label: "View Details", style: "bg-red-50 hover:bg-red-100 text-red-600" },
  ORDER_CANCELLED: { icon: "❌", label: "View Details", style: "bg-gray-50 hover:bg-gray-100 text-gray-600" },
  PAYMENT_CONFIRMED: { icon: "💰", label: "View Order", style: "bg-green-50 hover:bg-green-100 text-green-600" },
  ORDER_COMPLETED: { icon: "✅", label: "View Invoice", style: "bg-green-50 hover:bg-green-100 text-green-600" },
  PAYMENT_REMINDER: { icon: "⏳", label: "Check Status", style: "bg-purple-50 hover:bg-purple-100 text-purple-600" },
  CREDIT_ISSUED: { icon: "💰", label: "View Credit", style: "bg-emerald-50 hover:bg-emerald-100 text-emerald-600" },
  CREDIT_PAYOUT_COMPLETED: { icon: "💸", label: "View Credit", style: "bg-emerald-50 hover:bg-emerald-100 text-emerald-600" },
  CREDIT_PAYOUT_DECLINED: { icon: "💰", label: "View Credit", style: "bg-amber-50 hover:bg-amber-100 text-amber-700" },
  ORDER_EDITED: { icon: "✏️", label: "View Changes", style: "bg-blue-50 hover:bg-blue-100 text-blue-600" },
};

const ADMIN_TYPE_UI: Record<string, { icon: string; label: string; style: string }> = {
  ORDER_PLACED_TRACKING: { icon: "📦", label: "Review Order", style: "bg-blue-50 hover:bg-blue-100 text-blue-600" },
  PAYMENT_SUBMITTED: { icon: "💰", label: "Review Payment", style: "bg-green-50 hover:bg-green-100 text-green-600" },
  PAYMENT_CONFIRMED_ADMIN: { icon: "✅", label: "View Details", style: "bg-emerald-50 hover:bg-emerald-100 text-emerald-600" },
  NEW_REGISTRATION: { icon: "🆕", label: "Review Request", style: "bg-orange-50 hover:bg-orange-100 text-orange-600" },
  CREDIT_PAYOUT_REQUESTED: { icon: "💸", label: "View Request", style: "bg-amber-50 hover:bg-amber-100 text-amber-700" },
};

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

export type NotificationsAudience = "customer" | "admin";

interface NotificationsModalProps {
  /** Which bell opened the list (default: customer). */
  audience?: NotificationsAudience;
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
  audience = "customer",
  onViewNotification,
  onClose,
  notifications: notificationsProp,
  unreadCount: unreadCountProp,
  markAsRead: markAsReadProp,
  markAllAsRead: markAllAsReadProp,
  deleteNotification: deleteNotificationProp,
}: NotificationsModalProps): JSX.Element | null {
  // Both hooks are "safe" (null outside their provider); use the bell's one.
  const adminContext = useAdminNotificationsSafe();
  const customerContext = useCustomerNotificationsSafe();
  const context: any = audience === "admin" ? adminContext : customerContext;

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

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return "Date unavailable";
    const date = toDate(timestamp as any);
    if (!date || isNaN(date.getTime())) return "Date unavailable";
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

  // One entry per notification type (see notification-contract.ts).
  const TYPE_UI: Record<string, { icon: string; label: string; style: string }> = audience === "admin" ? ADMIN_TYPE_UI : CUSTOMER_TYPE_UI;
  const DEFAULT_UI = { icon: "🔔", label: "View", style: "bg-blue-50 hover:bg-blue-100 text-blue-600" };
  const uiFor = (type: string) => TYPE_UI[normalizeNotificationType(type) ?? ""] ?? DEFAULT_UI;

  const getNotificationIcon = (type: string) => uiFor(type).icon;

  const getViewButtonConfig = (notification: CustomerNotification) => {
    const { label, style } = uiFor(notification.type);
    return { label, style };
  };

  return (
    <StyleModalShell
      width="xl"
      skinType="default"
      onClose={onClose}
      title={audience === "admin" ? "Admin Notifications" : "Notifications"}
      subtitle={
        unreadCount > 0 ? `${unreadCount} unread` : undefined
      }
      icon={<Bell className="w-6 h-6" />}
      footer={
        <ModalFooterButtons
          cancelButton={{ label: "Close", onClick: onClose, variant: "secondary", keyboardShortcut: "Escape" }}
          confirmButton={
            notifications.length > 0 && unreadCount > 0
              ? { label: "Mark All as Read", onClick: markAllAsRead, variant: "primary", icon: <Check className="w-4 h-4" /> }
              : undefined
          }
        />
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
              .filter((n: CustomerNotification) => !deletingIds.has(n.id))
              .map((notification: CustomerNotification) => {
              const viewButtonConfig = getViewButtonConfig(notification);

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

                      <button
                        onClick={() => {
                          onClose();
                          startTransition(() => onViewNotification?.(notification as any));
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all font-semibold ${viewButtonConfig.style}`}
                      >
                        <Eye className="w-3 h-3" />
                        {viewButtonConfig.label}
                      </button>

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