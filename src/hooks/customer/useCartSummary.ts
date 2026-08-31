/**
 * useCartSummary
 *
 * Derives cart items, subtotal, and validates order readiness.
 * Extracted from CustomerDashboardMain to reduce its size.
 */
import { getWeekRange } from '../../utils/weekUtils';
import type { OrderValidationResult } from '../../types';
import { useMemo, useCallback } from 'react';
import { areAllDaysDisabled } from '../../utils/weekUtils';
import { DAY_LABELS } from '../../types/customer-dashboard';
import type { Product } from '../../types';
import type { DayQuantities } from '../../types/cart';

interface CartItem {
  product: Product;
  quantities: DayQuantities;
  total: number;
  price: number;
}

interface UseCartSummaryOptions {
  cart: Record<string, DayQuantities>;
  products: Product[];
  selectedWeek: number;
  selectedYear: number;
  calculatePrice: (product: Product, customerType?: string) => number;
  customerType?: string;
}

export function useCartSummary({
  cart,
  products,
  selectedWeek,
  selectedYear,
  calculatePrice,
  customerType,
}: UseCartSummaryOptions) {
  const cartItems = useMemo<CartItem[]>(() => {
    return Object.entries(cart)
      .map(([productId, quantities]) => {
        const product = products.find(p => p.id === productId);
        if (!product) return null;
        const total = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
        const price = calculatePrice(product, customerType);
        return { product, quantities, total, price };
      })
      .filter(Boolean) as CartItem[];
  }, [cart, products, customerType, calculatePrice]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.total, 0),
    [cartItems]
  );

  const validateOrder = useCallback((): OrderValidationResult => {
    const errors: string[] = [];

    if (areAllDaysDisabled(selectedWeek, selectedYear)) {
      const weekRange = getWeekRange(selectedWeek, selectedYear);
      errors.push(
        `⏰ The delivery week ending ${weekRange} is fully past the 48-hour order cutoff (Vancouver time). Please select a future week.`
      );
      return { isValid: false, errors };
    }

    Object.entries(cart).forEach(([productId, quantities]) => {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      DAY_LABELS.forEach(d => {
        const qty = quantities[d.key as keyof DayQuantities];
        if (qty > 0 && qty < (product.dailyMinOrder ?? 0)) {
          errors.push(`${product.name} on ${d.label}: ${qty} ordered, minimum is ${(product.dailyMinOrder ?? 0)}`);
        }
      });
    });

    return { isValid: errors.length === 0, errors };
  }, [cart, products, selectedWeek, selectedYear]);

  return { cartItems, subtotal, validateOrder };
}
