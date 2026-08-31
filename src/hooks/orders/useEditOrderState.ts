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

  const getItemSubtotal = (productId: string): number => {
    const product = getProduct(productId);
    const price = product ? ((product.retail ?? product.price ?? product.wholesale ?? 0) as number) : 0;
    return getProductTotal(productId) * price;
  };

  const itemsSubtotal = useMemo(
    () => Object.keys(editedItems).reduce((sum, id) => sum + getItemSubtotal(id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editedItems, products, activeDays]
  );

  const finalOrderTotal = useMemo(() => {
    const fee = deliveryFeeEnabled ? parseFloat(deliveryFee) || 0 : 0;
    const disc = discountType === 'percentage'
      ? itemsSubtotal * (discount / 100)
      : discount;
    // ✅ FIX: GST calculated on (subtotal - discount) — not on pre-discount amount
    const taxableBase = Math.max(0, itemsSubtotal - disc);
    const gst = Math.round((taxableBase * 0.05 + Number.EPSILON) * 100) / 100;
    return Math.max(0, taxableBase + gst + fee);
  }, [itemsSubtotal, deliveryFeeEnabled, deliveryFee, discountType, discount]);

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
    itemsSubtotal, finalOrderTotal,
    getProduct, getProductTotal, getItemSubtotal,
  };
}
