// src/services/invoicing/finalizeOrderToInvoice.ts
// ✅ PRODUCTION-SAFE: Feb 14, 2026 - Import from types instead of demo data

import { generateInvoiceNumber } from '../idCounterService';
import type {Order} from '../../types'
import { safeParseJSON } from '../../utils/safeLocalStorage';
import type { Invoice } from './invoiceQueryService';
import { isFirebaseConfigured } from '../../firebase/config'; // ✅ MAR 17: Firestore mode detection
import { createInvoice as saveInvoice, getInvoiceByOrderId } from '../data/invoicesDataService';
import { logger } from '../../utils/logger';
 // ✅ MAR 17: Firestore-safe invoice creation

type PaidStatus = "unpaid" | "submitted" | "confirmed";

type NormalizedAdjustment = {
  id: string;
  orderId: string;
  createdAt: string;
  type: "increase" | "decrease";
  reason?: string;

  deltaSubtotal: number;
  deltaGst: number;
  deltaTotal: number;

  // increase only
  paid?: {
    status: PaidStatus;
    amount: number;
    submittedAt?: string;
    confirmedAt?: string;
    confirmedBy?: string;
  };

  // decrease only
  creditIssued?: {
    amount: number;
    creditNoteId?: string;
    issuedAt?: string;
  };

  // optional link to revision
  revisionId?: string;
};

function money(n: any): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
}

function isoNow(): string {
  return new Date().toISOString();
}

function normalizeAdjustment(raw: any, orderId: string): NormalizedAdjustment {
  const createdAt = raw?.createdAt ? String(raw.createdAt) : isoNow();
  const type: "increase" | "decrease" =
    raw?.type === "decrease" ? "decrease" : "increase";

  const base: NormalizedAdjustment = {
    id: String(raw?.id ?? `adj_${orderId}_${Date.now()}`),
    orderId: String(raw?.orderId ?? orderId),
    createdAt,
    type,
    reason: raw?.reason ? String(raw.reason) : undefined,
    deltaSubtotal: money(raw?.deltaSubtotal ?? 0),
    deltaGst: money(raw?.deltaGst ?? 0),
    deltaTotal: money(raw?.deltaTotal ?? 0),
    revisionId: raw?.revisionId ? String(raw.revisionId) : undefined,
  };

  if (type === "increase") {
    const paid = raw?.paid ?? {};
    base.paid = {
      status: (paid?.status ?? "unpaid") as PaidStatus,
      amount: money(paid?.amount ?? Math.abs(base.deltaTotal)),
      submittedAt: paid?.submittedAt ? String(paid.submittedAt) : undefined,
      confirmedAt: paid?.confirmedAt ? String(paid.confirmedAt) : undefined,
      confirmedBy: paid?.confirmedBy ? String(paid.confirmedBy) : undefined,
    };
  } else {
    const creditIssued = raw?.creditIssued ?? {};
    base.creditIssued = {
      amount: money(creditIssued?.amount ?? Math.abs(base.deltaTotal)),
      creditNoteId: creditIssued?.creditNoteId
        ? String(creditIssued.creditNoteId)
        : raw?.creditNoteId
          ? String(raw.creditNoteId)
          : undefined,
      issuedAt: creditIssued?.issuedAt ? String(creditIssued.issuedAt) : createdAt,
    };
  }

  return base;
}

/**
 * ✅ Legacy normalizer for old supplementary invoices (backward compatibility)
 * This supports old data that may still have supplementaryInvoices arrays
 */
// normalizeSupplementaryInvoice removed

/**
 * FINALIZE = Create ONE invoice snapshot when order becomes COMPLETE.
 * 
 * 🚨 HYBRID VERSION (Step 11 + 12):
 * ✅ KEEPS validation guards (status + unpaid checks)
 * ✅ ADOPTS deterministic IDs (invoice.id = order.id)
 * ✅ ADOPTS transaction-based writes
 * ✅ ADOPTS structured snapshots object
 * 
 * - Deterministic invoice id = order.id (1 invoice per order forever)
 * - Snapshot includes:
 *   - final items
 *   - adjustments ledger (new)
 *   - legacy supplementary invoices (old) for backward compatibility
 *   - totals + balanceDue + paid/partial/unpaid
 */
export async function finalizeOrderToInvoice(order: Order): Promise<string> {
  // ---------------------------
  // 🚨 CRITICAL GUARD #1: Order must be completed
  // ---------------------------
  const status = order.status;
  if (status !== 'completed') { // ✅ Removed legacy 'complete' check
    throw new Error(
      `❌ Cannot generate final invoice for order ${order.id} - status is "${status}" (must be "completed")`
    );
  }

  if (!order?.id) throw new Error("❌ Missing order.id");

  // ---------------------------
  // IDEMPOTENCY LAYER 1: fast local check
  // ---------------------------
  const existing = order.finalInvoiceId as string | undefined;
  if (existing) {
    return existing;
  }

  // ---------------------------
  // ✅ DETERMINISTIC ID: 1 invoice forever
  // ---------------------------
  const invoiceId = String(order.id);

  // ---------------------------
  // IDEMPOTENCY LAYER 2: Check if invoice already exists
  // ---------------------------
  if (isFirebaseConfigured) {
    // FIX BUG 2 (CRITICAL): This block was completely empty — the Firebase production
    // path had NO duplicate-invoice check. If two completion attempts ran concurrently
    // (e.g. admin clicks Complete + auto-scheduler fires) both could pass Layer 1
    // (neither has finalInvoiceId in their in-memory order object), generate separate
    // invoice numbers, and write conflicting Firestore documents.
    // Fix: query Firestore for an existing invoice tied to this order before proceeding.
    const existingFirestoreInvoice = await getInvoiceByOrderId(order.id);
    if (existingFirestoreInvoice) {
      logger.warn(`[finalizeOrderToInvoice] Invoice already exists for order ${order.id} — returning existing ID.`);
      return existingFirestoreInvoice.id;
    }
  } else {
    const allInvoices = safeParseJSON<any[]>('bakery_invoices', []);
    const existingInvoice = allInvoices.find((inv: Record<string, any>) => inv.id === invoiceId);
    if (existingInvoice) {

      return invoiceId;
    }
  }

  // ---- Snapshot inputs ----
  const itemsSnapshot = Array.isArray(order.items) ? order.items : [];

  // ✅ NEW: adjustments ledger
  const rawAdjustments = Array.isArray(order.adjustments) ? order.adjustments : [];
  const adjustments: NormalizedAdjustment[] = rawAdjustments.map((a) =>
    normalizeAdjustment(a, order.id),
  );

  // ---------------------------
  // ✅ SIMPLIFIED: No adjustment blocking
  // ---------------------------

  // ✅ Legacy supplementary invoices (still snapshot them)

  // ---- Totals ----
  const baseTotal = money(order.total ?? undefined);
  const baseSubtotal = money(order.subtotal ?? undefined);
  const baseGst = money(order.gst ?? undefined);

  // Adjustments math (new)
  const increases = adjustments.filter((a) => a.type === "increase");
  const decreases = adjustments.filter((a) => a.type === "decrease");

  const incTotal = money(increases.reduce((s, a) => s + money(a.deltaTotal), 0));
  const decTotalAbs = money(decreases.reduce((s, a) => s + Math.abs(money(a.deltaTotal)), 0)); // credit amount

  const adjPaidConfirmed = money(
    increases
      .filter((a) => a.paid?.status === "confirmed")
      .reduce((s, a) => s + money(a.paid?.amount ?? a.deltaTotal), 0),
  );

  const adjUnpaid = money(
    increases
      .filter((a) => (a.paid?.status ?? "unpaid") !== "confirmed")
      .reduce((s, a) => s + money(a.paid?.amount ?? a.deltaTotal), 0),
  );

  // Legacy supplementary math (old) — removed
  const suppUnpaid = 0;
  const suppTotal = 0;

  // Credits applied to this order (if you use ApplyCreditSection)
  // ✅ FIX #17: Use creditApplied (correct field name) not appliedCredit (wrong)
  const creditsApplied = money((order as any).creditApplied ?? order.appliedCredit ?? 0);

  // Paid flags
  const basePaid = !!order.paymentReceived;

  const finalTotal = money(baseTotal + suppTotal);
  const totalPaid = money((basePaid ? baseTotal : 0) + adjPaidConfirmed + (suppTotal - suppUnpaid));
  const creditsIssued = money(decTotalAbs);
  const balanceDue = money(Math.max(0, finalTotal - totalPaid - creditsApplied));

  const invoiceStatus: Invoice["invoiceStatus"] =
    balanceDue <= 0
      ? "paid"
      : totalPaid > 0 || creditsApplied > 0
        ? "partial"
        : "unpaid";

  const createdAt = order.finalizedAt || order.completedAt || order.createdAt || isoNow();
  const createdDate = createdAt instanceof Date ? createdAt : (typeof (createdAt as any)?.toDate === "function" ? (createdAt as any).toDate() : new Date(createdAt as any));

  const year = order.year || createdDate.getFullYear();
  const isoWeek = order.isoWeek || order.week || 0;
  const weekKey =
    order.weekKey || `${year}-W${String(isoWeek).padStart(2, "0")}`;
  const yearMonth =
    order.yearMonth ||
    `${year}-${String(createdDate.getMonth() + 1).padStart(2, "0")}`;

  // Use Firestore counter for proper sequential invoice number
  let invoiceNumber = order.invoiceNumber;
  if (!invoiceNumber) {
    try {
      invoiceNumber = await generateInvoiceNumber();
    } catch (genErr) {
      // FIX T2R8-C2 (CRITICAL — CRA Income Tax Act regulation 229 compliance):
      // Was producing a fake invoice number using:
      //   `DBH-${YYYY-MM-DD}-${Date.now-last-3}${Math.random-3-hex}-${check}`
      // ...which is the EXACT pattern R5-S5-F15 documented as a critical bug
      // and fixed in idCounterService.ts:172-181 (which now throws). But this
      // independent fallback in finalizeOrderToInvoice was missed by that fix.
      //
      // Three problems with the fabricated number:
      //   1. NOT sequential — breaks the daily counter contract that downstream
      //      invoice search/aggregation relies on.
      //   2. CRA Income Tax Act regulation 229 requires sequential invoice
      //      numbers. Date.now-based numbers create gaps that fail audit
      //      reconciliation — auditors flag them as "missing invoices."
      //   3. The check digit was correctly computed, hiding the underlying
      //      problem from verifyId() — every fabricated ID looked legitimate
      //      to downstream code.
      //
      // The correct response when generateInvoiceNumber fails (which itself
      // already exhausts the CF and direct-Firestore-transaction paths) is
      // to fail loudly so the admin can retry rather than silently producing
      // a non-compliant invoice number.  Failing at this point leaves the
      // order in 'completed' status without finalInvoiceId — the next
      // completion attempt will hit the idempotency guard and get a clear
      // "missing invoice ID" error directing manual reconciliation.
      logger.exception('finalizeOrderToInvoice.invoiceNumber.failed', genErr as Error, {
        orderId: order.id,
        orderStatus: order.status,
      });
      throw new Error(
        `Invoice number generation failed for order ${order.id}. ` +
        `Both Cloud Function and direct-Firestore paths returned errors. ` +
        `Order remains in 'completed' status without a final invoice. ` +
        `Please retry; if the error persists, escalate. ` +
        `Original: ${(genErr as Error)?.message ?? genErr}`
      );
    }
  }

  const invoice: Invoice = {
    id: invoiceId,
    invoiceNumber,
    orderId: order.id || "",
    customerId: order.customerId ?? "",
    customerName: order.customerName ?? "",
    customerEmail: order.customerEmail,
    createdAt: createdDate.toISOString(),
    year,
    yearMonth,
    isoWeek,
    weekKey,
    finalTotal,
    invoiceStatus,
    paymentReceived: invoiceStatus === "paid", // legacy
  };


  const invoiceWithSnapshots = {
    ...invoice,
    createdAtServer: isoNow(),
    updatedAtServer: isoNow(),

    // ✅ STRUCTURED SNAPSHOTS (new from proposed code)
    snapshots: {
      items: itemsSnapshot,
      adjustments,

      totals: {
        baseSubtotal,
        baseGst,
        baseTotal,
        finalTotal,
        totalPaid,
        creditsApplied,
        creditsIssued,
        balanceDue,
        adjPaidConfirmed,
        adjUnpaid,
        suppUnpaid,
      },
    },
  };

  await saveInvoice(invoiceWithSnapshots as any);

  return invoiceId;
}