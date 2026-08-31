import type { NotificationItem } from '../types/notification-canonical';
import type { Order, Product, Category, Customer } from '../types';
import type { User } from '../services/firebase/authService';
import type { ModalType, ModalProps } from '../types/modals';
import type { ModalSize, OverlayBlur } from '../ui/modals/BaseModal';

import { fetchOrder, fetchInvoice, fetchInvoiceByOrderId, fetchProducts, fetchCategories, fetchCustomer, resolvePendingOrderDetailsProps } from "./notification-modal-fetchers";
import { toast } from 'sonner';
import { logger } from './logger';


// ─── Typed modal payload ──────────────────────────────────────────────────────
// All resolver functions return this shape. The modal registry maps each field
// to the correct modal component prop via the ModalRoot dispatch layer.
export interface ModalPayload {
  // Core identifiers
  orderId?: string;
  invoiceId?: string;
  customerId?: string;

  // Data objects
  order?: Order | null;
  products?: Product[];
  categories?: Category[];
  // PASS 12: typed where a canonical type exists. `invoice`/`editDetails` stay
  // loose because the project has two competing `Invoice` interfaces declared
  // in services (no exported type from `src/types/`), and the modal layer
  // shouldn't pull in service code. Same reasoning as `[key: string]: unknown`
  // below — the registry passes whatever each modal component declares it
  // accepts.
  customer?: Customer;
  invoice?: unknown;
  notification?: NotificationItem;

  // Common display fields
  amount?: number;
  customerName?: string;
  rejectionReason?: string;
  isEditedOrder?: boolean;
  // PASS 12: editDetails kept as `unknown` because individual modal callers
  // shape it differently (some pass an OrderEditHistory, others a custom diff
  // structure). Tightening this is a separate refactor.
  editDetails?: unknown;
  userRole?: 'admin' | 'customer';
  message?: string;
  error?: string;

  // Action callbacks (injected by caller, not resolver)
  onClose?: () => void;
  onConfirmPayment?: (order: Order) => void;
  onApproveOrder?: (order: Order) => void;
  onRejectOrder?: (order: Order) => void;
  onDeleteNotification?: (notificationId: string) => void;
  onViewCredit?: () => void;
  onPayNow?: (order: Order) => void;
  onPaymentSubmitted?: (orderId: string) => void;
  onApprove?: ((orderId: string, deliveryFee: number) => void) | ((order: Order) => void) | ((orderId: string) => Promise<void>);
  onReject?: ((orderId: string, reason?: string) => void) | ((order: Order) => void) | ((orderId: string, reason?: string) => Promise<void>);
  onCancelOrder?: (orderId: string) => void;
  onDownloadExcel?: (...args: unknown[][]) => void;
  onDownloadPDF?: (...args: unknown[][]) => void;
  onDownloadBakeryPDF?: (...args: unknown[][]) => void;
  onSendReminder?: (order: Order) => void;

  // Routing / meta
  _modalRedirect?: string;
  [key: string]: unknown; // allow additional props passed through
}
// ─────────────────────────────────────────────────────────────────────────────

// Type for AppContext (used in functions below)
interface AppContext {
  orders?: Order[];
  products?: Product[];
  categories?: Category[];
  customers?: Customer[];
  loadOrders?: () => Promise<Order[]>;
  loadProducts?: () => Product[];
  loadCategories?: () => Category[];
  loadCustomers?: () => Customer[];
  onConfirmPayment?: (order: Order) => void;
  onApproveOrder?: (order: Order) => void;
  onRejectOrder?: (order: Order) => void;
  onCancelOrder?: (orderId: string) => void;
  onDeleteNotification?: (notificationId: string) => void;
  // PASS 12: user is the authenticated session user. Imported from
  // services/firebase/authService — same `User` type that useAuth() returns.
  // Replaces the prior `any` which had hidden two latent bugs (the resolver
  // was reading `user.displayName`, a field that doesn't exist on User —
  // the canonical field is `user.name`).
  user?: User;
  openModal?: <T extends ModalType>(type: T, props: ModalProps<T>, size?: ModalSize, overlayBlur?: OverlayBlur) => void;
  closeModal?: () => void; // ✅ For closing modals from stub callbacks
}

/**
 * ✅ Uses RAW fetch to bypass validation errors (for display purposes)
 */

async function resolveSubmitPaymentProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  if (!notification.orderId) {
    throw new Error('Missing orderId in notification');
  }
  
  // ✅ ALWAYS fetch fresh order to check current status
  const order = await fetchOrder(notification.orderId, context);
  if (!order) {
    throw new Error(`Order ${notification.orderId} not found`);
  }
  
  // ✅ SMART ROUTING: Check if payment was already submitted
  if (order.paymentSubmitted) {
    
    const products = fetchProducts(context);
    const categories = fetchCategories(context);
    
    return {
      _modalRedirect: 'PAYMENT_IN_REVIEW', // Redirect to review modal
      order,
      products,
      categories
    };
  }
  
  // ✅ SMART ROUTING: Check if order is already paid/completed
  // ✅ PHASE 1 FIX (Feb 9, 2026): Remove legacy 'paid' status
  if (order.status === 'in_process' || order.status === 'completed') {
    
    const products = fetchProducts(context);
    const categories = fetchCategories(context);
    
    return {
      _modalRedirect: 'COMPLETED_ORDER_INVOICE', // Redirect to invoice modal
      order,
      products,
      categories
    };
  }
  
  // ✅ Normal flow: Show payment submission form
  const products = fetchProducts(context);
  const categories = fetchCategories(context);
  
  return {
    order,
    products,
    categories,
    onPaymentSubmitted: () => {} // Will be overridden by modal system
  };
}

/**
 * 3. CANCELLED_ORDER_DETAILS - Order rejected/cancelled
 */
async function resolveCancelledOrderDetailsProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  if (!notification.orderId) {
    throw new Error('Missing orderId in notification');
  }
  
  const order = await fetchOrder(notification.orderId, context);
  if (!order) {
    throw new Error(`Order ${notification.orderId} not found`);
  }
  
  const products = fetchProducts(context);
  const categories = fetchCategories(context);
  
  return {
    order,
    products,
    categories
  };
}

/**
 * 4. PAYMENT_IN_REVIEW - Payment submitted, pending review
 * 
 * ✅ FEB 16, 2026: SPECIAL CASE FOR PAYMENT_REMINDER
 * If notification type is PAYMENT_REMINDER and order has no paymentProofUrl:
 * - Redirect to SUBMIT_PAYMENT modal instead
 * - This handles the conditional logic: "if already submitted → show 'in review', otherwise → submit payment"
 */
async function resolvePaymentInReviewProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  if (!notification.orderId) {
    throw new Error('Missing orderId in notification');
  }
  
  const order = await fetchOrder(notification.orderId, context);
  if (!order) {
    throw new Error(`Order ${notification.orderId} not found`);
  }
  
  // ✅ SPECIAL CASE: PAYMENT_REMINDER conditional logic
  // If this is a payment reminder notification and no payment proof exists,
  // redirect to SUBMIT_PAYMENT modal instead of showing "in review"
  if (notification.type === 'PAYMENT_REMINDER' && !order.paymentProofUrl) {
    
    // Return SUBMIT_PAYMENT props with redirect flag
    const products = fetchProducts(context);
    const categories = fetchCategories(context);
    
    return {
      _modalRedirect: 'SUBMIT_PAYMENT', // ✅ Special flag to redirect modal
      order,
      products,
      categories,
      amount: order.total,
      isPaymentReminder: true, // ✅ Flag to show "Payment Reminder" messaging
    };
  }
  
  // ✅ NORMAL CASE: Payment proof exists (or not a payment reminder)
  // Show PAYMENT_IN_REVIEW modal
  const products = fetchProducts(context);
  const categories = fetchCategories(context);
  
  return {
    order,
    products,
    categories
  };
}

/**
 * 4.3. PAID_ORDER_DETAILS - Order in production (payment confirmed)
 * ✅ NEW: Dedicated resolver for paid orders in production
 * This modal shows order details for orders with confirmed payment (in_process status)
 * ✅ MAR 12, 2026: Enhanced to preserve isEditedOrder and editDetails props
 */
async function resolvePaidOrderDetailsProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  if (!notification.orderId) {
    throw new Error('Missing orderId in notification');
  }
  
  const order = await fetchOrder(notification.orderId, context);
  if (!order) {
    throw new Error(`Order ${notification.orderId} not found`);
  }
  
  const products = fetchProducts(context);
  const categories = fetchCategories(context);
  
 // Preserve isEditedOrder and editDetails from notification metadata
  // This allows the modal to show appropriate messaging for edited orders
  const baseProps = {
    order,
    products,
    categories,
    onClose: () => {} // Will be overridden by modal system
  };
  
  // ✅ If this is an ORDER_EDITED notification, include the edit context
  if (notification.type === 'ORDER_EDITED') {
    return {
      ...baseProps,
      isEditedOrder: true,
      editDetails: notification.metadata
    };
  }
  
  return baseProps;
}

/**
 * 4.5. COMPLETED_ORDER_INVOICE - Completed order invoice view
 * ✅ NEW: Dedicated resolver for completed order invoices
 * This modal shows the final invoice for completed orders
 */
async function resolveCompletedOrderInvoiceProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  if (!notification.orderId) {
    throw new Error('Missing orderId in notification');
  }
  
  const order = await fetchOrder(notification.orderId, context);
  if (!order) {
    throw new Error(`Order ${notification.orderId} not found`);
  }
  
  const products = fetchProducts(context);
  const categories = fetchCategories(context);
  
  return {
    order,
    products,
    categories,
    onDownloadExcel: () => {},
    onDownloadPDF: () => {
      // Modal self-fetches products/categories and calls downloadCompleteOrderPDF directly
    }
  };
}

/**
 * 5. INVOICE_DETAIL - Invoice viewing (final/updated)
 * ✅ TRIPLE-STRATEGY RESOLUTION:
 *    1. notification.invoiceId (direct)
 *    2. order.finalInvoiceId (from order data)
 *    3. Query by orderId (fallback search)
 * 
 * ✅ FALLBACK: If no invoice found, redirect to COMPLETED_ORDER_INVOICE with order data
 * 
 * Modal expects:
 * - invoice: Invoice (from invoicing service)
 * - onClose: () => void
 */
async function resolveInvoiceDetailProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  let invoiceId = notification.invoiceId;
  let invoice = null;
  let order = null;
  
  // ══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1: Try notification.invoiceId (direct reference)
  // ═══════════════════════════════════════════════════════════════════════════
  if (invoiceId) {
    invoice = fetchInvoice(invoiceId);
    
    if (invoice) {
      return {
        invoice,
        onClose: () => {}
      };
    } else {
      logger.warn(`⚠️ [Strategy 1] FAILED - Invoice ${invoiceId} not found in storage`);
      // Don't return yet, try other strategies
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 2: Try order.finalInvoiceId or order.latestInvoiceId
  // ═══════════════════════════════════════════════════════════════════════════
  if (!invoice && notification.orderId) {
    order = await fetchOrder(notification.orderId, context);
    
    if (order) {
      // Check both finalInvoiceId and latestInvoiceId (different systems may use different fields)
      const orderInvoiceId = order.finalInvoiceId || order.invoiceId;
      
      if (orderInvoiceId) {
        invoice = fetchInvoice(orderInvoiceId);
        
        if (invoice) {
          return {
            invoice,
            onClose: () => {}
          };
        } else {
          logger.warn(`⚠️ [Strategy 2] FAILED - Invoice ${orderInvoiceId} not found in storage`);
        }
      } else {
      }
    } else {
      logger.warn(`⚠️ [Strategy 2] FAILED - Order ${notification.orderId} not found`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 3: Query invoices by orderId (fallback)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!invoice && notification.orderId) {
    invoice = fetchInvoiceByOrderId(notification.orderId);
    
    if (invoice) {
      return {
        invoice,
        onClose: () => {}
      };
    } else {
      logger.warn(`⚠️ [Strategy 3] FAILED - No invoice found for orderId ${notification.orderId}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 4 (NEW): Fallback to order data for COMPLETED_ORDER_INVOICE modal
  // ══════════════════════════════════════════════════════════════════════════
  // ✅ PHASE 1 FIX (Feb 9, 2026): Remove legacy 'paid' status
  if (!invoice && order && (order.status === 'completed' || order.status === 'in_process')) {
    
    const products = fetchProducts(context);
    const categories = fetchCategories(context);
    
    // ✅ Return props for COMPLETED_ORDER_INVOICE modal with a special flag
    return {
      _modalRedirect: 'COMPLETED_ORDER_INVOICE', // Special flag for resolver to change modal type
      order,
      products,
      categories,
      onClose: () => {}
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 5 (NEW): Handle in-progress orders without invoices
  // ═══════════════════════════════════════════════════════════════════════════
  if (!invoice && order && (order.status === 'pending' || order.status === 'approved')) {
    
    // Return error with helpful message
    return {
      invoice: null,
      notification,
      error: 'Invoice not yet available',
      reason: `This order is currently ${order.status}. Invoices are only generated when orders are completed and paid.`,
      order, // Include order for fallback display
      onClose: () => {}
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ALL STRATEGIES FAILED - Return error fallback
  // ═══════════════════════════════════════════════════════════════════════════
  console.error(`❌ [ModalResolver] ALL STRATEGIES FAILED - Could not find invoice`);
  console.error(`   Tried:`);
  console.error(`   ✗ Strategy 1: notification.invoiceId = ${notification.invoiceId || 'N/A'}`);
  console.error(`   ✗ Strategy 2: order.finalInvoiceId = ${order ? (order.finalInvoiceId || 'N/A') : 'order not found'}`);
  console.error(`   ✗ Strategy 3: query by orderId = ${notification.orderId || 'N/A'}`);
  console.error(`   ✗ Strategy 4: order fallback = ${order ? `order found but status=${order.status}` : 'order not found'}`);
  
  return {
    invoice: null, // ✅ Explicitly set to null
    notification,
    error: 'Invoice not found using any strategy (notification.invoiceId, order.finalInvoiceId, or orderId query)',
    onClose: () => {}
  };
}

/**
 * 6. CREDIT_RECEIVED - Credit issued notification
 * 
 * Modal expects ONLY:
 * - customerId: string
 * - onViewCredit: () => void
 * - onClose: () => void
 */
async function resolveCreditReceivedProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  // ✅ Extract customerId from notification
  const customerId = notification.customerId || notification.metadata?.customerId;
  
  // ✅ If customerId is missing, return error fallback
  if (!customerId) {
    console.error('❌ [ModalResolver] CREDIT_RECEIVED notification missing customerId');
    return {
      notification,
      error: 'Customer ID not found in notification',
      reason: 'Cannot display credit modal without customer ID',
      onClose: () => {}
    };
  }
  
  
  // ✅ Return ONLY the props the modal expects
  return {
    customerId: customerId,
    onViewCredit: () => {}, // Modal system will override
    onClose: () => {}       // Modal system will override
  };
}

/**
 * 7. ADMIN_ORDER_VIEW - Admin order review interface
 */
async function resolveAdminOrderViewProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  // Extract orderId from multiple sources with fallback
  let orderId = notification.orderId 
    || notification.metadata?.orderId 
    || notification.actions?.[0]?.payload?.orderId;
  
 // FALLBACK - Extract from notification ID
  // Pattern: "payment-{orderId}-submitted"
  if (!orderId && notification.id) {
    const match = notification.id.match(/^payment-(.+)-submitted$/);
    if (match) {
      orderId = match[1];
    }
  }
  
 // FALLBACK - Extract from message text
  // Pattern: "for order {orderId}"
  if (!orderId && notification.message) {
    const match = notification.message.match(/for order\s+([A-Z0-9\-]+)/);
    if (match) {
      orderId = match[1];
    }
  }
  
  if (!orderId) {
    console.error('❌ [ModalResolver] Missing orderId in notification. Full notification:', notification);
    throw new Error('Missing orderId in notification');
  }
  
  
  const order = await fetchOrder(orderId, context);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  
  const products = fetchProducts(context);
  const categories = fetchCategories(context);
  
  // Try to fetch customer if customerId is available
  let customer = null;
  const customerId = notification.customerId || order.customerId;
  if (customerId) {
    customer = await fetchCustomer(customerId, context);
  }
  
  return {
    order,
    products,
    categories,
    customer,
    onApprove: context.onApproveOrder || (async (_orderId: string) => {
      // Close the order view modal first
      if (context.closeModal) {
        context.closeModal();
      }

      try {
        const { approveOrderAction } = await import('../services/orderActionService');
        const { toast } = await import('sonner');

        // PASS 12: was reading `context.user.displayName` — a field that
        // doesn't exist on the User type. Previously masked by user being
        // typed as `any`. The canonical field is `name` (per
        // services/firebase/authService.ts User interface). Also removed the
        // hardcoded `admin@bakery.com` fallback: if the user isn't present,
        // the action fails loudly rather than recording a fake admin in the
        // audit trail (same accountability fix as Pass 12 Task 1).
        if (!context.user?.email) {
          toast.error('Cannot approve order — admin session not found. Please re-login.');
          return;
        }
        const adminInfo = {
          id: context.user.id || context.user.email,
          email: context.user.email,
          name: context.user.name || context.user.email,
          storeName: context.user.storeName || context.user.name || 'Admin',
        };

        const result = await approveOrderAction(order, adminInfo, order.deliveryFee ?? 0);

        if (result.success) {
          toast.success(`Order ${order.orderNumber || order.id} approved successfully!`, {
            description: `${order.customerName} has been notified and can now submit payment.`,
            duration: 4000,
          });

          if (context.loadOrders) {
            await context.loadOrders();
          }
        } else {
          toast.error(result.message || 'Failed to approve order');
        }
      } catch (error) {
        console.error('❌ [ModalResolver] Order approval failed:', error);
        const { toast } = await import('sonner');
        toast.error(error instanceof Error ? error.message : 'Failed to approve order');
      }
    }),
    onReject: context.onRejectOrder || (async (orderId: string, reason?: string) => {
 // Implement full rejection workflow from notifications
      if (context.closeModal && context.openModal) {
        context.closeModal(); // Close ADMIN_ORDER_VIEW modal
        
        // Open REJECT_ORDER modal with proper workflow
        context.openModal('REJECT_ORDER', {
          order,
          onConfirm: async (rejectionReason: string) => {
            // The modal will handle calling the rejection service
            // and showing success/error notifications
          }
        });
      } else {
      }
    }),
    onDownloadExcel: () => {
    },
    onDownloadPDF: () => {
    },
    onDownloadBakeryPDF: () => {
    },
    onCancelOrder: context.onCancelOrder || (async (orderId: string) => {
 // Implement cancellation workflow from notifications
      if (context.closeModal && context.openModal) {
        context.closeModal(); // Close current modal
        
        // Open CANCEL_ORDER modal
        context.openModal('CANCEL_ORDER', {
          order,
          onConfirm: async (cancellationReason: string) => {
            // The modal will handle calling the cancellation service
          }
        });
      } else {
      }
    }),
  };
}

/**
 * 8. PAYMENT_RECEIVED_SUCCESS - Payment confirmed (admin)
 */
async function resolvePaymentReceivedSuccessProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  const orderId = notification.orderId;
  const amount = notification.amount || notification.metadata?.amount || 0;
  const paymentDate = notification.metadata?.paymentDate || notification.createdAt;
  
  // Optionally fetch order for additional details
  let order = null;
  if (orderId) {
    order = await fetchOrder(orderId, context);
  }
  
  return {
    orderId,
    amount,
    paymentDate,
    order, // May be null
    onClose: () => {} // Will be overridden by modal system
  };
}

/**
 * 9. PAYMENT_CONFIRMED_MESSAGE - Simple message modal for payment confirmation
 */
async function resolvePaymentConfirmedMessageProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  const orderId = notification.orderId;
  const customerName = notification.customerName || notification.metadata?.customerName;
  const amount = notification.amount || notification.metadata?.amount;
  const invoiceNumber = notification.metadata?.invoiceNumber || notification.metadata?.order?.invoiceNumber;
  
  return {
    orderId,
    customerName,
    amount,
    invoiceNumber,
    onClose: () => {} // Will be overridden by modal system
  };
}

/**
 * 11. NOTIFICATION_DETAILS - Fallback for unknown types or errors
 */
async function resolveNotificationDetailsProps(
  notification: NotificationItem,
  context: AppContext,
  error?: string
): Promise<ModalPayload> {
  
  // Try to fetch order if orderId exists
  let order = null;
  if (notification.orderId) {
    try {
      order = await fetchOrder(notification.orderId, context);
    } catch (err) {
      logger.warn(`⚠️ [ModalResolver] Could not fetch order ${notification.orderId}:`, err);
    }
  }
  
  return {
    notification,
    order,
    error,
    onClose: () => {} // Will be overridden by modal system
  };
}

/**
 * 12. REJECTED_ORDER_DETAILS - View rejected order details
 */
async function resolveRejectedOrderDetailsProps(
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  
  if (!notification.orderId) {
    throw new Error('Missing orderId in notification');
  }
  
  const order = await fetchOrder(notification.orderId, context);
  if (!order) {
    logger.warn(`⚠️ [ModalResolver] Could not fetch order ${notification.orderId}`);
    // ✅ Return null order - modal will handle gracefully
    return {
      order: null,
      products: fetchProducts(context),
      categories: fetchCategories(context),
      rejectionReason: notification.metadata?.reason || 'Order not found',
      onClose: () => {} // Will be overridden by modal system
    };
  }
  
  const products = fetchProducts(context);
  const categories = fetchCategories(context);
  
  // Extract rejection reason from notification metadata or order
  const rejectionReason = notification.metadata?.reason || order.rejectionReason || 'No reason provided';
  
  
  return {
    order,
    products,
    categories,
    rejectionReason,
    onClose: () => {} // Will be overridden by modal system
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RESOLVER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ✅ STEP 5: Add standard base props to modal props
 * Ensures every modal receives predictable props:
 * - notificationId (for tracking)
 * - orderId (if applicable)
 * - onClose (will be overridden by modal system)
 * - Admin callbacks (if admin context)
 */
function addStandardProps(
  props: Record<string, unknown>,
  notification: NotificationItem,
  context: AppContext
): ModalPayload {
  // Base props for all modals - typed as ModalPayload to allow dynamic assignment
  const standardProps: ModalPayload = {
    onClose: () => {}, // Will be overridden by modal system
    orderId: notification.orderId || "",
    invoiceId: notification.invoiceId,
    customerId: notification.customerId || "",
  };

  // Add admin-specific callbacks if admin user
  if (context.user?.role === 'admin') {
    if (context.onConfirmPayment) standardProps.onConfirmPayment = context.onConfirmPayment;
    if (context.onApproveOrder)   standardProps.onApproveOrder   = context.onApproveOrder;
    if (context.onRejectOrder)    standardProps.onRejectOrder     = context.onRejectOrder;
  }

  // Allow both admin and customer to delete notifications
  if (context.onDeleteNotification) {
    standardProps.onDeleteNotification = context.onDeleteNotification;
  }

  // Merge with resolved props (resolved props take precedence)
  return {
    ...standardProps,
    ...props,
  };
}

/**
 * Main resolver function - maps modal type to props resolver
 * 
 * ✅ FEB 16, 2026: STEP 5 - Standardized props
 * - Every modal receives notificationId, onClose
 * - Admin modals receive admin callbacks
 * - Props validation and logging
 */
export async function resolveModalProps(
  modalType: string,
  notification: NotificationItem,
  context: AppContext
): Promise<ModalPayload> {
  logger.log(`🎯 [ModalResolver] Resolving modal: ${modalType}`);
  logger.log(`🎯 [ModalResolver] Notification type: ${notification.type}, ID: ${notification.id}`);
  if (import.meta.env.DEV) logger.log(`[ModalResolver] Resolving: ${modalType}`);
  // Notification detail logging disabled in production
  
  try {
    let props: Record<string, unknown>;
    
    switch (modalType) {
      case 'SUBMIT_PAYMENT':
        props = await resolveSubmitPaymentProps(notification, context);
        break;
      
      case 'PENDING_ORDER_DETAILS':
        props = await resolvePendingOrderDetailsProps(notification, context);
        break;
      
      case 'CANCELLED_ORDER_DETAILS':
        props = await resolveCancelledOrderDetailsProps(notification, context);
        break;
      
      case 'REJECTED_ORDER_DETAILS':
        props = await resolveRejectedOrderDetailsProps(notification, context);
        break;
      
      case 'PAYMENT_IN_REVIEW':
        props = await resolvePaymentInReviewProps(notification, context);
        break;
      
      case 'PAID_ORDER_DETAILS':
        props = await resolvePaidOrderDetailsProps(notification, context);
        break;
      
      case 'COMPLETED_ORDER_INVOICE':
        props = await resolveCompletedOrderInvoiceProps(notification, context); // ✅ Use dedicated resolver
        break;
      
      case 'INVOICE_DETAIL': // ✅ Legacy support - use invoice resolver
        props = await resolveInvoiceDetailProps(notification, context);
        break;
      
      case 'CREDIT_RECEIVED':
        props = await resolveCreditReceivedProps(notification, context);
        break;
      
      case 'ADMIN_ORDER_VIEW':
        props = await resolveAdminOrderViewProps(notification, context);
        break;
      
      case 'PAYMENT_RECEIVED_SUCCESS':
        props = await resolvePaymentReceivedSuccessProps(notification, context);
        break;
      
      case 'PAYMENT_CONFIRMED_MESSAGE':
 // Simple message modal - just pass through notification data
        props = {
          orderId: notification.orderId || "",
          customerName: notification.customerName || notification.metadata?.customerName,
          amount: notification.amount || notification.metadata?.amount,
          invoiceNumber: notification.metadata?.invoiceNumber || notification.metadata?.order?.invoiceNumber,
        };
        break;
      
      case 'NOTIFICATION_DETAILS':
        props = await resolveNotificationDetailsProps(notification, context);
        break;
      
      default:
        logger.warn(`⚠️ [ModalResolver V2] Unknown modal type: ${modalType}`);
        logger.warn(`⚠️ Notification type: ${notification.type}, ID: ${notification.id}`);
        logger.warn(`⚠️ Expected one of: PENDING_ORDER_DETAILS, SUBMIT_PAYMENT, CANCELLED_ORDER_DETAILS, REJECTED_ORDER_DETAILS, PAYMENT_IN_REVIEW, PAID_ORDER_DETAILS, COMPLETED_ORDER_INVOICE, CREDIT_RECEIVED, ADMIN_ORDER_VIEW, PAYMENT_RECEIVED_SUCCESS, NOTIFICATION_DETAILS`);
        
        // Return minimal fallback props
        props = await resolveNotificationDetailsProps(notification, context, `Unsupported modal type: ${modalType}`);
        break;
    }
    
    // Add standard props to resolved props
    return addStandardProps(props, notification, context);
  } catch (error) {
    console.error(`❌ [ModalResolver] Error resolving props for ${modalType}:`, error);
    return await resolveNotificationDetailsProps(notification, context, error instanceof Error ? error.message : 'Unknown error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a minimal context from component props
 * Use this helper in components that don't have full context
 */

// Context factories — re-exported from notification-modal-context for backward compat
export { createMinimalContext, createContextWithCallbacks } from "./notification-modal-context";
