/**
 * orderCompletion — pure rules for completing an order (no Firebase).
 *
 * Used by the completeOrder callable + the weekly autoCompleteOrders
 * schedule (orderCompletion.ts in the functions root), and by the web app's
 * countdown timer (deliveryWeekCloseAt), so the "when is this order due"
 * rule exists exactly once.
 *
 *   Due date:  Friday 12:00 (America/Vancouver) of the order's ISO delivery
 *              week (order.year + order.week).
 *   Auto-complete: paid, unlocked, not yet invoiced, active status, due, and
 *              due within the last AUTO_COMPLETE_WINDOW_DAYS (older leftovers
 *              are left for an admin, so a first run can't mass-complete a
 *              backlog).
 */
import { canTransitionOrderStatus } from "./orderLifecycle";

export const COMPLETION_TIME_ZONE = "America/Vancouver";
export const AUTO_COMPLETE_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type Doc = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const money = (v: unknown): number => Math.round(num(Number(v)) * 100) / 100;

// ── Dates ───────────────────────────────────────────────────────────────────

/** Monday (UTC date) of ISO week `week` in ISO year `year`. */
export function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return monday;
}

/** UTC instant of a wall-clock time in Vancouver (handles PST/PDT). */
export function vancouverTimeToUtc(y: number, m: number, d: number, hour: number, minute = 0): Date {
  for (const offsetHours of [7, 8]) {
    const candidate = new Date(Date.UTC(y, m, d, hour + offsetHours, minute));
    const localHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: COMPLETION_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(candidate)
    );
    if (localHour === hour) return candidate;
  }
  return new Date(Date.UTC(y, m, d, hour + 8, minute));
}

/** Friday 12:00 Vancouver of the order's delivery week, or null when unknown. */
export function deliveryWeekCloseAt(year: unknown, week: unknown): Date | null {
  const y = num(year);
  const w = num(week);
  if (!Number.isInteger(y) || !Number.isInteger(w) || y < 2000 || w < 1 || w > 53) return null;
  const friday = isoWeekMonday(y, w);
  friday.setUTCDate(friday.getUTCDate() + 4);
  return vancouverTimeToUtc(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate(), 12);
}

/** Sunday of the delivery week as YYYY-MM-DD (the order's deliveryDate). */
export function deliveryWeekEndDate(year: unknown, week: unknown): string | null {
  const y = num(year);
  const w = num(week);
  if (!Number.isInteger(y) || !Number.isInteger(w) || w < 1 || w > 53) return null;
  const sunday = isoWeekMonday(y, w);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return sunday.toISOString().slice(0, 10);
}

// ── Eligibility ─────────────────────────────────────────────────────────────

/** Statuses the weekly schedule may complete (paid orders still in flight). */
export const AUTO_COMPLETE_STATUSES = ["approved", "in_process", "delivered"] as const;

export type CompletionBlocker =
  | "already_completed"
  | "not_allowed_from_status"
  | "locked";

/** Can this order be completed right now (manually or automatically)? */
export function completionBlocker(order: Doc): CompletionBlocker | null {
  if (order.status === "completed") return "already_completed";
  if (!canTransitionOrderStatus(order.status, "completed")) return "not_allowed_from_status";
  if (order.locked === true) return "locked";
  return null;
}

export function isDueForAutoComplete(order: Doc, now: Date, windowDays = AUTO_COMPLETE_WINDOW_DAYS): boolean {
  if (!(AUTO_COMPLETE_STATUSES as readonly unknown[]).includes(order.status)) return false;
  if (order.paymentReceived !== true || order.finalInvoiceId) return false;
  if (completionBlocker(order)) return false;
  const closeAt = deliveryWeekCloseAt(order.year, order.week);
  if (!closeAt) return false;
  const overdueMs = now.getTime() - closeAt.getTime();
  return overdueMs >= 0 && overdueMs <= windowDays * DAY_MS;
}

// ── Final invoice (port of the web app's finalizeOrderToInvoice) ───────────

interface Adjustment {
  type: "increase" | "decrease";
  deltaTotal: number;
  paidStatus: string;
  paidAmount: number;
  raw: Doc;
}

function normalizeAdjustments(order: Doc, orderId: string): Adjustment[] {
  const list = Array.isArray(order.adjustments) ? (order.adjustments as Doc[]) : [];
  return list.map((a) => {
    const type = a?.type === "decrease" ? "decrease" : "increase";
    const deltaTotal = money(a?.deltaTotal);
    const paid = (a?.paid ?? {}) as Doc;
    return {
      type,
      deltaTotal,
      paidStatus: String(paid.status ?? "unpaid"),
      paidAmount: money(paid.amount ?? Math.abs(deltaTotal)),
      raw: { ...a, orderId: a?.orderId ?? orderId },
    };
  });
}

export interface FinalInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  year: number;
  yearMonth: string;
  isoWeek: number;
  weekKey: string;
  finalTotal: number;
  invoiceStatus: "paid" | "partial" | "unpaid";
  paymentReceived: boolean;
  snapshots: {
    items: unknown[];
    adjustments: Doc[];
    totals: Record<string, number>;
  };
}

/**
 * The final invoice for a completed order. Deterministic id (= order id), so
 * completing twice can never create two invoices.
 */
export function buildFinalInvoice(order: Doc, orderId: string, invoiceNumber: string, now: Date): FinalInvoice {
  const adjustments = normalizeAdjustments(order, orderId);
  const increases = adjustments.filter((a) => a.type === "increase");
  const decreases = adjustments.filter((a) => a.type === "decrease");

  const baseTotal = money(order.total);
  const creditsApplied = money(order.creditApplied ?? order.appliedCredit ?? 0);
  const adjPaidConfirmed = money(increases.filter((a) => a.paidStatus === "confirmed").reduce((s, a) => s + a.paidAmount, 0));
  const adjUnpaid = money(increases.filter((a) => a.paidStatus !== "confirmed").reduce((s, a) => s + a.paidAmount, 0));
  // Reductions after payment (paid-order edits, partial cancellations) were
  // returned as store credit; the order's total already excludes them.
  const editCredits = money(order.creditIssued ?? 0);
  const creditsIssued = money(decreases.reduce((s, a) => s + Math.abs(a.deltaTotal), 0) + editCredits);

  const finalTotal = baseTotal;
  // A paid order's cash payment is its amount due (total minus store credit,
  // plus anything later returned as credit); credit is counted once, as
  // creditsApplied.
  const basePaid = order.paymentReceived === true ? Math.max(0, baseTotal + editCredits - creditsApplied) : 0;
  const totalPaid = money(basePaid + adjPaidConfirmed);
  const balanceDue = money(Math.max(0, finalTotal + editCredits - totalPaid - creditsApplied));
  const invoiceStatus = balanceDue <= 0 ? "paid" : totalPaid > 0 || creditsApplied > 0 ? "partial" : "unpaid";

  const year = num(order.year) || now.getUTCFullYear();
  const isoWeek = num(order.isoWeek) || num(order.week);
  const weekKey = typeof order.weekKey === "string" && order.weekKey ? order.weekKey : `${year}-W${String(isoWeek).padStart(2, "0")}`;
  const yearMonth =
    typeof order.yearMonth === "string" && order.yearMonth
      ? order.yearMonth
      : `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    id: orderId,
    invoiceNumber,
    orderId,
    customerId: String(order.customerId ?? ""),
    customerName: String(order.customerName ?? ""),
    ...(typeof order.customerEmail === "string" ? { customerEmail: order.customerEmail } : {}),
    year,
    yearMonth,
    isoWeek,
    weekKey,
    finalTotal,
    invoiceStatus,
    paymentReceived: invoiceStatus === "paid",
    snapshots: {
      items: Array.isArray(order.items) ? order.items : [],
      adjustments: adjustments.map((a) => a.raw),
      totals: {
        baseSubtotal: money(order.subtotal),
        baseGst: money(order.gst),
        baseTotal,
        finalTotal,
        totalPaid,
        creditsApplied,
        creditsIssued,
        balanceDue,
        adjPaidConfirmed,
        adjUnpaid,
        suppUnpaid: 0,
      },
    },
  };
}

/** Immutable record of the order at completion (orders/{id}/snapshots). */
export function buildCompletionSnapshot(order: Doc, orderId: string, actor: string, finalInvoiceId: string): Doc {
  const adjustments = Array.isArray(order.adjustments) ? (order.adjustments as Doc[]) : [];
  const snapshot: Doc = {
    orderId,
    customerId: String(order.customerId ?? ""),
    trigger: "complete",
    createdBy: actor,
    reason: actor === "auto-scheduler" ? "Auto-completed by system" : `Manually completed by ${actor}`,
    status: "completed",
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: num(order.subtotal),
    gst: num(order.gst),
    deliveryFee: num(order.deliveryFee),
    serviceCharge: num(order.serviceCharge),
    total: num(order.total),
    paymentReceived: order.paymentReceived === true,
    paymentSubmitted: order.paymentSubmitted === true,
    adjustmentsCount: adjustments.length,
    totalAdjustmentsDelta: money(adjustments.reduce((s, a) => s + num(a?.deltaTotal), 0)),
    locked: true,
    finalInvoiceId,
  };
  if (order.discount !== undefined) snapshot.discount = order.discount;
  if (order.discountPercentage !== undefined) snapshot.discountPercentage = order.discountPercentage;
  if (num(order.cancellationFee) > 0) snapshot.cancellationFee = num(order.cancellationFee);
  if (order.creditApplied !== undefined) snapshot.creditApplied = num(order.creditApplied);
  if (order.creditIssued !== undefined) snapshot.creditIssued = num(order.creditIssued);
  if (order.discountNote) snapshot.discountNote = order.discountNote;
  if (order.paidAt !== undefined) snapshot.paidAt = order.paidAt;
  return snapshot;
}
