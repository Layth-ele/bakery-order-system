/**
 * orderSnapshot.schema.ts
 * Separated to avoid esbuild duplicate-key warnings when co-located with order.schema.ts
 */
import { z } from 'zod';
import {
  idSchema,
  firestoreTimestampSchema,
  optionalFirestoreTimestampSchema,
  nonEmptyStringSchema,
  optionalNonEmptyStringSchema,
  positiveAmountSchema,
} from '../shared/primitives';
import { orderItemSchema } from './orderItem.schema';
import { orderStatusSchema, snapshotTriggerSchema } from './orderEnums.schema';

export const orderSnapshotSchema = z.object({
  // Identity
  id: idSchema,
  orderId: idSchema,
  // ✅ PASS 4 (M2): Denormalized customerId so the Firestore rule on
  // orders/{orderId}/snapshots/{snapId} no longer needs a parent-doc get()
  // to verify ownership. Existing docs will lack this field — the rule
  // falls back to the legacy parent-get() path when customerId is missing,
  // and a one-time backfill (see backfillSnapshotCustomerId.ts) populates
  // historical snapshots.
  customerId: idSchema.optional(),
  createdAt: firestoreTimestampSchema, // ✅ TIMESTAMP FIX
  createdBy: nonEmptyStringSchema, // Customer ID or admin email
  
  // Change metadata
  // Use .catch() to gracefully handle legacy trigger values
  // was tightened. Without .catch(), any order with an old snapshot trigger value
  // fails the entire order validation and gets silently dropped from the UI.
  trigger: snapshotTriggerSchema.catch('payment'),
  reason: optionalNonEmptyStringSchema,
  
  // Complete order state at this moment
  status: orderStatusSchema,
  // Use z.array(...).optional() NOT orderItemsArraySchema.optional()
  // orderItemsArraySchema carries .min(1) — so an empty array `[]` stored in a legacy
  // snapshot still fails even though the field is marked optional. Snapshots legitimately
  // store empty-array items when taken for cancelled/rejected orders or during migration.
  // The .min(1) constraint is correct for live order items but NOT for historical snapshots.
  items: z.array(orderItemSchema).optional(),
  subtotal: positiveAmountSchema,
  gst: positiveAmountSchema,
  deliveryFee: positiveAmountSchema,
  serviceCharge: positiveAmountSchema,
  discount: positiveAmountSchema.optional(),
  discountNote: optionalNonEmptyStringSchema,
  total: positiveAmountSchema,
  
  // Payment state at snapshot time
  paymentReceived: z.boolean().optional(),
  paymentSubmitted: z.boolean().optional(),
  paidAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  paymentReceivedAt: optionalFirestoreTimestampSchema, // When payment was received/confirmed
  
  // Adjustments state
  adjustmentsCount: z.number().int().nonnegative().optional(),
  totalAdjustmentsDelta: positiveAmountSchema.optional(),
  
  // Lifecycle flags
  locked: z.boolean().optional(),
  finalInvoiceId: idSchema.optional(),
});

export type OrderSnapshot = z.infer<typeof orderSnapshotSchema>;

