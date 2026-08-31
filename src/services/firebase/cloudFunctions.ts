/**
 * Cloud Functions Client SDK
 * Wrapper for calling Firebase Cloud Functions from React app
 * 
 * Usage:
 * import { createOrderViaCloudFunction } from '@/services/firebase/cloudFunctions';
 * 
 * const result = await createOrderViaCloudFunction({
 *   customerId: user.id || "",
 *   customerName: (user.storeName ?? ""),
 *   items: cart,
 *   subtotal: 100,
 *   gst: 5,
 *   total: 105
 * });
 * 
 * logger.log("Order ID:", result.id); // "ORD-2026-04-001"
 *
 * ✅ PASS 2 (April 2026): Added wrappers for order action / payment / credit
 *    Cloud Functions. These move business-critical writes off the client.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebase/config";
import { logger } from '../../utils/logger';

// ============================================
// INITIALIZE FUNCTIONS
// ============================================
const functions = getFunctions(app);

// PASS 10: emulator hookup removed from imports — was only referenced from
// the commented-out block below. To re-enable, add `connectFunctionsEmulator`
// back to the import and uncomment the block:
//   if (import.meta.env.DEV) {
//     connectFunctionsEmulator(functions, 'localhost', 5001);
//   }

// ============================================
// ORDER FUNCTIONS
// ============================================

export interface CreateOrderPayload {
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: any[];
  subtotal: number;
  gst: number;
  total: number;
  status?: string;
  weekRange?: string;
  deliveryDays?: any[];
  orderNote?: string;
}

export interface CreateOrderResult {
  id: string; // "ORD-2026-04-001"
}

/**
 * Create order via Cloud Function
 * Server generates sequential order ID
 * 
 * @param payload - Order data
 * @returns {id: "ORD-2026-04-001"}
 * 
 * @example
 * const result = await createOrderViaCloudFunction({
 *   customerId: "user123",
 *   customerName: "ABC Bakery",
 *   customerEmail: "abc@example.com",
 *   items: [{productId: "p1", quantity: 10}],
 *   subtotal: 100,
 *   gst: 5,
 *   total: 105,
 *   status: "pending",
 *   weekRange: "Apr 14-20, 2026",
 *   deliveryDays: []
 * });
 */
export async function createOrderViaCloudFunction(
  payload: CreateOrderPayload
): Promise<CreateOrderResult> {
  const fn = httpsCallable<CreateOrderPayload, CreateOrderResult>(
    functions,
    "createOrderWithCustomId"
  );
  
  const result = await fn(payload);
  return result.data;
}

// ============================================
// CUSTOMER FUNCTIONS
// ============================================

export interface CreateCustomerPayload {
  uid: string;
  email: string;
  storeName: string;
  contactPerson?: string;
  phone?: string;
  storeAddress?: string;
}

export interface CreateCustomerResult {
  id: string; // Firebase Auth UID
  customerCode: string; // "CUST-2026-04-001"
}

/**
 * Create customer via Cloud Function
 * Server generates sequential customer code
 * 
 * NOTE: Document ID is Firebase Auth UID
 * Customer code is stored as a field for human-readable reference
 * 
 * @param payload - Customer data
 * @returns {id: "firebaseAuthUid", customerCode: "CUST-2026-04-001"}
 * 
 * @example
 * const result = await createCustomerViaCloudFunction({
 *   uid: "firebase_auth_uid_123",
 *   email: "customer@example.com",
 *   storeName: "ABC Bakery",
 *   contactPerson: "John Smith",
 *   phone: "604-123-4567",
 *   storeAddress: "123 Main St"
 * });
 */
export async function createCustomerViaCloudFunction(
  payload: CreateCustomerPayload
): Promise<CreateCustomerResult> {
  const fn = httpsCallable<CreateCustomerPayload, CreateCustomerResult>(
    functions,
    "createCustomerWithCode"
  );
  
  const result = await fn(payload);
  return result.data;
}

// ============================================
// INVOICE FUNCTIONS
// ============================================

export interface CreateInvoicePayload {
  customerId: string;
  customerName: string;
  subtotal: number;
  gst: number;
  total: number;
  orderIds?: string[];
  week?: number;
  year?: number;
}

export interface CreateInvoiceResult {
  id: string; // e.g. "DBH-2026-03-26-000001"
  invoiceNumber: string; // e.g. "DBH-2026-03-26-000001" (same as id)
}

/**
 * Create invoice via Cloud Function
 * Server generates sequential invoice number
 * 
 * @param payload - Invoice data
 * @returns {id: "DBH-2026-03-26-000001", invoiceNumber: "DBH-2026-03-26-000001"}
 * 
 * @example
 * const result = await createInvoiceViaCloudFunction({
 *   customerId: "user123",
 *   customerName: "ABC Bakery",
 *   subtotal: 500,
 *   gst: 25,
 *   total: 525,
 *   orderIds: ["ORD-2026-04-001", "ORD-2026-04-002"],
 *   week: 16,
 *   year: 2026
 * });
 */
export async function createInvoiceViaCloudFunction(
  payload: CreateInvoicePayload
): Promise<CreateInvoiceResult> {
  const fn = httpsCallable<CreateInvoicePayload, CreateInvoiceResult>(
    functions,
    "createInvoiceWithCustomId"
  );
  
  const result = await fn(payload);
  return result.data;
}

// ============================================
// PASS 2 — ORDER ACTION FUNCTIONS
// ============================================

export interface ApproveOrderPayload { orderId: string; deliveryFee?: number; }
export interface ApproveOrderResult { success: boolean; orderId: string; total: number; gst: number; deliveryFee: number; }

/**
 * ✅ PASS 2: Approve order via Cloud Function (server-enforced state transition).
 */
export async function approveOrderViaCloudFunction(
  payload: ApproveOrderPayload
): Promise<ApproveOrderResult> {
  const fn = httpsCallable<ApproveOrderPayload, ApproveOrderResult>(functions, "approveOrder");
  const result = await fn(payload);
  return result.data;
}

export interface RejectOrderPayload { orderId: string; reason?: string; }
export interface RejectOrderResult { success: boolean; orderId: string; }

/**
 * ✅ PASS 2: Reject order via Cloud Function.
 */
export async function rejectOrderViaCloudFunction(
  payload: RejectOrderPayload
): Promise<RejectOrderResult> {
  const fn = httpsCallable<RejectOrderPayload, RejectOrderResult>(functions, "rejectOrder");
  const result = await fn(payload);
  return result.data;
}

export interface CancelOrderPayload {
  orderId: string;
  reason: string;
  cancelledDays?: string[];
  cancellationFeePercentage?: number;
  creditAmount?: number;
}
export interface CancelOrderResult { success: boolean; orderId: string; }

/**
 * ✅ PASS 2: Cancel order via Cloud Function.
 * Atomic: status flip + voided invoice record + status audit are committed together.
 */
export async function cancelOrderViaCloudFunction(
  payload: CancelOrderPayload
): Promise<CancelOrderResult> {
  const fn = httpsCallable<CancelOrderPayload, CancelOrderResult>(functions, "cancelOrder");
  const result = await fn(payload);
  return result.data;
}

// ============================================
// PASS 2 — PAYMENT FUNCTIONS
// ============================================

export interface SubmitPaymentProofPayload {
  orderId: string;
  paymentMethod: "etransfer" | "credit" | "cash" | "cheque" | string;
  paymentReference?: string;
  transferPassword?: string;
}
export interface SubmitPaymentProofResult { success: boolean; orderId: string; }

/**
 * ✅ PASS 2: Customer-callable. Submits payment proof for an approved order.
 * Replaces direct customer updateOrder() writes for payment fields.
 */
export async function submitPaymentProofViaCloudFunction(
  payload: SubmitPaymentProofPayload
): Promise<SubmitPaymentProofResult> {
  const fn = httpsCallable<SubmitPaymentProofPayload, SubmitPaymentProofResult>(
    functions,
    "submitPaymentProof"
  );
  const result = await fn(payload);
  return result.data;
}

export interface ConfirmOrderPaymentPayload { orderId: string; invoiceNumber?: string; }
export interface ConfirmOrderPaymentResult { success: boolean; orderId: string; }

/**
 * ✅ PASS 2: Admin-callable. Confirms payment received → in_process.
 */
export async function confirmOrderPaymentViaCloudFunction(
  payload: ConfirmOrderPaymentPayload
): Promise<ConfirmOrderPaymentResult> {
  const fn = httpsCallable<ConfirmOrderPaymentPayload, ConfirmOrderPaymentResult>(
    functions,
    "confirmOrderPayment"
  );
  const result = await fn(payload);
  return result.data;
}

// ============================================
// PASS 2 — CREDIT FUNCTIONS
// ============================================

export interface ApplyOrderCreditPayload { orderId: string; amount: number; }
export interface ApplyOrderCreditResult {
  success: boolean;
  orderId: string;
  appliedAmount: number;
  newCreditApplied: number;
  newAmountDue: number;
}

/**
 * ✅ PASS 2: Customer-callable. Applies credit FIFO across the customer's
 * available credit notes, atomically updates order.creditApplied / amountDue,
 * and writes the application history record — all in a single transaction.
 *
 * After this Cloud Function is the sole credit-application path, the Firestore
 * rule on creditNotes can deny ALL customer writes (Pass 2 rules update).
 */
export async function applyOrderCreditViaCloudFunction(
  payload: ApplyOrderCreditPayload
): Promise<ApplyOrderCreditResult> {
  const fn = httpsCallable<ApplyOrderCreditPayload, ApplyOrderCreditResult>(
    functions,
    "applyOrderCredit"
  );
  const result = await fn(payload);
  return result.data;
}
