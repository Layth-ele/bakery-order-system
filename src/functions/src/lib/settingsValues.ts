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
export const DEFAULT_FREE_DELIVERY_MIN = 250;
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

/** Order subtotal that qualifies for free delivery: freeDeliveryMin → freeDeliveryThreshold → $250. */
export function resolveFreeDeliveryMin(general: Doc, legacy?: Doc): number {
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
