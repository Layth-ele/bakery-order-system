/**
 * orderPlacement — pure rules for placing an order (no Firebase).
 * Used by the placeOrder Cloud Function; tested in
 * __tests__/orderPlacement.test.ts.
 *
 * Money rules (the ONE definition used everywhere — approval, invoices,
 * emails, PDFs):
 *   total        = subtotal − discount + GST + delivery fee + service charge
 *                  (the invoice total; credit is NOT subtracted from it)
 *   creditApplied = store credit used on the order
 *   amountDue    = max(0, total − creditApplied)  — what the customer pays
 */
import { isoWeekMonday, vancouverTimeToUtc } from "./orderCompletion";

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Day = (typeof DAYS)[number];
export type DayQuantities = Record<Day, number>;

/** A delivery day closes this many hours before noon (Vancouver) that day. */
export const CUTOFF_HOURS = 48;
export const MAX_ITEMS = 200;
export const MAX_QTY_PER_DAY = 10_000;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Input ───────────────────────────────────────────────────────────────────

export interface PlaceOrderInput {
  /** Client-generated, stable across retries → the order's document id. */
  requestId: string;
  week: number;
  year: number;
  items: Array<{ productId: string; quantities: DayQuantities }>;
  note: string;
  creditToApply: number;
}

export class PlacementError extends Error {
  constructor(public readonly code: "invalid-argument" | "failed-precondition", message: string) {
    super(message);
  }
}

const REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function parsePlaceOrderInput(raw: unknown): PlaceOrderInput {
  const d = (raw ?? {}) as Record<string, unknown>;
  const bad = (m: string) => new PlacementError("invalid-argument", m);

  if (typeof d.requestId !== "string" || !REQUEST_ID.test(d.requestId)) throw bad("A valid requestId is required.");
  const week = Number(d.week);
  const year = Number(d.year);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) throw bad("Invalid year.");
  if (!Number.isInteger(week) || week < 1 || week > 53) throw bad("Invalid week.");
  if (!Array.isArray(d.items) || d.items.length === 0) throw bad("Your order has no items.");
  if (d.items.length > MAX_ITEMS) throw bad(`An order can have at most ${MAX_ITEMS} products.`);

  const seen = new Set<string>();
  const items = d.items.map((it: any) => {
    const productId = typeof it?.productId === "string" ? it.productId.trim() : "";
    if (!productId || productId.includes("/")) throw bad("Each item needs a valid productId.");
    if (seen.has(productId)) throw bad("Each product can appear only once.");
    seen.add(productId);
    const q = (it?.quantities ?? {}) as Record<string, unknown>;
    const quantities = {} as DayQuantities;
    for (const day of DAYS) {
      const v = q[day] ?? 0;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_QTY_PER_DAY) {
        throw bad(`Invalid ${day} quantity.`);
      }
      quantities[day] = v;
    }
    return { productId, quantities };
  });
  const itemsWithQty = items.filter((it) => DAYS.some((day) => it.quantities[day] > 0));
  if (itemsWithQty.length === 0) throw bad("Your order has no quantities.");

  const credit = d.creditToApply === undefined || d.creditToApply === null ? 0 : Number(d.creditToApply);
  if (!Number.isFinite(credit) || credit < 0) throw bad("Invalid credit amount.");

  return {
    requestId: d.requestId,
    week,
    year,
    items: itemsWithQty,
    note: typeof d.note === "string" ? d.note.trim().slice(0, 1000) : "",
    creditToApply: round2(credit),
  };
}

// ── Cutoff ──────────────────────────────────────────────────────────────────

/** Moment ordering closes for a delivery day: noon Vancouver that day − 48 h. */
export function dayCutoff(year: number, week: number, day: Day): Date {
  const date = isoWeekMonday(year, week);
  date.setUTCDate(date.getUTCDate() + DAYS.indexOf(day));
  const noon = vancouverTimeToUtc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  return new Date(noon.getTime() - CUTOFF_HOURS * 60 * 60 * 1000);
}

/** Days that have quantities but are already closed for ordering. */
export function closedDaysInOrder(input: Pick<PlaceOrderInput, "week" | "year" | "items">, now: Date): Day[] {
  return DAYS.filter(
    (day) => input.items.some((it) => it.quantities[day] > 0) && now.getTime() >= dayCutoff(input.year, input.week, day).getTime()
  );
}

// ── Pricing ─────────────────────────────────────────────────────────────────

export interface CatalogProduct {
  name?: unknown;
  retail?: unknown;
  wholesale?: unknown;
  price?: unknown;
  discount?: unknown;
  available?: unknown;
}

export type PriceTier = "commercial" | "individual";

/** The unit price the customer sees on the order screen. */
export function unitPriceFor(product: CatalogProduct, tier: PriceTier): number {
  const pick = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
  const base = tier === "commercial" ? pick(product.wholesale) || pick(product.price) : pick(product.retail) || pick(product.price);
  const disc = typeof product.discount === "number" && product.discount > 0 && product.discount < 100 ? product.discount : 0;
  return disc > 0 ? base * (1 - disc / 100) : base;
}

export interface PricedOrder {
  items: Array<{ productId: string; productName: string; price: number; total: number } & DayQuantities>;
  subtotal: number;
  gst: number;
  serviceCharge: number;
  deliveryFee: number;
  total: number;
}

export interface PricingSettings {
  tier: PriceTier;
  gstRate: number;
  serviceCharge: number;
  /** Standard delivery fee, waived at or above freeDeliveryMin. */
  deliveryFee: number;
  freeDeliveryMin: number;
}

/**
 * Price an order exactly as the order screen shows it. The delivery fee is
 * the estimate the customer saw; the admin confirms it at approval.
 */
export function priceOrder(
  input: Pick<PlaceOrderInput, "items">,
  catalog: Map<string, CatalogProduct | undefined>,
  opts: PricingSettings
): PricedOrder {
  const items = input.items.map(({ productId, quantities }) => {
    const product = catalog.get(productId);
    if (!product) throw new PlacementError("failed-precondition", "A product in your cart is no longer available. Please refresh.");
    if (product.available === false) {
      throw new PlacementError("failed-precondition", `${String(product.name ?? "A product")} is currently unavailable.`);
    }
    const price = unitPriceFor(product, opts.tier);
    if (price <= 0) throw new PlacementError("failed-precondition", `${String(product.name ?? "A product")} has no price set.`);
    const total = DAYS.reduce((s, day) => s + quantities[day], 0);
    return { productId, productName: String(product.name ?? "Product"), price, ...quantities, total };
  });

  const subtotal = round2(items.reduce((s, it) => s + it.price * it.total, 0));
  const gst = round2(subtotal * opts.gstRate);
  const serviceCharge = round2(Math.max(0, opts.serviceCharge));
  const deliveryFee = subtotal === 0 || subtotal >= opts.freeDeliveryMin ? 0 : round2(Math.max(0, opts.deliveryFee));
  const total = round2(subtotal + gst + serviceCharge + deliveryFee);
  return { items, subtotal, gst, serviceCharge, deliveryFee, total };
}

/** Amount the customer pays after store credit. */
export const amountDueOf = (total: number, creditApplied: number): number => Math.max(0, round2(total - creditApplied));

// ── Credit (FIFO across the customer's credit notes) ───────────────────────

export interface CreditNoteBalance {
  id: string;
  remaining: number;
  createdAtMs: number;
}

export function allocateCredit(
  notes: CreditNoteBalance[],
  requested: number,
  orderTotal: number
): { applied: number; deductions: Array<{ id: string; used: number; newBalance: number }> } {
  const available = round2(notes.reduce((s, n) => s + Math.max(0, n.remaining), 0));
  if (requested > available + 0.005) {
    throw new PlacementError("failed-precondition", `Not enough store credit. Available: $${available.toFixed(2)}.`);
  }
  let toUse = round2(Math.min(requested, orderTotal));
  const deductions: Array<{ id: string; used: number; newBalance: number }> = [];
  for (const n of [...notes].sort((a, b) => a.createdAtMs - b.createdAtMs)) {
    if (toUse <= 0) break;
    const used = round2(Math.min(Math.max(0, n.remaining), toUse));
    if (used <= 0) continue;
    deductions.push({ id: n.id, used, newBalance: round2(n.remaining - used) });
    toUse = round2(toUse - used);
  }
  const applied = round2(deductions.reduce((s, d) => s + d.used, 0));
  return { applied, deductions };
}
