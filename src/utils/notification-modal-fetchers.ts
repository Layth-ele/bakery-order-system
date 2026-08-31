import type { NotificationItem } from '../types/notification-canonical';
import { safeParseJSON } from '../utils/safeLocalStorage';
/**
 * Notification Modal Data Fetchers
 *
 * Private helper functions that retrieve data needed to populate
 * notification modal props. Extracted from notification-modal-resolver.ts.
 */
import type { Product, Category, Order } from "../types";
import type { ModalType, ModalProps } from '../types/modals';
import type { ModalSize, OverlayBlur } from '../ui/modals/BaseModal';
import { getOrder } from "../services/data/ordersDataService";
import { logger } from './logger';


interface AppContext {
  orders?: Order[];
  products?: Product[];
  categories?: Category[];
  customers?: any[];
  currentUser?: any;
  openModal?: <T extends ModalType>(type: T, props: ModalProps<T>, size?: ModalSize, overlayBlur?: OverlayBlur) => void;
  closeModal?: () => void;
  loadProducts?: () => Product[];
  loadCategories?: () => Category[];
  loadCustomers?: () => any[];
}

export async function fetchOrder(orderId: string, context: AppContext): Promise<Order | null> {
  
  // Try loading fresh orders first (real-time)
  const contextOrders = context.orders || [];
  if (contextOrders.length > 0) {
    const orders = contextOrders;
    const order = orders.find(o => o.id === orderId);
    if (order) {
      return order;
    }
  }
  if (context.orders) {
    const order = context.orders.find(o => o.id === orderId);
    if (order) {
      logger.warn(`⚠️ [ModalResolver] Order ${orderId} found in context cache (may be stale). Status: ${order.status}`);
      return order;
    }
  }

  const order = await getOrder(orderId);
  
  if (!order) {
    console.error(`❌ [ModalResolver] Order ${orderId} not found`);
  } else {
  }
  
  return order || null;
}

/**
 * ✅ ROBUST: Supports multiple invoice lookup strategies
 */
export function fetchInvoice(invoiceId: string): any | null {

  const allInvoices: any[] = [];  // Firebase only — invoices fetched via Firestore
  const invoice = allInvoices.find((inv) => inv.id === invoiceId);
  
  if (!invoice) {
    logger.warn(`⚠️ [ModalResolver] Invoice ${invoiceId} not found`);
  }
  
  return invoice || null;
}

/**
 * ✅ NEW: Query invoice by orderId (fallback when invoiceId not available)
 * Used when notification doesn't have invoiceId but has orderId
 */
export function fetchInvoiceByOrderId(orderId: string): any | null {
  
  const allInvoices: any[] = [];  // Firebase only — invoices fetched via Firestore
  
  // Find invoice where invoice.orderId matches
  const invoice = allInvoices.find((inv) => inv.orderId === orderId);
  
  if (invoice) {
  } else {
    logger.warn(`⚠️ [ModalResolver] No invoice found for orderId ${orderId}`);
  }
  
  return invoice || null;
}

/**
 */
export function fetchProducts(context: AppContext): Product[] {
  // Try context first
  if (context.products && context.products.length > 0) {
    return context.products;
  }
  
  // Call loadProducts if available (context.products won't be pre-populated)
  if (context.loadProducts) {
    const loaded = context.loadProducts();
    if (loaded && loaded.length > 0) {
      return loaded as Product[];
    }
  }

  const products = safeParseJSON<any[]>('bakery_products', []);

  return products;
}

/**
 */
export function fetchCategories(context: AppContext): Category[] {
  // Try context first
  if (context.categories && context.categories.length > 0) {
    return context.categories;
  }
  
  // Call loadCategories if available
  if (context.loadCategories) {
    const loaded = context.loadCategories();
    if (loaded && loaded.length > 0) {
      return loaded as Category[];
    }
  }

  const categories = safeParseJSON<any[]>('bakery_categories', []);

  return categories;
}

/**
 */
export async function fetchCustomer(customerId: string, context: AppContext): Promise<any | null> {
  // Try context first
  if (context.customers) {
    const customer = context.customers.find(c => c.id === customerId);
    if (customer) {
      return customer;
    }
  }
  
  // Call loadCustomers if available (now async)
  if (context.loadCustomers) {
    try {
      const loaded = await context.loadCustomers();
      if (loaded && Array.isArray(loaded)) {
        const customer = loaded.find((c) => c.id === customerId);
        if (customer) {
          return customer;
        }
      }
    } catch (error) {
      logger.warn(`⚠️ [ModalResolver] Failed to load customers:`, error);
    }
  }

  const allCustomers = safeParseJSON<any[]>('bakery_customers', []);
  const customer = allCustomers.find((c) => c.id === customerId);
  
  if (!customer) {
    logger.warn(`⚠️ [ModalResolver] Customer ${customerId} not found`);
  }
  
  return customer || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL PROPS RESOLVERS (Per Modal Type)
// ══════════════════════════════════════════════════════════════════════════

/**
 * 1. PENDING_ORDER_DETAILS - Customer order pending approval
 */
export async function resolvePendingOrderDetailsProps(
  notification: NotificationItem,
  context: AppContext
): Promise<any> {
  
  if (!notification.orderId) {
    throw new Error('Missing orderId in notification');
  }
  
  const order = await fetchOrder(notification.orderId, context);
  if (!order) {
    throw new Error(`Order ${notification.orderId} not found`);
  }
  
  const products = fetchProducts(context);
  const categories = fetchCategories(context);
  
  // ✅ Detect user role from context
  // If user is admin, notification is admin-facing (ORDER_SUBMITTED, ORDER_UPDATE_REQUESTED)
  // If user is customer, notification is customer-facing (ORDER_PENDING)
  const userRole = context.currentUser?.role === 'admin' ? 'admin' : 'customer';
  
  
  return {
    order,
    products,
    categories,
    userRole, // ✅ Pass role to modal for read-only vs action mode
    onClose: () => {} // Will be overridden by modal system
  };
}

/**
 * 2. SUBMIT_PAYMENT - Payment submission form
 * ✅ FEB 7, 2026: Smart status check - if payment already submitted, show PAYMENT_IN_REVIEW instead
 */

export type { AppContext };
