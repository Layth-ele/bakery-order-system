/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORDER SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Complete Order schema with all nested types
 * 
 * ✅ Order status enum (locked)
 * ✅ Payment tracking
 * ✅ Revision & adjustment system
 * ✅ Firestore Timestamp enforcement
 * 
 * Changed from isoDateStringSchema to firestoreTimestampSchema for all timestamps
 * 
 * 🔥 MAR 13, 2026: deliveryDate now uses flexibleDateSchema (accepts both string and Timestamp)
 * Fixed validation error where Firestore stored deliveryDate as Timestamp but schema expected string
 * 
 * 🔥 MAR 17, 2026: Snapshots migrated to subcollections, input schemas restored
 * 
 * LAST UPDATED: 2026-03-17
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import { orderStatusSchema, snapshotTriggerSchema } from './orderEnums.schema';
import type { OrderStatus, SnapshotTrigger } from './orderEnums.schema';
export { orderSnapshotSchema } from './orderSnapshot.schema';
export type { OrderSnapshot } from './orderSnapshot.schema';
export { orderStatusSchema, snapshotTriggerSchema } from './orderEnums.schema';
export type { OrderStatus, SnapshotTrigger } from './orderEnums.schema';
import {
  idSchema,
  emailSchema,
  nonEmptyStringSchema,
  optionalNonEmptyStringSchema,
  firestoreTimestampSchema,
  optionalFirestoreTimestampSchema,
  weekNumberSchema,
  yearSchema,
  weekKeySchema,
  yearMonthSchema,
  positiveAmountSchema,
  optionalPercentageSchema,
  optionalFlexibleDateSchema, // Added for deliveryDate field
} from '../shared/primitives';
import { orderItemsArraySchema } from './orderItem.schema';
import { orderAdjustmentsArraySchema } from './orderAdjustment.schema';
import { creditApplicationsArraySchema } from './creditApplication.schema';
import { creditNoteSchema } from '../creditNote/creditNote.schema'; // ✅ Circular dependency import

// ═══════════════════════════════════════════════════════════════════════════
// ORDER STATUS ENUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Order Status Enum
 * ✅ LOCKED: These are the only valid order statuses
 * ❌ Removed legacy 'complete' status (use 'completed' instead)
 */
// orderStatusSchema moved to orderEnums.schema.ts

// ═══════════════════════════════════════════════════════════════════════════
// ORDER SNAPSHOT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Snapshot Trigger Enum
 */
// snapshotTriggerSchema moved to orderEnums.schema.ts

/**
 * Order Snapshot Schema
 * Captures complete order state at key lifecycle moments
 */
// ═══════════════════════════════════════════════════════════════════════════
// ORDER SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete Order Schema
 */
export const orderSchema = z.object({
  // Identity
  id: idSchema,
  customerId: idSchema,
  customerName: nonEmptyStringSchema,
  customerAddress: nonEmptyStringSchema,
  customerContactPerson: nonEmptyStringSchema,
  customerPhone: z.string().optional(),   // Accept empty strings for orders with no phone
  
  // Week information
  week: weekNumberSchema,
  year: yearSchema.optional(),
  weekRange: nonEmptyStringSchema.optional(), // Computed display field — not always stored
  
  // Searchable metadata fields (for optimized Firestore queries)
  invoiceNumber: optionalNonEmptyStringSchema.nullable().optional(),
  yearMonth: yearMonthSchema.optional(),
  weekKey: weekKeySchema.optional(),
  isoWeek: weekNumberSchema.optional(),
  deliveryDate: optionalFlexibleDateSchema, // Use flexible date schema (accepts both string and Timestamp)
  completedAt: optionalFirestoreTimestampSchema, // TIMESTAMP FIX - was optionalNonEmptyStringSchema.nullable()
  expiresAt: optionalNonEmptyStringSchema.nullable(),
  customerEmail: emailSchema.optional(),
  
  // Items & pricing
  items: orderItemsArraySchema,
  subtotal: positiveAmountSchema,
  discount: positiveAmountSchema.optional(), // Admin discount amount (flat dollar amount)
  discountPercentage: optionalPercentageSchema, // Admin discount percentage (0-100)
  discountNote: z.string().nullable().optional(), // Admin note explaining the discount (can be empty)
  discountAppliedBy: emailSchema.optional(), // Email of admin who applied the discount
  gst: positiveAmountSchema, // 5% GST on subtotal only
  deliveryFee: positiveAmountSchema,
  serviceCharge: positiveAmountSchema, // $3.99 per order
  serviceChargeWaived: z.boolean(), // Admin can waive this
  total: positiveAmountSchema,
  
  // Order status & lifecycle
  status: orderStatusSchema,
  createdAt: firestoreTimestampSchema, // ✅ TIMESTAMP FIX
  updatedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  updatedBy: emailSchema.optional(), // Email of admin who updated it
  
  // Order Source Tracking
  // Track whether order was placed by customer or admin
  placedByCustomer: z.boolean().optional(), // true = customer placed, false/undefined = admin placed
  
  // Update request system
  updateRequested: z.boolean().optional(),
  updateRequestedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  originalItems: orderItemsArraySchema.optional(),
  originalSubtotal: positiveAmountSchema.optional(),
  originalTotal: positiveAmountSchema.optional(),
  originalDeliveryFee: positiveAmountSchema.optional(),
  originalStatus: optionalNonEmptyStringSchema.nullable(),
  quantitiesUpdated: z.boolean().optional(),
  
  // Approval tracking
  approvedBy: emailSchema.optional(),
  approvedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  
  // Rejection tracking
  rejectedBy: emailSchema.optional(),
  rejectedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  rejectionReason: optionalNonEmptyStringSchema.nullable(),
  
  // Cancellation tracking
  cancelledBy: idSchema.optional(), // User ID who cancelled
  cancelledAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  cancellationReason: optionalNonEmptyStringSchema.nullable(),
  cancellationFee: positiveAmountSchema.optional(),
  cancellationFeePercentage: optionalPercentageSchema,
  cancelledByAdminEmail: emailSchema.optional(),
  cancelledDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(), // Track which days were cancelled
  creditAmount: positiveAmountSchema.optional(), // Credit issued to customer for cancellation
  
  // Notes - allow any string including empty, or undefined
  note: z.string().optional(),
  internalNote: z.string().nullable().optional(), // Admin-only notes
  // FIX T2R7-H2 (HIGH): Was z.string() — accepted any text. The Cloud
  // Function `submitPaymentProof` validates against the enum below, but
  // direct customer writes (under the post-T2R7-C3 rule) bypassed CF
  // validation. Enum here ensures schema-validated writes match the CF.
  // 'E-Transfer'/'Cheque' shown as comments — actual values are lowercase
  // tokens matching CF expectations.
  paymentMethod: z.enum(['etransfer', 'credit', 'cash', 'cheque']).nullable().optional(),
  
  // Payment Reminder System
  paymentReminderCount: z.number().int().nonnegative().optional(),
  lastReminderSentAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  emailReminderCount: z.number().int().nonnegative().optional(),
  lastEmailReminderSentAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  
  // Payment Submission System
  paymentSubmitted: z.boolean().optional(),
  paymentSubmittedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  // FIX T2R7-H3 (HIGH): Was optionalNonEmptyStringSchema.nullable() with
  // no max length. A customer submitting payment proof could set
  // transferPassword to a 900KB string, pushing the order doc near the
  // 1MB Firestore limit and locking the doc. E-transfer security answers
  // are typically <30 chars; 200 is generous and well below any abuse
  // threshold.
  transferPassword: z.string().min(1).max(200).nullable().optional(),
  paymentProofUrl: z.string().nullable().optional(), // URL to uploaded payment proof image
  
  // Payment Verification System
  paymentReceived: z.boolean().optional(),
  paidAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  paymentReceivedAt: optionalFirestoreTimestampSchema, // When payment was received/confirmed
  paidBy: emailSchema.optional(), // Admin who confirmed payment
  
  // Update Approval System
  updateApprovedBy: emailSchema.optional(),
  updateApprovedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  
  // ❌ REMOVED: Revision & Credit Note System (revisions removed, creditNotes kept)
  creditNotes: z.array(z.lazy(() => creditNoteSchema)).optional(), // Import from creditNote.schema.ts
  
  // Credit Application
  appliedCredit: positiveAmountSchema.optional(),
  creditApplications: creditApplicationsArraySchema.optional(),
  
  // OrderAdjustments Ledger
  adjustments: orderAdjustmentsArraySchema.optional(),
  
  // Order Lifecycle Timestamps & Locking
  locked: z.boolean().optional(),
  finalizedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  weekCloseAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  
  // Final Invoice
  finalInvoiceId: idSchema.optional(),
  
  // Production Tracking
  productionNeedsReprint: z.boolean().optional(),
  productionLastPrintedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  lastAdjustmentConfirmedAt: optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
  
  // ❌ REMOVED: Order Lifecycle Snapshots (migrated to subcollection orders/{orderId}/snapshots/* on MAR 17, 2026)
  // snapshots field removed from schema to prevent 1MB document limit
  // Use getOrderSnapshots(orderId) from firebase/firestore/snapshots.ts to retrieve snapshots
  // Legacy: kept as optional any[] for backward-compat with code that still accesses order.snapshots
  snapshots: z.array(z.any()).optional(),

  // Legacy / convenience fields kept for backward-compat
  deliveryAddress: z.string().optional(),
  customerType: z.string().nullable().optional(), // 'commercial' | 'individual' — lives on Customer, mirrored here
  notes: z.string().nullable().optional(), // alias for note field

  // Financial legacy fields
  creditApplied: positiveAmountSchema.optional(),  // credit applied to this order
  finalTotal: positiveAmountSchema.optional(),      // final total after all adjustments
  totalAmount: positiveAmountSchema.optional(),     // legacy alias for total
  serviceFee: positiveAmountSchema.optional(),      // service charge alias
  amountDue: positiveAmountSchema.optional(),       // outstanding balance

  // Order tracking legacy fields
  orderNumber: z.string().nullable().optional(),               // human-readable order number
  paymentStatus: z.string().nullable().optional(),             // legacy payment status field
  
  // Delivery fields
  deliveryWeek: z.number().int().nonnegative().optional(),
  deliveryYear: z.number().int().nonnegative().optional(),
  startDate: z.string().nullable().optional(),                 // delivery period start
  phoneNumber: z.string().nullable().optional(),               // alias for customerPhone

  // Invoice/billing legacy fields
  paymentTransactions: z.array(z.any()).optional(),      // legacy payment transactions
  month: z.number().optional(),                          // billing month
  monthRange: z.string().nullable().optional(),                     // billing month range string
  paymentReference: z.string().nullable().optional(),               // e-transfer reference number
  weekYear: z.string().nullable().optional(),                       // combined week+year string e.g. "2026-W12"
  creditAppliedAt: z.string().nullable().optional(),                // when credit was applied
  invoiceId: z.string().nullable().optional(),                      // linked invoice ID
  paid: z.boolean().optional(),                          // whether order has been paid

  // Strict mode: unknown fields stripped, not written to Firestore
});

export type Order = z.infer<typeof orderSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// INPUT SCHEMAS FOR WRITES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Input schema for creating new orders
 * This is used by Firebase write functions to validate data before write
 */
export const createOrderInputSchema = orderSchema
  .extend({
    // Override BEFORE partial — Zod applies extends in order
    customerPhone: z.string().optional(),          // Accept empty strings — no format validation on create
    customerAddress: z.string().optional(),         // Accept any address string
    customerContactPerson: z.string().optional(),   // Optional contact person
    id: z.string().optional(),                      // Generated server-side
  })
  .partial({
    id: true,
    weekRange: true,
    yearMonth: true,
    weekKey: true,
    invoiceNumber: true,
    createdAt: true,
    updatedAt: true,
  }).strip();

/**
 * Input schema for updating existing orders
 * Makes most fields optional since updates can be partial
 */
export const updateOrderInputSchema = orderSchema.partial().strip();

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;