/**
 * Business settings the Cloud Functions compute with, resolved from the SAME
 * document the admin edits: settings/general (Admin → System Settings,
 * created by bootstrapSettings). The older settings/default document is read
 * only as a fallback for fields general doesn't have yet.
 *
 * Pure: no Firebase imports. Tested in __tests__/settingsValues.test.ts.
 */
type Doc = Record<string, unknown> | null | undefined;

export const DEFAULT_TAX_RATE = 0.05;
export const DEFAULT_FREE_DELIVERY_MIN = 500;
export const DEFAULT_DELIVERY_FEE = 10;
export const DEFAULT_SERVICE_CHARGE = 3.99;

const rate = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1 ? v : undefined;
const amount = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

function first<T>(docs: Doc[], fields: string[], parse: (v: unknown) => T | undefined): T | undefined {
  for (const d of docs) {
    for (const f of fields) {
      const v = parse(d?.[f]);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

/** GST as a fraction (0.05 = 5%): gstRate → taxRate (legacy) → 5%. */
export function resolveTaxRate(general: Doc, legacy?: Doc): number {
  return first([general, legacy], ["gstRate", "taxRate"], rate) ?? DEFAULT_TAX_RATE;
}

/**
 * Admin → Settings → "Free delivery" switch. Off → delivery is always
 * charged. Settings saved before the switch existed count as on.
 */
export function isFreeDeliveryEnabled(general: Doc, legacy?: Doc): boolean {
  const v = [general, legacy].map((d) => d?.freeDeliveryEnabled).find((x) => typeof x === "boolean");
  return v !== false;
}

/**
 * Order subtotal (after discount) that qualifies for free delivery:
 * freeDeliveryMin → freeDeliveryThreshold → $500. Infinity when free
 * delivery is switched off, so no order ever qualifies.
 */
export function resolveFreeDeliveryMin(general: Doc, legacy?: Doc): number {
  if (!isFreeDeliveryEnabled(general, legacy)) return Number.POSITIVE_INFINITY;
  return first([general, legacy], ["freeDeliveryMin", "freeDeliveryThreshold"], amount) ?? DEFAULT_FREE_DELIVERY_MIN;
}

/** Standard delivery fee charged below the free-delivery minimum (default $10). */
export function resolveDeliveryFee(general: Doc, legacy?: Doc): number {
  return first([general, legacy], ["deliveryFee"], amount) ?? DEFAULT_DELIVERY_FEE;
}

/** Service charge per order: 0 when disabled; on by default at $3.99. */
export function resolveServiceCharge(general: Doc, legacy?: Doc): number {
  const enabled = [general, legacy].map((d) => d?.serviceChargeEnabled).find((v) => typeof v === "boolean");
  if (enabled === false) return 0;
  return first([general, legacy], ["serviceChargeAmount"], amount) ?? DEFAULT_SERVICE_CHARGE;
}

// ── Bakery policy timings (Admin → Settings → Policies & timing) ────────────

export const DEFAULT_ORDER_CUTOFF_HOURS = 48;
export const DEFAULT_CANCELLATION_NOTICE_HOURS = 24;

/** Whole hours, 0 … 14 days. */
const hours = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 336 ? Math.round(v) : undefined;
const percent = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;

/** Ordering for a delivery day closes this many hours before noon that day. */
export function resolveOrderCutoffHours(general: Doc, legacy?: Doc): number {
  return first([general, legacy], ["orderCutoffHours"], hours) ?? DEFAULT_ORDER_CUTOFF_HOURS;
}

/** Payment must arrive this many hours before noon of the first delivery day (default: the order cutoff). */
export function resolvePaymentDueHours(general: Doc, legacy?: Doc): number {
  return first([general, legacy], ["paymentDueHours"], hours) ?? resolveOrderCutoffHours(general, legacy);
}

/** Cancel at least this many hours before noon of a delivery day to avoid the late fee. */
export function resolveCancellationNoticeHours(general: Doc, legacy?: Doc): number {
  return first([general, legacy], ["cancellationNoticeHours"], hours) ?? DEFAULT_CANCELLATION_NOTICE_HOURS;
}

/** Fee (% of the cancelled part) for a late cancellation of a paid order. */
export function resolveLateCancellationFeePercent(general: Doc, legacy?: Doc): number {
  return first([general, legacy], ["cancellationFeePercent", "cancellationFeePercentage"], percent) ?? 0;
}

/** Everything a customer needs to know, resolved from Settings (Policies page, invoices). */
export interface BakeryPolicy {
  orderCutoffHours: number;
  paymentDueHours: number;
  cancellationNoticeHours: number;
  lateCancellationFeePercent: number;
  taxRate: number;
  serviceCharge: number;
  deliveryFee: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryMin: number;
}

export function resolvePolicy(general: Doc, legacy?: Doc): BakeryPolicy {
  return {
    orderCutoffHours: resolveOrderCutoffHours(general, legacy),
    paymentDueHours: resolvePaymentDueHours(general, legacy),
    cancellationNoticeHours: resolveCancellationNoticeHours(general, legacy),
    lateCancellationFeePercent: resolveLateCancellationFeePercent(general, legacy),
    taxRate: resolveTaxRate(general, legacy),
    serviceCharge: resolveServiceCharge(general, legacy),
    deliveryFee: resolveDeliveryFee(general, legacy),
    freeDeliveryEnabled: isFreeDeliveryEnabled(general, legacy),
    freeDeliveryMin: resolveFreeDeliveryMin(general, legacy),
  };
}

