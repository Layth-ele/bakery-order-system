/**
 * Modal Registry - Type-Safe Component Mapping with Lazy Loading
 *
 * Maps modal type names to their React components with FULL TYPE SAFETY.
 * Single source of truth for all modals in the app.
 *
 * Benefits:
 * - No giant switch statement
 * - Easy to add new modals (just add to registry)
 * - Type-safe with discriminated union
 * - Props are fully typed for each modal component
 * - Lazy loading for better performance and code splitting
 * - Error boundaries for graceful fallback handling
 * - Analytics tracking for modal usage insights
 *
 * Performance: Each modal is lazy-loaded on demand, reducing initial bundle size.
 * The error boundary ensures graceful degradation if a modal fails to load.
 */

import { lazy, ComponentType } from "react";
import type { ModalType, ModalProps } from "../../types/modals";

/**
 * Fallback Modal Component
 * Displays when a modal fails to load (network error, chunk load failure, etc.)
 *
 * ✅ PASS 7 NOTE: Each registry entry casts FallbackModal to `any` because
 * React.lazy() requires its catch handler's component type to match the
 * success-branch component type exactly. FallbackModal accepts `{ onClose }`
 * but each success-branch modal has its own discriminated props shape.
 * Tried introducing a typed `makeFallback<K>()` factory in Pass 7 but it
 * created 90+ errors because each `lazy(() => ...)` promise must resolve to
 * ONE component type, and discriminated unions across the catch return
 * fan-out to incompatible shapes.
 *
 * The 45 `as any` casts here are an honest cost of using React.lazy with
 * heterogeneous fallback semantics. Eliminating them requires a different
 * lazy-loading strategy: each modal would wrap its own ErrorBoundary that
 * renders FallbackModal on chunk-load failure, removing the need for a
 * registry-level catch. That's a Pass 8+ refactor (it's 45 modal files
 * to touch, not 1).
 */
const FallbackModal: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal-backdrop p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative z-modal-content">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Unable to Load Modal
      </h2>
      <p className="text-gray-600 mb-6">
        We encountered an error loading this dialog. Please try
        again or refresh the page.
      </p>
      <button
        onClick={onClose}
        className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
      >
        Close
      </button>
    </div>
  </div>
);



/**
 * Analytics Tracking for Modal Opens
 * Integrates with Google Analytics (gtag) if available
 */
const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.DEV;

export function trackModalOpen(
  type: ModalType,
  metadata?: Record<string, unknown>,
): void {
  // Google Analytics tracking
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "modal_open", {
      modal_type: type,
      ...metadata,
    });
  }
}

/**
 * Analytics Tracking for Modal Closes
 */
export function trackModalClose(
  type: ModalType,
  duration?: number,
): void {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "modal_close", {
      modal_type: type,
      duration_ms: duration,
    });
  }
}

/**
 * Type-safe modal component interface
 * Each modal component must accept its specific props + onClose
 */
type ModalComponent<T extends ModalType> = ComponentType<
  ModalProps<T> & { onClose: () => void }
>;

/**
 * Fully typed modal registry with lazy loading and error boundaries
 * TypeScript verifies each component accepts the correct props
 */
export const MODAL_REGISTRY: {
  [K in ModalType]: ModalComponent<K>;
} = {
  // ============================================
  // ORDERS FEATURE MODALS
  // ============================================
  // ❌ MAR 9, 2026: REMOVED ORDER_CONFIRMATION modal
  // Order now closes directly after submission without confirmation modal
  ORDER_REVIEW: lazy(() =>
    import("../../components/modals/orders/OrderReviewModal")
      .then((module) => ({ default: module.OrderReviewModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  EDIT_ORDER: lazy(() =>
    import("../../components/modals/orders/EditOrderModal")
      .then((module) => ({ default: module.EditOrderModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  EDIT_PAID_ORDER: lazy(() =>
    import("../../components/modals/orders/EditPaidOrderModal")
      .then((module) => ({
        default: module.EditPaidOrderModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  PAID_ORDER_DETAILS: lazy(() =>
    import(
      "../../components/modals/orders/PaidOrderDetailsModal"
    )
      .then((module) => ({
        default: module.PaidOrderDetailsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  ADMIN_ORDER_VIEW: lazy(() =>
    import("../../components/modals/orders/AdminOrderViewModal")
      .then((module) => ({
        default: module.AdminOrderViewModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  CANCEL_ORDER: lazy(() =>
    import("../../components/modals/orders/CancelOrderModal")
      .then((module) => ({ default: module.CancelOrderModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  REJECT_ORDER: lazy(() =>
    import("../../components/modals/orders/RejectOrderModal")
      .then((module) => ({ default: module.RejectOrderModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  CONFIRM_APPROVE_ORDER: lazy(() =>
    import(
      "../../components/modals/orders/ConfirmApproveOrderModal"
    )
      .then((module) => ({
        default: module.ConfirmApproveOrderModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  CONFIRM_CUSTOM_PRODUCT: lazy(() =>
    import(
      "../../components/modals/orders/ConfirmCustomProductModal"
    )
      .then((module) => ({
        default: module.ConfirmCustomProductModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  CUSTOMER_CANCEL_ORDER: lazy(() =>
    import(
      "../../components/modals/orders/CustomerCancelOrderModal"
    )
      .then((module) => ({
        default: module.CustomerCancelOrderModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  INVOICE_PREVIEW: lazy(() =>
    import("../../components/modals/orders/InvoicePreviewModal")
      .then((module) => ({
        default: module.InvoicePreviewModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  // MAR 17, 2026: Cancelled Order Details Modal (Restored)
  CANCELLED_ORDER_DETAILS: lazy(() =>
    import("../../components/modals/orders/CancelledOrderDetailsModal")
      .then((module) => ({
        default: module.CancelledOrderDetailsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  REJECTED_ORDER_DETAILS: lazy(() =>
    import(
      "../../components/modals/orders/RejectedOrderDetailsModal"
    )
      .then((module) => ({
        default: module.RejectedOrderDetailsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  PENDING_ORDER_DETAILS: lazy(() =>
    import(
      "../../components/modals/orders/PendingOrderDetailsModal"
    )
      .then((module) => ({
        default: module.PendingOrderDetailsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  COMPLETED_ORDER_INVOICE: lazy(() =>
    import(
      "../../components/modals/orders/CompletedOrderInvoiceModal"
    )
      .then((module) => ({
        default: module.CompletedOrderInvoiceModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  DELIVERY_FEE: lazy(() =>
    import("../../components/modals/admin/DeliveryFeeModal")
      .then((module) => ({ default: module.DeliveryFeeModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  ORDER_UPDATE_SUCCESS: lazy(() =>
    import(
      "../../components/modals/orders/OrderUpdateSuccessModal"
    )
      .then((module) => ({
        default: module.OrderUpdateSuccessModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  ORDER_SUCCESS: lazy(() =>
    import(
      "../../components/modals/orders/OrderSuccessModal"
    )
      .then((module) => ({
        default: module.OrderSuccessModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),

  // ============================================
  // CUSTOMERS FEATURE MODALS
  // ============================================
  EDIT_CUSTOMER: lazy(() =>
    import(
      "../../components/modals/customers/EditCustomerModal"
    )
      .then((module) => ({ default: module.EditCustomerModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  DELETE_CUSTOMER: lazy(() =>
    import(
      "../../components/modals/customers/DeleteCustomerModal"
    )
      .then((module) => ({
        default: module.DeleteCustomerModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  CUSTOMER_PROFILE: lazy(() =>
    import(
      "../../components/modals/customers/CustomerProfileModal"
    )
      .then((module) => ({
        default: module.CustomerProfileModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),

  // ============================================
  // ADMIN FEATURE MODALS
  // ============================================
  ADMIN_PASSWORD: lazy(() =>
    import('../../components/modals/admin/AuthGuardModal').then(m => ({ default: m.AuthGuardModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  FORGOT_PASSWORD: lazy(() =>
    import("../../components/modals/auth/ForgotPasswordModal")
      .then((module) => ({ default: module.ForgotPasswordModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  AUTH_GUARD: lazy(() =>
    import('../../components/modals/admin/AuthGuardModal').then(m => ({ default: m.AuthGuardModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  ADMIN_SECURITY: lazy(() =>
    import("../../components/modals/admin/AdminSecurityModal")
      .then((module) => ({
        default: module.AdminSecurityModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  ADD_CREDIT: lazy(() =>
    import("../../components/modals/admin/AddCreditModal")
      .then((module) => ({
        default: module.AddCreditModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  ADD_CUSTOMER: lazy(() =>
    import("../../components/modals/customers/AddCustomerModal")
      .then((module) => ({ default: module.AddCustomerModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  ADMIN_PASSWORD_CONFIRM: lazy(() =>
    import('../../components/modals/admin/AuthGuardModal').then(m => ({ default: m.AuthGuardModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  PAYMENT_CONFIRMED_MESSAGE: lazy(() =>
    import(
      "../../components/modals/admin/PaymentConfirmedMessageModal"
    )
      .then((module) => ({
        default: module.PaymentConfirmedMessageModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  PAYMENT_CONFIRMED_ADMIN: lazy(() =>
    import(
      "../../components/modals/admin/PaymentConfirmedMessageModal"
    )
      .then((module) => ({
        default: module.PaymentConfirmedMessageModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),

  // ============================================
  // PRODUCTS & CATEGORIES MODALS
  // ============================================
  PRODUCT_DETAILS: lazy(() =>
    import(
      "../../components/modals/products/ProductDetailsModal"
    )
      .then((module) => ({
        default: module.ProductDetailsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  EDIT_PRODUCT: lazy(() =>
    import("../../components/modals/products/EditProductModal")
      .then((module) => ({ default: module.EditProductModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  EDIT_CATEGORY: lazy(() =>
    import("../../components/modals/products/EditCategoryModal")
      .then((module) => ({ default: module.EditCategoryModal }))
      .catch(() => ({ default: FallbackModal as any })),
  ),

  // ============================================
  // PAYMENTS FEATURE MODALS
  // ============================================
  SUBMIT_PAYMENT: lazy(() => {
    return import(
      "../../components/modals/payments/SubmitPaymentModal"
    )
      .then((module) => ({
        default: module.SubmitPaymentModal,
      }))
      .catch((error) => {
        console.error(
          "❌ Failed to import SubmitPaymentModal",
          error,
        );
        throw error;
      });
  }),
  CREDIT_HISTORY: lazy(() =>
    import(
      "../../components/modals/notifications/CreditHistoryModal"
    )
      .then((module) => ({
        default: module.CreditHistoryModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  CREDIT_RECEIVED: lazy(() =>
    import(
      "../../components/modals/notifications/CreditReceivedModal"
    )
      .then((module) => ({
        default: module.CreditReceivedModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  CREDIT_RECEIVED_CELEBRATION: lazy(() =>
    import(
      "../../components/modals/notifications/CreditReceivedCelebrationModal"
    )
      .then((module) => ({
        default: module.CreditReceivedCelebrationModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  PAYMENT_RECEIVED_SUCCESS: lazy(() =>
    import(
      "../../components/modals/payments/PaymentReceivedSuccessModal"
    )
      .then((module) => ({
        default: module.PaymentReceivedSuccessModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  UNPAID_ORDER_DETAILS: lazy(() =>
    import(
      "../../components/modals/orders/UnpaidOrderDetailsModal"
    )
      .then((module) => ({
        default: module.UnpaidOrderDetailsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  CUSTOMER_UNPAID_ORDER_DETAILS: lazy(() =>
    import(
      "../../components/modals/orders/CustomerUnpaidOrderDetailsModal"
    )
      .then((module) => ({
        default: module.CustomerUnpaidOrderDetailsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  PAYMENT_IN_REVIEW: lazy(() =>
    import(
      "../../components/modals/payments/PaymentInReviewModal"
    )
      .then((module) => ({
        default: module.PaymentInReviewModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  PAYMENT_SUBMITTED: lazy(() =>
    import(
      "../../components/modals/payments/PaymentSubmittedModal"
    )
      .then((module) => ({
        default: module.PaymentSubmittedModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  NOTIFICATION_DETAILS: lazy(() =>
    import(
      "../../components/modals/notifications/NotificationDetailsModal"
    )
      .then((module) => ({
        default: module.NotificationDetailsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  NOTIFICATIONS: lazy(() =>
    import(
      "../../components/modals/notifications/NotificationsModal"
    )
      .then((module) => ({
        default: module.NotificationsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  ADMIN_NOTIFICATIONS: lazy(() =>
    import(
      "../../components/modals/admin/AdminNotificationsModal"
    )
      .then((module) => ({
        default: module.AdminNotificationsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
  KEYBOARD_SHORTCUTS: lazy(() =>
    import("../../components/modals/KeyboardShortcutsModal")
      .then((module) => ({
        default: module.KeyboardShortcutsModal,
      }))
      .catch(() => ({ default: FallbackModal as any })),
  ),
} as const;

/**
 * Helper function to get a typed modal component
 * This ensures type safety when rendering modals
 */
export function getModalComponent<T extends ModalType>(
  type: T,
): ModalComponent<T> | undefined {
  return MODAL_REGISTRY[type];
}