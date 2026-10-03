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
  /**
   * Fraction of the credit that is GST (0–1). For credit that comes from an
   * order, use gstShareOf(order): the share of GST in what the order charged,
   * since delivery and service charge carry no GST. Manual credit: 0.
   */
  gstShare: number;
  now: Date;
}

/** Share of an order's total that is GST (0 when there is none). */
export function gstShareOf(order: { gst?: unknown; total?: unknown }): number {
  const gst = typeof order.gst === "number" && Number.isFinite(order.gst) ? order.gst : 0;
  const total = typeof order.total === "number" && Number.isFinite(order.total) ? order.total : 0;
  return gst > 0 && total > 0 ? Math.min(1, gst / total) : 0;
}

export function creditNoteNumber(id: string, now: Date): string {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `CN-${ymd}-${id.slice(0, 6).toUpperCase()}`;
}

export function buildCreditNote(input: CreditNoteInput): Record<string, unknown> {
  const amount = round2(input.amount);
  const gst = round2(amount * Math.min(1, Math.max(0, input.gstShare)));
  const subtotal = round2(amount - gst);
  const orderId = input.orderId || input.id;
  return {
    customerId: input.customerId,
    orderId,
    sourceOrderId: orderId,
    creditNoteNumber: creditNoteNumber(input.id, input.now),
    amount,
    total: amount,
    subtotal,
    gst,
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
