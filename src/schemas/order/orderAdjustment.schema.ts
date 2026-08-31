/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORDER ADJUSTMENT SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schema for OrderAdjustment ledger entries
 * 
 * ✅ Adjustment type enum (locked)
 * ✅ Payment state enum (locked)
 * ✅ Financial delta tracking
 * 
 * 🔥 TIMESTAMP MIGRATION (Phase 1 - Option C)
 * Changed from isoDateStringSchema to firestoreTimestampSchema
 * 
 * EXPORTS: paidStatusSchema (NOT paymentTrackingSchema)
 * 
 * LAST UPDATED: 2026-03-10 (Fixed export naming)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  firestoreTimestampSchema,
  optionalFirestoreTimestampSchema,
  optionalNonEmptyStringSchema,
  positiveAmountSchema,
} from '../shared/primitives';

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT STATE ENUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Payment State - Lifecycle states for adjustment payments
 * ✅ LOCKED: These are the only valid payment states
 */
export const paymentStateSchema = z.enum([
  'unpaid',
  'submitted',
  'confirmed',
]);

export type PaymentState = z.infer<typeof paymentStateSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// ADJUSTMENT TYPE ENUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Adjustment Type Enum
 * ✅ LOCKED: These are the only valid adjustment types
 */
export const adjustmentTypeSchema = z.enum([
  'increase',
  'decrease',
]);

export type AdjustmentType = z.infer<typeof adjustmentTypeSchema>;

/**
 * Adjustment Reason Enum
 * ✅ LOCKED: These are the only valid adjustment reasons
 */
export const adjustmentReasonSchema = z.enum([
  'revision',
]);

export type AdjustmentReason = z.infer<typeof adjustmentReasonSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// NESTED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Paid Status Schema (for increases)
 * Tracks payment lifecycle for additional charges
 */
export const paidStatusSchema = z.object({
  status: paymentStateSchema,
  amount: positiveAmountSchema,
  submittedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  confirmedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  invoiceNumber: optionalNonEmptyStringSchema,
  transferPassword: optionalNonEmptyStringSchema,
  confirmedBy: optionalNonEmptyStringSchema, // Admin email
});

export type PaidStatus = z.infer<typeof paidStatusSchema>;

/**
 * Credit Issued Schema (for decreases)
 * Tracks credit note generation when order is decreased
 */
export const creditIssuedSchema = z.object({
  amount: positiveAmountSchema,
  creditNoteId: idSchema,
  issuedAt: firestoreTimestampSchema, // ✅ TIMESTAMP FIX
});

export type CreditIssued = z.infer<typeof creditIssuedSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// ORDER ADJUSTMENT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Order Adjustment Schema
 * Canonical ledger entry for all order changes after approval
 * 
 * BUSINESS RULE: Each approved revision creates ONE adjustment entry
 */
export const orderAdjustmentSchema = z.object({
  // Identity
  id: idSchema, // e.g., "ADJ-20260127-abc123"
  orderId: idSchema,
  createdAt: firestoreTimestampSchema, // ✅ TIMESTAMP FIX
  type: adjustmentTypeSchema,
  
  // Financial deltas (always positive numbers, direction determined by type)
  deltaSubtotal: positiveAmountSchema,
  deltaGst: positiveAmountSchema,
  deltaTotal: positiveAmountSchema,

  // Legacy / convenience aliases kept for backward-compat
  subtotalChange: z.number().optional(), // alias for deltaSubtotal (positive = increase)
  
  // Source tracking
  reason: adjustmentReasonSchema,
  revisionId: idSchema,
  
  // Payment tracking (for increases)
  paid: paidStatusSchema.optional(),
  paymentReceived: z.boolean().optional(), // legacy field tracking payment confirmation
  
  // Credit tracking (for decreases)
  creditIssued: creditIssuedSchema.optional(),
});

export type OrderAdjustment = z.infer<typeof orderAdjustmentSchema>;

/**
 * Array of Order Adjustments
 */
export const orderAdjustmentsArraySchema = z.array(orderAdjustmentSchema);

export type OrderAdjustmentsArray = z.infer<typeof orderAdjustmentsArraySchema>;