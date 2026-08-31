/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INVOICE SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schemas for WeeklyInvoice and PaymentTransaction
 * 
 * ✅ Invoice generation & payment tracking
 * ✅ Payment method enum (locked)
 * ✅ Transaction status tracking
 * 
 * LAST UPDATED: 2026-03-05
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  nonEmptyStringSchema,
  optionalNonEmptyStringSchema,
  emailSchema,
  weekNumberSchema,
  yearSchema,
  positiveAmountSchema,
  optionalUrlSchema,
  firestoreTimestampSchema,         // ✅ TIMESTAMP FIX
  optionalFirestoreTimestampSchema, // ✅ TIMESTAMP FIX
} from '../shared/primitives';

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT METHOD ENUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Payment Method Enum
 * ✅ LOCKED: These are the only valid payment methods
 */
export const paymentMethodSchema = z.enum([
  'cash',
  'credit_card',
  'debit_card',
  'e_transfer',
  'other',
]);

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION STATUS ENUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transaction Status Enum
 * ✅ LOCKED: These are the only valid transaction statuses
 */
export const transactionStatusSchema = z.enum([
  'pending',
  'completed',
  'failed',
  'refunded',
]);

export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY INVOICE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Weekly Invoice Schema
 * Aggregates all orders for a customer in a given week
 */
export const weeklyInvoiceSchema = z.object({
  // Identity
  id: idSchema,
  invoiceNumber: nonEmptyStringSchema, // e.g., "INV-2026-001"
  
  // Customer reference
  customerId: idSchema,
  customerName: nonEmptyStringSchema,
  
  // Week reference
  week: weekNumberSchema,
  year: yearSchema,
  weekRange: nonEmptyStringSchema,
  
  // Orders included in this invoice
  orders: z.array(z.lazy(() => orderSchema)), // Import from order.schema.ts
  
  // Totals
  subtotal: positiveAmountSchema,
  gst: positiveAmountSchema,
  total: positiveAmountSchema,
  
  // Timestamps
  createdAt: firestoreTimestampSchema,         // ✅ TIMESTAMP FIX
  dueDate: firestoreTimestampSchema,           // ✅ TIMESTAMP FIX
  
  // Payment status
  paid: z.boolean(),
  paidAt: optionalFirestoreTimestampSchema,    // ✅ TIMESTAMP FIX
  paymentMethod: paymentMethodSchema.optional(),
  transactionId: idSchema.optional(),
  
  // Notes
  notes: optionalNonEmptyStringSchema,
});

export type WeeklyInvoice = z.infer<typeof weeklyInvoiceSchema>;

// Import Order schema to avoid circular dependency
import { orderSchema } from '../order/order.schema';

/**
 * Array of Weekly Invoices
 */
export const weeklyInvoicesArraySchema = z.array(weeklyInvoiceSchema);

export type WeeklyInvoicesArray = z.infer<typeof weeklyInvoicesArraySchema>;

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT TRANSACTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Payment Transaction Schema
 * Tracks individual payment transactions
 */
export const paymentTransactionSchema = z.object({
  // Identity
  id: idSchema,
  
  // References
  orderId: idSchema.optional(), // Link to specific order
  invoiceId: idSchema.optional(), // Link to invoice
  customerId: idSchema,
  
  // Transaction details
  amount: positiveAmountSchema,
  method: paymentMethodSchema,
  status: transactionStatusSchema,
  
  // Timestamps
  transactionDate: firestoreTimestampSchema,   // ✅ TIMESTAMP FIX
  
  // Processing
  processedBy: emailSchema.optional(), // Admin who processed
  
  // Notes & receipts
  notes: optionalNonEmptyStringSchema,
  receiptUrl: optionalUrlSchema,
});

export type PaymentTransaction = z.infer<typeof paymentTransactionSchema>;

/**
 * Array of Payment Transactions
 */
export const paymentTransactionsArraySchema = z.array(paymentTransactionSchema);

export type PaymentTransactionsArray = z.infer<typeof paymentTransactionsArraySchema>;
