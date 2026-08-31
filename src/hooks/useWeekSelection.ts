/**
 * Custom Hook: useWeekSelection
 * Manages week selection state and calculations for the Customer Dashboard
 * 
 * Step 5: Custom Hook Extraction - CustomerDashboard Optimization
 */

import {useState, useCallback} from 'react'
import { 
  getCurrentWeekNumber, 
  getTotalWeeksInYear,
  getWeekRange as getWeekRangeUtil
} from '../utils/time/vancouverCutoff';

export interface UseWeekSelectionReturn {
  selectedWeek: number;
  selectedYear: number;
  currentWeek: number;
  currentYear: number;
  totalWeeksThisYear: number;
  setSelectedWeek: (week: number) => void;
  setSelectedYear: (year: number) => void;
  getWeekRange: (week: number, year: number) => string;
  getYearForWeek: (targetWeek: number, currentWeek: number, currentYear: number) => number;
}

/**
 * Custom hook for managing week selection state and calculations
 */
export function useWeekSelection(): UseWeekSelectionReturn {
  // ✅ Get current week and year (Vancouver timezone)
  const currentWeek = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  const totalWeeksThisYear = getTotalWeeksInYear(currentYear);

  // ✅ State: Selected week and year
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // ✅ OPTIMIZATION: Memoize week range calculation
  const getWeekRange = useCallback((week: number, year: number): string => {
    return getWeekRangeUtil(week, year);
  }, []);

  // ✅ OPTIMIZATION: Calculate year for week (handles year transitions)
  const getYearForWeek = useCallback(
    (targetWeek: number, currentWeek: number, currentYear: number): number => {
      // If target week is 1 and we're at the end of the year, it's next year
      if (targetWeek === 1 && currentWeek >= totalWeeksThisYear) {
        return currentYear + 1;
      }
      return currentYear;
    },
    [totalWeeksThisYear]
  );

  return {
    selectedWeek,
    selectedYear,
    currentWeek,
    currentYear,
    totalWeeksThisYear,
    setSelectedWeek,
    setSelectedYear,
    getWeekRange,
    getYearForWeek,
  };
}
