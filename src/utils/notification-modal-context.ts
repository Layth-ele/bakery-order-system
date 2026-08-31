import { getOrders } from '../services/data/ordersDataService';
import { safeParseJSON } from '../utils/safeLocalStorage';
/**
 * Notification Modal Context Factories
 *
 * Utility functions for creating AppContext objects used by the
 * notification modal resolver. Extracted to reduce resolver file size.
 */
import type { Product, Category, Order } from "../types";
import type { ModalType, ModalProps } from '../types/modals';
import type { ModalSize, OverlayBlur } from '../ui/modals/BaseModal';

interface AppContext {
  orders?: Order[];
  products?: Product[];
  categories?: Category[];
  customers?: any[];
  loadOrders?: () => Promise<Order[]>;
  loadProducts?: () => Product[];
  loadCategories?: () => Category[];
  loadCustomers?: () => any[];
  onConfirmPayment?: (order: Order) => void;
  onApproveOrder?: (order: Order) => void;
  onRejectOrder?: (order: Order) => void;
  onDeleteNotification?: (notificationId: string) => void;
  user?: any; // ✅ Add user to context for role-based logic
  openModal?: <T extends ModalType>(type: T, props: ModalProps<T>, size?: ModalSize, overlayBlur?: OverlayBlur) => void;
  closeModal?: () => void; // ✅ For closing modals from stub callbacks
}


export function createMinimalContext(
  orders: Order[],
  products: Product[],
  categories: Category[],
  user?: any
): AppContext {
  return {
    orders,
    products,
    categories,
    user,
    loadOrders: async () => await getOrders(),
    loadProducts: () => safeParseJSON<any[]>('bakery_products', []),
    loadCategories: () => safeParseJSON<any[]>('bakery_categories', []),
    loadCustomers: () => safeParseJSON<any[]>('bakery_customers', [])
  };
}

/**
 * Create context with action callbacks
 * Use this in components that need to handle modal actions
 */
export function createContextWithCallbacks(
  orders: Order[],
  products: Product[],
  categories: Category[],
  user: any,
  callbacks: {
    onConfirmPayment?: (order: Order) => void;
    onSendReminder?: (order: Order) => void;
    onCancelOrder?: (order: Order) => void;
    onApproveOrder?: (order: Order) => void;
    onRejectOrder?: (order: Order) => void;
  }
): AppContext {
  return {
    ...createMinimalContext(orders, products, categories, user),
    ...callbacks
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════

export type { AppContext };