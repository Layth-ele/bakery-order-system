/**
 * useCartLoader
 *
 * Loads the saved cart from IndexedDB on mount and restores the selected week.
 * Extracted from CustomerDashboardMain to reduce its size.
 */
import { useEffect } from 'react';
import { loadCartFromLocal } from '../../utils/localCartStorageNative';
import { getInitialOrderWeek, getYearForWeek, isRestoredWeekValid } from '../../utils/weekSelection';
import { areAllDaysDisabled as areAllDaysDisabledUtil } from '../../utils/weekUtils';
import type { DayQuantities } from '../../types/cart';

interface CartLoaderOptions {
  userId: string;
  currentWeek: number;
  currentYear: number;
  setCart: (cart: Record<string, DayQuantities>) => void;
  setOrderNote: (note: string) => void;
  setSelectedWeek: (week: number) => void;
}

export function useCartLoader({
  userId,
  currentWeek,
  currentYear,
  setCart,
  setOrderNote,
  setSelectedWeek,
}: CartLoaderOptions) {
  useEffect(() => {
    if (!userId) return;

    // RACE-CONDITION FIX: if userId changes (logout → re-login as different user)
    // before the async loadCartFromLocal resolves, the cleanup sets `cancelled`
    // so the stale cart data is never written to the new user's state.
    let cancelled = false;

    Promise.resolve(loadCartFromLocal(userId)).then(savedCart => {
      if (cancelled || !savedCart) return;

      setCart((savedCart as any).cart);
      setOrderNote((savedCart as any).orderNote);

      const restoredWeek = (savedCart as any).selectedWeek;
      const restoredYear =
        (savedCart as any).selectedYear ?? getYearForWeek(restoredWeek, currentWeek, currentYear);

      const weekStillValid = isRestoredWeekValid(
        restoredWeek,
        (savedCart as any).selectedYear,
        currentWeek,
        currentYear,
      );

      if (weekStillValid && !areAllDaysDisabledUtil(restoredWeek, currentYear)) {
        setSelectedWeek(restoredWeek);
      } else {
        setSelectedWeek(getInitialOrderWeek());
      }
    });

    return () => { cancelled = true; };
  }, [userId, currentWeek, currentYear, setCart, setOrderNote, setSelectedWeek]);
}
