/**
 * Customer Types - Re-exported from Schemas
 * 
 * ✅ SINGLE SOURCE OF TRUTH: All types inferred from Zod schemas
 * ✅ NO DUPLICATION: Types come from /schemas/customer/customer.schema.ts
 * ✅ RUNTIME SAFETY: Schema validation ensures type correctness
 * 
 * Version: 2.0.0 - Aligned with schemas (March 7, 2026)
 */

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS FROM SCHEMAS (Single Source of Truth)
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // Core Customer type
  Customer,
  
  // Enums
  CustomerStatus,
  CustomerType,
  
  // Input schemas for CRUD
  CreateCustomerInput,
  UpdateCustomerInput,
  PasswordResetInput,
  
  // Stats and filters
  CustomerStats,
  CustomerFilters,
} from '../schemas';

/**
 * MIGRATION GUIDE:
 * 
 * Before (OLD - hand-written types):
 * ```typescript
 * export interface Customer {
 *   id: string;
 *   email: string;
 *   createdAt?: any; // ❌ Type unsafe
 * }
 * ```
 * 
 * After (NEW - schema-inferred types):
 * ```typescript
 * export type { Customer } from '../schemas';
 * // ✅ Customer.createdAt is Firestore Timestamp (type-safe)
 * ```
 * 
 * BENEFITS:
 * - Types match runtime validation exactly
 * - No drift between types and schemas
 * - Firestore Timestamp enforcement
 * - Single update point for all changes
 */
