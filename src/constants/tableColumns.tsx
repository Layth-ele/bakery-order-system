/**
 * Table Columns Configuration
 * Shared constants for product table column definitions
 * Used across CustomerDashboard, ProductsCatalog, and other table components
 */

import { getWeekDayDate, formatShortDate } from "../utils/weekUtils";
import type { DayQuantities } from "../types";

// Days array - single definition used everywhere
export const DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
] as const;

export type DayKey = keyof DayQuantities;

// Column widths - single source of truth
// Applied via <colgroup> to ensure header and body always match
// ⚠️ NOTE: Tailwind requires full class names (no dynamic interpolation)
// If you need to change widths, update BOTH the constant AND the JSX below
export const COLUMN_WIDTHS = {
  product: { base: "22%", lg: "22%" },
  day: { base: "9%", lg: "7%" },
  total: { base: "10%", lg: "10%" },
  info: { base: "9%", lg: "9%" },
} as const;

// Helper: Render colgroup element for consistent column widths
export function TableColGroup(): JSX.Element | null {
  return (
    <colgroup>
      {/* Product column: wider on mobile (no info col), narrower on desktop */}
      <col className="w-[28%] lg:w-[22%]" />
      
      {/* Day columns: 8% on mobile, 7% on desktop */}
      {DAYS.map((day) => (
        <col key={day.key} className="w-[8%] lg:w-[7%]" />
      ))}
      
      {/* Total column */}
      <col className="w-[16%] lg:w-[9%]" />
      
      {/* Info column - desktop only */}
      <col className="hidden lg:table-column lg:w-[12%]" />
    </colgroup>
  );
}

// Helper: Render day header cells with dates
export function DayHeaderCells({
  selectedWeek,
  selectedYear,
}: {
  selectedWeek: number;
  selectedYear: number;
}): JSX.Element | null {
  return (
    <>
      {DAYS.map((day, index) => {
        // Get the actual Date object for this day
        const dayDate = getWeekDayDate(selectedWeek, index, selectedYear);
        
        return (
          <th
            key={day.key}
            className="px-1.5 sm:px-2 lg:px-3 py-2 sm:py-3 text-center text-white border-l border-dashed border-white/20"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] sm:text-xs md:text-sm font-medium">
                {day.label}
              </span>
              <span className="text-[8px] sm:text-[9px] md:text-xs opacity-80">
                {formatShortDate(dayDate)}
              </span>
            </div>
          </th>
        );
      })}
    </>
  );
}