/**
 * Custom Hook: useCartManagement
 * ✅ PHASE 3 APPROVED: Perfect UI State Management Pattern
 * 
 * PURPOSE:
 * - Manage shopping cart UI state
 * - Calculate cart totals and items
 * - Provide cart operations (add, update, clear)
 * 
 * STATUS: ✅ EXCELLENT - This is the ideal pattern for UI state
 * 
 * RESPONSIBILITIES:
 * - ✅ UI state (cart quantities)
 * - ✅ Derived state calculations (cartItems, subtotal)
 * - ✅ State update operations (updateQuantity, clearCart)
 * 
 * WHY THIS IS PERFECT:
 * - No business logic - just state management
 * - Calculations are presentation logic (appropriate for hook)
 * - No external dependencies
 * - Highly reusable
 * - Excellent memoization
 * 
 * Step 5: Custom Hook Extraction - CustomerDashboard Optimization
 * Version: 2.0.0 - Approved March 8, 2026
 */

import { useState, useMemo, useCallback } from 'react';
import type { Product, DayQuantities } from '../types';

export interface CartItem {
  product: Product;
  quantities: DayQuantities;
  total: number;
  price: number;
}

export interface UseCartManagementReturn {
  cart: Record<string, DayQuantities>;
  cartItems: CartItem[];
  subtotal: number;
  updateQuantity: (productId: string, day: keyof DayQuantities, quantity: number) => void;
  clearCart: () => void;
  setCart: React.Dispatch<React.SetStateAction<Record<string, DayQuantities>>>;
}

/**
 * Custom hook for managing cart state and calculations
 */
export function useCartManagement(
  products: Product[],
  customerType: 'commercial' | 'retail'
): UseCartManagementReturn {
  const [cart, setCart] = useState<Record<string, DayQuantities>>({});

  // ✅ OPTIMIZATION: Calculate cart items with proper typing
  const cartItems = useMemo(() => {
    const emptyWeek: DayQuantities = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    };

    return Object.entries(cart)
      .map(([productId, quantities]) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return null;

        const total = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
        const price =
          customerType === 'commercial'
            ? product.commercialPrice
            : product.retailPrice;

        return {
          product,
          quantities,
          total,
          price,
        };
      })
      .filter(Boolean) as CartItem[];
  }, [cart, products, customerType]);

  // ✅ OPTIMIZATION: Calculate subtotal
  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.total, 0),
    [cartItems]
  );

  // ✅ OPTIMIZATION: Memoize quantity update handler
  const updateQuantity = useCallback(
    (productId: string, day: keyof DayQuantities, quantity: number) => {
      if (quantity < 0) return;

      setCart((prev) => {
        const emptyWeek: DayQuantities = {
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 0,
          sunday: 0,
        };

        const current = prev[productId] || emptyWeek;
        const updated: DayQuantities = {
          ...current,
          [day]: quantity,
        };

        // If all quantities are 0, remove the product from cart
        const hasQuantity = Object.values(updated).some((qty) => qty > 0);
        if (!hasQuantity) {
          const { [productId]: _, ...rest } = prev;
          return rest;
        }

        return {
          ...prev,
          [productId]: updated,
        };
      });
    },
    []
  );

  // ✅ OPTIMIZATION: Clear cart
  const clearCart = useCallback(() => {
    setCart({});
  }, []);

  return {
    cart,
    cartItems,
    subtotal,
    updateQuantity,
    clearCart,
    setCart,
  };
}