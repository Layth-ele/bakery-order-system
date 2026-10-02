/**
 * creditNotes — the one shape of a store-credit note, whoever issues it
 * (manual credit, paid-order edit, cancellation, returned credit).
 * Matches the web app's creditNote schema (src/schemas/creditNote).
 *
 * Pure: the caller adds createdAt (server timestamp) and writes it.
 */
import { round2 } from "./orderRevision";

export type CreditNoteType = "refund" | "overpayment" | "admin_edit" | "cancellation";

export interface CreditNoteInput {
  id: string;
  customerId: string;
  /** The order the credit came from; manual credits use the note's own id. */
  orderId?: string;
  amount: number;
  type: CreditNoteType;
  reason: string;
  createdBy: string;
  gstRate: number;
  now: Date;
}

export function creditNoteNumber(id: string, now: Date): string {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `CN-${ymd}-${id.slice(0, 6).toUpperCase()}`;
}

export function buildCreditNote(input: CreditNoteInput): Record<string, unknown> {
  const amount = round2(input.amount);
  const subtotal = round2(amount / (1 + Math.max(0, input.gstRate)));
  const orderId = input.orderId || input.id;
  return {
    customerId: input.customerId,
    orderId,
    sourceOrderId: orderId,
    creditNoteNumber: creditNoteNumber(input.id, input.now),
    amount,
    total: amount,
    subtotal,
    gst: round2(amount - subtotal),
    deliveryFeeAdjustment: 0,
    remainingBalance: amount,
    fullyApplied: false,
    status: "available",
    type: input.type,
    sourceType: input.type,
    reason: input.reason,
    createdBy: input.createdBy,
  };
}
