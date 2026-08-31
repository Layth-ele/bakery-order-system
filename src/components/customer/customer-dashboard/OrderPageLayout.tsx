/**
 * OrderPageLayout.tsx
 * 
 * ✅ MARCH 16, 2026: Clean CSS Grid Layout
 * - Week section scrolls naturally with page
 * - Categories header visible
 * - Products table gets maximum space
 * - Clean 3-section layout
 * - Responsive across all devices
 * 
 * Layout Structure:
 * ┌─────────────────────────────────────┐
 * │ Dashboard Nav (fixed)               │
 * ├─────────────────────────────────────┤
 * │ Week Selection (scrolls)            │
 * ├─────────────────────────────────────┤
 * │ Categories Header (sticky z:30)     │
 * ├─────────────────────────────────────┤
 * │ Products Table (scrolls)            │
 * │                                     │
 * │ [All content scrolls together]      │
 * │                                     │
 * ├─────────────────────────────────────┤
 * │ Order Summary (fixed bottom sheet)  │
 * │ Collapsed: ~90px  Expanded: ≤700px  │
 * └─────────────────────────────────────┘
 * 
 * Bottom padding: pb-[90px] matches collapsed OrderSummaryPanel
 * height precisely (fixed value, not viewport-relative).
 */

import { useRef, useEffect } from "react";
import { Info } from "lucide-react";

import type {
  Product,
  Category,
  DayQuantities,
} from "../../../types";
import type { User } from "../../../hooks/useAuth";
import type { ModalType, ModalProps } from '../../../types/modals';
import type { ModalSize, OverlayBlur } from '../../../ui/modals/BaseModal';

import { WeekSelector } from "./WeekSelector";
import { ProductFiltersAndTableHeader } from "./ProductFiltersAndTableHeader";
import { DebouncedQuantityInput } from "./DebouncedQuantityInput";
import { ProductImagePlaceholder } from "../../../components/shared/ProductImagePlaceholder";
import {
  DAYS,
  TableColGroup,
} from "../../../constants/tableColumns";

interface OrderPageLayoutProps {
  selectedWeek: number;
  selectedYear: number;
  currentWeek: number;
  currentYear: number;
  totalWeeksThisYear: number;
  showWeekSelection: boolean;
  showAllWeeks: boolean;

  categories: Category[];
  products: Product[];
  cart: Record<string, DayQuantities>;
  filteredProducts: Product[];
  selectedCategory: string;

  highlightedProductId: string | null;
  validationErrors: string[];
  isSubmittingOrder: boolean;
  submitError: string | null;
  headerHeight: number;
  summaryPanelHeight?: number;

  lockedDaysForWeek: boolean[];

  areAllDaysDisabled: (week: number) => boolean;
  isWeekDisabled: (week: number) => boolean;
  isBeforeThursdayNoon: boolean;

  onWeekChange: (week: number) => void;
  onCategoryChange: (categoryId: string) => void;
  onUpdateQuantity: (
    productId: string,
    day: keyof DayQuantities,
    quantity: number,
  ) => void;
  onToggleWeekSelection: () => void;
  onToggleAllWeeks: () => void;
  onClearValidationErrors: () => void;
  onClearSubmitError: () => void;

  safeWeekRange: (week: number) => string;
  getProductTotal: (productId: string) => number;
  calculatePrice: (
    product: Product,
    customerType?: string,
  ) => number;

  user: User;

  openModal: <T extends ModalType>(type: T, props: ModalProps<T>, size?: ModalSize, overlayBlur?: OverlayBlur) => void;
}

const emptyWeek: DayQuantities = {
  monday: 0,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  sunday: 0,
};

export function OrderPageLayout({
  selectedWeek,
  selectedYear,
  currentWeek,
  currentYear,
  totalWeeksThisYear,
  showWeekSelection,
  showAllWeeks,
  categories,
  products,
  cart,
  filteredProducts,
  selectedCategory,
  highlightedProductId,
  validationErrors,
  isSubmittingOrder,
  submitError,
  headerHeight,
  summaryPanelHeight = 180,
  areAllDaysDisabled,
  isWeekDisabled,
  isBeforeThursdayNoon,
  onWeekChange,
  onCategoryChange,
  onUpdateQuantity,
  onToggleWeekSelection,
  onToggleAllWeeks,
  onClearValidationErrors,
  onClearSubmitError,
  safeWeekRange,
  getProductTotal,
  calculatePrice,
  user,
  openModal,
  lockedDaysForWeek,
}: OrderPageLayoutProps): JSX.Element | null {
  const productListRef = useRef<HTMLDivElement>(null);

  // Handle quick add to cart from ProductDetailsModal
  const handleQuickAddToCart = (productId: string, dayKey: string, quantity: number) => {
    onUpdateQuantity(productId, dayKey as any, quantity);
  };

  // Scroll to highlighted product
  useEffect(() => {
    if (!highlightedProductId) return;

    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(
        `product-${highlightedProductId}`,
      );
      element?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedProductId, filteredProducts.length]);

  return (
    <div
      className="w-full flex flex-col"
    >
      {/* ========================================
          SECTION 1: WEEK SELECTION
          Shrinks to its natural height, scrolls inside the area
          ======================================== */}
      <div className="flex-shrink-0 px-3 sm:px-4 lg:px-6 py-2 overflow-y-auto">
        <WeekSelector
          selectedWeek={selectedWeek}
          selectedYear={selectedYear}
          currentWeek={currentWeek}
          currentYear={currentYear}
          totalWeeksThisYear={totalWeeksThisYear}
          showWeekSelection={showWeekSelection}
          showAllWeeks={showAllWeeks}
          areAllDaysDisabled={areAllDaysDisabled}
          isWeekDisabled={isWeekDisabled}
          isBeforeThursdayNoon={isBeforeThursdayNoon}
          onWeekChange={onWeekChange}
          onToggleWeekSelection={onToggleWeekSelection}
          onToggleAllWeeks={onToggleAllWeeks}
          safeWeekRange={safeWeekRange}
        />
      </div>

      {/* ========================================
          SECTION 2: CATEGORY PILLS + TABLE HEADER
          flex-shrink-0 so it NEVER shrinks away — always visible
          No longer needs sticky/stickyTop since it's in a fixed-height flex column
          ======================================== */}
      <div className="flex-shrink-0 px-3 lg:px-6">
        <ProductFiltersAndTableHeader
          categories={categories}
          products={products}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          selectedWeek={selectedWeek}
          selectedYear={selectedYear}
          stickyTop={0}
        />
      </div>

      {/* ========================================
          SECTION 3: PRODUCTS TABLE
          Min-height ensures 5 rows always visible above summary panel
          ======================================== */}
      <div className="px-3 lg:px-6 flex flex-col">
        <div
          ref={productListRef}
          className="flex flex-col bg-white/90 rounded-b-xl shadow-md border border-[#D4A574]/30 border-t-0"
        >
          {/* Product list — scrollable when many products */}
          <div className="overflow-x-auto" style={{ minHeight: '270px', maxHeight: '65vh' }}>
                {filteredProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <div className="w-16 h-16 bg-[#f5f1eb] rounded-full flex items-center justify-center mb-4">
                      <span className="text-3xl">🍞</span>
                    </div>
                    <p className="text-[#8B6F47] font-semibold text-base mb-1">No products in this category</p>
                    <p className="text-[#8B6F47]/60 text-sm">Try selecting a different category above</p>
                  </div>
                )}
            <div className="min-w-[320px]">
              <table className="w-full table-fixed products-table">
                <TableColGroup />
                <tbody>
                {filteredProducts.map((product, index) => {
                  const quantities = cart[product.id] || emptyWeek;
                  const productTotal = getProductTotal(product.id);
                  const finalPrice = calculatePrice(product, user.customerType);
                  const isHighlighted = highlightedProductId != null && highlightedProductId === product.id;

                  return (
                    <tr
                      key={product.id}
                      id={`product-${product.id}`}
                      className={`transition-all duration-300 hover:bg-[#D4A574]/5 ${
                        isHighlighted
                          ? "bg-gradient-to-r from-[#D4A574]/20 via-[#D4A574]/10 to-transparent border-l-4 border-[#D4A574]"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-[#faf8f5]"
                      }`}
                    >
                      {/* Product Name & Info Column */}
                      <td className="px-1.5 sm:px-2 lg:px-4 py-1 lg:py-2 border-r border-dashed border-[#D4A574]/20">
                        <div className="flex items-center gap-1.5">
                          {/* Image: desktop only — placeholder if no image */}
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={(product.name ?? "")}
                              className="hidden lg:block w-8 h-8 object-cover rounded-lg flex-shrink-0"
                            />
                          ) : (
                            <ProductImagePlaceholder
                              size="sm"
                              className="hidden lg:flex w-8 h-8 flex-shrink-0"
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            {/* Name + Info icon (always visible on mobile) */}
                            <div className="flex items-start gap-1">
                              <span className="text-[#3d3832] text-[10px] sm:text-xs lg:text-sm font-semibold leading-tight line-clamp-2">
                                {(product.name ?? "")}
                              </span>
                              {/* Info icon — mobile only; lg+ uses the dedicated Info column */}
                              <button
                                type="button"
                                onClick={() =>
                                  openModal("PRODUCT_DETAILS", {
                                    product,
                                    products,
                                    onAddToCart: handleQuickAddToCart,
                                    lockedDaysForWeek,
                                    selectedWeek,
                                    selectedYear,
                                  })
                                }
                                className="lg:hidden flex-shrink-0 p-0.5 text-[#D4A574] hover:text-[#8B6F47] transition-colors mt-0.5"
                                title="Product Info"
                              >
                                <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                            </div>
                            {/* Price */}
                            <span className="text-emerald-600 font-bold text-[10px] sm:text-xs block mt-0.5">
                              ${finalPrice.toFixed(2)}
                            </span>
                            {/* Min order - desktop only */}
                            {(product.dailyMinOrder ?? 0) > 0 && (
                              <span className="hidden lg:block text-amber-600 text-[10px] mt-0.5">
                                Min: {product.dailyMinOrder}/day
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Day Columns */}
                      {DAYS.map((day, dayIndex) => {
                        const qty = quantities[day.key];
                        const hasError = qty > 0 && qty < (product.dailyMinOrder ?? 0);
                        const isLocked = lockedDaysForWeek?.[dayIndex] ?? false;

                        return (
                          <td
                            key={day.key}
                            className="px-0.5 sm:px-1 lg:px-2 py-1 lg:py-2 border-l border-dashed border-[#D4A574]/20"
                          >
                            <DebouncedQuantityInput
                              value={qty || 0}
                              onChange={(newValue) =>
                                onUpdateQuantity(
                                  product.id,
                                  day.key,
                                  newValue,
                                )
                              }
                              disabled={isLocked}
                              hasError={hasError}
                              min={0}
                              placeholder="0"
                              title={
                                isLocked
                                  ? "Ordering closed (48h cutoff)"
                                  : ""
                              }
                              // debounceMs={300}
                            />
                          </td>
                        );
                      })}

                      {/* Total Column */}
                      <td className="px-1 lg:px-3 py-1 lg:py-2 text-center border-l border-dashed border-[#D4A574]/20">
                        <span className="text-[#3d3832] font-bold text-[10px] sm:text-xs lg:text-sm">
                          {productTotal}
                        </span>
                      </td>

                      {/* Info Button Column (Desktop) */}
                      <td className="hidden lg:table-cell px-2 lg:px-4 py-1.5 lg:py-2 text-center border-l border-dashed border-[#D4A574]/20">
                        <button
                          type="button"
                          onClick={() =>
                            openModal("PRODUCT_DETAILS", {
                              product,
                              products,
                              onAddToCart: handleQuickAddToCart,
                              lockedDaysForWeek,
                              selectedWeek,
                              selectedYear,
                            })
                          }
                          className="p-2 text-[#D4A574] hover:bg-[#f5f1eb] rounded transition-colors"
                        >
                          <Info className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Footer — always visible, pinned above OrderSummaryPanel */}
          <div className="flex-shrink-0 bg-[#f5f1eb] border-t border-[#D4A574]/20 px-4 py-1.5 flex items-center justify-between rounded-b-xl">
            <span className="text-[#8B6F47] text-xs font-medium">
              {filteredProducts.length === 0
                ? "No products found"
                : `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}${selectedCategory === "__discounted__" ? " on sale" : " in this category"}`
              }
            </span>
            {filteredProducts.length > 4 && (
              <span className="text-[#D4A574]/60 text-[10px]">
                Scroll to see all ↑
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}