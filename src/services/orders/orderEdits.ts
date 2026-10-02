/**
 * Admin order edits — the browser side. The edit screens collect changes;
 * the editOrder / editPaidOrder Cloud Functions validate, reprice and save
 * them, issue any store credit, and notify the customer. Nothing here
 * writes to Firestore.
 */
import type { Order } from '../../types';
import {
  editOrderViaCloudFunction,
  editPaidOrderViaCloudFunction,
  type DayQuantitiesPayload,
  type EditOrderPayload,
  type EditOrderResult,
  type EditPaidOrderResult,
} from '../firebase/cloudFunctions';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/** What EditOrderPage hands to its onSave callback. */
export interface AdminOrderChanges {
  editedItems: Record<string, Partial<DayQuantitiesPayload> & { productName?: string; price?: number }>;
  deliveryFee?: number;
  discount?: number;
  discountPercentage?: number;
  discountType?: string;
  discountNote?: string;
}

export function dayQuantities(src: Partial<Record<string, unknown>>): DayQuantitiesPayload {
  const q = {} as DayQuantitiesPayload;
  for (const d of DAYS) {
    const v = Number(src[d] ?? 0);
    q[d] = Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0;
  }
  return q;
}

export function toEditOrderPayload(order: Order, changes: AdminOrderChanges): EditOrderPayload {
  const original = new Set((order.items ?? []).map((i) => i.productId));
  const items = Object.entries(changes.editedItems ?? {}).map(([productId, it]) => ({
    productId,
    quantities: dayQuantities(it as Record<string, unknown>),
    // A custom product the admin just added: the server needs its name and price.
    ...(productId.startsWith('custom-') && !original.has(productId)
      ? { custom: { name: String(it.productName ?? 'Custom product'), price: Number(it.price ?? 0) } }
      : {}),
  }));

  const payload: EditOrderPayload = { orderId: order.id, items };
  if (typeof changes.deliveryFee === 'number' && Number.isFinite(changes.deliveryFee)) {
    payload.deliveryFee = Math.max(0, changes.deliveryFee);
  }
  if (changes.discountType !== undefined) {
    const percentage = changes.discountType === 'percentage';
    const value = Number(percentage ? changes.discountPercentage ?? changes.discount : changes.discount) || 0;
    payload.discount = { type: percentage ? 'percentage' : 'fixed', value: Math.max(0, value), note: changes.discountNote ?? '' };
  }
  return payload;
}

/** Save an admin's edit of a pending / approved (unpaid) order. */
export function saveOrderEdit(order: Order, changes: AdminOrderChanges): Promise<EditOrderResult> {
  return editOrderViaCloudFunction(toEditOrderPayload(order, changes));
}

/** Reduce a paid order; the difference is issued as store credit. */
export function savePaidOrderReduction(
  order: Order,
  editedItems: Array<{ productId: string } & Partial<DayQuantitiesPayload>>,
  reason: string
): Promise<EditPaidOrderResult> {
  return editPaidOrderViaCloudFunction({
    orderId: order.id,
    items: editedItems.map((it) => ({ productId: it.productId, quantities: dayQuantities(it as Record<string, unknown>) })),
    reason,
  });
}
