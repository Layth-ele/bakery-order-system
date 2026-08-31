/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CREDIT NOTE SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schema for CreditNote (generated when order is decreased)
 * 
 * ✅ Credit tracking
 * ✅ Payout request workflow
 * ✅ Application tracking
 * 
 * LAST UPDATED: 2026-03-10
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  nonEmptyStringSchema,
  optionalNonEmptyStringSchema,
  emailSchema,
  positiveAmountSchema,
  firestoreTimestampSchema,       // ✅ TIMESTAMP FIX: Accepts Firestore Timestamps
  optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX: Optional version
} from '../shared/primitives';
import { orderItemsArraySchema } from '../order/orderItem.schema';

// ═══════════════════════════════════════════════════════════════════════════
// PAYOUT METHOD ENUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Payout Method Enum
 * ✅ LOCKED: These are the only valid payout methods
 */
export const payoutMethodSchema = z.enum([
  'bank_transfer',
  'cash',
  'check',
  'credit_balance', // Applied to future orders
]);

export type PayoutMethod = z.infer<typeof payoutMethodSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT NOTE STATUS & TYPE (backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Credit Note Status
 * ✅ Backward compatibility with old creditService.ts
 */
export const creditNoteStatusSchema = z.enum([
  'available',
  'partially_used',
  'fully_used',
  'paid_out',
]);

export type CreditNoteStatus = z.infer<typeof creditNoteStatusSchema>;

/**
 * Credit Note Type
 * ✅ Backward compatibility with old creditService.ts
 */
export const creditNoteTypeSchema = z.enum([
  'refund',
  'overpayment',
  'admin_edit',
  'cancellation',
]);

export type CreditNoteType = z.infer<typeof creditNoteTypeSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT NOTE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base Credit Note Schema (without refinements)
 * Used for .omit() and .partial() operations
 */
export const baseCreditNoteSchema = z.object({
  // Identity
  id: idSchema, // e.g., "CN-20260117-001"
  customerId: idSchema, // ✅ Customer this credit belongs to
  orderId: idSchema,
  revisionId: idSchema.optional(), // If from a revision
  creditNoteNumber: nonEmptyStringSchema, // Display number (e.g., "CN-001-001")
  
  // ✅ BACKWARD COMPATIBILITY: Legacy fields from old creditService.ts
  sourceOrderId: idSchema.optional(), // Alias for orderId (backward compatibility)
  amount: positiveAmountSchema.optional(), // Alias for total (backward compatibility)
  status: creditNoteStatusSchema.optional(), // Legacy status field (backward compatibility)
  type: creditNoteTypeSchema.optional(), // Legacy type field (backward compatibility)
  reason: optionalNonEmptyStringSchema, // Reason for credit issuance
  editedBy: optionalNonEmptyStringSchema, // Alias for createdBy (backward compatibility)
  
  // Credit details
  removedItems: orderItemsArraySchema.optional(), // ✅ Optional for manual credits (empty array won't pass orderItemsArraySchema.min(1))
  subtotal: positiveAmountSchema, // Amount credited (before GST)
  gst: positiveAmountSchema, // GST amount credited
  deliveryFeeAdjustment: positiveAmountSchema, // Delivery fee adjustment if any
  total: positiveAmountSchema, // Total credit amount
  
  // Status & metadata
  createdAt: firestoreTimestampSchema,    // ✅ TIMESTAMP FIX: Firestore stores as Timestamp
  createdBy: nonEmptyStringSchema, // Admin email or customer ID who triggered it
  appliedToOrders: z.array(idSchema).optional(), // Order IDs where credit was applied
  remainingBalance: positiveAmountSchema, // Unused credit amount
  fullyApplied: z.boolean(), // True if all credit used
  
  // Payout (if customer requests cash refund)
  payoutRequested: z.boolean().optional(),
  payoutRequestedAt: optionalFirestoreTimestampSchema,
  payoutApproved: z.boolean().optional(),
  payoutApprovedAt: optionalFirestoreTimestampSchema,
  payoutApprovedBy: emailSchema.optional(), // Admin email
  payoutCompletedAt: optionalFirestoreTimestampSchema,
  payoutMethod: payoutMethodSchema.optional(),
  payoutNote: optionalNonEmptyStringSchema, // e.g., "3-7 business days policy note"
  
  // Notifications
  customerNotificationId: idSchema.optional(),
  adminNotificationId: idSchema.optional(),
  notificationSent: z.boolean().optional(),
});

/**
 * Credit Note Schema (with refinements)
 * Generated when order is decreased (opposite of SupplementaryInvoice)
 * Tracks refunds/credits owed to customer
 */
export const creditNoteSchema = baseCreditNoteSchema.refine(
  (data) => data.remainingBalance <= data.total,
  {
    message: 'Remaining balance cannot exceed total credit amount',
    path: ['remainingBalance'],
  }
).refine(
  (data) => {
    // If fullyApplied is true, remainingBalance must be 0
    if (data.fullyApplied) {
      return data.remainingBalance === 0;
    }
    return true;
  },
  {
    message: 'Fully applied credits must have zero remaining balance',
    path: ['fullyApplied'],
  }
);

export type CreditNote = z.infer<typeof creditNoteSchema>;

/**
 * Array of Credit Notes
 */
export const creditNotesArraySchema = z.array(creditNoteSchema);

export type CreditNotesArray = z.infer<typeof creditNotesArraySchema>;