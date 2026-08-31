/**
 * ============================================================================
 * FIREBASE - Centralized Exports
 * ============================================================================
 * 
 * This file exports all Firebase-related functions in one place.
 * Import from here for better organization and easier refactoring.
 * 
 * ✅ MAR 13, 2026: Updated to use domain-split firestore architecture
 * - firebase/firestore/* contains domain-specific files
 * - Easier to review, maintain, and debug
 * - Reduced from 968 lines to ~200-300 per domain
 * 
 * ✅ MAR 14, 2026: Removed unused services (analytics, messaging, storage)
 * - analytics.ts: Firebase Analytics not used in production (146 lines removed)
 * - messaging.ts: App uses Firestore notifications instead (500+ lines removed)
 * - storage.ts: App uses external image URLs instead (180 lines removed)
 * - Total cleanup: ~826 lines of dead code eliminated
 * 
 * @created February 12, 2026
 */

// ============================================
// FIREBASE CORE
// ============================================
export { auth, db, storage } from './config';
// ✅ MAR 14, 2026: Removed analytics and messaging exports (unused in production)

// ============================================
// FIRESTORE OPERATIONS (domain-split architecture)
// ============================================
export {
  // Types (re-exported from schemas)
  type Customer,
  type Product,
  type Order,
  type Settings,
  type NotificationData,
  type CreditNote,
  
  // Customer operations
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  createUserProfile,
  subscribeToCustomer,
  subscribeToCustomers,
  
  // Product operations
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  subscribeToProducts,
  
  // Order operations
  createOrder,
  updateOrder,
  deleteOrder,
  getOrder,
  getOrders,
  getOrdersByCustomer,
  subscribeToOrder,
  subscribeToOrders,
  subscribeToCustomerOrders,
  
  // Settings operations
  getSettings,
  updateSettings,
  subscribeToSettings,
  
  // Notification operations
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToNotifications,
  
  // Credit note operations
  getCreditNotes,
  createCreditNote,
  updateCreditNote,
  subscribeToCreditNotes,
} from './firestore';

// ============================================
// AUTHENTICATION
// ============================================
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from './auth';

// ✅ MAR 14, 2026: Removed storage exports (uploadImage, deleteImage, getDownloadURL)
// ✅ MAR 14, 2026: Removed messaging exports (requestNotificationPermission, onMessageListener, etc.)
// ✅ MAR 14, 2026: Removed analytics exports (logEvent, trackPageView, etc.)

// ============================================
// RECOMMENDED USAGE
// ============================================

/**
 * For WRITE operations (create, update, delete):
 * ✅ Use functions from firestore.ts (ends with "Safe")
 * 
 * @example
 * ```typescript
 * import { createOrderSafe, updateCustomerSafe } from '@/firebase';
 * import { ValidationError } from '@/firebase';
 * 
 * try {
 *   const orderId = await createOrderSafe(order);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error('Invalid:', error.field, (error as any).message);
 *   }
 * }
 * ```
 */

/**
 * For READ operations:
 * ✅ Use any read function (no validation needed)
 * 
 * @example
 * ```typescript
 * import { getOrders, subscribeToCustomers } from '@/firebase';
 * 
 * const orders = await getOrders();
 * const unsubscribe = subscribeToCustomers(setCustomers);
 * ```
 */

/**
 * For COMPLEX operations:
 * ✅ Use the safe wrapper
 * 
 * @example
 * ```typescript
 * import { safeFirestoreOperation } from '@/firebase';
 * 
 * const result = await safeFirestoreOperation(
 *   async () => {
 *     // Your complex operation
 *   },
 *   'Operation Name'
 * );
 * 
 * if (result.success) {
 *   console.log('Success:', result.data);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */

/**
 * For DEBUGGING:
 * ✅ Use the integrity checker
 * 
 * @example
 * ```typescript
 * import { verifyCollectionIntegrity } from '@/firebase';
 * 
 * const report = await verifyCollectionIntegrity('orders');
 * console.log('Valid:', report.valid, 'Invalid:', report.invalid);
 * ```
 */