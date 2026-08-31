/**
 * EditPaidOrderModal - Edit paid orders with strict decrease-only rules
 * 
 * ✅ FEB 21, 2026: Implemented tabbed interface for better UX
 * ✅ FEB 21, 2026: Standardized loading states (button loading)
 * ✅ FEB 20, 2026: MOVED to /components/modals/orders/ (consolidation project)
 */

import { Minus, Plus } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import {AlertTriangle, Info, Lock, FileText, Edit, CheckCircle as CheckCircleIcon, TrendingDown, DollarSign, Edit2, CreditCard} from 'lucide-react'
import type { Order, Product, Category, OrderItem } from '../../../types';
import {invalidateCache} from '../../../hooks/useCachedFirebase'
import { toast } from 'sonner';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { SaveFooter } from '../../../ui/modals/ModalFooterButtons'; // ✅ FEB 21, 2026
import { 
  canEditPaidOrder, 
  validateItemEdit, 
  adminEditPaidOrder 
} from '../../../services/creditService'; // Add all missing imports
// ✅ PASS 7: Calculation logic extracted to a hook (was inlined as 80 LOC of useMemo).
import { useEditPaidOrderCalculations } from '../../../hooks/admin/useEditPaidOrderCalculations';
import { 
  getWeekRange, 
  getWeekDayDate, 
  formatShortDate 
} from '../../../utils/weekUtils'; // Add week utility functions
import { ModalThreeSections } from './ModalOrderSections';
import { displayOrderNumber, displayInvoiceNumber, displayCustomerCode, displayOrderLabel, invoiceFilename, orderFilename } from '../../../utils/displayId';

interface EditPaidOrderModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  adminEmail: string; // Current admin's email
  onSave?: (result: { success: boolean; creditIssued: number }) => void;
  onClose: () => void;
}

export function EditPaidOrderModal({
  order: initialOrder,
  products,
  categories,
  adminEmail,
  onSave,
  onClose,
}: EditPaidOrderModalProps): JSX.Element | null {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [editedItems, setEditedItems] = useState<{ [productId: string]: OrderItem }>({});
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [productId: string]: string }>({});
  const [activeTab, setActiveTab] = useState('info');

  // Check if order can be edited
  const editPermission = useMemo(() => canEditPaidOrder(order), [order]);

  const days = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
  ] as const;

 // Filter to only show active days (days with items ordered)
  const activeDays = useMemo(() => {
    const daysWithItems = new Set<string>();
    
    // Check all items to find which days have quantities
    order.items.forEach(item => {
      days.forEach(day => {
        if (item[day.key] && item[day.key] > 0) {
          daysWithItems.add(day.key);
        }
      });
    });
    
    // Return only days that have items
    return days.filter(day => daysWithItems.has(day.key));
  }, [order.items]);

  // Initialize edited items from order
  useEffect(() => {
    const itemsMap: { [productId: string]: OrderItem } = {};
    order.items.forEach((item: OrderItem) => {
      itemsMap[item.productId] = {
        ...item,
        monday: item.monday || 0,
        tuesday: item.tuesday || 0,
        wednesday: item.wednesday || 0,
        thursday: item.thursday || 0,
        friday: item.friday || 0,
        saturday: item.saturday || 0,
        sunday: item.sunday || 0,
      };
    });
    setEditedItems(itemsMap);
  }, [order]);

  // Get week day date
  const getDayDate = (dayKey: string) => {
    const dayIndex = days.findIndex(d => d.key === dayKey);
    return getWeekDayDate(order.week, order.year || new Date().getFullYear(), dayIndex);
  };

  // Calculate item total
  const getItemTotal = (item: OrderItem) => {
    return days.reduce((sum, day) => sum + (item[day.key] || 0), 0);
  };

  // ✅ PASS 7: All three useMemo blocks (calculatedTotals, creditAmount,
  // changes) were extracted to useEditPaidOrderCalculations — one
  // hook call replaces ~85 LOC of inline computation. The legacy GST
  // detection logic is preserved exactly.
  const { calculatedTotals, creditAmount, changes } = useEditPaidOrderCalculations(order, editedItems);

  // Update quantity handler with validation
  const updateQuantity = (productId: string, day: string, newValue: number) => {
    const originalItem = order.items.find(item => item.productId === productId);
    if (!originalItem) return;

    // Clear previous error
    setValidationErrors(prev => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });

    // Calculate new total quantity for this item
    const currentItem = editedItems[productId];
    const newItemData = { ...currentItem, [day]: Math.max(0, newValue) };
    const newTotalQuantity = getItemTotal(newItemData);
    const originalTotalQuantity = originalItem.quantity || getItemTotal(originalItem);

    // Validate decrease-only
    const validation = validateItemEdit(originalItem, newTotalQuantity);
    
    if (!validation.valid) {
      setValidationErrors(prev => ({
        ...prev,
        [productId]: validation.error || 'Invalid quantity',
      }));
      toast.error(validation.error);
      return;
    }

    // Update item
    setEditedItems(prev => ({
      ...prev,
      [productId]: newItemData,
    }));
  };

  // Submit handler
  const handleSubmit = async () => {
    // Validation
    if (!editPermission.canEdit) {
      toast.error(editPermission.reason || 'Cannot edit this order');
      return;
    }

    if (changes.length === 0) {
      toast.error('No changes detected');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for editing this order');
      return;
    }

 // Removed credit > 0 validation
    // Admin can now increase quantities back up to original (to correct mistakes)
    // Credit can be 0 if admin increased items back to original quantity

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please fix validation errors before submitting');
      return;
    }

    setSubmitting(true);

    try {
      // Convert edited items to array
      const updatedItems: OrderItem[] = Object.values(editedItems).map(item => {
        const totalQty = getItemTotal(item);
        return {
          ...item,
          quantity: totalQty,
          total: totalQty, // ✅ FIX: total = sum of daily quantities (per schema)
        };
      }).filter(item => (item.quantity ?? item.total) > 0);

      // Call admin edit function
      const result = await adminEditPaidOrder(
        order,
        updatedItems,
        adminEmail,
        reason.trim()
      );

      if (result.success) {
        // Invalidate cache
        await invalidateCache.orders();

        // Show success
        toast.success(
          `✅ Order updated! $${result.creditIssued.toFixed(2)} credit issued to customer.`,
          { duration: 5000 }
        );

        // Callback
        if (onSave) {
          onSave(result);
        }

        // Close modal
        onClose();
      } else {
        toast.error(result.error || 'Failed to update order');
      }
    } catch (error) {
      console.error('Error updating paid order:', error);
      toast.error(error instanceof Error ? (error as any).message : 'Failed to update order');
    } finally {
      setSubmitting(false);
    }
  };

  const computedWeekRange = order.week && order.year 
    ? getWeekRange(order.week, order.year)
    : order.weekRange || 'N/A';

  // Calculate if changes are valid for submission
  const canSubmit = useMemo(() => {
    return (
      editPermission.canEdit &&
      changes.length > 0 &&
      reason.trim().length > 0 &&
 // Removed creditAmount > 0 check - allows corrections back to original
      Object.keys(validationErrors).length === 0
    );
  }, [editPermission.canEdit, changes.length, reason, validationErrors]);

  return (
    <StyleModalShell
      width="4xl"
      skinType="warning"
      title="EDIT PAID ORDER"
      subtitle={displayOrderNumber(order)}
      onClose={onClose}
      hideBody
      className="h-[90vh]"
      footer={
        <SaveFooter
          onCancel={onClose}
          onSave={handleSubmit}
          isSaving={submitting}
          saveDisabled={!canSubmit}
          saveLabel="Save & Issue Credit"
        />
      }
    >
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* FIXED Tab Navigation */}
          <div className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-2 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8]">
            <TabsList className="w-full bg-white border-2 border-[#E8C4A2] p-1">
              <TabsTrigger 
                value="info" 
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4A574] data-[state=active]:to-[#E8C4A2] data-[state=active]:text-[#333333] text-[#8B6F47] font-bold uppercase text-xs sm:text-sm"
              >
                <Info className="w-4 h-4 mr-2" />
                Order Info
              </TabsTrigger>
              <TabsTrigger 
                value="edit" 
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4A574] data-[state=active]:to-[#E8C4A2] data-[state=active]:text-[#333333] text-[#8B6F47] font-bold uppercase text-xs sm:text-sm"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Items
              </TabsTrigger>
              <TabsTrigger 
                value="review" 
                className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4A574] data-[state=active]:to-[#E8C4A2] data-[state=active]:text-[#333333] text-[#8B6F47] font-bold uppercase text-xs sm:text-sm"
              >
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                Review {changes.length > 0 && `(${changes.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

              {activeTab === 'review' && (
            <div className="flex-shrink-0 px-4 sm:px-6 pb-2 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8]">
              <div className="bg-gradient-to-br from-white to-[#F5E9D9] rounded-xl p-4 sm:p-6 border-2 border-[#E8C4A2]">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A574]" />
                  <h3 className="text-sm sm:text-base text-[#333333] font-bold uppercase tracking-wider">
                    Reason for Edit (Required)
                  </h3>
                </div>
                <textarea
                  id="edit-reason"
                  value={reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                  placeholder="e.g., Customer requested reduction due to over-ordering, Item unavailable, Quality issue, etc."
                  disabled={!editPermission.canEdit}
                  className="w-full h-20 px-3 sm:px-4 py-2 sm:py-3 border-2 border-[#D4A574] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B6F47] text-xs sm:text-sm text-[#333333] disabled:bg-neutral-100 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-[10px] text-[#8B6F47] mt-2">
                  This reason will be visible to the customer in their credit notification.
                </p>
              </div>
            </div>
          )}

          {/* SCROLLABLE Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Tab 1: Order Info */}
            <TabsContent value="info" className="p-4 sm:p-6 space-y-4 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8] m-0">
              {/* Permission Check */}
              {!editPermission.canEdit && (
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border-2 border-red-200">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-red-600" />
                    <div>
                      <h3 className="text-sm font-bold text-red-900">Cannot Edit Order</h3>
                      <p className="text-xs text-red-700 mt-1">{editPermission.reason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning Banner */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border-2 border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-amber-900 mb-2">⚠️ Admin Edit Rules</h3>
                    <ul className="text-xs text-amber-800 space-y-1">
                      <li>• <strong>You can adjust quantities</strong> up to the original amount ordered</li>
                      <li>• <strong>Cannot exceed</strong> the original quantity (e.g., if customer ordered 8, max is 8)</li>
                      <li>• <strong>Allows corrections:</strong> If you reduced to 5 by mistake, you can increase back to 6, 7, or 8</li>
                      <li>• Credit will be automatically issued for any reductions</li>
                      <li>• Customer will be notified of changes and credit issued</li>
                    </ul>
                  </div>
                </div>
              </div>

              <ModalThreeSections order={order} products={products} summaryLabel="Current Total">
              </ModalThreeSections>

              {/* Credit & Charge Reference */}
              {((order as any).creditApplied > 0 || (order as any).amountDue) && (
                <div className="bg-[#FFF8F0] border border-[#E8C4A2] rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E8C4A2]">
                    <CreditCard className="w-4 h-4 text-[#D4A574]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B6F47]">
                      Payment Reference
                    </h3>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {(order as any).creditApplied > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#8B6F47]">Credit Applied</span>
                        <span className="text-sm font-bold text-emerald-600">
                          −${((order as any).creditApplied).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-[#E8C4A2] pt-2 mt-2">
                      <span className="text-xs font-bold text-[#8B6F47] uppercase">
                        Actual Amount Charged
                      </span>
                      <span className="text-sm font-bold text-[#D4A574]">
                        ${((order as any).amountDue || order.total || 0).toFixed(2)}
                      </span>
                    </div>
                    {creditAmount > 0 && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-700">
                          ⚡ After this edit, <strong>${creditAmount.toFixed(2)}</strong> credit will be issued to customer
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation Hint */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-blue-900">Next Step</h3>
                    <p className="text-xs text-blue-700 mt-1">
                      Click the "Edit Items" tab above to adjust quantities for this order.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Edit Items */}
            <TabsContent value="edit" className="p-4 sm:p-6 space-y-4 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8] m-0">
              {/* Editable Items Table */}
              <div className="bg-white rounded-xl p-4 sm:p-6 border-2 border-[#E8C4A2] shadow-lg">
                <div className="flex items-center gap-2 mb-4 border-b border-[#E8C4A2] pb-2">
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A574]" />
                  <h3 className="text-sm sm:text-base text-[#333333] font-bold uppercase tracking-wider">
                    Adjust Items (Max: Original Quantity)
                  </h3>
                </div>

                <div className="w-full">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white border-b border-[#D4A574]">
                        <th className="px-2 py-2 text-left font-bold">Product</th>
                        {activeDays.map(d => {
                          const date = getDayDate(d.key);
                          return (
                            <th key={d.key} className="px-1 py-2 text-center font-bold">
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] sm:text-xs">{d.label}</span>
                                <span className="text-[8px] sm:text-[9px] opacity-70 font-normal hidden sm:block">
                                  {formatShortDate(date)}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                        <th className="px-2 py-2 text-right font-bold">Tot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8C4A2]">
                      {(Object.values(editedItems) as OrderItem[]).map((item) => {
                        const originalItem = order.items.find(i => i.productId === item.productId);
                        const hasError = validationErrors[item.productId];
                        
                        return (
                          <tr 
                            key={item.productId} 
                            className={`hover:bg-[#F5E9D9]/30 ${hasError ? 'bg-red-50' : ''}`}
                          >
                            <td className="px-2 py-2 font-semibold text-[#333333] text-[10px] sm:text-xs">
                              <div className="max-w-[100px] sm:max-w-none truncate" title={item.productName}>
                                {item.productName}
                              </div>
                              {hasError && (
                                <p className="text-[8px] text-red-600 mt-1">{hasError}</p>
                              )}
                            </td>
                            {activeDays.map(d => (
                              <td key={d.key} className="px-0.5 sm:px-1 py-2 text-center">
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5">
                                  {/* Minus Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentValue = item[d.key] || 0;
                                      if (currentValue > 0) {
                                        updateQuantity(item.productId, d.key, currentValue - 1);
                                      }
                                    }}
                                    disabled={!editPermission.canEdit || (item[d.key] || 0) === 0}
                                    className="p-0.5 rounded bg-red-100 hover:bg-red-200 text-red-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors hidden sm:block"
                                    title="Decrease quantity"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  
                                  {/* Quantity Input - Compact */}
                                  <input 
                                    type="number" 
                                    min="0"
                                    max={originalItem?.[d.key] || 0}
                                    value={item[d.key]}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                      const newValue = parseInt(e.target.value) || 0;
                                      const maxAllowed = originalItem?.[d.key] || 0;
                                      if (newValue > maxAllowed) {
                                        toast.error(`Cannot increase ${item.productName}. Max allowed: ${maxAllowed}`);
                                        return;
                                      }
                                      updateQuantity(item.productId, d.key, newValue);
                                    }}
                                    disabled={!editPermission.canEdit}
                                    className={`w-10 sm:w-12 text-center border rounded py-0.5 text-[10px] sm:text-xs font-bold ${
                                      editPermission.canEdit
                                        ? 'border-[#D4A574] focus:border-[#8B6F47] focus:ring-1 focus:ring-[#8B6F47] text-[#333333] bg-white' 
                                        : 'bg-neutral-100 text-neutral-400 cursor-not-allowed border-neutral-200'
                                    }`}
                                  />
                                  
                                  {/* Plus Button - Always DISABLED (decrease-only) */}
                                  <button
                                    type="button"
                                    disabled={true}
                                    className="p-0.5 rounded bg-gray-200 text-gray-400 cursor-not-allowed hidden sm:block"
                                    title="Cannot increase quantities for paid orders (decrease-only)"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </td>
                            ))}
                            <td className="px-2 py-2 text-right font-black text-[#D4A574] text-[10px] sm:text-xs">
                              {getItemTotal(item)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Summary */}
              {changes.length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border-2 border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                      <div>
                        <h3 className="text-sm font-bold text-green-900">Changes Detected</h3>
                        <p className="text-xs text-green-700 mt-1">
                          {changes.length} item{changes.length !== 1 ? 's' : ''} modified
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('review')}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors"
                    >
                      Review Changes →
                    </button>
                  </div>
                </div>
              )}

              {changes.length === 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="text-sm font-bold text-blue-900">No Changes Yet</h3>
                      <p className="text-xs text-blue-700 mt-1">
                        Adjust item quantities in the table above. Changes will appear in the Review tab.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Review & Submit */}
            <TabsContent value="review" className="p-4 sm:p-6 space-y-4 bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8] m-0">
              {/* Changes Summary */}
              {changes.length > 0 ? (
                <div className="bg-gradient-to-br from-[#2C2416] to-[#1a1611] rounded-xl p-4 sm:p-6 border-2 border-[#D4A574] shadow-xl">
                  <div className="flex items-center gap-2 mb-4 border-b border-[#D4A574]/30 pb-3">
                    <DollarSign className="w-5 h-5 text-[#D4A574]\" />
                    <h3 className="text-sm sm:text-base text-[#D4A574] font-bold uppercase tracking-wider">
                      Changes Summary
                    </h3>
                  </div>

                              <div 
                    className="changes-summary-scrollable space-y-3 mb-4 max-h-[320px] overflow-y-auto pr-2"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(212, 165, 116, 0.3) transparent'
                    }}
                  >
                    {/* ✅ Webkit scrollbar styles - using regular style tag */}
                    <style dangerouslySetInnerHTML={{__html: `
                      .changes-summary-scrollable::-webkit-scrollbar {
                        width: 6px;
                      }
                      .changes-summary-scrollable::-webkit-scrollbar-track {
                        background: transparent;
                      }
                      .changes-summary-scrollable::-webkit-scrollbar-thumb {
                        background: rgba(212, 165, 116, 0.3);
                        border-radius: 6px;
                      }
                      .changes-summary-scrollable::-webkit-scrollbar-thumb:hover {
                        background: rgba(212, 165, 116, 0.5);
                      }
                    `}} />
                    {changes.map((change, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm font-bold text-white">{change.productName}</p>
                          <p className="text-xs text-neutral-400 mt-1">
                            Qty: {change.originalQuantity} → {change.newQuantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-black ${change.quantityChange < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {change.quantityChange > 0 ? '+' : ''}{change.quantityChange}
                          </p>
                          <p className={`text-[10px] ${change.priceChange < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {change.priceChange > 0 ? '+' : ''}${Math.abs(change.priceChange).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Summary - FIXED (Not Scrolling) */}
                  <div className="space-y-2 pt-4 border-t border-[#D4A574]/30">
                    <div className="flex justify-between text-xs text-neutral-400">
                      <span>Original Total:</span>
                      <span className="font-bold text-white">${order.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-400">
                      <span>New Total:</span>
                      <span className="font-bold text-white">${calculatedTotals.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-[#D4A574]/30">
                      <span className="text-[#D4A574] font-bold uppercase tracking-widest text-sm">Credit to Issue</span>
                      <span className="text-xl font-bold text-[#D4A574]">
                        ${creditAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border-2 border-amber-200">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <div>
                      <h3 className="text-sm font-bold text-amber-900">No Changes to Review</h3>
                      <p className="text-xs text-amber-700 mt-1">
                        Go to the "Edit Items" tab to make changes to the order quantities.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom padding for comfortable scrolling */}
              <div className="h-8" />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </StyleModalShell>
  );
}