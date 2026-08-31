import type { DayQuantities } from '../types/cart';

// ✅ FIREBASE MODE - cart persisted in Firebase/React state, not localStorage
export interface CartPersistencePayload {
  cart: Record<string, DayQuantities>;
  orderNote: string;
  selectedWeek: number;
}

export function saveCartToLocal(_customerId: string, _cart: any): void {
  // no-op in Firebase mode
}

export function saveCartDebounced(_customerId: string, _cart: any): void {
  // no-op in Firebase mode
}

export function loadCartFromLocal(_customerId: string): CartPersistencePayload | null {
  return null; // cart loaded from React state / Firebase
}

export function clearCartFromLocal(_customerId: string): void {
  // no-op in Firebase mode
}

