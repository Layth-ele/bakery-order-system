/**
 * Edit Order Page Component
 * 
 * ✅ MAR 13, 2026: Major UI Refactor - Order Items + Order Summary Sections
 *   - Replaced Products table with Order Items section (grouped by category)
 *   - Added Order Summary section with amber gradient styling
 *   - Products now show in individual cards with date display (Mon 3/16, etc.)
 *   - Moved admin controls (Discount, Delivery Fee, Custom Products) after Order Items
 * ✅ FEB 16, 2026: Converted to StyleModalShell for premium design consistency
 * ✅ FEB 15, 2026: Refactored to use EditOrderPage component
 * 
 * Wraps EditOrderPage component with modal shell.
 *
 * Features:
 * - Customer direct save to pending orders
 * - Admin direct save to any editable order
 * - Navigation to order history
 */

import {X, Save, AlertTriangle, Calendar, Package, Tag, Truck, Plus, DollarSign} from 'lucide-react'
import { useState } from 'react';
import {Order, Product, Category} from '../../types'
import { DayQuantities } from '../../types/order-flow';
import {canCustomerEditOrder} from '../../services/orders/orderEditRules'
import { formatShortDate, getWeekDayDate } from '../../utils/weekUtils';
import { useModal } from '../../contexts/ModalContextNew';
import { useEditOrderState, days } from '../../hooks/orders/useEditOrderState';
import { toDate } from '../../utils/timestampFormatting';
import { logger } from '../../utils/logger';

// ❌ REMOVED: createRevision, submitRevision - revisions feature removed

interface EditOrderPageProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onSave: (result: any) => void; // Changed to accept result object
  onCancel: () => void;
  isAdmin: boolean;
  onNavigateToHistory?: (orderId: string) => void;
}

// Note: `days` is imported from useEditOrderState above

export function EditOrderPage({
  order,
  products,
  categories,
  onSave,
  onCancel,
  isAdmin,
  onNavigateToHistory,
}: EditOrderPageProps): JSX.Element | null {
  const { openModal } = useModal(); // Add modal hook for confirmation modal
  
 // Safety check - prevent crash if products/categories are undefined
  if (!products || !categories) {
    if (import.meta.env.DEV) console.error('❌ [EditOrderPage] Missing required props:', { 
      hasProducts: !!products, 
      hasCategories: !!categories,
      productsLength: products?.length,
      categoriesLength: categories?.length,
    });
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-4">⚠️ Unable to load order editor</div>
        <p className="text-neutral-600 mb-4">Required data is missing. Please try again.</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-[#D4A574] text-white rounded-lg hover:bg-[#8B6F47] transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  // Convert order items to editable format
  const {
    editedItems, setEditedItems, activeDays, hasChanges, setHasChanges,
    errorMessage, setErrorMessage,
    discount, setDiscount, discountNote, setDiscountNote,
    discountType, setDiscountType,
    deliveryFeeEnabled, setDeliveryFeeEnabled,
    deliveryFee, setDeliveryFee,
    customProducts, setCustomProducts,
    customProductDays, setCustomProductDays,
    customProductQty, setCustomProductQty,
    editPermission, itemsSubtotal, finalOrderTotal,
    getProduct, getProductTotal, getItemSubtotal,
  } = useEditOrderState(order, products, isAdmin);

  // FIX T2R4-C4 part A (CRITICAL): Custom product name/price were previously
  // uncontrolled DOM inputs read via document.getElementById('custom-product-name').
  // That bypassed React state and broke if the component re-mounted, if two
  // copies of this view existed, or in test environments where DOM IDs aren't
  // stable.  Now controlled — the handler reads from React state.
  const [customProductName, setCustomProductName] = useState('');
  const [customProductPrice, setCustomProductPrice] = useState('');

  // Item initialization handled by useEditOrderState hook

  // ✅ Check edit permissions (different rules for admin vs customer)

  // editPermission provided by useEditOrderState

  // ✅ PHASE 5: SECURITY - Show permission denied UI if editing not allowed
  if (!editPermission.allowed) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Cannot Edit Order</h3>
              <p className="text-gray-600 leading-relaxed">{editPermission.reason}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              onClick={onCancel}
              className="px-6 py-2 bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle quantity change
  const updateQuantity = (productId: string, day: keyof DayQuantities, quantity: number) => {
    // Check if this day is editable for customers
    if (!isAdmin && editPermission.allowedDeliveryDays && !editPermission.allowedDeliveryDays.includes(day)) {
      setErrorMessage(`Cannot edit ${day} - delivery is within 48 hours`);
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const newQuantity = Math.max(0, quantity);
    setEditedItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [day]: newQuantity,
      },
    }));
    setHasChanges(true);
  };

  // Get product details

  // getProduct provided by useEditOrderState

  // Calculate total for a product

  // getProductTotal provided by useEditOrderState

  // Calculate item subtotal

  // getItemSubtotal provided by useEditOrderState

  // Calculate items subtotal (products only, no fees/taxes)

  // itemsSubtotal provided by useEditOrderState

  // Calculate final order total (subtotal + delivery - discount + GST)

  // finalOrderTotal provided by useEditOrderState

  // Validate and save
  const handleSave = async () => {
    // Check if at least one item has quantities
    const hasAnyQuantity = Object.values(editedItems).some((item) => {
      return days.some(day => (item[day.key] || 0) > 0);
    });

    if (!hasAnyQuantity) {
      setErrorMessage('Order must have at least one product with quantities');
      return;
    }

    // ✅ PHASE 5: FIXED - Direct update for both admin and customer (pending orders)
    // Customers can edit PENDING orders only (checked by editPermission)
    // Admins can edit PENDING, APPROVED, IN_PROCESS orders
    setErrorMessage(''); // Clear any errors
    
    // ✅ Direct update for both admin and customer
    // Customer can only reach here if order is PENDING (checked by canCustomerEditOrder)
    // Admin can edit any non-completed order
    const updateData: any = {
      editedItems: editedItems,
    };
    
 // If admin is editing a PENDING order, mark it for auto-approval
    if (isAdmin && order.status === 'pending') {
      updateData.shouldApprove = true; // Flag to trigger approval after save
      if (import.meta.env.DEV) logger.log('🎯 [EditOrderPage] Admin editing pending order - will auto-approve after save');
    }
    
    // ✅ PHASE 5: Customers cannot change delivery fee or discount (admin-only)
    if (isAdmin) {
      updateData.deliveryFee = deliveryFeeEnabled ? parseFloat(deliveryFee) || 0 : 0;
      // ✅ FIX: Save both discountType-specific fields so paidOrderEditService
      // can correctly recalculate after an edit
      if (discountType === 'percentage') {
        updateData.discountPercentage = discount;  // store the % value
        updateData.discount = 0; // clear flat discount
      } else {
        updateData.discount = discount;  // store the $ value
        updateData.discountPercentage = 0; // clear percentage discount
      }
      updateData.discountNote = discountNote;
      updateData.discountType = discountType;
    } else {
      // Customer uses existing values (cannot modify)
      updateData.deliveryFee = order.deliveryFee;
      updateData.discount = order.discount || 0;
      updateData.discountNote = order.discountNote || '';
    }
    
    onSave(updateData);
  };

  // Check if a day is editable
  const isDayEditable = (day: keyof DayQuantities): boolean => {
    if (isAdmin) return true;
    return editPermission.allowedDeliveryDays?.includes(day) || false;
  };

  // Get delivery dates for the order
  const getDeliveryDate = (day: keyof DayQuantities): string => {
    if (!order.deliveryWeek) return '';
    const year = order.deliveryYear || new Date().getFullYear();
    return formatShortDate(getWeekDayDate(order.deliveryWeek, day, year));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      
      {/* Content Area - Light Background */}
      <div className="flex-1 overflow-y-auto bg-[#F5E9D9] p-6">
        {/* Alerts moved inside content area */}

        {/* Permission Warning */}
        {!isAdmin && !editPermission.allowed && editPermission.reason && (
          <div className="mb-4 p-4 bg-yellow-50 border-2 border-[#FF9800] rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#FF9800] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#8B4513]">
              <strong>Limited Editing:</strong> {editPermission.reason}
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-900 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Customer Info: Changes need approval */}
        {!isAdmin && (
          <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-400 rounded-xl flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <strong>Note:</strong> Changes submitted will be sent to admin for approval before being applied to your order.
            </div>
          </div>
        )}

        {/* Two-Column Info Boxes - Like UNPAID ORDER DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* CUSTOMER Box */}
          <div className="bg-white border-2 border-[#D4A574]/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 text-[#8B4513]">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-[#8B4513] uppercase tracking-wide">Customer</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-[#8B4513]/70 uppercase font-semibold mb-1">Name</div>
                <div className="text-base font-bold text-[#2C2416]">{order.customerName || 'N/A'}</div>
              </div>
              {order.deliveryAddress && (
                <div>
                  <div className="text-xs text-[#8B4513]/70 uppercase font-semibold mb-1">Delivery Address</div>
                  <div className="text-sm text-[#2C2416]">{order.deliveryAddress}</div>
                </div>
              )}
              {(order.phoneNumber || order.customerPhone) && (
                <div>
                  <div className="text-xs text-[#8B4513]/70 uppercase font-semibold mb-1">Phone Number</div>
                  <div className="text-sm text-[#2C2416]">{order.phoneNumber || order.customerPhone}</div>
                </div>
              )}
            </div>
          </div>

          {/* DELIVERY WEEK Box */}
          <div className="bg-white border-2 border-[#D4A574]/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-6 h-6 text-[#8B4513]" />
              <h3 className="text-sm font-bold text-[#8B4513] uppercase tracking-wide">Delivery Week</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-[#8B4513]/70 uppercase font-semibold mb-1">Week</div>
                <div className="text-base font-bold text-[#2C2416]">
                  {order.week || `Week ${order.deliveryWeek} (${order.weekRange || 'N/A'})`}
                </div>
              </div>
              {order.createdAt && (
                <div>
                  <div className="text-xs text-[#8B4513]/70 uppercase font-semibold mb-1">Order Date</div>
                  <div className="text-sm text-[#2C2416]">
                    {(toDate(order.createdAt) ?? new Date()).toLocaleDateString('en-US', {
                      month: 'numeric',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ORDER ITEMS Section - Card-based grouped by category */}
        <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-[#333333] to-[#4a4238] px-6 py-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Items
            </h3>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Group items by category */}
            {(() => {
              // Create groups: regular categories + "Other" for uncategorized/custom items
              const groups: Array<{
                category: Category | null;
                items: Array<[string, any]>;
              }> = [];

              // Add regular categories
              categories.forEach((category) => {
                const categoryItems = Object.entries(editedItems).filter(([productId, item]) => {
                  const product = getProduct(productId);
                  return product?.category === category.id;
                });
                
                if (categoryItems.length > 0) {
                  groups.push({
                    category,
                    items: categoryItems,
                  });
                }
              });

              // Add "Other" category for custom/uncategorized items
              const otherItems = Object.entries(editedItems).filter(([productId, item]) => {
                const product = getProduct(productId);
                // Items without a product match (custom products) or without a category
                return !product || !product.category || !categories.find(c => c.id === product.category);
              });

              if (otherItems.length > 0) {
                groups.push({
                  category: null, // null means "Other"
                  items: otherItems,
                });
              }

              // If no groups at all, show all items
              if (groups.length === 0) {
                const allItems = Object.entries(editedItems);
                if (allItems.length > 0) {
                  groups.push({
                    category: null,
                    items: allItems,
                  });
                }
              }

              return groups.map(({ category, items }, groupIndex) => (
                <div key={category?.id || 'other'}>
                  {/* Category Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-[#D4A574]"></div>
                    <h4 className="font-bold text-[#333333] text-lg">
                      {category?.name || 'Other Items'}
                    </h4>
                  </div>

                  {/* Products in this category */}
                  <div className="space-y-4">
                    {items.map(([productId, item]: [string, any]) => {
                      const product = getProduct(productId);

                      // Calculate total for this product
                      const productTotal = activeDays.reduce((sum, day) => {
                        return sum + (item[day.key] || 0);
                      }, 0);

                      return (
                        <div
                          key={productId}
                          className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-5"
                        >
                          {/* Product Name and Price */}
                          <div className="mb-4">
                            <h5 className="font-bold text-[#333333] text-lg mb-1">
                              {item.productName}
                            </h5>
                            <div className="flex items-center gap-4">
                              <span className="text-gray-600 text-sm">
                                ${(item.price || 0).toFixed(2)} per unit
                              </span>
                              {product?.dailyMinOrder && (
                                <span className="text-[#FF9800] text-xs font-semibold">
                                  Min: {(product.dailyMinOrder ?? 0)}/day
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Day Inputs - EDITABLE */}
                          <div className="flex gap-3 flex-wrap">
                            {activeDays.map((day) => {
                              const isEditable = isDayEditable(day.key);
                              const deliveryDate = getDeliveryDate(day.key);
                              const quantity = item[day.key] || 0;
                              const hasQuantity = quantity > 0;

                              return (
                                <div key={day.key} className="flex flex-col items-center flex-1 min-w-[80px]">
                                  <div className="text-sm font-bold text-gray-700 mb-1">
                                    {day.label}
                                  </div>
                                  {deliveryDate && (
                                    <div className="text-xs text-gray-500 mb-2">
                                      {deliveryDate}
                                    </div>
                                  )}
                                  <input
                                    type="number"
                                    min="0"
                                    value={quantity}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                      if (isEditable) {
                                        updateQuantity(productId, day.key, parseInt(e.target.value) || 0);
                                      }
                                    }}
                                    disabled={!isEditable}
                                    className={`w-full px-3 py-3 text-center border-2 rounded-lg font-bold text-2xl transition-all ${
                                      hasQuantity
                                        ? 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-gray-300 bg-white text-gray-400'
                                    } ${
                                      isEditable
                                        ? 'focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/30 cursor-pointer hover:border-[#D4A574]'
                                        : 'cursor-not-allowed bg-gray-100 opacity-60'
                                    }`}
                                  />
                                  {!isEditable && (
                                    <span className="text-xs text-yellow-600 mt-1">🔒</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ORDER SUMMARY Section */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 sm:p-5 border border-amber-400 mb-4 sm:mb-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center shadow-lg">
              <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="font-bold text-[#333333] text-lg sm:text-2xl">
              Order Summary
            </h3>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-amber-300">
              <span className="text-[#666666] text-sm sm:text-base">
                Items Subtotal:
              </span>
              <span className="font-semibold text-[#333333] text-base sm:text-xl">
                ${itemsSubtotal.toFixed(2)}
              </span>
            </div>

            {deliveryFeeEnabled && parseFloat(deliveryFee) > 0 && (
              <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-amber-300">
                <span className="text-[#666666] text-sm sm:text-base">
                  Delivery Fee:
                </span>
                <span className="font-semibold text-[#333333] text-base sm:text-xl">
                  ${parseFloat(deliveryFee).toFixed(2)}
                </span>
              </div>
            )}

            {discount > 0 && (
              <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-amber-300">
                <span className="text-[#666666] text-sm sm:text-base">
                  Discount {discountType === 'percentage' ? `(${discount}%)` : ''}:
                </span>
                <span className="font-semibold text-red-600 text-base sm:text-xl">
                  -${(discountType === 'percentage' 
                    ? itemsSubtotal * (discount / 100)
                    : discount
                  ).toFixed(2)}
                </span>
              </div>
            )}

            {/* GST Breakdown */}
            <div className="flex justify-between items-center pb-2 sm:pb-3 border-b border-amber-300">
              <span className="text-[#666666] text-sm sm:text-base">
                GST (5%):
              </span>
              <span className="font-semibold text-[#333333] text-base sm:text-xl">
                ${(() => {
                  // ✅ FIX: GST on (subtotal - discount) only, delivery fee not taxable
                  const disc = discountType === 'percentage'
                    ? itemsSubtotal * (discount / 100)
                    : discount;
                  const taxableBase = Math.max(0, itemsSubtotal - disc);
                  const gst = Math.round((taxableBase * 0.05 + Number.EPSILON) * 100) / 100;
                  return gst.toFixed(2);
                })()}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-[#333333] text-base sm:text-xl">
                Order Total:
              </span>
              <span className="font-bold text-[#333333] text-2xl sm:text-4xl">
                ${finalOrderTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Admin-Only Controls */}
        {isAdmin && (
          <div className="space-y-4">
            {/* Discount Section */}
            <div className="bg-white border-2 border-[#D4A574]/30 rounded-xl overflow-hidden">
              <div className="bg-[#E8D5C0] px-5 py-3 flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#8B4513]" />
                <h3 className="text-sm font-bold text-[#8B4513] uppercase tracking-wide">Discount</h3>
              </div>
              
              <div className="p-5">
                {/* Discount Type Toggle Buttons */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('percentage');
                      setHasChanges(true);
                    }}
                    className={`px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 border-2 ${
                      discountType === 'percentage'
                        ? 'bg-[#D4A574] text-white border-[#D4A574] shadow-md'
                        : 'bg-white text-[#8B4513] border-[#D4A574]/30 hover:border-[#D4A574]'
                    }`}
                  >
                    <span className="text-xl">%</span>
                    <span>Percentage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('fixed');
                      setHasChanges(true);
                    }}
                    className={`px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 border-2 ${
                      discountType === 'fixed'
                        ? 'bg-[#D4A574] text-white border-[#D4A574] shadow-md'
                        : 'bg-white text-[#8B4513] border-[#D4A574]/30 hover:border-[#D4A574]'
                    }`}
                  >
                    <span className="text-xl">$</span>
                    <span>Fixed Amount</span>
                  </button>
                </div>
                
                {/* Discount Value Input */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-[#8B4513] uppercase mb-2">
                    {discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount ($)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B4513] text-lg font-bold">
                      {discountType === 'percentage' ? '%' : '$'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percentage' ? '100' : undefined}
                      step={discountType === 'percentage' ? '1' : '0.01'}
                      value={discount === 0 ? '' : discount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = parseFloat(e.target.value) || 0;
                        if (discountType === 'percentage' && value > 100) {
                          setDiscount(100);
                        } else {
                          setDiscount(value);
                        }
                        setHasChanges(true);
                      }}
                      className="w-full pl-12 pr-4 py-2.5 border-2 border-[#D4A574]/50 rounded-lg text-[#2C2416] font-medium focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/30 focus:outline-none"
                      placeholder={discountType === 'percentage' ? 'Enter percentage (e.g., 10)' : 'Enter fixed amount (e.g., 25.00)'}
                    />
                  </div>
                </div>
                
                {/* Discount Note */}
                <div>
                  <label className="block text-sm font-semibold text-[#8B4513] uppercase mb-2">
                    Discount Note (Optional)
                  </label>
                  <textarea
                    id="discount-note"
                    value={discountNote}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      setDiscountNote(e.target.value);
                      setHasChanges(true);
                    }}
                    rows={3}
                    className="w-full px-4 py-2.5 border-2 border-[#D4A574]/50 rounded-lg text-[#2C2416] focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/30 focus:outline-none resize-none"
                    placeholder="Add a note explaining the discount reason"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Fee Toggle */}
            <div className="bg-white border-2 border-[#D4A574]/30 rounded-xl overflow-hidden">
              <div className="bg-[#E8D5C0] px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#8B4513]" />
                  <h3 className="text-sm font-bold text-[#8B4513] uppercase tracking-wide">Delivery Fee</h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deliveryFeeEnabled}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setDeliveryFeeEnabled(e.target.checked);
                      setHasChanges(true);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#D4A574]/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4A574]"></div>
                  <span className="ms-3 text-sm font-medium text-[#8B4513]">
                    {deliveryFeeEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
              {deliveryFeeEnabled && (
                <div className="p-5">
                  {/* ✅ NEW: Warning message if order is below free delivery minimum */}
                  {itemsSubtotal < 150 && (
                    <div className="mb-4 p-4 bg-[#FFF3E0] border-2 border-[#FF9800] rounded-lg flex items-start gap-2">
                      <span className="text-lg">💡</span>
                      <p className="text-sm text-[#333333]">
                        This order's subtotal (${itemsSubtotal.toFixed(2)}) is below the free delivery minimum ($150.00). 
                        Please enter the delivery fee determined by the bakery office.
                      </p>
                    </div>
                  )}
                  
                  {/* ✅ NEW: Delivery fee input field */}
                  <div>
                    <label className="block text-sm font-semibold text-[#8B4513] uppercase mb-2">
                      Delivery Fee Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B4513] text-lg font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={deliveryFee}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setDeliveryFee(e.target.value);
                          setHasChanges(true);
                        }}
                        className="w-full pl-12 pr-4 py-2.5 border-2 border-[#D4A574]/50 rounded-lg text-[#2C2416] font-medium focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/30 focus:outline-none"
                        placeholder="50.00"
                      />
                    </div>
                    <p className="mt-2 text-xs text-[#8B4513]">
                      Suggested: $50.00 | Free delivery for orders over $150
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Add Custom Product Section */}
            <div className="bg-white border-2 border-[#D4A574]/30 rounded-xl overflow-hidden">
              <div className="bg-[#E8D5C0] px-5 py-3 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#8B4513]" />
                <h3 className="text-sm font-bold text-[#8B4513] uppercase tracking-wide">Add Custom Product</h3>
              </div>
              
              <div className="p-5">
                <p className="text-xs text-[#8B4513] mb-4">Add one-off products not in the regular catalog</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-orange-900 mb-1">
                      Product Name
                    </label>
                    <input
                      type="text"
                      id="custom-product-name"
                      value={customProductName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomProductName(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                      placeholder="e.g., Custom Cake"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-orange-900 mb-1">
                      Unit Price ($) <span className="text-xs text-orange-600">- price per item</span>
                    </label>
                    <input
                      type="number"
                      id="custom-product-price"
                      min="0"
                      step="0.01"
                      value={customProductPrice}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomProductPrice(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Delivery Days Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-orange-900 mb-2">
                    Select Delivery Days
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {activeDays.map(day => (
                      <label
                        key={day.key}
                        className="flex items-center gap-2 px-3 py-2 bg-orange-50 border-2 border-orange-200 rounded-lg hover:bg-orange-100 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={customProductDays[day.key] || false}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setCustomProductDays(prev => ({
                              ...prev,
                              [day.key]: e.target.checked
                            }));
                          }}
                          className="w-4 h-4 text-orange-600 bg-white border-orange-300 rounded focus:ring-orange-500 focus:ring-2"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-orange-900">{day.full}</span>
                          <span className="text-xs text-orange-600">{getDeliveryDate(day.key)}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Quantity Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-orange-900 mb-1">
                    Quantity (per selected day)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customProductQty}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomProductQty(parseInt(e.target.value) || 1)}
                    className="w-full md:w-32 px-3 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                    placeholder="1"
                  />
                </div>

                {/* Price Calculation Preview */}
                {(() => {
                  // FIX T2R4-C4: was document.getElementById('custom-product-price').
                  // Now reads from controlled state.
                  const unitPrice = parseFloat(customProductPrice || '0');
                  const selectedDaysCount = Object.values(customProductDays).filter(Boolean).length;
                  const totalQty = customProductQty * selectedDaysCount;
                  const totalCost = unitPrice * totalQty;
                  
                  if (unitPrice > 0 && selectedDaysCount > 0) {
                    return (
                      <div className="mb-4 p-3 bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-orange-300 rounded-lg">
                        <div className="text-sm font-semibold text-orange-900 mb-2">💰 Cost Calculation</div>
                        <div className="space-y-1 text-sm text-orange-800">
                          <div className="flex justify-between">
                            <span>Unit Price:</span>
                            <span className="font-mono">${unitPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quantity per day:</span>
                            <span className="font-mono">{customProductQty}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Selected days:</span>
                            <span className="font-mono">{selectedDaysCount} {selectedDaysCount === 1 ? 'day' : 'days'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total quantity:</span>
                            <span className="font-mono font-semibold">{totalQty} items</span>
                          </div>
                          <div className="border-t-2 border-orange-400 pt-1 mt-1 flex justify-between">
                            <span className="font-bold">Total Cost:</span>
                            <span className="font-mono font-bold text-base">${totalCost.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-orange-600 mt-1 italic">
                            ({customProductQty} × {selectedDaysCount} × ${unitPrice.toFixed(2)} = ${totalCost.toFixed(2)})
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Add Product Button */}
                <button
                  type="button"
                  onClick={() => {
                    // FIX T2R4-C4 (CRITICAL — DOM-as-state anti-pattern):
                    // Was reading values via document.getElementById(...).
                    // Now reads from React state.  Also replaces the
                    // Math.random() ID with crypto.randomUUID() (browser-
                    // native, collision-free).
                    const name = customProductName.trim();
                    const price = parseFloat(customProductPrice || '0');

                    if (!name) {
                      setErrorMessage('Please enter a product name');
                      setTimeout(() => setErrorMessage(''), 3000);
                      return;
                    }
                    if (price <= 0) {
                      setErrorMessage('Please enter a valid price');
                      setTimeout(() => setErrorMessage(''), 3000);
                      return;
                    }

                    // Check if at least one day is selected
                    const selectedDays = Object.entries(customProductDays).filter(([_, selected]) => selected);

                    if (selectedDays.length === 0) {
                      setErrorMessage('Please select at least one delivery day');
                      setTimeout(() => setErrorMessage(''), 3000);
                      return;
                    }

                    // FIX T2R4-C4: was Math.random().toString(36).substr(2,5)
                    // — predictable, collision-prone at high concurrency,
                    // and used the deprecated substr() method.
                    // crypto.randomUUID() is collision-free and supported in
                    // all modern browsers.  Falls back to crypto.getRandomValues
                    // for the rare browser without randomUUID.
                    const randomToken = (() => {
                      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                        return crypto.randomUUID();
                      }
                      const buf = new Uint8Array(8);
                      crypto.getRandomValues(buf);
                      let s = '';
                      for (let i = 0; i < buf.length; i++) {
                        s += buf[i].toString(16).padStart(2, '0');
                      }
                      return s;
                    })();
                    const customId = `custom-${Date.now()}-${randomToken}`;
                    const newItem: any = {
                      productId: customId,
                      productName: `${name} (Custom)`,
                      price: price,
                      monday: 0,
                      tuesday: 0,
                      wednesday: 0,
                      thursday: 0,
                      friday: 0,
                      saturday: 0,
                      sunday: 0,
                    };
                    
                    // Set quantities for selected days
                    selectedDays.forEach(([dayKey, _]) => {
                      newItem[dayKey] = customProductQty;
                    });
                    
                    
                    setEditedItems(prev => ({
                      ...prev,
                      [customId]: newItem
                    }));
                    setHasChanges(true);
                    
                    
 // Show confirmation modal with product details
                    openModal('CONFIRM_CUSTOM_PRODUCT', {
                      productData: {
                        name,
                        price,
                        selectedDays: customProductDays,
                        quantity: customProductQty,
                      },
                      onClose: () => {
                        // Modal closed, product already added to editedItems
                      },
                    });

                    // Clear inputs and reset state — now via React state, no
                    // more direct DOM .value manipulation.
                    setCustomProductName('');
                    setCustomProductPrice('');
                    setCustomProductDays({});
                    setCustomProductQty(1);
                  }}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Add Product
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions - Like UNPAID ORDER DETAILS buttons */}
      <div className="bg-white border-t-2 border-[#D4A574]/30 px-6 py-4 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-white border-2 border-[#8B4513]/30 text-[#8B4513] rounded-lg font-semibold hover:bg-[#F5E9D9] transition-all duration-200 flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
            hasChanges
              ? 'bg-[#D4A574] hover:bg-[#B8935F] text-white shadow-md hover:shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          {isAdmin 
            ? (order.status === 'pending' ? 'Save and Approve' : 'Save Changes')
            : 'Submit Changes'
          }
        </button>
      </div>
    </div>
  );
}