/**
 * placeOrder — the ONLY way an order is created.
 *
 * The browser sends just what the customer chose (products + quantities per
 * day, week, note, credit to use). Everything that matters is decided here,
 * from server data:
 *   - who the customer is and that their account is approved
 *   - that every delivery day in the order is still open (48 h before noon)
 *   - prices from the live catalogue (wholesale vs retail by account type,
 *     product discount) — the same prices the order screen shows
 *   - GST, service charge and estimated delivery fee from Settings
 *   - the sequential order number, and any store credit (FIFO)
 * all in ONE transaction, so an order is never half-created and never
 * created twice: the client's requestId is the order's document id, making
 * retries return the original order.
 *
 * Money rules: see lib/orderPlacement.ts (total excludes credit;
 * amountDue = total − creditApplied).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { reserveDailyId } from "./idGenerator";
import { requireApprovedCustomer } from "./_shared";
import {
  PlacementError,
  allocateCredit,
  amountDueOf,
  closedDaysInOrder,
  parsePlaceOrderInput,
  priceOrder,
  type CatalogProduct,
  type CreditNoteBalance,
  type PriceTier,
} from "./lib/orderPlacement";
import {
  resolveDeliveryFee,
  resolveFreeDeliveryMin,
  resolveServiceCharge,
  resolveTaxRate,
} from "./lib/settingsValues";

const db = getFirestore();

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
  creditApplied: number;
  amountDue: number;
  /** true when this requestId had already created the order (a retry). */
  duplicate: boolean;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const placeOrder = onCall(async (request): Promise<PlaceOrderResult> => {
  const caller = await requireApprovedCustomer(request);

  let input;
  try {
    input = parsePlaceOrderInput(request.data);
  } catch (err) {
    if (err instanceof PlacementError) throw new HttpsError(err.code, err.message);
    throw err;
  }

  const closed = closedDaysInOrder(input, new Date());
  if (closed.length > 0) {
    const days = closed.map((d) => DAY_LABELS[d]).join(", ");
    throw new HttpsError(
      "failed-precondition",
      `Ordering has closed for ${days} of week ${input.week}. Please remove ${closed.length > 1 ? "those days" : "that day"} or choose another week.`
    );
  }

  // Reads that don't need transactional isolation.
  const [customerSnap, generalSnap, legacySnap, productSnaps] = await Promise.all([
    db.doc(`customers/${caller.uid}`).get(),
    db.doc("settings/general").get(),
    db.doc("settings/default").get(),
    db.getAll(...input.items.map((it) => db.doc(`products/${it.productId}`))),
  ]);
  const customer = customerSnap.data() ?? {};
  const general = generalSnap.data();
  const legacy = legacySnap.data();
  const catalog = new Map<string, CatalogProduct | undefined>(
    productSnaps.map((s) => [s.id, s.exists ? (s.data() as CatalogProduct) : undefined])
  );

  let priced;
  try {
    priced = priceOrder(input, catalog, {
      tier: (customer.customerType === "commercial" ? "commercial" : "individual") as PriceTier,
      gstRate: resolveTaxRate(general, legacy),
      serviceCharge: resolveServiceCharge(general, legacy),
      deliveryFee: resolveDeliveryFee(general, legacy),
      freeDeliveryMin: resolveFreeDeliveryMin(general, legacy),
    });
  } catch (err) {
    if (err instanceof PlacementError) throw new HttpsError(err.code, err.message);
    throw err;
  }

  const orderRef = db.collection("orders").doc(input.requestId);
  const creditQuery = db
    .collection("creditNotes")
    .where("customerId", "==", caller.uid)
    .where("status", "in", ["available", "partially_used"]);

  const result = await db.runTransaction(async (tx): Promise<PlaceOrderResult> => {
    // ── Reads (all before any write) ──
    const existing = await tx.get(orderRef);
    if (existing.exists) {
      const o = existing.data() ?? {};
      if (o.customerId !== caller.uid) {
        throw new HttpsError("already-exists", "This request id is already in use.");
      }
      return {
        orderId: existing.id,
        orderNumber: String(o.orderNumber ?? ""),
        total: Number(o.total ?? 0),
        creditApplied: Number(o.creditApplied ?? 0),
        amountDue: Number(o.amountDue ?? o.total ?? 0),
        duplicate: true,
      };
    }

    let credit = { applied: 0, deductions: [] as Array<{ id: string; used: number; newBalance: number }> };
    if (input.creditToApply > 0) {
      const notesSnap = await tx.get(creditQuery);
      // Credit with a payout requested is reserved for the payout.
      const notes: CreditNoteBalance[] = notesSnap.docs.filter((d) => d.data().payoutRequested !== true).map((d) => ({
        id: d.id,
        remaining: Number(d.data().remainingBalance ?? d.data().amount ?? 0),
        createdAtMs: d.data().createdAt?.toMillis?.() ?? 0,
      }));
      try {
        credit = allocateCredit(notes, input.creditToApply, priced.total);
      } catch (err) {
        if (err instanceof PlacementError) throw new HttpsError(err.code, err.message);
        throw err;
      }
    }

    const orderNumber = await reserveDailyId(tx, "ORD"); // reads + writes the counter

    // ── Writes ──
    for (const d of credit.deductions) {
      tx.update(db.doc(`creditNotes/${d.id}`), {
        remainingBalance: d.newBalance,
        status: d.newBalance <= 0 ? "fully_used" : "partially_used",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (credit.applied > 0) {
      tx.set(db.collection("creditApplicationHistory").doc(), {
        orderId: orderRef.id,
        orderNumber,
        customerId: caller.uid,
        amount: credit.applied,
        appliedNotes: credit.deductions.map((d) => ({ id: d.id, amountUsed: d.used, newBalance: d.newBalance })),
        appliedBy: caller.uid,
        appliedAt: FieldValue.serverTimestamp(),
      });
    }

    const amountDue = amountDueOf(priced.total, credit.applied);
    const now = new Date();
    tx.set(orderRef, {
      orderNumber,
      customerId: caller.uid,
      ...(str(customer.customerCode) ? { customerCode: str(customer.customerCode) } : {}),
      customerName: str(customer.storeName) || str(customer.contactPerson) || caller.email,
      customerEmail: str(customer.email) || caller.email,
      customerAddress: str(customer.storeAddress) || str(customer.address) || "Address not provided",
      customerContactPerson: str(customer.contactPerson) || str(customer.storeName),
      customerPhone: str(customer.phone),
      week: input.week,
      year: input.year,
      weekRange: `Week ${input.week}, ${input.year}`,
      yearMonth: `${input.year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
      items: priced.items,
      subtotal: priced.subtotal,
      gst: priced.gst,
      deliveryFee: priced.deliveryFee,
      serviceCharge: priced.serviceCharge,
      serviceChargeWaived: false,
      total: priced.total,
      creditApplied: credit.applied,
      amountDue,
      status: "pending",
      paymentReceived: false,
      paymentSubmitted: false,
      note: input.note,
      placedByCustomer: true,
      createdBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      orderId: orderRef.id,
      orderNumber,
      total: priced.total,
      creditApplied: credit.applied,
      amountDue,
      duplicate: false,
    };
  });

  if (!result.duplicate) {
    console.log(`[placeOrder] ${result.orderNumber} (${result.orderId}) by ${caller.uid}: total ${result.total}, credit ${result.creditApplied}`);
  }
  return result;
});
