/**
 * Cloud Functions client — typed wrappers for every callable.
 *
 * Business-critical writes (placing, approving, rejecting, cancelling and
 * completing orders, payments, store credit, reminders) happen ONLY in
 * these server functions; the browser never writes them directly.
 *
 * @example
 *   const { orderNumber } = await placeOrderViaCloudFunction({
 *     requestId, week: 40, year: 2026,
 *     items: [{ productId: 'p1', quantities: { monday: 4, tuesday: 0, ... } }],
 *   });
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
// ORDER PLACEMENT
// ============================================

export interface PlaceOrderPayload {
  /** Stable per submission (reuse on retry) — becomes the order id. */
  requestId: string;
  week: number;
  year: number;
  items: Array<{
    productId: string;
    quantities: Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', number>;
  }>;
  note?: string;
  creditToApply?: number;
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
  creditApplied: number;
  amountDue: number;
  duplicate: boolean;
}

/**
 * Customer: place an order. The server prices it, checks cutoffs, applies
 * credit and assigns the order number in one transaction. Idempotent per
 * requestId.
 */
export async function placeOrderViaCloudFunction(payload: PlaceOrderPayload): Promise<PlaceOrderResult> {
  const fn = httpsCallable<PlaceOrderPayload, PlaceOrderResult>(functions, "placeOrder");
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
  customerType?: 'individual' | 'commercial';
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

/**
 * User-facing message for a failed order-action callable.
 *
 * Order actions (approve / reject / cancel / submit & confirm payment) run
 * ONLY in Cloud Functions — there is no client-side fallback, because
 * re-running an action in the browser after a server error could apply it
 * twice (the server may have committed before the error reached us).
 */
export function callableErrorMessage(error: unknown, action: string): string {
  const code = (error as { code?: string })?.code ?? '';
  const message = (error as { message?: string })?.message ?? '';
  switch (code) {
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return `Couldn't reach the server to ${action}. Check your connection, refresh, and try again.`;
    case 'functions/internal':
    case 'functions/unknown':
      return `The server hit an error while trying to ${action}. Refresh to check the order before trying again.`;
    case 'functions/not-found':
      return message && !/^not[ -]found$/i.test(message)
        ? message
        : `The server function to ${action} isn't deployed. Deploy Cloud Functions and try again.`;
    default:
      return message || `Failed to ${action}.`;
  }
}

// ============================================
// PASS 2 — ORDER ACTION FUNCTIONS
// ============================================

export interface ApproveOrderPayload { orderId: string; deliveryFee?: number; }
export interface ApproveOrderResult { success: boolean; orderId: string; total: number; gst: number; amountDue: number; deliveryFee: number; }

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
export interface RejectOrderResult { success: boolean; orderId: string; creditReturned: number; }

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
}
/** `full` false = only some delivery days were cancelled; the order continues. */
export interface CancelOrderResult {
  success: boolean;
  orderId: string;
  full: boolean;
  credit: number;
  fee: number;
  creditNoteId: string | null;
}

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

export interface CompleteOrderPayload { orderId: string; }
export interface CompleteOrderResult {
  status: 'completed' | 'already_completed';
  orderId: string;
  invoiceId: string;
  invoiceNumber: string;
}

/**
 * Admin: complete an order on the server (status + invoice number + invoice
 * + snapshot in one transaction). Idempotent.
 */
export async function completeOrderViaCloudFunction(payload: CompleteOrderPayload): Promise<CompleteOrderResult> {
  const fn = httpsCallable<CompleteOrderPayload, CompleteOrderResult>(functions, "completeOrder");
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

// ============================================
// ORDER EDITS, REMINDERS, STORE CREDIT
// ============================================

export interface DayQuantitiesPayload {
  monday: number; tuesday: number; wednesday: number; thursday: number;
  friday: number; saturday: number; sunday: number;
}

export interface EditOrderPayload {
  orderId: string;
  /** The full edited order: every product with its per-day quantities. */
  items: Array<{
    productId: string;
    quantities: DayQuantitiesPayload;
    /** Only for a custom product added in this edit (productId "custom-…"). */
    custom?: { name: string; price: number };
  }>;
  deliveryFee?: number;
  discount?: { type: 'percentage' | 'fixed'; value: number; note?: string };
}
export interface CallableEmailResult { state: 'sent' | 'skipped' | 'failed'; to: string; reason?: string }
export interface EditOrderResult {
  orderId: string;
  total: number;
  amountDue: number;
  creditReturned: number;
  /** Set for approved orders: the "order updated" email to the customer. */
  email?: CallableEmailResult;
}

/** Admin edits a pending/approved (unpaid) order; the server reprices it. */
export async function editOrderViaCloudFunction(payload: EditOrderPayload): Promise<EditOrderResult> {
  const fn = httpsCallable<EditOrderPayload, EditOrderResult>(functions, "editOrder");
  return (await fn(payload)).data;
}

export interface EditPaidOrderPayload {
  orderId: string;
  items: Array<{ productId: string; quantities: DayQuantitiesPayload }>;
  reason: string;
}
export interface EditPaidOrderResult { orderId: string; total: number; creditIssued: number; creditNoteId: string }

/** Admin reduces a paid order; the difference becomes store credit. */
export async function editPaidOrderViaCloudFunction(payload: EditPaidOrderPayload): Promise<EditPaidOrderResult> {
  const fn = httpsCallable<EditPaidOrderPayload, EditPaidOrderResult>(functions, "editPaidOrder");
  return (await fn(payload)).data;
}

export interface PaymentReminderResult { reminderNumber: number; amountDue: number; email: CallableEmailResult }

/** Admin reminds a customer to pay (in-app notification + email). */
export async function sendPaymentReminderViaCloudFunction(orderId: string): Promise<PaymentReminderResult> {
  const fn = httpsCallable<{ orderId: string }, PaymentReminderResult>(functions, "sendPaymentReminder");
  return (await fn({ orderId })).data;
}

export interface IssueStoreCreditPayload {
  customerId: string;
  amount: number;
  reason: string;
  type?: 'refund' | 'overpayment' | 'admin_edit' | 'cancellation';
}

/** Admin adds store credit to a customer's account (customer is notified). */
export async function issueStoreCreditViaCloudFunction(
  payload: IssueStoreCreditPayload
): Promise<{ creditNoteId: string; amount: number }> {
  const fn = httpsCallable<IssueStoreCreditPayload, { creditNoteId: string; amount: number }>(functions, "issueStoreCredit");
  return (await fn(payload)).data;
}

/** Customer asks for a credit note's balance to be paid out (admin is notified). */
export async function requestCreditPayoutViaCloudFunction(
  creditNoteId: string
): Promise<{ creditNoteId: string; amount: number }> {
  const fn = httpsCallable<{ creditNoteId: string }, { creditNoteId: string; amount: number }>(functions, "requestCreditPayout");
  return (await fn({ creditNoteId })).data;
}
