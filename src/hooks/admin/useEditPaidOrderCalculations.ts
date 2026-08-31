/**
 * useEditPaidOrderCalculations
 *
 * Pass 7 component-decomposition extraction from EditPaidOrderModal.tsx.
 *
 * Computes the new order totals (subtotal, GST, delivery, service, total)
 * given an edited items map, plus the credit amount that would be issued
 * and a structured list of per-item changes.
 *
 * The legacy-GST detection logic is preserved intact — some orders in the
 * production data have GST excluded from `total` due to a 2025 bug. We
 * detect the source order's pattern and apply the same convention to the
 * recomputed total to keep behavior consistent.
 */

import { useMemo } from 'react';
import type { Order, OrderItem } from '../../types';
import { calculateCreditFromReduction } from '../../services/creditService';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type DayKey = (typeof DAY_KEYS)[number];

function getItemTotal(item: OrderItem): number {
  return DAY_KEYS.reduce((sum, day) => sum + ((item[day] as number | undefined) ?? 0), 0);
}

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

export function useEditPaidOrderCalculations(
  order: Order,
  editedItems: { [productId: string]: OrderItem },
): UseEditPaidOrderCalculationsResult {
  const calculatedTotals = useMemo<OrderTotals>(() => {
    const items = Object.values(editedItems);
    const subtotal = items.reduce((sum, item) => {
      return sum + getItemTotal(item) * (item.price ?? 0);
    }, 0);

    // Apply discount from original order
    let discount = 0;
    if (order.discountPercentage) {
      discount = subtotal * (order.discountPercentage / 100);
    } else if (order.discount) {
      discount = order.discount;
    }
    const discountedSubtotal = subtotal - discount;

    const originalSubtotal = order.subtotal || 0;
    const originalGst = order.gst || 0;
    const originalDeliveryFee = order.deliveryFee || 0;
    const originalServiceCharge = order.serviceChargeWaived ? 0 : (order.serviceCharge || 0);
    const originalDiscount = order.discount || 0;

    // Detect legacy GST handling: some orders had GST stored separately from total
    const reconstructedTotalWithGst =
      originalSubtotal + originalGst + originalDeliveryFee + originalServiceCharge - originalDiscount;
    const reconstructedTotalWithoutGst =
      originalSubtotal + originalDeliveryFee + originalServiceCharge - originalDiscount;
    const orderTotal = order.total ?? 0;
    const gstWasNotIncludedInOriginalTotal =
      Math.abs(reconstructedTotalWithoutGst - orderTotal) < 0.01 &&
      Math.abs(reconstructedTotalWithGst - orderTotal) >= 0.01;

    let gst: number;
    let total: number;
    if (gstWasNotIncludedInOriginalTotal) {
      gst = 0;
      total = discountedSubtotal + originalDeliveryFee + originalServiceCharge;
    } else {
      gst = discountedSubtotal * 0.05;
      total = discountedSubtotal + gst + originalDeliveryFee + originalServiceCharge;
    }

    return {
      subtotal,
      gst,
      deliveryFee: originalDeliveryFee,
      serviceCharge: originalServiceCharge,
      total,
    };
  }, [
    editedItems,
    order.deliveryFee,
    order.serviceCharge,
    order.serviceChargeWaived,
    order.discount,
    order.discountPercentage,
    order.total,
    order.subtotal,
    order.gst,
  ]);

  const creditAmount = useMemo(() => {
    return calculateCreditFromReduction(order.total ?? 0, calculatedTotals.total);
  }, [order.total, calculatedTotals.total]);

  const changes = useMemo<ItemChange[]>(() => {
    const list: ItemChange[] = [];
    order.items.forEach((originalItem) => {
      const editedItem = editedItems[originalItem.productId];
      if (!editedItem) return;
      const newQty = getItemTotal(editedItem);
      const originalQty = originalItem.quantity || getItemTotal(originalItem);
      if (newQty !== originalQty) {
        const qtyChange = newQty - originalQty;
        list.push({
          productName: originalItem.productName,
          originalQuantity: originalQty,
          newQuantity: newQty,
          quantityChange: qtyChange,
          priceChange: qtyChange * (originalItem.price ?? 0),
        });
      }
    });
    return list;
  }, [editedItems, order.items]);

  return { calculatedTotals, creditAmount, changes };
}
