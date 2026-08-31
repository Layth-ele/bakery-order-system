/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CREDIT APPLICATION SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schema for CreditApplication (tracks how credit was applied to an order)
 * 
 * ✅ Partial credit application
 * ✅ Full audit trail
 * 
 * LAST UPDATED: 2026-03-05
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  nonEmptyStringSchema,
  positiveAmountSchema,
  firestoreTimestampSchema, // ✅ TIMESTAMP FIX
} from '../shared/primitives';

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT APPLICATION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Credit Application Schema
 * Tracks how credit was applied to an order
 * Allows partial credit application and full audit trail
 */
export const creditApplicationSchema = z.object({
  creditNoteId: idSchema, // Which credit note was used
  creditNoteNumber: nonEmptyStringSchema, // Display number for reference (e.g., "CN-001-001")
  amountApplied: positiveAmountSchema, // How much credit was used
  appliedAt: firestoreTimestampSchema, // ✅ TIMESTAMP FIX: Firestore stores as Timestamp
  orderId: idSchema, // Order where credit was applied
});

export type CreditApplication = z.infer<typeof creditApplicationSchema>;

/**
 * Array of Credit Applications
 */
export const creditApplicationsArraySchema = z.array(creditApplicationSchema);

export type CreditApplicationsArray = z.infer<typeof creditApplicationsArraySchema>;
