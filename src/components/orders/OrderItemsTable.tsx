/**
 * OrderItemsTable Component
 * 
 * Reusable component for displaying order items grouped by category
 * with a day-by-day delivery schedule grid.
 * 
 * ✅ MAR 13, 2026: Added day/date display (e.g., "Mon 3/13")
 *   - Shows formatted date below day name for each column
 *   - Calculates dates using getWeekDayDate utility from weekUtilsExport
 * ✅ FEB 18, 2026: Extracted from multiple modal components to reduce duplication
 * 
 * Used in:
 * - PaidOrderDetailsModal
 * - PendingOrderDetailsModal
 * - RejectedOrderDetailsModal
 * - CancelledOrderDetailsModal
 * - CustomerUnpaidOrderDetailsModal
 * - UnpaidOrderDetailsModal
 * - CompletedOrderInvoiceModal
 * - InvoicePreviewModal
 * - AdminOrderViewModal
 */

import { Package } from 'lucide-react';
import type { Order, Product, Category } from '../../types';
import { 
  groupItemsByCategory, 
  DAYS_OF_WEEK, 
  getItemQuantityForDay,
  getShortDayName,
  type DayOfWeek 
} from '../../services/calculators'; // Migrated from utils/orderUtils
import { getWeekDayDate } from '../../utils/weekUtilsExport'; // For displaying dates

interface OrderItemsTableProps {
  order: Order;
  products: Product[];
  categories: Category[];
  
  /** Optional: Show header with icon (default: true) */
  showHeader?: boolean;
  
  /** Optional: Header title (default: "Order Items") */
  headerTitle?: string;
  
  /** Optional: Custom header color classes (default: black/gold gradient) */
  headerClassName?: string;
  
  /** Optional: Custom day cell colors when quantity > 0 */
  activeDayClassName?: string;
  
  /** Optional: Custom day cell colors when quantity = 0 */
  inactiveDayClassName?: string;
  
  /** Optional: Show product prices (default: true) */
  showPrices?: boolean;
  
  /** Optional: Show category color indicators (default: true) */
  showCategoryColors?: boolean;
  
  /** Optional: Compact mode with smaller text and spacing (default: false) */
  compact?: boolean;
}

export function OrderItemsTable({
  order,
  products,
  categories,
  showHeader = true,
  headerTitle = 'Order Items',
  headerClassName = 'bg-gradient-to-r from-[#333333] to-[#4a4238]',
  activeDayClassName = 'bg-green-100 border-green-400',
  inactiveDayClassName = 'bg-white border-gray-200',
  showPrices = true,
  showCategoryColors = true,
  compact = false
}: OrderItemsTableProps): JSX.Element | null {
  
 // Defensive check - ensure categories is an array
  const safeCategories = Array.isArray(categories) ? categories : [];
  
  // Group items by category using shared utility
  const categoryGroups = groupItemsByCategory(order, products, safeCategories);

 // Helper to get formatted date for each day
  const getDayDate = (day: string): string => {
    if (!order.week || !order.year) return '';
    
    const dayIndex: Record<string, number> = {
      monday: 0,
      tuesday: 1,
      wednesday: 2,
      thursday: 3,
      friday: 4,
      saturday: 5,
      sunday: 6
    };
    
    const index = dayIndex[day.toLowerCase()];
    if (index === undefined) return '';
    
    try {
      const date = getWeekDayDate(order.week, index, order.year);
      const month = date.getMonth() + 1; // 0-indexed
      const dayNum = date.getDate();
      return `${month}/${dayNum}`;
    } catch (error) {
      return '';
    }
  };

  // If no items, show empty state
  if (categoryGroups.length === 0) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        {showHeader && (
          <div className={`${headerClassName} px-6 py-3`}>
            <h3 className="text-white font-bold flex items-center gap-2">
              <Package className="w-5 h-5" />
              {headerTitle}
            </h3>
          </div>
        )}
        <div className="p-6 text-center text-gray-500">
          No items in this order
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
      {showHeader && (
        <div className={`${headerClassName} px-6 py-3`}>
          <h3 className="text-white font-bold flex items-center gap-2">
            <Package className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            {headerTitle}
          </h3>
        </div>
      )}

      <div className={compact ? 'p-4 space-y-4' : 'p-6 space-y-6'}>
        {categoryGroups.map(({ category, items }) => (
          <div key={category.id} className={compact ? 'space-y-2' : 'space-y-3'}>
            {/* Category Header */}
            <div className={`flex items-center gap-2.5 ${compact ? 'pb-1.5' : 'pb-2.5'} border-b-2 border-gray-200`}>
              {showCategoryColors && (
                <div 
                  className={compact ? 'w-2.5 h-2.5 rounded-full' : 'w-3 h-3 rounded-full'}
                  style={{ backgroundColor: ((category as any)?.color as string) || '#D4A574' }} 
                  aria-hidden="true"
                />
              )}
              <h4 className={`font-bold text-[#333333] ${compact ? 'text-base' : 'text-lg'}`}>
                {category.name}
              </h4>
            </div>

            {/* Items in Category */}
            <div className={compact ? 'space-y-2' : 'space-y-3'}>
              {items.map((item) => {
                const product = products.find(p => p.id === item.productId);
                // ✅ Custom products (productId starts with "custom-") won't be in catalog
                // Use the stored item name/price as fallback so they still display
                const displayProduct = product ?? (item.productId?.startsWith('custom-') ? {
                  id: item.productId,
                  name: item.productName || 'Custom Product',
                  retail: item.price ?? 0,
                } : null);
                if (!displayProduct) return null;

                return (
                  <div 
                    key={item.productId} 
                    className={`bg-gray-50 border border-gray-200 rounded-lg ${compact ? 'p-3' : 'p-4'}`}
                  >
                    {/* Product Name and Price */}
                    <div className={`flex items-start justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
                      <div>
                        <h5 className={`font-bold text-[#333333] ${compact ? 'text-base' : 'text-lg'}`}>
                          {displayProduct.name}
                        </h5>
                        {showPrices && (
                          <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                            ${(displayProduct as any).retail?.toFixed(2) || item.price?.toFixed(2) || '0.00'} per unit
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Delivery Days Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const quantity = getItemQuantityForDay(item, day as DayOfWeek);
                        const hasQuantity = quantity > 0;
                        const dayDate = getDayDate(day); // Get formatted date

                        return (
                          <div
                            key={day}
                            className={`rounded-lg ${compact ? 'p-2' : 'p-2.5'} text-center border-2 transition-all ${
                              hasQuantity
                                ? activeDayClassName
                                : inactiveDayClassName
                            }`}
                          >
                            <div className={`font-semibold text-gray-600 ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'} capitalize`}>
                              {getShortDayName(day as DayOfWeek)}
                            </div>
                                                  {dayDate && (
                              <div className={`text-gray-500 ${compact ? 'text-[9px] mb-0.5' : 'text-[10px] mb-1'}`}>
                                {dayDate}
                              </div>
                            )}
                            <div className={`font-bold ${hasQuantity ? 'text-green-700' : 'text-gray-400'} ${compact ? 'text-sm' : 'text-lg'}`}>
                              {quantity}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrderItemsTable;