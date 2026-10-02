/**
 * Preview for the "edit paid order" modal: new totals and the store credit
 * the reduction will issue. Uses the exact rules the editPaidOrder Cloud
 * Function applies (src/functions/src/lib/orderRevision.ts), so the preview
 * always equals the result.
 */
import { useMemo } from 'react';
import type { Order, OrderItem } from '../../types';
import {
  diffItems,
  effectiveGstRate,
  normalizeItems,
  orderTotals,
  round2,
} from '../../functions/src/lib/orderRevision';

export interface OrderTotals {
  subtotal: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  total: number;
}

export interface ItemChange {
  productName: string;
  originalQuantity: number;
  newQuantity: number;
  quantityChange: number;
  priceChange: number;
}

export interface UseEditPaidOrderCalculationsResult {
  calculatedTotals: OrderTotals;
  creditAmount: number;
  changes: ItemChange[];
}

/** Fallback GST rate if the order carries none (never used for taxed orders). */
const FALLBACK_GST_RATE = 0.05;

export function useEditPaidOrderCalculations(
  order: Order,
  editedItems: { [productId: string]: OrderItem },
): UseEditPaidOrderCalculationsResult {
  return useMemo(() => {
    const before = normalizeItems(order.items);
    const after = normalizeItems(Object.values(editedItems)).filter((it) => it.total > 0);
    const t = orderTotals(after, order, effectiveGstRate(order, FALLBACK_GST_RATE));
    return {
      calculatedTotals: {
        subtotal: t.subtotal,
        gst: t.gst,
        deliveryFee: t.deliveryFee,
        serviceCharge: t.serviceCharge,
        total: t.total,
      },
      creditAmount: Math.max(0, round2((order.total ?? 0) - t.total)),
      changes: diffItems(before, after),
    };
  }, [order, editedItems]);
}
