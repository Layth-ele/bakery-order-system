/**
 * Domain Types - Re-exported from Schemas
 * 
 * ✅ SINGLE SOURCE OF TRUTH: All core entity types come from Zod schemas
 * ✅ NO DUPLICATION: Types inferred from /schemas/* files
 * ✅ RUNTIME SAFETY: Schema validation ensures correctness
 * 
 * This file exists for backward compatibility.
 * Prefer importing directly from '@/schemas' in new code.
 * 
 * Version: 2.0.0 - Aligned with schemas (March 7, 2026)
 */

// ═══════════════════════════════════════════════════════════════════════════
// CORE DOMAIN TYPES (Re-exported from Schemas)
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT & CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  
  Product,
  Category,
  CreateProductInput,
  UpdateProductInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Order
  Order,
  OrderStatus,
  OrderSnapshot,
  SnapshotTrigger,
  CreateOrderInput,
  UpdateOrderInput,
  
  // Order Items
  OrderItem,
  OrderItemsArray,
  
  // Adjustments
  OrderAdjustment,
  OrderAdjustmentsArray,
  PaymentState,
  AdjustmentType,
  AdjustmentReason,
  PaidStatus,
  CreditIssued,
  
  // Credit Applications
  CreditApplication,
  CreditApplicationsArray,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT NOTES
  // ═══════════════════════════════════════════════════════════════════════════
  
  CreditNote,
  CreditNotesArray,
  PayoutMethod,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICING
  // ═══════════════════════════════════════════════════════════════════════════
  
  WeeklyInvoice,
  WeeklyInvoicesArray,
  PaymentTransaction,
  PaymentTransactionsArray,
  PaymentMethod,
  TransactionStatus,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Settings,
  UpdateSettingsInput,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER (for convenience)
  // ═══════════════════════════════════════════════════════════════════════════
  
  Customer,
  CustomerStatus,
  CustomerType,
  
} from '../schemas';

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPER TYPES (Not in schemas - these are frontend-specific)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Week - UI helper for week selection
 * NOT a Firestore entity, so not in schemas
 */
export interface Week {
  weekNumber: number;
  year: number;
  startDate: string;      // ISO date string
  endDate: string;        // ISO date string
  deliveryDate: string;   // ISO date string
}

/**
 * WeekInfo - Extended week information for UI
 * NOT a Firestore entity, so not in schemas
 */
export interface WeekInfo {
  weekKey: string;        // Format: "2026-W10"
  weekNumber: number;
  year: number;
  startDate: string;      // ISO date string
  endDate: string;        // ISO date string
  deliveryDate: string;   // ISO date string
  cutoffDate: string;     // ISO date string
  isCurrentWeek: boolean;
  isPast: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION NOTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BEFORE (v1.0 - Hand-written types):
 * - 300+ lines of duplicate type definitions
 * - Timestamps typed as `any` or `string`
 * - Risk of drift from runtime validation
 * - Had to update types and schemas separately
 * 
 * AFTER (v2.0 - Schema-inferred types):
 * - All types inferred from Zod schemas via `z.infer<>`
 * - Timestamps correctly typed as `Firestore.Timestamp`
 * - Zero drift risk - types = runtime
 * - Single update point (schema only)
 * 
 * USAGE EXAMPLES:
 * 
 * ```typescript
 * // ✅ Import from this file (backward compatible)
 * import { Order, Product, Customer } from '@/types/domain';
 * 
 * // ✅ PREFERRED: Import directly from schemas
 * import { Order, Product, Customer } from '@/schemas';
 * 
 * // ✅ Use with validation
 * import { orderSchema, parseFirestoreDoc } from '@/schemas';
 * const order = parseFirestoreDoc(orderSchema, docData, 'Order');
 * // Type and runtime both validated! ✅
 * ```
 * 
 * BENEFITS:
 * - Type safety = Runtime safety
 * - Firestore Timestamp enforcement
 * - Locked enums (can't use invalid values)
 * - parseOrThrow() helpers for validation
 * - Zero maintenance overhead for type definitions
 */