/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCHEMAS INDEX - Master Export
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Single entry point for all Zod schemas across the application
 * 
 * ✅ Firestore Timestamp enforcement
 * ✅ Locked enums
 * ✅ parseOrThrow() helpers
 * ✅ Type-safe CRUD operations
 * 
 * USAGE:
 * ```ts
 * import { orderSchema, parseOrThrow, parseFirestoreDoc } from '@/schemas';
 * 
 * // Validate Firestore document
 * const order = parseFirestoreDoc(orderSchema, docData, 'Order');
 * 
 * // Validate and throw on error
 * const customer = parseOrThrow(customerSchema, data, 'Customer');
 * ```
 * 
 * Fixed: paidStatusSchema + revisionAdjustmentTypeSchema exports
 * 
 * Fixed: Restored createOrderInputSchema and updateOrderInputSchema after subcollection migration
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export * from './shared/primitives';
export * from './shared/parse';

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Schemas
  customerSchema,
  customerStatusSchema,
  customerTypeSchema,
  createCustomerInputSchema,
  // FIX T2R8-H4: split-schema variants for defense-in-depth on the
  // self-registration path. See customer.schema.ts for the full
  // rationale. Existing code can keep importing createCustomerInputSchema;
  // new self-registration code MUST import the restricted variant.
  createCustomerSelfRegistrationInputSchema,
  createCustomerByAdminInputSchema,
  updateCustomerInputSchema,
  passwordResetInputSchema,
  customerStatsSchema,
  customerFiltersSchema,
  // ✅ PASS 4 (M3): Auth-time schema for getCustomerForAuth
  authCustomerSchema,
  
  // Types
  type Customer,
  type CustomerStatus,
  type CustomerType,
  type CreateCustomerInput,
  type CreateCustomerSelfRegistrationInput,
  type CreateCustomerByAdminInput,
  type UpdateCustomerInput,
  type PasswordResetInput,
  type CustomerStats,
  type CustomerFilters,
  type AuthCustomer,
} from './customer/customer.schema';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT & CATEGORY
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Schemas
  productSchema,
  categorySchema,
  createProductInputSchema,
  updateProductInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  
  // Types
  type Product,
  type Category,
  type CreateProductInput,
  type UpdateProductInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from './product/product.schema';

// ═══════════════════════════════════════════════════════════════════════════
// ORDER
// ═══════════════════════════════════════════════════════════════════════════

export {
  // OrderItem
  orderItemSchema,
  orderItemsArraySchema,
  type OrderItem,
  type OrderItemsArray,
} from './order/orderItem.schema';

export {
  // OrderAdjustment
  orderAdjustmentSchema,
  orderAdjustmentsArraySchema,
  paymentStateSchema,
  adjustmentTypeSchema,
  adjustmentReasonSchema,
  paidStatusSchema,
  creditIssuedSchema,
  type OrderAdjustment,
  type OrderAdjustmentsArray,
  type PaymentState,
  type AdjustmentType,
  type AdjustmentReason,
  type PaidStatus,
  type CreditIssued,
} from './order/orderAdjustment.schema';

// OrderRevision schema kept for legacy data migration but not exported

export {
  // CreditApplication
  creditApplicationSchema,
  creditApplicationsArraySchema,
} from './order/creditApplication.schema';

export type {
  CreditApplication,
  CreditApplicationsArray,
} from './order/creditApplication.schema';

export {
  // Order
  orderSchema,
  orderStatusSchema,
  orderSnapshotSchema,
  snapshotTriggerSchema,
  createOrderInputSchema, // ✅ NEW: Input schema for writes
  updateOrderInputSchema, // ✅ NEW: Input schema for updates
  type Order,
  type OrderStatus,
  type OrderSnapshot,
  type SnapshotTrigger,
  type CreateOrderInput, // ✅ NEW: Input type
  type UpdateOrderInput, // ✅ NEW: Input type
} from './order/order.schema';

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT NOTE
// ═══════════════════════════════════════════════════════════════════════════

export {
  // CreditNote
  baseCreditNoteSchema, // ✅ Base schema for .omit() operations
  creditNoteSchema,
  creditNotesArraySchema,
  payoutMethodSchema,
  creditNoteStatusSchema, // ✅ NEW: Status enum
  creditNoteTypeSchema, // ✅ NEW: Type enum
  type CreditNote,
  type CreditNotesArray,
  type PayoutMethod,
  type CreditNoteStatus, // ✅ NEW: Status type
  type CreditNoteType, // ✅ NEW: Type type
} from './creditNote/creditNote.schema';

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Notification
  notificationItemSchema,
  notificationItemsArraySchema,
  notificationTypeSchema,
  actionTypeSchema,
  notificationActionSchema,
  notificationSummarySchema,
  type NotificationItem,
  type NotificationItemsArray,
  type NotificationType,
  type ActionType,
  type NotificationAction,
  type NotificationSummary,
} from './notification/notification.schema';

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Invoice
  weeklyInvoiceSchema,
  weeklyInvoicesArraySchema,
  paymentTransactionSchema,
  paymentTransactionsArraySchema,
  paymentMethodSchema,
  transactionStatusSchema,
  type WeeklyInvoice,
  type WeeklyInvoicesArray,
  type PaymentTransaction,
  type PaymentTransactionsArray,
  type PaymentMethod,
  type TransactionStatus,
} from './invoice/invoice.schema';

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Settings
  settingsSchema,
  updateSettingsInputSchema,
  type Settings,
  type UpdateSettingsInput,
} from './settings/settings.schema';

// ═══════════════════════════════════════════════════════════════════════════
// QUICK REFERENCE GUIDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * USAGE EXAMPLES:
 * 
 * 1. VALIDATE FIRESTORE DOCUMENT:
 * ```ts
 * import { orderSchema, parseFirestoreDoc } from '@/schemas';
 * 
 * const orderDoc = await getDoc(doc(db, 'orders', orderId));
 * const order = parseFirestoreDoc(orderSchema, orderDoc.data(), 'Order');
 * // ✅ order.createdAt is now ISO string (converted from Timestamp)
 * ```
 * 
 * 2. VALIDATE AND THROW ON ERROR:
 * ```ts
 * import { customerSchema, parseOrThrow } from '@/schemas';
 * 
 * const customer = parseOrThrow(customerSchema, rawData, 'Customer');
 * // ✅ Throws with helpful error message if validation fails
 * ```
 * 
 * 3. SAFE VALIDATION (NO THROW):
 * ```ts
 * import { productSchema, parseSafe } from '@/schemas';
 * 
 * const result = parseSafe(productSchema, rawData);
 * if (!result.success) {
 *   console.error(result.error);
 *   return null;
 * }
 * const product = result.data;
 * ```
 * 
 * 4. VALIDATE ARRAY:
 * ```ts
 * import { orderSchema, parseArray } from '@/schemas';
 * 
 * const orders = parseArray(orderSchema, ordersData, 'Order');
 * // ✅ All orders validated
 * ```
 * 
 * 5. VALIDATE ARRAY (SKIP INVALID):
 * ```ts
 * import { orderSchema, parseArrayPartial } from '@/schemas';
 * 
 * const orders = parseArrayPartial(orderSchema, ordersData, 'Order');
 * // ✅ Returns only valid orders, logs warnings for invalid ones
 * ```
 * 
 * 6. TYPE GUARD:
 * ```ts
 * import { orderSchema, isValid } from '@/schemas';
 * 
 * if (isValid(orderSchema, data)) {
 *   // ✅ TypeScript knows data is Order here
 *   console.log(data.id);
 * }
 * ```
 * 
 * 7. CREATE INPUT VALIDATION:
 * ```ts
 * import { createCustomerInputSchema, parseOrThrow } from '@/schemas';
 * 
 * const input = parseOrThrow(createCustomerInputSchema, formData, 'CreateCustomerInput');
 * // ✅ Validated before sending to Firestore
 * ```
 */