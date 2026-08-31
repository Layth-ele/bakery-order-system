/**
 * Order Types - Re-exported from Schemas
 * 
 * ✅ SINGLE SOURCE OF TRUTH: Import from schemas, not domain.ts
 * ✅ NO DUPLICATION: All order types come from Zod schemas
 * ✅ RUNTIME SAFETY: Schema validation enforces type correctness
 * 
 * Version: 2.0.0 - Aligned with schemas (March 7, 2026)
 */

// ═══════════════════════════════════════════════════════════════════════════
// ORDER TYPES (Re-exported from Schemas)
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // Core Order type
  Order,
  
  // Enums
  OrderStatus,
  OrderSnapshot,
  SnapshotTrigger,
  
  // Input schemas for CRUD
  CreateOrderInput,
  UpdateOrderInput,
  
  // Items
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
} from '../schemas';

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPER TYPES (Re-exported from domain.ts)
// ═══════════════════════════════════════════════════════════════════════════

export type { 
  Week, 
  WeekInfo 
} from './domain';

/**
 * MIGRATION NOTES:
 * 
 * Before:
 * ```typescript
 * // ❌ OLD: Re-exported from domain.ts (which had duplicates)
 * export type { Order } from './domain';
 * ```
 * 
 * After:
 * ```typescript
 * // ✅ NEW: Re-exported from schemas (single source of truth)
 * export type { Order } from '../schemas';
 * ```
 * 
 * BENEFITS:
 * - No intermediate duplication via domain.ts
 * - Direct path to schema-defined types
 * - Firestore Timestamp enforcement
 * - Locked enums and runtime validation
 */