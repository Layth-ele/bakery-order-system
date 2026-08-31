import { emptyWeek } from '../types';
import { useState, useEffect } from 'react';
import { 
  saveCartDebounced, 
  loadCartFromLocal, 
  clearCartFromLocal 
} from '../utils/localCartStorageNative';
import type { DayQuantities } from '../types/cart';

// Re-export from canonical types location
export type { DayQuantities } from '../types/cart';
export { emptyWeek } from '../types/cart';

/**
 * Custom hook for managing cart persistence with IndexedDB
 * Handles loading, saving, and clearing cart data
 */
export function useCartPersistence(userId: string) {
  const [cart, setCart] = useState<Record<string, DayQuantities>>({});
  const [orderNote, setOrderNote] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from IndexedDB on mount
  useEffect(() => {
    const loadSavedCart = async () => {
      if (!userId) return;
      
      const savedCart = await loadCartFromLocal(userId);
      if (savedCart) {
        setCart(savedCart.cart);
        setOrderNote(savedCart.orderNote);
        setSelectedWeek(savedCart.selectedWeek);
      }
      setIsLoaded(true);
    };
    
    loadSavedCart();
  }, [userId]);

  // Update day quantity for a product
  const updateDayQuantity = (productId: string, day: keyof DayQuantities, quantity: number) => {
    if (quantity < 0) return;

    setCart((prev) => {
      const current = prev[productId] || emptyWeek;
      const updated: DayQuantities = { ...current, [day]: quantity };

      const total = Object.values(updated).reduce((sum, q) => sum + q, 0);

      let newCart;
      if (total === 0) {
        newCart = { ...prev };
        delete newCart[productId];
      } else {
        newCart = { ...prev, [productId]: updated };
      }

      // Save to IndexedDB (debounced)
      saveCartDebounced(userId, newCart);

      return newCart;
    });
  };

  // Get total quantity for a product across all days
  const getProductTotal = (productId: string): number => {
    const quantities = cart[productId];
    if (!quantities) return 0;
    return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  };

  // Clear cart and remove from IndexedDB
  const clearCart = async () => {
    await clearCartFromLocal(userId);
    setCart({});
    setOrderNote('');
  };

  // Save cart to IndexedDB (manual save)
  const saveCart = () => {
    saveCartDebounced(userId, cart);
  };

  // Update order note
  const updateOrderNote = (note: string) => {
    setOrderNote(note);
    saveCartDebounced(userId, cart);
  };

  // Update selected week
  const updateSelectedWeek = (week: number) => {
    setSelectedWeek(week);
    saveCartDebounced(userId, cart);
  };

  return {
    // State
    cart,
    orderNote,
    selectedWeek,
    isLoaded,
    
    // Setters
    setCart,
    setOrderNote,
    setSelectedWeek,
    
    // Actions
    updateDayQuantity,
    getProductTotal,
    clearCart,
    saveCart,
    updateOrderNote,
    updateSelectedWeek,
  };
}