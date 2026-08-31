/**
 * Order Flow Types - Shared types for order modals and components
 * 
 * ✅ FEB 23, 2026: Created to eliminate `any` usage in order flow
 * 
 * These types provide proper typing for:
 * - Edit order modals
 * - Order review modals
 * - Payment modals
 * - Order list components
 * - Customer/admin order pages
 */

import { Order, OrderItem, Product, Category, OrderAdjustment } from './domain';
import { Customer } from './customer';

// ============================================================================
// EDITABLE ORDER ITEMS
// ============================================================================

/**
 * Day quantities for editable order items
 */
export interface DayQuantities {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

/**
 * Editable order item - used in edit modals and order pages
 * Maps to internal state during order editing
 */
export interface EditableOrderItem extends DayQuantities {
  productId: string;
  productName: string;
  price: number;
  total: number;
  isCustomProduct?: boolean; // For custom items added during edit
}

/**
 * Map of product IDs to editable items
 * Used in EditOrderModal, EditOrderPage, etc.
 */
export type EditableItemsMap = {
  [productId: string]: EditableOrderItem;
};

/**
 * Result returned from edit modal/page on save
 */
export interface EditOrderResult {
  editedItems: EditableItemsMap;
  hasChanges: boolean;
  totalQuantity?: number;
  totalAmount?: number;
}

// ============================================================================
// CART ITEMS (ORDER CREATION)
// ============================================================================

/**
 * Cart item with product and quantities
 * Used in OrderReviewModal and order creation flow
 */
export interface CartItem {
  product: Product;
  quantities: DayQuantities;
}

/**
 * Cart state for order creation
 */
export interface Cart {
  items: CartItem[];
  subtotal: number;
  gst: number;
  total: number;
}

// ============================================================================
// PAYMENT SUBMISSION
// ============================================================================

/**
 * Payment submission data from customer
 */
export interface PaymentSubmissionData {
  invoiceNumber: string;
  transferPassword: string;
  submittedAt?: string; // ISO string
}

/**
 * Payment confirmation data from admin
 */
export interface PaymentConfirmationData {
  confirmedAt: string; // ISO string
  confirmedBy: string; // Admin email/ID
  notes?: string;
}

// ============================================================================
// ADJUSTMENT PAYMENTS
// ============================================================================

/**
 * Adjustment with payment details
 * Extends OrderAdjustment with UI-friendly properties
 */
export interface AdjustmentWithPayment extends OrderAdjustment {
  // All properties from OrderAdjustment
  // Add UI-specific helpers if needed
  displayAmount?: string; // Formatted amount for display
  paymentStatusLabel?: string; // Human-readable status
}

// ============================================================================
// ORDER WITH RELATIONS
// ============================================================================

/**
 * Order with customer information attached
 * Used in admin views where customer details are needed
 */
export interface OrderWithCustomer extends Order {
  customer?: Customer;
  customerInfo?: Pick<Customer, 'storeName' | 'contactPerson' | 'phone' | 'storeAddress'>;
}

/**
 * Order with products and categories resolved
 * Used in order display components
 */
export interface OrderWithProducts extends Order {
  resolvedItems?: Array<{
    item: OrderItem;
    product?: Product;
    category?: Category;
  }>;
}

/**
 * Full order with all relations resolved
 * Used in detailed order views
 */
export interface FullOrder extends Order {
  customer?: Customer;
  products?: Product[];
  categories?: Category[];
  adjustments?: OrderAdjustment[];
}

// ============================================================================
// TIMESTAMPS & FIREBASE COMPATIBILITY
// ============================================================================

/**
 * Timestamp that can be either ISO string or Firebase Timestamp
 * Use for backward compatibility during migration
 */
export type TimestampLike = string | {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
};

/**
 * Convert TimestampLike to ISO string
 */
export function toISOString(timestamp: TimestampLike | undefined | null): string | undefined {
  if (!timestamp) return undefined;
  
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  
  // Firebase Timestamp
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }
  
  return undefined;
}

/**
 * Convert TimestampLike to Date
 */
export function toDate(timestamp: TimestampLike | undefined | null): Date | undefined {
  if (!timestamp) return undefined;
  
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  // Firebase Timestamp
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000);
  }
  
  return undefined;
}

// ============================================================================
// MODAL PROPS
// ============================================================================

/**
 * Base modal props shared across order modals
 */
export interface BaseOrderModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onClose?: () => void;
}

/**
 * Edit order modal props
 */
export interface EditOrderModalProps extends BaseOrderModalProps {
  onSave?: (result: EditOrderResult) => void;
  onCancel?: () => void;
  isAdmin?: boolean;
  viewMode?: 'customer' | 'admin';
}

// PASS 12 — REMOVED dead `OrderReviewModalProps` interface.
//
// The real OrderReviewModal component (src/components/modals/orders/
// OrderReviewModal.tsx) declares its props inline as
// `onConfirm: () => void` — it doesn't take any orderData argument; the
// parent owns that state and calls onConfirm() to signal "go ahead and
// submit". The interface that lived here had a different shape
// (`onConfirm: (orderData: any) => void`), wasn't imported by anyone (grep
// confirmed zero importers), and carried a TODO from when it was first
// written. Two competing source-of-truth declarations + an `any` + a TODO
// is exactly the smell that bites later, so it's gone.

/**
 * Payment modal props
 */
export interface PaymentModalProps extends BaseOrderModalProps {
  adjustment?: OrderAdjustment; // For adjustment payments
  viewMode?: 'customer' | 'admin';
  onPaymentSubmitted?: () => void;
  onPaymentConfirmed?: () => void;
}

/**
 * Order details modal props
 */
export interface OrderDetailsModalProps extends BaseOrderModalProps {
  viewMode?: 'customer' | 'admin';
  onEdit?: () => void;
  onDownload?: () => void;
  onCancel?: () => void;
  onConfirmPayment?: (order: Order) => void;
  onSendReminder?: (order: Order) => void;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Order action handlers
 */
export interface OrderActionHandlers {
  onView?: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onDownload?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onApprove?: (order: Order) => void;
  onReject?: (order: Order) => void;
  onConfirmPayment?: (order: Order) => void;
  onSendReminder?: (order: Order) => void;
}

/**
 * Order filter options
 */
export interface OrderFilters {
  status?: Order['status'] | 'all';
  paymentStatus?: 'paid' | 'unpaid' | 'submitted' | 'all';
  week?: number;
  customerId?: string;
  searchTerm?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Order sort options
 */
export type OrderSortBy = 'date' | 'week' | 'customer' | 'total' | 'status';
export type OrderSortDirection = 'asc' | 'desc';

/**
 * Order sort configuration
 */
export interface OrderSort {
  by: OrderSortBy;
  direction: OrderSortDirection;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if order has payment submitted
 */
export function hasPaymentSubmitted(order: Order): boolean {
  return !!order.paymentSubmitted;
}

/**
 * Check if order has payment received
 */
export function hasPaymentReceived(order: Order): boolean {
  return !!order.paymentReceived;
}

/**
 * Check if order has adjustments
 */
export function hasAdjustments(order: Order): boolean {
  return !!(order.adjustments?.length);
}

/**
 * Get order adjustments safely
 */
export function getOrderAdjustments(order: Order): OrderAdjustment[] {
  return order.adjustments || [];
}

/**
 * Check if item is a custom product
 */
export function isCustomProduct(productId: string): boolean {
  return productId.startsWith('custom-');
}

/**
 * Calculate total quantity for an editable item
 */
export function calculateItemTotal(item: EditableOrderItem): number {
  return (
    item.monday +
    item.tuesday +
    item.wednesday +
    item.thursday +
    item.friday +
    item.saturday +
    item.sunday
  );
}

/**
 * Calculate total amount for editable items
 */
export function calculateEditedTotal(items: EditableItemsMap): number {
  return Object.values(items).reduce((total, item) => {
    return total + (calculateItemTotal(item) * item.price);
  }, 0);
}
