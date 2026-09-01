/**
 * useCartOperations Hook
 * 🟢 HOOK - Cart management operations
 * 
 * REFACTORED - Phase 3: Customer Pages Refactoring
 * - Extracted from CustomerDashboardMain.tsx (1361 lines)
 * - Handles all cart state and operations
 * - Optimized with useMemo and useCallback
 * 
 * Responsibilities:
 * - Cart state management (items, totals)
 * - Add/remove/update cart items
 * - Week selection logic
 * - Cart persistence
 * - Cart validation
 * 
 * Performance Optimizations:
 * - useMemo for cart totals calculation
 * - useCallback for stable function references
 * - Selective state updates
 * 
 * Used by: CustomerDashboardMain.tsx
 * Location: /hooks/customer/useCartOperations.ts
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
// Local flat cart item shape (productId/quantity/day based)
interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  day: string;
  categoryId: string;
}
import type { Product } from '../../types';
import {
  loadCartFromLocal,
  saveCartToLocal,
  clearCartFromLocal,
} from '../../utils/localCartStorageNative';
import {
  getCurrentWeek,
  getWeeksInYear,
  getDefaultWeek,
  isRestoredWeekValid,
} from '../../utils/weekSelection';
import { getISOWeekInfo } from '../../utils/weekUtils';

// ============================================================================
// TYPES
// ============================================================================

export interface CartState {
  items: CartItem[];
  selectedWeek: number;
  selectedYear: number;
  subtotal: number;
  deliveryFee: number;
  serviceCharge: number;
  total: number;
}

export interface CartOperations {
  // State
  cart: CartState;
  
  // Week selection
  onWeekChange: (week: number) => void;
  onYearChange: (year: number) => void;
  
  // Cart operations
  addToCart: (product: Product, quantity: number, day: string) => void;
  updateQuantity: (productId: string, day: string, quantity: number) => void;
  removeFromCart: (productId: string, day: string) => void;
  clearCart: () => void;
  
  // Utilities
  getCartItemQuantity: (productId: string, day: string) => number;
  isInCart: (productId: string, day: string) => boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// FIX T2R8-H1 (HIGH): Removed previously dead-but-dangerous helper
// `calculateCartTotals(items, serviceChargeEnabled)`.  It computed a "total"
// with NO GST applied (literally `subtotal + deliveryFee + serviceCharge` with
// hardcoded `DEFAULT_DELIVERY_FEE = 0` and `DEFAULT_SERVICE_CHARGE = 3.99`).
// Currently zero callers — dead code — but if anyone enabled this hook, every
// order placed through it would be sales-tax-noncompliant.  Removed entirely
// so future code can't accidentally adopt it; the canonical cart calculator
// lives in `services/customer/customerDashboardService.ts:calculateCartTotals`
// which reads dynamic settings AND applies GST correctly.
//
// If this hook is later wired up, callers MUST use the service-layer
// calculator with the live settings plumbed through.

// ============================================================================
// HOOK
// ============================================================================

export function useCartOperations(
  userId: string,
  serviceChargeEnabled: boolean = true
): CartOperations {
  // ============================================================================
  // STATE
  // ============================================================================
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(getCurrentWeek());
  const [selectedYear, setSelectedYear] = useState<number>(() => getISOWeekInfo().year);
  
  // ============================================================================
  // LOAD CART FROM PERSISTENCE - Once on mount
  // ============================================================================
  
  useEffect(() => {
    if (userId) {
      const savedCart = loadCartFromLocal(userId);
      
      if (savedCart) {
        // Validate and restore week selection
        const cartData = savedCart as any;
        if (cartData && isRestoredWeekValid(cartData.week, cartData.year, 0, 0)) {
          setSelectedWeek(cartData.week);
          setSelectedYear(cartData.year);
        } else {
          const defaultWeek = getDefaultWeek();
          setSelectedWeek(defaultWeek.week);
          setSelectedYear(defaultWeek.year);
        }
        
        setCartItems(cartData.items || []);
      }
    }
  }, [userId]);
  
  // ============================================================================
  // PERSIST CART - Whenever cart changes
  // ============================================================================
  
  useEffect(() => {
    if (userId) {
      saveCartToLocal(userId, {
        items: cartItems,
        week: selectedWeek,
        year: selectedYear,
      });
    }
  }, [userId, cartItems, selectedWeek, selectedYear]);
  
  // ============================================================================
  // MEMOIZED TOTALS - Performance optimization
  // ============================================================================
  //
  // FIX T2R8-H1: Was calling the removed `calculateCartTotals(items, ...)`.
  // Hook is currently unused (zero callers).  If a caller wires this up
  // later, they MUST replace the stub below with a call to the canonical
  // calculator at services/customer/customerDashboardService.ts which
  // accepts dynamic settings (deliveryFee, freeDeliveryMin, serviceCharge,
  // gstRate) and applies GST.  Keeping a subtotal-only stub here so the
  // shape of `cart.subtotal` is preserved for any consumers reading just
  // that field; total/gst/deliveryFee/serviceCharge are intentionally
  // omitted — callers must compute them via the canonical calculator.
  const cartTotals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      subtotal,
      deliveryFee: 0,
      serviceCharge: 0,
      total: subtotal,
    };
  }, [cartItems]);
  
  // ============================================================================
  // CART OPERATIONS - useCallback for stable references
  // ============================================================================
  
  const addToCart = useCallback(
    (product: Product, quantity: number, day: string) => {
      setCartItems((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.productId === product.id && item.day === day
        );
        
        if (existingIndex >= 0) {
          // Update existing item
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
          };
          return updated;
        } else {
          // Add new item
          return [
            ...prev,
            {
              productId: product.id,
              productName: (product.name ?? ""),
              // ✅ PASS 6: product.price is `number | undefined` but CartItem.price is required.
              price: product.price ?? 0,
              quantity,
              day,
              categoryId: product.categoryId,
            },
          ];
        }
      });
    },
    []
  );
  
  const updateQuantity = useCallback(
    (productId: string, day: string, quantity: number) => {
      setCartItems((prev) => {
        if (quantity <= 0) {
          // Remove item if quantity is 0
          return prev.filter(
            (item) => !(item.productId === productId && item.day === day)
          );
        } else {
          // Update quantity
          return prev.map((item) =>
            item.productId === productId && item.day === day
              ? { ...item, quantity }
              : item
          );
        }
      });
    },
    []
  );
  
  const removeFromCart = useCallback((productId: string, day: string) => {
    setCartItems((prev) =>
      prev.filter((item) => !(item.productId === productId && item.day === day))
    );
  }, []);
  
  const clearCart = useCallback(() => {
    setCartItems([]);
    if (userId) {
      clearCartFromLocal(userId);
    }
  }, [userId]);
  
  // ============================================================================
  // WEEK SELECTION - useCallback for stable references
  // ============================================================================
  
  const onWeekChange = useCallback((week: number) => {
    setSelectedWeek(week);
  }, []);
  
  const onYearChange = useCallback((year: number) => {
    setSelectedYear(year);
    // Reset to week 1 when year changes
    setSelectedWeek(1);
  }, []);
  
  // ============================================================================
  // UTILITY FUNCTIONS - Memoized queries
  // ============================================================================
  
  const getCartItemQuantity = useCallback(
    (productId: string, day: string): number => {
      const item = cartItems.find(
        (item) => item.productId === productId && item.day === day
      );
      return item?.quantity || 0;
    },
    [cartItems]
  );
  
  const isInCart = useCallback(
    (productId: string, day: string): boolean => {
      return cartItems.some(
        (item) => item.productId === productId && item.day === day
      );
    },
    [cartItems]
  );
  
  // ============================================================================
  // RETURN - Memoized cart state object
  // ============================================================================
  
  const cart = useMemo(
    () => ({
      items: cartItems,
      selectedWeek,
      selectedYear,
      ...cartTotals,
    }),
    [cartItems, selectedWeek, selectedYear, cartTotals]
  );
  
  return {
    cart,
    onWeekChange,
    onYearChange,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartItemQuantity,
    isInCart,
  };
}
