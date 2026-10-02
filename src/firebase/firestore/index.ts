/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - DOMAIN-SPLIT ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This file re-exports all Firestore operations from domain-specific files.
 * 
 * ARCHITECTURE:
 * - shared.ts: Common utilities (wrapFirestoreOperation, db, etc.)
 * - customers.ts: Customer CRUD + subscriptions
 * - products.ts: Product CRUD + subscriptions
 * - categories.ts: Category CRUD + subscriptions
 * - orders.ts: Order CRUD + subscriptions
 * - settings.ts: Settings CRUD + subscriptions
 * - notifications.ts: Notification operations
 * - creditNotes.ts: Credit Note CRUD + subscriptions
 * - orderEditHistory.ts: Order Edit History CRUD + subscriptions (✅ MAR 14, 2026)
 * - creditApplicationHistory.ts: Credit Application History CRUD + subscriptions (✅ MAR 14, 2026)
 * 
 * WHY THIS SPLIT:
 * - Easier to review changes (one domain at a time)
 * - Easier to isolate bugs (one file per domain)
 * - Reduced merge conflicts (team works on different domains)
 * - Prevents accidental refactors affecting the whole app
 * - Each file is ~200-300 lines instead of 968 lines
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPE RE-EXPORTS (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export type { 
  Customer, 
  Product,
  Category,
  Order, 
  Settings, 
  CreditNote,
} from '../../schemas';


// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════

export {
  getCustomers,
  getCustomer,
  createCustomer,
  createUserProfile,
  updateCustomer,
  deleteCustomer,
  subscribeToCustomer,
  subscribeToCustomers,
} from './customers';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  subscribeToProducts,
} from './products';

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

export {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  subscribeToCategories,
} from './categories';

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════

export {
  getOrders,
  getOrder,
  getOrdersByCustomer,
  subscribeToOrders,
  subscribeToCustomerOrders,
  subscribeToOrder,
} from './orders';

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export {
  getSettings,
  updateSettings,
  subscribeToSettings,
} from './settings';

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// CREDIT NOTES
// ═══════════════════════════════════════════════════════════════════════════

export {
  getCreditNotes,
  subscribeToCreditNotes,
} from './creditNotes';

// ═══════════════════════════════════════════════════════════════════════════
// ORDER EDIT HISTORY (✅ MAR 14, 2026)
// ═══════════════════════════════════════════════════════════════════════════

export {
  getOrderEditHistory,
  subscribeToOrderEditHistory,
} from './orderEditHistory';

export type { OrderEditHistory } from './orderEditHistory';

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT APPLICATION HISTORY (✅ MAR 14, 2026)
// ═══════════════════════════════════════════════════════════════════════════

export {
  getCreditApplicationHistory,
  subscribeToCreditApplicationHistory,
} from './creditApplicationHistory';

export type { CreditApplicationRecord } from './creditApplicationHistory';

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOTS (✅ MAR 17, 2026 - Migrated from embedded array to subcollection)
// ═══════════════════════════════════════════════════════════════════════════

export {
  getOrderSnapshots,
  getLatestOrderSnapshot,
} from './snapshots';