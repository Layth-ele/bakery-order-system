/**
 * WeekSelector.tsx
 * ✅ Extracted week selection UI component
 * ✅ Simplified week selection interface - direct grid access
 * ✅ Visual indicators for selected week and disabled weeks
 * ✅ Responsive design for all device sizes
 * ✅ CRITICAL FIX: Correctly handles year transitions at New Year's
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { getYearForWeek } from "../../../utils/weekSelection";

interface WeekSelectorProps {
  // Week data
  selectedWeek: number;
  selectedYear: number;
  currentWeek: number;
  currentYear: number;
  totalWeeksThisYear: number;

  // UI state
  showWeekSelection: boolean;
  showAllWeeks: boolean;

  // Logic functions
  areAllDaysDisabled: (week: number) => boolean;
  isWeekDisabled: (week: number) => boolean;
  isBeforeThursdayNoon: boolean;

  // Handlers
  onWeekChange: (week: number) => void;
  onToggleWeekSelection: () => void;
  onToggleAllWeeks: () => void;

  // Utility functions
  safeWeekRange: (week: number) => string;
}

export function WeekSelector({
  selectedWeek,
  selectedYear,
  currentWeek,
  currentYear,
  totalWeeksThisYear,
  showWeekSelection,
  showAllWeeks,
  areAllDaysDisabled,
  isWeekDisabled,
  isBeforeThursdayNoon,
  onWeekChange,
  onToggleWeekSelection,
  onToggleAllWeeks,
  safeWeekRange,
}: WeekSelectorProps): JSX.Element | null {
  // ✅ CRITICAL FIX: Calculate next week and its correct year
  const nextWeek =
    currentWeek >= totalWeeksThisYear ? 1 : currentWeek + 1;
  
  // ✅ Get correct years for current and next week (handles New Year transition)
  const currentWeekYear = getYearForWeek(currentWeek, currentWeek, currentYear);
  const nextWeekYear = getYearForWeek(nextWeek, currentWeek, currentYear);

  return (
    <div className="bg-gradient-to-br from-[#3d3832] to-[#2c2416] rounded-xl shadow-lg p-2 border border-[#D4A574]/40 mt-1">


      {/* Current Selection Summary - Always Visible, compact */}
      <div className="flex items-center gap-2 bg-[#1a3331]/60 border border-[#10b981]/50 rounded-xl px-3 py-1.5 mb-1.5">
        <div className="flex-shrink-0 w-6 h-6 bg-[#10b981] rounded-lg flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex items-baseline gap-2 flex-1 min-w-0">
          <span className="text-[#10b981] font-bold text-xs uppercase tracking-wide whitespace-nowrap">Selected:</span>
          <span className="text-white font-bold text-sm">Week {selectedWeek}, {selectedYear}</span>
          <span className="text-[#e8dcc8]/60 text-xs truncate hidden sm:inline">{safeWeekRange(selectedWeek)}</span>
        </div>
        <button
          type="button"
          onClick={onToggleWeekSelection}
          className="flex-shrink-0 text-[#D4A574]/70 hover:text-[#D4A574] transition-colors"
        >
          {showWeekSelection ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expandable Week Selection Options */}
      {showWeekSelection && (
        <div className="space-y-2">
          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-600/50 to-transparent"></div>
            <span className="text-[10px] text-neutral-400 font-medium px-2 py-0.5 bg-[#1a1a1a] rounded-full">
              Select any week
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-600/50 to-transparent"></div>
          </div>

          {/* 53 Week Grid */}
          <div
            className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 gap-2"
            style={{ contain: "layout style" }}
          >
            {Array.from(
              { length: totalWeeksThisYear },
              (_, i) => i + 1,
            ).map((week) => {
              const disabled = isWeekDisabled(week);
              return (
                <button
                  type="button"
                  key={week}
                  onClick={() =>
                    !disabled && onWeekChange(week)
                  }
                  disabled={disabled}
                  className={`flex items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150 py-1.5 ${
                    disabled
                      ? "bg-[#1a1a1a] text-neutral-600 cursor-not-allowed opacity-40"
                      : selectedWeek === week
                        ? "bg-gradient-to-br from-[#D4A574] to-[#B8935F] text-white shadow-md shadow-[#D4A574]/30 scale-105 ring-1 ring-[#D4A574]/50"
                        : "bg-[#3a3a3a] text-white/80 hover:bg-[#D4A574]/60 hover:text-white"
                  }`}
                >
                  {week}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}