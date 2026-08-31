/**
 * Types Index - Central Export Point
 * 
 * ✅ ALIGNED WITH SCHEMAS: All domain types come from /schemas
 * ✅ SINGLE SOURCE OF TRUTH: No duplication between types and schemas
 * ✅ CLEAR SEPARATION:
 *    - Domain types → /schemas (Zod-validated)
 *    - UI types → /types/* (component-specific)
 * 
 * Version: 2.0.0 - Schema-aligned (March 7, 2026)
 */

// ═══════════════════════════════════════════════════════════════════════════
// AUTH (No schema - Firebase Auth types)
// ═══════════════════════════════════════════════════════════════════════════

export type { User } from "../hooks/useAuth";

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN TYPES (Re-exported from schemas)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Order types - All from schemas
 * Includes: Order, OrderItem, OrderAdjustment, OrderRevision, etc.
 */
export * from "./order";

/**
 * Customer types - All from schemas
 * Includes: Customer, CustomerStatus, CustomerType, etc.
 */
export * from "./customer";

/**
 * Domain types - All from schemas
 * Legacy barrel export for backward compatibility
 * 
 * ⚠️ PREFER: Import directly from '@/schemas' in new code
 */
export * from "./domain";

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (Schema-based)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Notification contract - Canonical notification types
 */
export * from "./notification-contract";

/**
 * Notification store - Repository pattern interfaces
 */
export * from "./notification-store";


// ═══════════════════════════════════════════════════════════════════════════
// UI-SPECIFIC TYPES (No schema equivalent - component types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modal registry and type system
 */
export * from "./modals";



/**
 * Order flow UI types
 * Includes: OrderWithCustomer, OrderWithProducts, OrderFilters, etc.
 */
export * from "./order-flow";

/**
 * Customer dashboard UI types
 */
// customer-dashboard: exclude CustomerType to avoid conflict with ./customer
export type { CustomerDashboardProps, OrderValidationResult } from "./customer-dashboard";

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT GUIDELINES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ✅ RECOMMENDED PATTERNS:
 * 
 * 1. For domain types (Order, Customer, Product):
 *    ```typescript
 *    import { Order, Customer } from '@/schemas';
 *    ```
 *    OR
 *    ```typescript
 *    import { Order, Customer } from '@/types';
 *    ```
 * 
 * 2. For UI-specific types:
 *    ```typescript
 *    import { OrderWithCustomer } from '@/types/order-flow';
 *    import { ModalName } from '@/types/modals';
 *    ```
 * 
 * 3. With validation:
 *    ```typescript
 *    import { orderSchema, parseFirestoreDoc } from '@/schemas';
 *    const order = parseFirestoreDoc(orderSchema, docData, 'Order');
 *    ```
 * 
 * ❌ AVOID:
 * 
 * - Don't import from individual schema files:
 *   ```typescript
 *   // ❌ BAD
 *   import { Order } from '@/schemas/order/order.schema';
 *   
 *   // ✅ GOOD
 *   import { Order } from '@/schemas';
 *   ```
 * 
 * - Don't duplicate type definitions:
 *   ```typescript
 *   // ❌ BAD
 *   interface Order {
 *     id: string;
 *     // ... duplicating schema
 *   }
 *   
 *   // ✅ GOOD
 *   import { Order } from '@/schemas';
 *   ```
 */
// Cart types (shared between hooks and services)
export type { DayQuantities } from "./cart";
export { emptyWeek } from "./cart";
// ─── Credit types ────────────────────────────────────────────────────────────
export type { 
  CreditNote, 
  CreditNoteStatus, 
  CreditNoteType,
  CreditNotesArray,
} from '../schemas';
