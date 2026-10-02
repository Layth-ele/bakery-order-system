/**
 * orderRevision — pure rules for changing an existing order (no Firebase).
 *
 * Used by the editOrder / editPaidOrder / cancelOrder Cloud Functions, and by
 * the admin screens to preview exactly what the server will do (the client
 * imports this file directly, so preview and result can never disagree).
 *
 * Money rules (same as lib/orderPlacement.ts):
 *   total     = (subtotal − discount) + GST + delivery fee + service charge
 *   amountDue = max(0, total − creditApplied)
 * Once an order is paid, a reduction is returned to the customer as store
 * credit (creditIssued); amountDue keeps the amount that was paid.
 */

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Day = (typeof DAYS)[number];
export type DayQuantities = Record<Day, number>;

export interface RevisionItem extends DayQuantities {
  productId: string;
  productName: string;
  price: number;
  total: number;
}

/** The order fields that pricing depends on. */
export interface PricedOrderFields {
  items?: unknown;
  subtotal?: unknown;
  gst?: unknown;
  discount?: unknown;
  discountPercentage?: unknown;
  deliveryFee?: unknown;
  serviceCharge?: unknown;
  serviceChargeWaived?: unknown;
  total?: unknown;
  creditApplied?: unknown;
  /** Fee kept from a partial cancellation of a paid order. */
  cancellationFee?: unknown;
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  cancellationFee: number;
  total: number;
}

export class RevisionError extends Error {
  constructor(public readonly code: "invalid-argument" | "failed-precondition", message: string) {
    super(message);
  }
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const itemQuantity = (q: Partial<DayQuantities>): number => DAYS.reduce((s, d) => s + num(q[d]), 0);

/** Normalize stored order items (missing day fields → 0, total recomputed). */
export function normalizeItems(raw: unknown): RevisionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it) => it && typeof it === "object" && typeof (it as any).productId === "string")
    .map((it: any) => {
      const q = {} as DayQuantities;
      for (const d of DAYS) q[d] = Math.max(0, Math.trunc(num(it[d])));
      return {
        ...it,
        productId: it.productId,
        productName: String(it.productName ?? it.name ?? "Product"),
        price: num(it.price),
        ...q,
        total: itemQuantity(q),
      };
    });
}

export const itemsSubtotal = (items: RevisionItem[]): number =>
  round2(items.reduce((s, it) => s + it.price * it.total, 0));

/** Flat + percentage discount on a subtotal (both apply), never above it. */
export function discountOn(subtotal: number, order: Pick<PricedOrderFields, "discount" | "discountPercentage">): number {
  const flat = Math.max(0, num(order.discount));
  const pct = Math.min(100, Math.max(0, num(order.discountPercentage)));
  return round2(Math.min(subtotal, flat + (subtotal * pct) / 100));
}

/**
 * The GST rate an order was actually charged at (so revising a paid order
 * can't drift if Settings changed since). Falls back to `fallbackRate`.
 */
export function effectiveGstRate(order: PricedOrderFields, fallbackRate: number): number {
  const subtotal = num(order.subtotal);
  const base = subtotal - discountOn(subtotal, order);
  const gst = num(order.gst);
  if (base > 0 && gst > 0) return gst / base;
  return fallbackRate;
}

/** Price `items` with the order's discount, fees and the given GST rate. */
export function orderTotals(
  items: RevisionItem[],
  order: PricedOrderFields,
  gstRate: number,
  overrides: { deliveryFee?: number } = {}
): OrderTotals {
  const subtotal = itemsSubtotal(items);
  const discountAmount = discountOn(subtotal, order);
  const gst = round2((subtotal - discountAmount) * gstRate);
  const deliveryFee = round2(Math.max(0, overrides.deliveryFee ?? num(order.deliveryFee)));
  const serviceCharge = order.serviceChargeWaived === true ? 0 : round2(Math.max(0, num(order.serviceCharge)));
  const cancellationFee = round2(Math.max(0, num(order.cancellationFee)));
  const total = round2(subtotal - discountAmount + gst + deliveryFee + serviceCharge + cancellationFee);
  return { subtotal, discountAmount, gst, deliveryFee, serviceCharge, cancellationFee, total };
}

// ── Input ───────────────────────────────────────────────────────────────────

export const MAX_ITEMS = 200;
export const MAX_QTY_PER_DAY = 10_000;

export interface RequestedItem {
  productId: string;
  quantities: DayQuantities;
  /** Admin-defined product not in the catalogue (productId "custom-…"). */
  custom?: { name: string; price: number };
}

const CUSTOM_ID = /^custom-[A-Za-z0-9_-]{1,80}$/;

/** Validate `[{ productId, quantities: { monday… }, custom? }]` from a callable. */
export function parseRequestedItems(raw: unknown): RequestedItem[] {
  const bad = (m: string) => new RevisionError("invalid-argument", m);
  if (!Array.isArray(raw)) throw bad("items must be a list.");
  if (raw.length > MAX_ITEMS) throw bad(`An order can have at most ${MAX_ITEMS} products.`);
  const seen = new Set<string>();
  return raw.map((it: any) => {
    const productId = typeof it?.productId === "string" ? it.productId.trim() : "";
    if (!productId || productId.includes("/")) throw bad("Each item needs a valid productId.");
    if (seen.has(productId)) throw bad("Each product can appear only once.");
    seen.add(productId);
    const src = (it?.quantities ?? {}) as Record<string, unknown>;
    const quantities = {} as DayQuantities;
    for (const d of DAYS) {
      const v = src[d] ?? 0;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_QTY_PER_DAY) {
        throw bad(`Invalid ${d} quantity.`);
      }
      quantities[d] = v;
    }
    if (it?.custom !== undefined && it?.custom !== null) {
      if (!CUSTOM_ID.test(productId)) throw bad("Custom products need a custom- id.");
      const name = typeof it.custom.name === "string" ? it.custom.name.trim().slice(0, 120) : "";
      const price = Number(it.custom.price);
      if (!name) throw bad("A custom product needs a name.");
      if (!Number.isFinite(price) || price <= 0 || price > 100_000) throw bad(`Invalid price for ${name}.`);
      return { productId, quantities, custom: { name, price: round2(price) } };
    }
    return { productId, quantities };
  });
}

/** Per-product quantity changes between two versions of an order. */
export function diffItems(before: RevisionItem[], after: RevisionItem[]): ItemChange[] {
  const ids = [...new Set([...before.map((i) => i.productId), ...after.map((i) => i.productId)])];
  const changes: ItemChange[] = [];
  for (const id of ids) {
    const a = before.find((i) => i.productId === id);
    const b = after.find((i) => i.productId === id);
    const from = a?.total ?? 0;
    const to = b?.total ?? 0;
    const dayChanged = DAYS.some((d) => (a?.[d] ?? 0) !== (b?.[d] ?? 0));
    if (!dayChanged) continue;
    const price = b?.price ?? a?.price ?? 0;
    changes.push({
      productId: id,
      productName: (b ?? a)!.productName,
      originalQuantity: from,
      newQuantity: to,
      quantityChange: to - from,
      priceChange: round2(to * (b?.price ?? price) - from * (a?.price ?? price)),
    });
  }
  return changes;
}

// ── Reductions (paid-order edits, partial cancellations) ────────────────────

export interface ItemChange {
  productId: string;
  productName: string;
  originalQuantity: number;
  newQuantity: number;
  quantityChange: number;
  priceChange: number;
}

/**
 * Apply the edited per-day quantities to an order's items, allowing only
 * reductions. `requested` is the full edited order: a product left out is
 * reduced to 0, and products at 0 on every day are removed.
 */
export function reduceItems(
  original: RevisionItem[],
  requested: Array<{ productId: string; quantities: Partial<DayQuantities> }>
): { items: RevisionItem[]; changes: ItemChange[] } {
  const byId = new Map(requested.map((r) => [r.productId, r.quantities]));
  for (const id of byId.keys()) {
    if (!original.some((it) => it.productId === id)) {
      throw new RevisionError("invalid-argument", "Only products already on the order can be changed.");
    }
  }
  const changes: ItemChange[] = [];
  const items: RevisionItem[] = [];
  for (const it of original) {
    const req = byId.get(it.productId) ?? {};
    const q = {} as DayQuantities;
    for (const d of DAYS) {
      const v = req[d] ?? 0;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
        throw new RevisionError("invalid-argument", `Invalid ${d} quantity for ${it.productName}.`);
      }
      if (v > it[d]) {
        throw new RevisionError(
          "failed-precondition",
          `${it.productName} can only be reduced (${d}: ${it[d]} ordered, ${v} requested).`
        );
      }
      q[d] = v;
    }
    const total = itemQuantity(q);
    if (total !== it.total) {
      changes.push({
        productId: it.productId,
        productName: it.productName,
        originalQuantity: it.total,
        newQuantity: total,
        quantityChange: total - it.total,
        priceChange: round2((total - it.total) * it.price),
      });
    }
    if (total > 0) items.push({ ...it, ...q, total });
  }
  return { items, changes };
}

/** Zero the given delivery days on every item (drops items left empty). */
export function removeDays(original: RevisionItem[], days: Day[]): RevisionItem[] {
  return original
    .map((it) => {
      const q = {} as DayQuantities;
      for (const d of DAYS) q[d] = days.includes(d) ? 0 : it[d];
      return { ...it, ...q, total: itemQuantity(q) };
    })
    .filter((it) => it.total > 0);
}

export const activeDays = (items: RevisionItem[]): Day[] => DAYS.filter((d) => items.some((it) => it[d] > 0));

// ── Cancellation ────────────────────────────────────────────────────────────

export interface CancellationPlan {
  /** Every delivery day cancelled → the order becomes "cancelled". */
  full: boolean;
  /** Items after a partial cancellation (empty for a full one). */
  items: RevisionItem[];
  totals: OrderTotals | null;
  /** Store credit issued to the customer. */
  credit: number;
  /** Cancellation fee kept by the bakery (paid orders only). */
  fee: number;
  /** For unpaid orders: store credit returned because the order shrank. */
  creditReturned: number;
  creditApplied: number;
  amountDue: number;
}

/**
 * What cancelling `days` of an order does to its money.
 *
 * Paid order: the customer gets back what the cancelled part cost (cash and
 *   credit alike), minus the fee percentage, as store credit.
 * Unpaid order: nothing was paid, so no fee and no refund — except store
 *   credit already used on the order, which is returned as far as the
 *   smaller (or cancelled) order no longer needs it.
 */
export function planCancellation(
  order: PricedOrderFields & { paymentReceived?: unknown },
  days: Day[],
  feePercentage: number,
  fallbackGstRate: number
): CancellationPlan {
  const items = normalizeItems(order.items);
  const valid = days.filter((d) => DAYS.includes(d));
  const active = activeDays(items);
  const cancelled = active.filter((d) => valid.includes(d));
  if (cancelled.length === 0) throw new RevisionError("invalid-argument", "Select at least one delivery day to cancel.");
  const fee = Math.min(100, Math.max(0, num(feePercentage)));
  const paid = order.paymentReceived === true;
  const oldTotal = round2(num(order.total));
  const creditApplied = round2(num(order.creditApplied));
  const full = cancelled.length === active.length;

  const gstRate = effectiveGstRate(order, fallbackGstRate);
  let newItems: RevisionItem[] = [];
  let totals: OrderTotals | null = null;
  let newTotal = 0;
  if (!full) {
    newItems = removeDays(items, cancelled);
    totals = orderTotals(newItems, order, gstRate);
    newTotal = totals.total;
  }
  const reduction = round2(Math.max(0, oldTotal - newTotal));

  if (paid) {
    const feeAmount = round2((reduction * fee) / 100);
    // A partial cancellation keeps the fee on the order, so the invoice still
    // adds up: total + credit issued = what the customer paid.
    if (totals && feeAmount > 0) {
      totals = orderTotals(newItems, { ...order, cancellationFee: num(order.cancellationFee) + feeAmount }, gstRate);
    }
    return {
      full,
      items: newItems,
      totals,
      credit: round2(reduction - feeAmount),
      fee: feeAmount,
      creditReturned: 0,
      creditApplied,
      amountDue: round2(num((order as any).amountDue ?? Math.max(0, oldTotal - creditApplied))),
    };
  }
  const keptCredit = round2(Math.min(creditApplied, newTotal));
  const creditReturned = round2(creditApplied - keptCredit);
  return {
    full,
    items: newItems,
    totals,
    credit: creditReturned,
    fee: 0,
    creditReturned,
    creditApplied: keptCredit,
    amountDue: round2(Math.max(0, newTotal - keptCredit)),
  };
}
