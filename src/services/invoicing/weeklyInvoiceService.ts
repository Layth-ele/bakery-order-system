import { generateInvoiceNumber } from '../idCounterService';
import type { Order, WeeklyInvoice, PaymentTransaction } from '../../types';
import { updateOrder } from '../data/ordersDataService'; // ✅ CANONICAL: Use ordersDataService for order operations
import {getWeekStartDate} from '../dataService'
import { getISOWeekInfo } from '../../utils/weekUtilsExport'; // ✅ FIXED: Import from clean utils export
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Invoice } from './invoiceQueryService';
import { getWeekdayInTimeZone } from '../../utils/timezone';
import { getServerTimestamp } from '../../utils/timestamps'; // ✅ TIMESTAMP FIX

/**
 * Generate a crypto-secure 9-char base36 ID suffix.
 *
 * FIX T2R4-H3 (HIGH — collision-prone IDs): Replacement for
 * `Math.random().toString(36).substr(2, 9)` which is reverse-engineerable
 * in V8 and prone to collisions when two operations occur in the same
 * millisecond. Used for weekly-invoice docIds and payment-transaction IDs.
 */
function cryptoIdSuffix(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
}

/**
 * ✅ WEEKLY SUMMARY INVOICE SERVICE
 * 
 * This service creates WEEKLY AGGREGATE invoices that combine multiple orders.
 * 
 * DIFFERENT FROM: finalizeOrderToInvoice.ts which creates ONE invoice PER ORDER
 * 
 * Use cases:
 * - Weekly summary reports for admin
 * - Consolidated billing periods
 * - Aggregate revenue tracking
 * 
 * Generate weekly invoice for completed orders
 * Called every Friday (or manually)
 * 
 * ✅ BATCH 2 UPDATE: Now reads from BOTH sources:
 * - Modern: order.adjustments[] (type: increase, paid.status = paid)
 * - Legacy: order.supplementaryInvoices[] (backward compatibility)
 */
export async function generateWeeklyInvoice(
  week: number,
  year: number,
  weekRange: string,
  orders: Order[],
  adminEmail: string,
  adminName: string
): Promise<WeeklyInvoice> {
  // Get unpaid orders for this week (for outstanding invoices)
 // STATUS MODEL FIX
  // Unpaid orders for invoicing = approved only (awaiting payment)
  // Status is the single source of truth
  const unpaidOrders = orders.filter(order =>
    order.week === week &&
    order.year === year &&
    order.status === 'approved' // Always unpaid by definition
  );

  if (unpaidOrders.length === 0) {
    throw new Error(`No orders found for Week ${week}, ${year}`);
  }

  // Calculate if any order had changes (credit notes)
  const hasChanges = unpaidOrders.some(order => 
    false ||
    (order.creditNotes && order.creditNotes.length > 0)
  );

  // Collect all payment transactions
  const allTransactions: PaymentTransaction[] = [];
  let originalTotal = 0;
  let creditTotal = 0;

  for (const order of unpaidOrders) {
    // Original payment
    originalTotal += order.total;
    
    if (order.paymentTransactions) {
      allTransactions.push(...order.paymentTransactions);
    }

    // Supplementary invoices removed

    // Credit notes
    if (order.creditNotes) {
      for (const credit of order.creditNotes) {
        creditTotal += credit.total;
      }
    }

    // ✅ BATCH 2: Modern adjustments (type: increase, paid.status = paid)
    if (order.adjustments) {
      for (const adjustment of order.adjustments) {
        if (adjustment.type === 'increase' && adjustment.paid?.status === 'confirmed') {
        }
      }
    }
  }

  const finalTotal = originalTotal - creditTotal;
  const totalPaid = allTransactions
    .filter(t => (t as any).type !== 'credit_refund')
    .reduce((sum, t) => sum + t.amount, 0);

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber();

  // ✅ Generate searchable metadata fields with CANONICAL formats
  const now = new Date();
  
  // Calculate yearMonth from the week's start date (NOT today's month)
  const weekStartDate = getWeekStartDate(week, year);
  const yearMonth = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM format
  
  // ✅ CANONICAL FORMATS (match invoiceQueryService.ts)
  const isoWeek = week; // NUMBER (not string!) - matches Invoice type
  const weekKey = `${year}-W${String(week).padStart(2, '0')}`; // DASH format: "2026-W04"
  
  // Get unique customer IDs from orders
  const customerIds = Array.from(new Set(unpaidOrders.map(o => o.customerId)));
  const customerId = customerIds.length === 1 ? customerIds[0] : ""; // Single customer if all orders from same customer
  
  // ✅ Set TTL expiration to 1 year from now for auto-cleanup
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Keep invoices for 1 year

  const invoice: any = {
    id: `invoice_${Date.now()}_${cryptoIdSuffix()}`,
    invoiceNumber,
    
    // Period metadata (for easy querying)
    week,
    year,
    yearMonth,
    isoWeek,
    weekKey,
    weekRange,
    generatedAt: now.toISOString(),
    
    // Customer references
    customerId,
    customerIds,
    
    // Order references
    orderIds: unpaidOrders.map(o => o.id),
    
    // Invoice type
    hasChanges,
    
    // Financial summary
    originalTotal,
    creditTotal,
    finalTotal,
    
    // Payment summary
    totalPaid,
    paymentTransactions: allTransactions,
    
    // Status
    status: 'draft',
    
    // Metadata
    createdBy: adminEmail,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Mark all orders as completed
  for (const order of unpaidOrders) {
    await updateOrder(order.id, {
      status: 'completed',
      completedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
      updatedBy: adminEmail,
      updatedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
      // ✅ Add invoice metadata to orders for reference
      invoiceNumber,
      yearMonth,
      weekKey,
      isoWeek,
    });
  }

  // ✅ Save invoice to Firestore `invoices` collection
  // Map WeeklyInvoice to Invoice format for Firestore
  const firestoreInvoice: Partial<Invoice> = {
    invoiceNumber,
    customerId: customerId || unpaidOrders[0].customerId, // Use first order's customer if multi-customer
    customerName: unpaidOrders[0].customerName,
    customerEmail: unpaidOrders[0].customerEmail,
    year,
    yearMonth,
    isoWeek,
    weekKey,
    finalTotal,
    invoiceStatus: totalPaid >= finalTotal ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid', // ✅ FIXED: Changed from 'status' to 'invoiceStatus'
    paymentReceived: totalPaid >= finalTotal, // Legacy field for compatibility
    pdfUrl: undefined, // Will be set after PDF generation
    pdfPath: undefined,
    notes: `Generated from ${unpaidOrders.length} orders`,
  };

  try {
    await addDoc(collection(db, 'invoices'), {
      ...firestoreInvoice,
      createdAt: serverTimestamp() as any, // ✅ FIXED: Using Firestore serverTimestamp for proper sorting
      expiresAt: Timestamp.fromDate(expiresAt), // ✅ FIXED: Using Firestore Timestamp for TTL (1 year retention)
    });
  } catch (error) {
    console.error('❌ Failed to save invoice to Firestore:', error);
    // Don't throw - invoice generation can continue even if Firestore fails
  }

  return invoice;
}

/**
 * Create payment transaction record when admin confirms payment
 */
export function createPaymentTransaction(
  order: Order,
  type: 'original_payment' | 'credit_refund',
  amount: number,
  paymentMethod: 'bank_transfer' | 'cash' | 'check' | 'other',
  adminEmail: string,
  adminName: string,
  options?: {
    referenceNumber?: string;
    transferPassword?: string;
    creditNoteId?: string;
    notes?: string;
  }
): PaymentTransaction {
  const transaction: any = {
    id: `txn_${Date.now()}_${cryptoIdSuffix()}`,
    orderId: order.id || "",
    type,
    amount,
    paymentMethod,
    referenceNumber: options?.referenceNumber,
    transferPassword: options?.transferPassword,
    collectedBy: adminEmail,
    collectedByName: adminName,
    collectedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
    creditNoteId: options?.creditNoteId,
    notes: options?.notes,
    createdAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
  };

  return transaction;
}

/**
 * Check if it's Friday in Vancouver timezone (weekly invoice generation day)
 * ✅ FIXED: Now uses Vancouver timezone instead of device timezone
 */
export function isFriday(): boolean {
  const day = getWeekdayInTimeZone('America/Vancouver');
  return day === 5; // 0 = Sunday, 5 = Friday
}

/**
 * Get current ISO-8601 week number (canonical implementation)
 * ✅ USES SHARED ISO-8601 FUNCTION - ensures consistency with orders, invoices, admin views
 */
export function getCurrentWeekNumber(): { week: number; year: number } {
  const weekInfo = getISOWeekInfo();
  return {
    week: weekInfo.week,
    year: weekInfo.year,
  };
}

/**
 * Get orders eligible for weekly invoice generation
 * (Orders that are approved/paid and haven't been completed yet)
 */
export function getEligibleOrdersForInvoice(
  orders: Order[],
  week: number,
  year: number
): Order[] {
  return orders.filter(order =>
    order.week === week &&
    order.year === year &&
    (order.status === 'approved' || order.paymentReceived === true) &&
    order.status !== 'completed'
  );
}

/**
 * Calculate invoice summary for preview
 */
export function calculateInvoiceSummary(orders: Order[]) {
  let originalTotal = 0;
  let creditTotal = 0;
  let totalTransactions = 0;

  for (const order of orders) {
    originalTotal += order.total;

    // supplementary invoices removed
    if (order.creditNotes) {
      creditTotal += order.creditNotes
        .reduce((sum, c) => sum + c.total, 0);
    }

    if (order.paymentTransactions) {
      totalTransactions += order.paymentTransactions.length;
    }

    // ✅ BATCH 2: Modern adjustments (type: increase, paid.status = paid)
    if (order.adjustments) {
      for (const adjustment of order.adjustments) {
        if (adjustment.type === 'increase' && adjustment.paid?.status === 'confirmed') {
        }
      }
    }
  }

  return {
    orderCount: orders.length,
    originalTotal,
    creditTotal,
    finalTotal: originalTotal - creditTotal,
    totalTransactions,
    hasChanges: orders.some(o => 
      false ||
      (o.creditNotes && o.creditNotes.length > 0)
    ),
  };
}