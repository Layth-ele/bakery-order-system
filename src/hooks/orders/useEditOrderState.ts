/**
 * useEditOrderState
 *
 * Manages all form state and derived values for the EditOrderPage component.
 * Extracted to reduce EditOrderPage from 1054 lines.
 *
 * Handles:
 * - Edited items map (productId → quantities)
 * - Active delivery days
 * - Admin-only state: discount, deliveryFee, custom products
 * - Item-level calculations: subtotal, total
 * - Permission check
 */
import { useState, useEffect, useMemo } from 'react';
import type { Order, OrderItem, Product } from '../../types';
import type { DayQuantities } from '../../types/cart';
import { useCachedCustomers, useCachedSettings } from '../useCachedFirebase';
import { autoDeliveryFee, normalizeItems, orderTotals, round2, type OrderTotals } from '../../functions/src/lib/orderRevision';
import { unitPriceFor, type PriceTier } from '../../functions/src/lib/orderPlacement';
import { resolveDeliveryFee, resolveFreeDeliveryMin, resolveTaxRate } from '../../functions/src/lib/settingsValues';
import { canAdminEditOrder, canCustomerEditOrder, type EditPermissionResult } from '../../services/orders/orderEditRules';

type EditedItemsDay = {
  productId: string;
  productName: string;
  price: number;
  monday: number; tuesday: number; wednesday: number; thursday: number;
  friday: number; saturday: number; sunday: number;
};
type EditedItemsMap = Record<string, EditedItemsDay>;

export const days: Array<{ key: keyof DayQuantities; label: string; full: string }> = [
  { key: 'monday',    label: 'Mon', full: 'Monday'    },
  { key: 'tuesday',   label: 'Tue', full: 'Tuesday'   },
  { key: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { key: 'thursday',  label: 'Thu', full: 'Thursday'  },
  { key: 'friday',    label: 'Fri', full: 'Friday'    },
  { key: 'saturday',  label: 'Sat', full: 'Saturday'  },
  { key: 'sunday',    label: 'Sun', full: 'Sunday'    },
];

export interface EditOrderState {
  // Items
  editedItems: Record<string, any>;
  setEditedItems: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeDays: typeof days;
  hasChanges: boolean;
  setHasChanges: (v: boolean) => void;
  errorMessage: string;
  setErrorMessage: (v: string) => void;

  // Admin-only
  discount: number;
  setDiscount: (v: number) => void;
  discountNote: string;
  setDiscountNote: (v: string) => void;
  discountType: 'percentage' | 'fixed';
  setDiscountType: (v: 'percentage' | 'fixed') => void;
  deliveryFeeEnabled: boolean;
  setDeliveryFeeEnabled: (v: boolean) => void;
  deliveryFee: string;
  setDeliveryFee: (v: string) => void;
  customProducts: Array<{ id: string; name: string; price: number }>;
  setCustomProducts: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; price: number }>>>;
  customProductDays: Record<string, boolean>;
  setCustomProductDays: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  customProductQty: number;
  setCustomProductQty: (v: number) => void;

  // Derived
  editPermission: EditPermissionResult;
  itemsSubtotal: number;
  finalOrderTotal: number;
  /** The totals the server will save (lib/orderRevision rules). */
  totals: OrderTotals & { autoFee: number; creditApplied: number; creditReturned: number; amountDue: number };
  gstRate: number;
  freeDeliveryMin: number;
  /** false → the delivery fee follows the free-delivery rule automatically. */
  feeTouched: boolean;
  setFeeTouched: (v: boolean) => void;

  // Helpers
  getProduct: (productId: string) => Product | undefined;
  getProductTotal: (productId: string) => number;
  getItemSubtotal: (productId: string) => number;
}

export function useEditOrderState(
  order: Order,
  products: Product[],
  isAdmin: boolean
): EditOrderState {
  const [editedItems, setEditedItems] = useState<EditedItemsMap>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeDays, setActiveDays] = useState(days);

  // Admin-only state
  // ✅ FIX: Initialize discount from the correct field based on discountType
  // order.discountPercentage holds % value, order.discount holds $ value
  const initialDiscountType: 'percentage' | 'fixed' =
    (order as any).discountType === 'fixed' ? 'fixed'
    : order.discountPercentage ? 'percentage'
    : order.discount ? 'fixed'
    : 'percentage';
  const initialDiscount =
    initialDiscountType === 'percentage'
      ? (order.discountPercentage || 0)
      : (order.discount || 0);

  const [discount, setDiscount] = useState(initialDiscount);
  const [discountNote, setDiscountNote] = useState(order.discountNote || '');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(initialDiscountType);
  const [deliveryFeeEnabled, setDeliveryFeeEnabled] = useState(order.deliveryFee > 0);
  const [deliveryFee, setDeliveryFee] = useState(
    order.deliveryFee > 0 ? order.deliveryFee.toString() : ''
  );
  const [customProducts, setCustomProducts] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [customProductDays, setCustomProductDays] = useState<Record<string, boolean>>({});
  const [customProductQty, setCustomProductQty] = useState(1);

  // Initialise edited items from order on mount / order change
  useEffect(() => {
    const itemsMap: EditedItemsMap = {};
    const daysWithOrders = new Set<keyof DayQuantities>();

    order.items.forEach((item: OrderItem) => {
      itemsMap[item.productId] = {
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        monday:    item.monday    || 0,
        tuesday:   item.tuesday   || 0,
        wednesday: item.wednesday || 0,
        thursday:  item.thursday  || 0,
        friday:    item.friday    || 0,
        saturday:  item.saturday  || 0,
        sunday:    item.sunday    || 0,
      };
      days.forEach(d => { if ((item[d.key] || 0) > 0) daysWithOrders.add(d.key); });
    });

    setEditedItems(itemsMap);
    const filtered = days.filter(d => daysWithOrders.has(d.key));
    setActiveDays(filtered.length > 0 ? filtered : days);
  }, [order]);

  // Permission check
  const editPermission = isAdmin
    ? canAdminEditOrder(order)
    : canCustomerEditOrder(order);

  // Helpers
  const getProduct = (productId: string) => products.find(p => p.id === productId);

  const getProductTotal = (productId: string): number => {
    const item = editedItems[productId];
    if (!item) return 0;
    return activeDays.reduce((sum, d) => sum + (item[d.key] || 0), 0);
  };

  // ── Prices: exactly what the editOrder Cloud Function will charge ──
  // Lines already on the order keep their price; a catalogue product added
  // now gets the customer's tier price; custom products their own price.
  const { data: settings } = useCachedSettings();
  const { data: customers = [] } = useCachedCustomers(isAdmin);
  const tier: PriceTier =
    (customers as any[]).find((c) => c.id === order.customerId)?.customerType === 'commercial' ? 'commercial' : 'individual';
  const general = (settings ?? null) as Record<string, unknown> | null;
  const gstRate = resolveTaxRate(general);
  const freeDeliveryMin = resolveFreeDeliveryMin(general);
  const standardDeliveryFee = resolveDeliveryFee(general);

  const priceOf = (productId: string): number => {
    const original = order.items.find((it) => it.productId === productId);
    if (original) return original.price || 0;
    if (productId.startsWith('custom-')) return Number(editedItems[productId]?.price) || 0;
    const product = getProduct(productId);
    return product ? unitPriceFor(product as any, tier) : 0;
  };

  const getItemSubtotal = (productId: string): number => round2(getProductTotal(productId) * priceOf(productId));

  const [feeTouched, setFeeTouched] = useState(false);
  const discountFields = discountType === 'percentage'
    ? { discount: 0, discountPercentage: discount }
    : { discount, discountPercentage: 0 };

  const totals = useMemo(() => {
    const items = normalizeItems(
      Object.entries(editedItems).map(([productId, it]) => ({
        ...it,
        productId,
        productName: it.productName ?? getProduct(productId)?.name ?? 'Product',
        price: priceOf(productId),
      }))
    ).filter((it) => it.total > 0);
    const priced = { ...order, ...discountFields } as any;
    const noFee = orderTotals(items, priced, gstRate, { deliveryFee: 0 });
    const autoFee = autoDeliveryFee(round2(noFee.subtotal - noFee.discountAmount), order.deliveryFee, {
      freeDeliveryMin,
      deliveryFee: standardDeliveryFee,
    });
    const fee = feeTouched ? (deliveryFeeEnabled ? Math.max(0, parseFloat(deliveryFee) || 0) : 0) : autoFee;
    const t = orderTotals(items, priced, gstRate, { deliveryFee: fee });
    const creditBefore = round2(Number(order.creditApplied) || 0);
    const creditApplied = round2(Math.min(creditBefore, t.total));
    return {
      ...t,
      autoFee,
      creditApplied,
      creditReturned: round2(creditBefore - creditApplied),
      amountDue: round2(Math.max(0, t.total - creditApplied)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedItems, products, tier, gstRate, freeDeliveryMin, standardDeliveryFee, feeTouched, deliveryFeeEnabled, deliveryFee, discountType, discount, order]);

  const itemsSubtotal = totals.subtotal;
  const finalOrderTotal = totals.total;

  return {
    editedItems, setEditedItems, activeDays, hasChanges, setHasChanges,
    errorMessage, setErrorMessage,
    discount, setDiscount, discountNote, setDiscountNote,
    discountType, setDiscountType,
    deliveryFeeEnabled, setDeliveryFeeEnabled,
    deliveryFee, setDeliveryFee,
    customProducts, setCustomProducts,
    customProductDays, setCustomProductDays,
    customProductQty, setCustomProductQty,
    editPermission,
    itemsSubtotal, finalOrderTotal, totals, gstRate, freeDeliveryMin,
    feeTouched, setFeeTouched,
    getProduct, getProductTotal, getItemSubtotal,
  };
}
