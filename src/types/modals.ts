import type { Product, Order, Category, Customer } from '../types';
import type { ModalSize, OverlayBlur } from '../ui/modals/BaseModal';
import type { KeyboardShortcut } from '../hooks/useKeyboardShortcuts'; // ✅ FIX: Import KeyboardShortcut type

/**
 * Modal Type Registry - Discriminated Union
 * 
 * Each modal type has its own props interface, optional size, and optional overlay blur.
 * This provides:
 * - Autocomplete when calling openModal()
 * - Compile-time type checking
 * - Self-documenting modal API
 * - Consistent sizing and visual effects
 * 
 * Usage:
 *   openModal('PRODUCT_DETAILS', { product, onAddToCart }, 'lg', 'md')
 *   // TypeScript knows exactly what props are required!
 */

export type ModalConfig =
  | {
      type: 'FORGOT_PASSWORD';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        initialEmail?: string;
      };
    }
  | {
      type: 'PRODUCT_DETAILS';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        product: Product;
        products?: Product[];
        onAddToCart?: (productId: string, dayKey: string, quantity: number) => void;
        lockedDaysForWeek?: boolean[];  // which days are locked for current week
        selectedWeek?: number;
        selectedYear?: number;
      };
    }
  // ❌ MAR 9, 2026: REMOVED ORDER_CONFIRMATION modal
  // Order now closes directly after submission without confirmation modal
  | {
      type: 'ADMIN_PASSWORD'; // Legacy alias → routes to AUTH_GUARD
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        onConfirm: (password: string) => void;
        message?: string;
        title?: string;
        actionLabel?: string;
        onCancel?: () => void;
        danger?: boolean;
      };
    }
  | {
      type: 'AUTH_GUARD'; // Unified admin authentication guard
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        title?: string;
        description?: string;
        actionLabel?: string;
        danger?: boolean;
        checklistItems?: Array<{
          id: string;
          label: string;
          value?: string;
          icon?: 'order' | 'password' | 'amount' | 'customer';
        }>;
        onConfirm: () => void | Promise<void>;
        onCancel?: () => void;
      };
    }
  | {
      type: 'ADMIN_SECURITY'; // Security verification modal to confirm admin role before creating new admin accounts
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        user: any; // User type from useAuth
        onConfirm: () => void;
      };
    }
  | {
      type: 'ADD_CREDIT'; // Admin modal to manually add credit to customer account
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        customer: Customer;
        onClose: () => void;
        onSuccess?: () => void;
      };
    }
  | {
      type: 'ORDER_REVIEW'; // Customer order review modal before final submission
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        cartItems: Array<{
          product: any; // Product type
          quantities: {
            monday: number;
            tuesday: number;
            wednesday: number;
            thursday: number;
            friday: number;
            saturday: number;
            sunday: number;
          };
          total: number;
          price: number;
        }>;
        selectedWeek: number;
        selectedYear: number;
        onConfirm: () => void;
      };
    }
  | {
      type: 'ADD_CUSTOMER'; // Admin modal to add new customers or admin accounts
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        isAddingAdmin: boolean;
        newCustomer: {
          storeName: string;
          email: string;
          storeAddress: string;
          contactPerson: string;
          phone: string;
          password: string;
          customerType: 'commercial' | 'individual' | 'admin';
        };
        onCustomerChange: (customer: any) => void;
        onAddCustomer: () => void;
        onShowAdminSecurity: () => void;
        onSetIsAddingAdmin: (value: boolean) => void;
      };
    }
  | {
      type: 'ADMIN_PASSWORD_CONFIRM'; // Legacy alias → routes to AUTH_GUARD
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        adminEmail: string;
        actionDescription: string;
        onConfirm: () => void | Promise<void>;
      };
    }
  | {
      type: 'PAYMENT_CONFIRMED_MESSAGE'; // Simple informational modal for admin - payment confirmed notification
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        orderId: string;
        customerName?: string;
        amount?: number;
        invoiceNumber?: string;
      };
    }
  // ❌ DELETED FEB 6, 2026: DELIVERY_FEE - Unused in the current route-based flow
  // ❌ DELETED FEB 6, 2026: PAYMENT_NOTIFICATIONS - Unused (replaced by notification bell)
  // ❌ DELETED FEB 6, 2026: ORDER_UPDATE_CONFIRMATION - Unused (superseded by ORDER_UPDATE_SUBMITTED)
  | {
      type: 'CANCEL_ORDER';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products?: Product[];
        categories?: Category[];
        adminEmail?: string;
        onConfirm: (reason: string) => void;
        onCancel?: () => void;
        onClose?: () => void;
      };
    }
  | {
      type: 'ADMIN_ORDER_VIEW';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
      };
    }
  | {
      type: 'REJECT_ORDER';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products?: Product[];
        onConfirm: (reason: string) => void;
      };
    }
  | {
      type: 'CONFIRM_APPROVE_ORDER'; // Confirmation modal for order approval
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        deliveryFee: number;
        products?: Product[];
        categories?: Category[];
        onConfirm: (deliveryFee: number) => void | Promise<void>;
        onReviewDetails?: () => void; // Optional: Open AdminOrderViewModal
      };
    }
  | {
      type: 'CONFIRM_CUSTOM_PRODUCT'; // Confirmation modal for custom product added
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        productData: {
          name: string;
          price: number;
          selectedDays: { [key: string]: boolean };
          quantity: number;
        };
        onClose: () => void;
      };
    }
  | {
      type: 'CUSTOMER_CANCEL_ORDER'; // Customer self-service order cancellation
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        onConfirm: (reason?: string, notes?: string) => void | Promise<void>;
      };
    }
  | {
      type: 'INVOICE_PREVIEW'; // Customer invoice preview with download/print
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
      };
    }
  | {
      type: 'EDIT_CUSTOMER';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        customer: Customer;
        onSave: (updated: Customer) => void;
        onClose?: () => void;
        onCancel?: () => void;
      };
    }
  | {
      type: 'EDIT_ORDER';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        isAdmin: boolean;
        onNavigateToHistory?: (orderId: string) => void;
        onSave: (editedItems: { [productId: string]: any }) => void;
        onCancel?: () => void;
        _source?: string; // Debug marker to force remount
        _orderId?: string; // Additional unique key
        [key: string]: unknown; // Allow additional props
      };
    }
  // ❌ REMOVED: UPDATE_PAID_ORDER - Feature disabled, dead code
  // Customer order change requests are no longer supported
  | {
      type: 'EDIT_PAID_ORDER'; // ✅ Admin edit paid orders with credit issuance
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        adminEmail: string;
        onSave?: (result: { success: boolean; creditIssued: number }) => void;
      };
    }
  | {
      type: 'PAID_ORDER_DETAILS'; // ✅ NEW: View paid order details in Ready page
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        onClose?: () => void;
        onDownloadExcel?: (order: Order) => void;
        onDownloadPDF?: (order: Order) => void;
        onEditPaidOrder?: (order: Order) => void;
        isEditedOrder?: boolean; // Flag for edited orders
        editDetails?: any; // Edit details from notification
      };
    }
  | {
      type: 'CUSTOMER_PROFILE';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        customerEmail: string;
        onClose: () => void;
        isAdmin?: boolean;
        openModal?: <T extends ModalType>(type: T, props?: ModalProps<T>) => void; // For opening other modals
      };
    }
  | {
      type: 'DELETE_CUSTOMER';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        customer: Customer | { id: string; storeName: string };
        onConfirm: (customer: any, archiveOnly: boolean) => void;
        onClose?: () => void;
        onCancel?: () => void;
      };
    }
  | {
      type: 'EDIT_PRODUCT';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        product: Product;
        categories: Category[];
        onSave: (productData: any, isEditing?: boolean) => void;
        onCancel?: () => void;
      };
    }
  | {
      type: 'EDIT_CATEGORY';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        category?: Category | null;
        categoryCount?: number;
        onSave: (categoryData: { name: string; order: number }, isEditing: boolean, categoryId?: string) => void;
        onCancel?: () => void; // Optional - ModalRoot injects onClose
      };
    }
  // ❌ DELETED FEB 18, 2026: ADD_DISCOUNT - Removed from Pending Orders page
  | {
      type: 'PAYMENT_RECEIVED_SUCCESS';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        orderId: string;
        amount?: number;
        order?: Order;
        products?: Product[];
        categories?: Category[];
      };
    }
  | {
      type: 'PAYMENT_CONFIRMED_ADMIN'; // Admin audit trail for payment confirmations
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        orderId: string;
        amount?: number;
        invoiceId?: string;
        confirmedAt?: string;
        confirmedBy?: string;
        confirmedByName?: string;
        order?: Order;
        onViewOrder?: (orderId: string) => void;
      };
    }
  // ❌ REMOVED: SUBMIT_SUPPLEMENTARY_PAYMENT - legacy hybrid modal
  // ❌ REMOVED: SUBMIT_ADJUSTMENT_PAYMENT - adjustment modals removed
  // ❌ REMOVED: ADJUSTMENT_PAYMENT_NOTIFICATION - adjustment modals removed
  // ❌ REMOVED: ADJUSTMENT_ORDER_DETAILS - adjustment modals removed
  // ❌ REMOVED: SUPPLEMENTARY_PAYMENT_PROOF - supplementary invoices removed
  | {
      type: 'CREDIT_HISTORY';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        customerId: string;
      };
    }
  | {
      type: 'CREDIT_RECEIVED';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        customerId: string;
        onViewCredit: () => void;
        onClose?: () => void;
      };
    }
  | {
      type: 'CREDIT_RECEIVED_CELEBRATION'; // Celebratory modal when customer receives credit
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        amount: number;
        reason: string;
        creditType: string;
      };
    }
  | {
      type: 'SUBMIT_PAYMENT';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        onPaymentSubmitted?: (orderId: string) => void;
      };
    }
  | {
      type: 'PAYMENT_IN_REVIEW';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        adjustment?: any; // Optional adjustment for adjustment payments
        viewMode?: 'customer' | 'admin'; // Optional view mode
        products?: Product[];
        categories?: Category[];
        onClose?: () => void;
      };
    }
  | {
      type: 'PAYMENT_SUBMITTED';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
      };
    }
  | {
      type: 'UNPAID_ORDER_DETAILS';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        onClose?: () => void;
        onConfirmPayment: (order: Order) => void;
        onSendReminder: (order: Order) => void;
        onCancelOrder: (order: Order) => void;
      };
    }
  | {
      type: 'CUSTOMER_UNPAID_ORDER_DETAILS'; // Customer-only unpaid order modal (no admin actions)
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        onPayNow?: (order: Order) => void; // ✅ Optional callback to open payment modal
      };
    }
  // ❌ REMOVED MAR 12, 2026: CANCELLED_ORDER_DETAILS - Replaced with toast notifications
  // Cancelled orders now show a simple toast notification instead of opening a modal
  // ✅ RESTORED MAR 17, 2026: CANCELLED_ORDER_DETAILS - Comprehensive modal for unpaid & paid cancellations
  | {
      type: 'CANCELLED_ORDER_DETAILS';
      props: {
        order: Order | null;
        products: Product[];
        categories: Category[];
        notificationId?: string;
        onDeleteNotification?: (id: string) => void;
      };
    }
  | {
      type: 'REJECTED_ORDER_DETAILS'; // ✅ NEW: For viewing rejected order details
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        onClose?: () => void; // Optional for modal system
      };
    }
  // ❌ REMOVED: INVOICE_DETAIL - Replaced with COMPLETED_ORDER_INVOICE for consistency across admin and customer dashboards
  | {
      type: 'COMPLETED_ORDER_INVOICE'; // Final invoice for completed orders (unified modal for admin and customer)
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        onDownloadExcel?: (order: Order) => void;
        onDownloadPDF?: (order: Order) => void;
      };
    }
  | {
      type: 'PENDING_ORDER_DETAILS'; // ✅ NEW: For viewing pending order details (customer read-only or admin review)
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        order: Order;
        products: Product[];
        categories: Category[];
        userRole?: 'customer' | 'admin'; // ✅ Determines read-only vs action mode
        onApprove?: (orderId: string, deliveryFee: number) => void; // Admin only
        onReject?: (orderId: string) => void; // Admin only
        onViewHistory?: (orderId: string) => void; // Admin only
        onClose?: () => void;
      };
    }
  | {
      type: 'NOTIFICATION_DETAILS'; // STEP 7 - Safe fallback for unknown/legacy notifications
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        notification?: any; // Notification object (optional for safety)
        notificationId?: string; // Notification ID fallback
        error?: string; // Optional error message
      };
    }
  | {
      type: 'NOTIFICATIONS'; // ✅ Main notifications list modal (customer)
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        notifications: any[]; // Array of notifications
        onViewNotification?: (notification: any) => void; // ✅ Powers all View buttons
        onMarkAsRead?: (id: string) => void;
        onMarkAllAsRead?: () => void;
        onDeleteNotification?: (id: string) => void;
        markAsRead?: (id: string) => Promise<void>;    // ✅ matches CustomerNotificationProvider
        markAllAsRead?: () => Promise<void>;           // ✅ matches CustomerNotificationProvider
        deleteNotification?: (id: string) => Promise<void>; // ✅ matches CustomerNotificationProvider
        unreadCount?: number;
        onViewOrder?: (orderId: string) => void;
        onDownloadInvoice?: (invoiceId: string) => void;
      };
    }
  | {
      type: 'ADMIN_NOTIFICATIONS'; // ✅ Admin notifications list modal
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        notifications: any[]; // Array of notifications
        onMarkAsRead?: (id: string) => void;
        onMarkAllAsRead?: () => void;
        onDeleteNotification?: (id: string) => void;
        onViewNotification?: (notification: any) => void; // ✅ Powers all View buttons
        onActionClick?: (action: any, notification: any) => void;
        getActionButtonConfig?: (action: any, orderId?: string) => { buttonLabel: string; buttonStyle: string };
        /** Passed from context by AdminNotificationBell */
        unreadCount?: number;
        markAsRead?: (id: string) => Promise<void>;
        markAllAsRead?: () => Promise<void>;
        deleteNotification?: (id: string) => Promise<void>;
      };
    }
  // ❌ REMOVED: COMPLETE_ORDER - Replaced by UNIFIED_ORDER_DETAILS
  // ❌ REMOVED: REVISION_PAYMENT_REQUIRED - revisions feature removed

 // Admin modal to set delivery fee for orders below free delivery minimum
  | {
      type: 'DELIVERY_FEE';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        orderId: string;
        onConfirm: (orderId: string, fee: number) => void;
      };
    }
  // AdminOrderDetailsModal - Giant admin order details modal for the current route-driven admin flow
  // OrderUpdateSuccessModal - Success notification after order updates
  | {
      type: 'ORDER_UPDATE_SUCCESS';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        message: string;
      };
    }
  // OrderSuccessModal - Shown to customer after successfully placing an order
  | {
      type: 'ORDER_SUCCESS';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        week: number;
        year: number;
      };
    }
  // KeyboardShortcutsModal - Help modal showing all keyboard shortcuts
  | {
      type: 'KEYBOARD_SHORTCUTS';
      size?: ModalSize;
      overlayBlur?: OverlayBlur;
      props: {
        shortcuts: KeyboardShortcut[];
      };
    }
;

// Extract modal type names for easier use
export type ModalType = ModalConfig['type'];

// Helper type to extract props for a specific modal type
export type ModalProps<T extends ModalType> = Extract<
  ModalConfig,
  { type: T }
>['props'];
// ============================================================================
// RE-EXPORTS for consumers that import modal primitives from this barrel
// ============================================================================

// ModalSize and OverlayBlur live in the UI layer but are needed by hooks
// that only import from '@/types'. Re-export them here to keep a single
// import point.
export type { ModalSize, OverlayBlur } from '../ui/modals/BaseModal';

// ModalStackEntry is defined in the modal service and used by useUrlSyncedModal
export type { ModalStackEntry } from '../services/modalService';
