/**
 * Week Utilities Export
 * 
 * ✅ PRODUCTION-SAFE: Re-exports week utilities without demo data dependency
 * This module provides a clean interface for services to import week utilities
 */

export {
  getISOWeekInfo,
  getCurrentWeekNumber,
  getCurrentYear,
  getWeekInfoByNumber,
  getWeeksInYear,
  isNearYearEnd,
  isWeekInPast,
  getWeekRange,
  getWeekStartDate,
  getWeekDayDate,
  formatShortDate,
  isDayWithin48Hours,
  areAllDaysDisabled,
  resolveWeekYear,
  getYearForWeek,
} from './weekUtils';
