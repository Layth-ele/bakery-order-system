/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORDER REVISION SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schema for OrderRevision change requests
 * 
 * ✅ Revision status enum (locked)
 * ✅ Adjustment type enum (locked)
 * ✅ Financial delta tracking
 * 
 * 
 * EXPORTS: revisionAdjustmentTypeSchema (renamed from adjustmentTypeSchema)
 * 
 * LAST UPDATED: 2026-03-10 (Fixed export naming - renamed to revisionAdjustmentTypeSchema)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  emailSchema,
  firestoreTimestampSchema,
  optionalFirestoreTimestampSchema,
  optionalNonEmptyStringSchema,
  amountSchema,
  positiveAmountSchema,
} from '../shared/primitives';
import { orderItemsArraySchema } from './orderItem.schema';

// ═══════════════════════════════════════════════════════════════════════════
// REVISION STATUS ENUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Revision Status Enum
 * ✅ LOCKED: These are the only valid revision statuses
 */
export const revisionStatusSchema = z.enum([
  'pending_approval',
  'approved',
  'rejected',
]);

export type RevisionStatus = z.infer<typeof revisionStatusSchema>;

/**
 * Adjustment Type for Revision
 * ✅ LOCKED: These are the only valid adjustment types
 */
export const revisionAdjustmentTypeSchema = z.enum([
  'increase',
  'decrease',
  'no_change',
]);

export type RevisionAdjustmentType = z.infer<typeof revisionAdjustmentTypeSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// ORDER REVISION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Order Revision Schema
 * Tracks change requests after order is approved/paid
 */
export const orderRevisionSchema = z.object({
  // Identity
  id: idSchema, // e.g., "REV-20260117-001"
  orderId: idSchema,
  customerId: idSchema,
  
  // Revision content
  proposedItems: orderItemsArraySchema, // New items customer wants
  originalItems: orderItemsArraySchema, // Items before revision
  
  // Financial impact
  originalSubtotal: positiveAmountSchema,
  proposedSubtotal: positiveAmountSchema,
  originalTotal: positiveAmountSchema,
  proposedTotal: positiveAmountSchema,
  difference: amountSchema, // Positive = customer pays more, Negative = gets credit
  adjustmentType: revisionAdjustmentTypeSchema,
  
  // Status & workflow
  status: revisionStatusSchema,
  createdAt: firestoreTimestampSchema, // ✅ TIMESTAMP FIX
  approvedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  approvedBy: emailSchema.optional(), // Admin email
  rejectedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  rejectedBy: emailSchema.optional(), // Admin email
  rejectionReason: optionalNonEmptyStringSchema,
  
  // Generated documents
  differenceInvoiceId: idSchema.optional(), // If increase, invoice for additional payment
  creditNoteId: idSchema.optional(), // If decrease, credit note generated
  
  // Notifications
  customerNotificationId: idSchema.optional(),
  adminNotificationId: idSchema.optional(),
  notificationSent: z.boolean().optional(),
});

export type OrderRevision = z.infer<typeof orderRevisionSchema>;

/**
 * Array of Order Revisions
 */
export const orderRevisionsArraySchema = z.array(orderRevisionSchema);

export type OrderRevisionsArray = z.infer<typeof orderRevisionsArraySchema>;

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// If you're seeing "does not provide an export named 'revisionAdjustmentTypeSchema'",
// clear your browser cache and Vite cache:
// 1. Stop dev server (Ctrl+C)
// 2. rm -rf node_modules/.vite
// 3. npm run dev
// 4. Hard refresh browser (Ctrl+Shift+R)
//
// The export IS here (line 53) - it's a cache issue!
// ═══════════════════════════════════════════════════════════════════════════