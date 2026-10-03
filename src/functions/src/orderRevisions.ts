/**
 * Order edits by an admin — the only way an order's items or prices change
 * after it is placed.
 *
 *   editOrder      pending / approved, not yet paid: change quantities, add
 *                  products, set the delivery fee and discount. Totals are
 *                  recomputed here; store credit the smaller order no longer
 *                  needs goes back to the customer. Approved orders: the
 *                  customer is notified (in-app + email) of the new amount due.
 *   editPaidOrder  paid (in_process): reduce quantities only; the difference
 *                  is issued as store credit, with edit history, an order
 *                  snapshot and a customer notification — one transaction.
 *
 * Pricing rules: lib/orderRevision.ts (shared with the admin screens).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAdmin, getTaxRate, getFreeDeliveryMin, getDeliveryFee } from "./_shared";
import { WITH_EMAIL, emailOrderUpdated, type EmailCallResult } from "./emails";
import { createNotificationInTx } from "./notify";
import { orderUpdatedNotification, orderReducedNotification } from "./lib/accountNotifications";
import { buildCreditNote, gstShareOf } from "./lib/creditNotes";
import { DAYS, deliveryNoon, unitPriceFor, type CatalogProduct, type PriceTier } from "./lib/orderPlacement";
import {
  RevisionError,
  autoDeliveryFee,
  diffItems,
  effectiveGstRate,
  itemQuantity,
  normalizeItems,
  orderTotals,
  parseRequestedItems,
  reduceItems,
  reducedTotals,
  round2,
  type RevisionItem,
} from "./lib/orderRevision";

const db = getFirestore();

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function asHttps(err: unknown): never {
  if (err instanceof RevisionError) throw new HttpsError(err.code, err.message);
  throw err;
}

function orderIdOf(data: unknown): string {
  const id = (data as any)?.orderId;
  if (typeof id !== "string" || !id || id.includes("/")) throw new HttpsError("invalid-argument", "orderId is required.");
  return id;
}

export function orderRefFields(orderId: string, o: Record<string, unknown>) {
  return {
    orderId,
    orderNumber: str(o.orderNumber) || orderId,
    weekRange: str(o.weekRange) || (o.week ? `Week ${o.week}, ${o.year}` : ""),
    customerId: str(o.customerId),
    customerName: str(o.customerName) || str(o.storeName),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// editOrder — unpaid orders
// ─────────────────────────────────────────────────────────────────────────────

interface DiscountInput {
  type: "percentage" | "fixed";
  value: number;
  note?: string;
}

function parseDiscount(raw: unknown): DiscountInput | undefined {
  if (raw === undefined || raw === null) return undefined;
  const d = raw as Record<string, unknown>;
  const type = d.type === "percentage" ? "percentage" : d.type === "fixed" ? "fixed" : null;
  const value = Number(d.value ?? 0);
  if (!type) throw new HttpsError("invalid-argument", "discount.type must be percentage or fixed.");
  if (!Number.isFinite(value) || value < 0 || (type === "percentage" && value > 100)) {
    throw new HttpsError("invalid-argument", "Invalid discount value.");
  }
  return { type, value: round2(value), note: str(d.note).slice(0, 500) };
}

export interface EditOrderResult {
  orderId: string;
  total: number;
  amountDue: number;
  creditReturned: number;
  email?: EmailCallResult;
}

export const editOrder = onCall(WITH_EMAIL, async (request): Promise<EditOrderResult> => {
  const admin = await requireAdmin(request);
  const orderId = orderIdOf(request.data);
  let requested;
  try {
    requested = parseRequestedItems((request.data as any)?.items);
  } catch (err) {
    asHttps(err);
  }
  if (!requested.some((r) => itemQuantity(r.quantities) > 0)) {
    throw new HttpsError("invalid-argument", "An order needs at least one item. Cancel the order instead.");
  }
  const rawFee = (request.data as any)?.deliveryFee;
  if (rawFee !== undefined && (typeof rawFee !== "number" || !Number.isFinite(rawFee) || rawFee < 0 || rawFee > 10_000)) {
    throw new HttpsError("invalid-argument", "Invalid delivery fee.");
  }
  const discount = parseDiscount((request.data as any)?.discount);

  const orderRef = db.doc(`orders/${orderId}`);
  const [gstRate, freeDeliveryMin, standardDeliveryFee] = await Promise.all([getTaxRate(), getFreeDeliveryMin(), getDeliveryFee()]);

  const result = await db.runTransaction(async (tx) => {
    // ── Reads ──
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snap.data() ?? {};
    if (!["pending", "approved"].includes(String(order.status))) {
      throw new HttpsError("failed-precondition", "Only pending or approved (unpaid) orders can be edited here.");
    }
    if (order.paymentReceived === true || order.paymentSubmitted === true) {
      throw new HttpsError(
        "failed-precondition",
        "The customer has already submitted payment for this order. Confirm the payment first, then use the paid-order edit."
      );
    }
    const before = normalizeItems(order.items);
    // A day already over can't get more (it wasn't baked) — only less.
    const over = DAYS.filter((d) => Date.now() >= deliveryNoon(Number(order.year), Number(order.week), d).getTime());
    for (const r of requested) {
      const was = before.find((it) => it.productId === r.productId);
      const grew = over.filter((d) => (r.quantities[d] ?? 0) > (was?.[d] ?? 0));
      if (grew.length > 0) {
        throw new HttpsError("failed-precondition", `${grew.map((d) => d[0].toUpperCase() + d.slice(1)).join(", ")} ${grew.length > 1 ? "have" : "has"} already passed — quantities for ${grew.length > 1 ? "those days" : "that day"} can only be reduced.`);
      }
    }
    const newIds = requested
      .filter((r) => !r.custom && !before.some((it) => it.productId === r.productId))
      .map((r) => r.productId);
    const [customerSnap, ...productSnaps] = await Promise.all([
      tx.get(db.doc(`customers/${str(order.customerId) || "_"}`)),
      ...newIds.map((id) => tx.get(db.doc(`products/${id}`))),
    ]);
    const tier: PriceTier = customerSnap.data()?.customerType === "commercial" ? "commercial" : "individual";
    const catalog = new Map(productSnaps.map((s) => [s.id, s.exists ? (s.data() as CatalogProduct) : undefined]));

    // ── Price ──
    const items: RevisionItem[] = [];
    for (const r of requested) {
      const total = itemQuantity(r.quantities);
      if (total === 0) continue;
      const existing = before.find((it) => it.productId === r.productId);
      if (existing) {
        items.push({ ...existing, ...r.quantities, total });
        continue;
      }
      if (r.custom) {
        items.push({ productId: r.productId, productName: r.custom.name, price: r.custom.price, ...r.quantities, total, isCustom: true } as RevisionItem);
        continue;
      }
      const product = catalog.get(r.productId);
      if (!product) throw new HttpsError("failed-precondition", "A product you added no longer exists.");
      const price = unitPriceFor(product, tier);
      if (price <= 0) throw new HttpsError("failed-precondition", `${String(product.name ?? "A product")} has no price set.`);
      items.push({ productId: r.productId, productName: String(product.name ?? "Product"), price, ...r.quantities, total });
    }

    const discountFields = discount
      ? {
          discount: discount.type === "fixed" ? discount.value : 0,
          discountPercentage: discount.type === "percentage" ? discount.value : 0,
          discountType: discount.type,
          discountNote: discount.note ?? "",
        }
      : {};
    // No fee from the admin → free delivery is re-checked for the new subtotal.
    const priced = { ...order, ...discountFields };
    const noFee = orderTotals(items, priced, gstRate, { deliveryFee: 0 });
    const deliveryFee =
      rawFee !== undefined
        ? rawFee
        : autoDeliveryFee(round2(noFee.subtotal - noFee.discountAmount), order.deliveryFee, {
            freeDeliveryMin,
            deliveryFee: standardDeliveryFee,
          });
    const totals = orderTotals(items, priced, gstRate, { deliveryFee });

    const creditBefore = round2(num(order.creditApplied));
    const creditApplied = round2(Math.min(creditBefore, totals.total));
    const creditReturned = round2(creditBefore - creditApplied);
    const amountDue = round2(Math.max(0, totals.total - creditApplied));
    const changes = diffItems(before, items);

    // ── Writes ──
    const historyRef = db.collection("orderEditHistory").doc();
    let creditNoteId: string | null = null;
    if (creditReturned > 0) {
      const noteRef = db.collection("creditNotes").doc();
      creditNoteId = noteRef.id;
      tx.set(noteRef, {
        ...buildCreditNote({
          id: noteRef.id,
          customerId: str(order.customerId),
          orderId,
          amount: creditReturned,
          type: "refund",
          reason: "Order updated — store credit no longer needed on this order",
          createdBy: admin.email,
          gstShare: gstShareOf(order),
          now: new Date(),
        }),
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const updates = {
      items,
      subtotal: totals.subtotal,
      gst: totals.gst,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      creditApplied,
      amountDue,
      ...discountFields,
      editedBy: admin.email,
      editedAt: FieldValue.serverTimestamp(),
      editCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.update(orderRef, updates);
    tx.set(historyRef, {
      orderId,
      customerId: str(order.customerId),
      kind: "edit",
      status: order.status,
      editedBy: admin.email,
      editedAt: FieldValue.serverTimestamp(),
      reason: "Order updated by admin",
      changesSummary: `${changes.length} item(s) changed`,
      originalTotal: round2(num(order.total)),
      newTotal: totals.total,
      creditIssued: creditReturned,
      ...(creditNoteId ? { creditNoteId } : {}),
      itemsChanged: changes,
    });
    if (order.status === "approved" && str(order.customerId)) {
      createNotificationInTx(
        tx,
        orderUpdatedNotification(orderRefFields(orderId, order), historyRef.id, amountDue, creditReturned)
      );
    }
    return {
      status: String(order.status),
      editId: historyRef.id,
      after: { ...order, ...updates, items, total: totals.total, amountDue, creditApplied },
      total: totals.total,
      amountDue,
      creditReturned,
    };
  });

  let email: EmailCallResult | undefined;
  if (result.status === "approved") {
    email = await emailOrderUpdated(orderId, result.after, result.editId, admin.email);
  }
  console.log(`[editOrder] ${orderId} by ${admin.email}: total ${result.total}, due ${result.amountDue}, credit returned ${result.creditReturned}`);
  return { orderId, total: result.total, amountDue: result.amountDue, creditReturned: result.creditReturned, email };
});

// ─────────────────────────────────────────────────────────────────────────────
// editPaidOrder — reduce a paid order, issue the difference as store credit
// ─────────────────────────────────────────────────────────────────────────────

export interface EditPaidOrderResult {
  orderId: string;
  total: number;
  creditIssued: number;
  creditNoteId: string;
}

export const editPaidOrder = onCall(async (request): Promise<EditPaidOrderResult> => {
  const admin = await requireAdmin(request);
  const orderId = orderIdOf(request.data);
  const reason = str((request.data as any)?.reason).slice(0, 500);
  if (!reason) throw new HttpsError("invalid-argument", "Please give a reason for the change.");
  let requested;
  try {
    requested = parseRequestedItems((request.data as any)?.items);
  } catch (err) {
    asHttps(err);
  }

  const orderRef = db.doc(`orders/${orderId}`);
  const fallbackRate = await getTaxRate();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snap.data() ?? {};
    if (order.status !== "in_process" || order.paymentReceived !== true) {
      throw new HttpsError(
        "failed-precondition",
        "Only paid orders in production can be reduced. Completed orders have a final invoice and can't be changed."
      );
    }

    const before = normalizeItems(order.items);
    let reduced;
    try {
      reduced = reduceItems(before, requested);
    } catch (err) {
      asHttps(err);
    }
    if (reduced.items.length === 0) {
      throw new HttpsError("failed-precondition", "To remove everything, cancel the order instead.");
    }
    const { totals, discount } = reducedTotals(order, reduced.items, effectiveGstRate(order, fallbackRate));
    const oldTotal = round2(num(order.total));
    const credit = round2(oldTotal - totals.total);
    if (credit <= 0) throw new HttpsError("failed-precondition", "Nothing was reduced, so there is no credit to issue.");

    const noteRef = db.collection("creditNotes").doc();
    const historyRef = db.collection("orderEditHistory").doc();
    const snapRef = orderRef.collection("snapshots").doc();
    const customerId = str(order.customerId);

    tx.set(noteRef, {
      ...buildCreditNote({
        id: noteRef.id,
        customerId,
        orderId,
        amount: credit,
        type: "admin_edit",
        reason: `Order change: ${reason}`,
        createdBy: admin.email,
        gstShare: gstShareOf(order),
        now: new Date(),
      }),
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(orderRef, {
      items: reduced.items,
      subtotal: totals.subtotal,
      discount,
      gst: totals.gst,
      total: totals.total,
      creditIssued: round2(num(order.creditIssued) + credit),
      editedBy: admin.email,
      editedAt: FieldValue.serverTimestamp(),
      editReason: reason,
      editCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(historyRef, {
      orderId,
      customerId,
      kind: "paid_edit",
      status: order.status,
      editedBy: admin.email,
      editedAt: FieldValue.serverTimestamp(),
      reason,
      changesSummary: `Reduced ${reduced.changes.length} item(s)`,
      originalTotal: oldTotal,
      newTotal: totals.total,
      creditIssued: credit,
      creditNoteId: noteRef.id,
      itemsChanged: reduced.changes,
    });
    tx.set(snapRef, {
      orderId,
      customerId,
      trigger: "admin_edit",
      createdBy: admin.email,
      createdAt: FieldValue.serverTimestamp(),
      reason: `Admin reduced paid order: ${reason}. Credit issued: $${credit.toFixed(2)}`,
      status: order.status,
      items: reduced.items,
      subtotal: totals.subtotal,
      gst: totals.gst,
      deliveryFee: totals.deliveryFee,
      serviceCharge: totals.serviceCharge,
      total: totals.total,
      creditIssued: credit,
    });
    if (customerId) {
      createNotificationInTx(
        tx,
        orderReducedNotification(orderRefFields(orderId, order), historyRef.id, { credit, reason, changes: reduced.changes })
      );
    }
    return { total: totals.total, credit, creditNoteId: noteRef.id };
  });

  console.log(`[editPaidOrder] ${orderId} by ${admin.email}: total ${result.total}, credit ${result.credit}`);
  return { orderId, total: result.total, creditIssued: result.credit, creditNoteId: result.creditNoteId };
});
