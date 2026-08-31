/**
 * ProductFiltersAndTableHeader.tsx
 * ✅ Category pills: flex-wrap on mobile, flows naturally to next row
 * ✅ Table header: Info column hidden on mobile (<lg)
 * ✅ Aligned with TableColGroup column widths
 */

import { getWeekDayDate, formatShortDate } from "../../../utils/weekUtils";
import type { Category } from "../../../types";
import { DAYS, TableColGroup } from "../../../constants/tableColumns";

interface ProductFiltersAndTableHeaderProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  selectedWeek: number;
  selectedYear: number;
  stickyTop?: number;
  products?: import('../../../types').Product[];
}

export function ProductFiltersAndTableHeader({
  categories,
  selectedCategory,
  onCategoryChange,
  selectedWeek,
  selectedYear,
  products = [],
}: ProductFiltersAndTableHeaderProps): JSX.Element | null {

  const pillBase = "px-2 sm:px-3.5 py-0.5 sm:py-1.5 rounded-full border text-[10px] sm:text-xs font-semibold transition-all duration-150 leading-tight whitespace-nowrap flex-shrink-0";
  const pillActive = "bg-[#D4A574] text-white border-[#D4A574] shadow-sm";
  const pillInactive = "bg-white text-[#5a4535] border-[#D4A574]/40 hover:bg-[#f5f1eb] hover:border-[#D4A574]/60";
  const pillDiscount = "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400";
  const pillDiscountActive = "bg-emerald-500 text-white border-emerald-500 shadow-sm";

  return (
    <section aria-label="Product filters and table header" className="w-full">
      <div className="bg-white border-b-2 border-[#D4A574]/30 shadow-sm">

        {/* ── Category pills ── */}
        <div className="px-2 sm:px-4 lg:px-6 py-1.5 sm:py-2.5 border-b border-[#D4A574]/15">
          {/* Header bar */}
          <div className="bg-gradient-to-r from-[#8B6F47] to-[#D4A574] -mx-2 sm:-mx-4 lg:-mx-6 px-3 sm:px-5 py-1.5 mb-2 sm:mb-2.5 -mt-2.5">
            <p className="text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-widest">
              Filter By Category
            </p>
          </div>
          {/* Mobile: horizontal scroll | Desktop: wrap */}
          <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 scrollbar-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {/* All Products */}
            <button
              type="button"
              onClick={() => onCategoryChange("all")}
              className={`${pillBase} ${selectedCategory === "all" ? pillActive : pillInactive}`}
            >
              All Products
            </button>
            {/* Discounted — directly after All Products, with count badge */}
            {(() => {
              const discountedCount = products.filter(p => (p.discount ?? 0) > 0).length;
              return (
                <button
                  type="button"
                  onClick={() => onCategoryChange("__discounted__")}
                  className={`${pillBase} ${selectedCategory === "__discounted__" ? pillDiscountActive : pillDiscount} flex items-center gap-1`}
                >
                  <span>🏷️ Discounted</span>
                  {discountedCount > 0 && (
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${selectedCategory === "__discounted__" ? "bg-white text-emerald-600" : "bg-emerald-500 text-white"}`}>
                      {discountedCount}
                    </span>
                  )}
                </button>
              );
            })()}
            {/* Deduplicated category pills */}
            {Array.from(
              new Map(categories.map((cat) => [cat.id, cat])).values()
            ).map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`${pillBase} ${selectedCategory === cat.id ? pillActive : pillInactive}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table column header — synced with TableColGroup widths ── */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <TableColGroup />
            <thead>
              <tr className="bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
                {/* Product column */}
                <th className="px-2 sm:px-3 lg:px-4 py-1.5 text-left text-white text-[10px] sm:text-xs font-bold border-r border-dashed border-white/20">
                  Product
                </th>

                {/* Day columns */}
                {DAYS.map((day, dayIndex) => {
                  const dayDate = getWeekDayDate(selectedWeek, dayIndex, selectedYear);
                  return (
                    <th
                      key={day.key}
                      className="px-0.5 sm:px-1 py-1.5 text-center text-white text-[9px] sm:text-[10px] font-bold border-l border-dashed border-white/20"
                    >
                      <div className="whitespace-nowrap">{day.label}</div>
                      <div className="text-[8px] sm:text-[9px] opacity-80 font-normal">
                        {formatShortDate(dayDate)}
                      </div>
                    </th>
                  );
                })}

                {/* Total column */}
                <th className="px-1 py-1.5 text-center text-white text-[10px] sm:text-xs font-bold border-l border-dashed border-white/20">
                  Total
                </th>

                {/* Info column — desktop only */}
                <th className="hidden lg:table-cell px-2 py-1.5 text-center text-white text-xs font-bold border-l border-dashed border-white/20">
                  Info
                </th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
    </section>
  );
}
