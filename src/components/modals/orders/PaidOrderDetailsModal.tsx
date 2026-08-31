/**
 * PaidOrderDetailsModal - Shows details for IN_PROCESS/COMPLETED orders
 *
 * ✅ MAR 17, 2026: Enhanced ORDER UPDATED modal
 *   - Added Credit Refund Breakdown section
 *   - Shows subtotal credit + GST refund breakdown
 *   - Lists all reduced/increased items with quantity changes
 * ✅ MAR 31, 2026: Fixed download buttons + amountDue display
 * ✅ CANONICAL MODAL FOR PAYMENT CONFIRMATION
 *
 * Opened from: PAYMENT_CONFIRMED / ORDER_EDITED / INVOICE_UPDATED notifications,
 *              ActiveOrders page (in_process + completed orders)
 */

import React from "react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalFooterButtons } from "../../../ui/modals/ModalFooterButtons";
import {
  CheckCircle2,
  DollarSign,
  Download,
  Truck,
  FileText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { Order, Product, Category } from '../../../types';
import { formatOrderDateWithFallback } from '../../../services/calculators';
import { displayOrderNumber } from '../../../utils/displayId';
import { ModalThreeSections } from './ModalOrderSections';

interface PaidOrderDetailsModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onDownloadExcel?: (order: Order) => void;
  onDownloadPDF?: (order: Order) => void;
  isEditedOrder?: boolean;
  editDetails?: any;
}

export function PaidOrderDetailsModal({
  order,
  products,
  categories,
  onClose,
  onDownloadExcel,
  onDownloadPDF,
  isEditedOrder,
  editDetails,
}: PaidOrderDetailsModalProps): JSX.Element | null {
  if (!order) return null;

  const orderTotal     = order.total || 0;
  const creditApplied  = (order as any).creditApplied || 0;
  const amountDue      = creditApplied > 0 ? Math.max(0, orderTotal - creditApplied) : orderTotal;

  // ✅ FIX: Fall back to order fields when editDetails is missing/incomplete
  const creditAmount   = editDetails?.creditAmount || (order as any).creditIssued || (order as any).creditApplied || 0;
  const itemsChanged   = editDetails?.itemsChanged || (order as any).itemsChanged || [];
  const increasedItems = itemsChanged.filter((i: any) => i.quantityChange > 0);
  const decreasedItems = itemsChanged.filter((i: any) => i.quantityChange < 0);
  const totalIncrease  = increasedItems.reduce((s: number, i: any) => s + (i.priceChange || 0), 0);
  const subtotalCredit = Math.max(0, -decreasedItems.reduce((s: number, i: any) => s + (i.priceChange || 0), 0));

  const modalTitle    = isEditedOrder ? "ORDER UPDATED" : "ORDER IN PRODUCTION";
  const modalSubtitle = isEditedOrder
    ? "Admin edited your order • Credit issued"
    : "Payment confirmed • In production";

  return (
    <StyleModalShell
      width="4xl"
      skinType="production"
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      footer={
        <ModalFooterButtons
          leftAction={onDownloadExcel ? {
            label: "Excel",
            onClick: () => onDownloadExcel(order),
            variant: "success",
            icon: <Download className="w-4 h-4" />,
          } : undefined}
          cancelButton={onDownloadPDF ? {
            label: "Download PDF",
            onClick: () => onDownloadPDF(order),
            variant: "danger",
            icon: <Download className="w-4 h-4" />,
          } : undefined}
          confirmButton={{ label: "Close", onClick: onClose, variant: "primary" }}
        />
      }
    >
      <>
        {/* ── Status Alert ───────────────────────────────────── */}
        {isEditedOrder ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-1">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 bg-amber-500 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-amber-900 text-sm">Order Has Been Updated</p>
                <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                  {editDetails?.reason ? `Reason: ${editDetails.reason}. ` : ''}Credit issued for any reductions.
                </p>
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Still in production • Delivery as scheduled
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-1">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-green-900 text-sm">Order in Production!</p>
                <p className="text-green-700 text-xs mt-0.5">Payment confirmed. Being prepared now.</p>
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600">
                    Payment confirmed on{" "}
                    {formatOrderDateWithFallback(order.paymentReceivedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Payment Information ────────────────────────────── */}
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden mt-6">
          <div className="bg-gradient-to-r from-[#333333] to-[#4a4238] px-6 py-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment Information
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm mb-1">
                  {creditApplied > 0 ? 'Invoice Total' : 'Order Amount'}
                </p>
                <p className="text-[#333333] font-bold text-2xl">${orderTotal.toFixed(2)}</p>
                {/* Show credit applied + amount due when credit was used */}
                {creditApplied > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-emerald-600 text-xs font-medium">
                      💳 Credit Applied: −${creditApplied.toFixed(2)}
                    </p>
                    <p className="text-emerald-800 text-sm font-bold">
                      Amount Due: ${amountDue.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Order Number</p>
                <p className="text-[#333333] font-semibold font-mono text-sm">
                  {displayOrderNumber(order)}
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-gray-500 text-sm mb-2">Status</p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-600 font-semibold">Paid - In Production</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Credit Refund Breakdown (only when credit was actually issued) ── */}
        {isEditedOrder && creditAmount > 0 && (
          <div className="bg-white rounded-xl border-2 border-green-200 overflow-hidden mt-6">
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Credit Refund Breakdown
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 text-sm">Subtotal Credit (Before GST):</span>
                  <span className="text-[#333333] font-semibold">${subtotalCredit.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 text-sm">GST Credit (5%):</span>
                  <span className="text-[#333333] font-semibold">${(subtotalCredit * 0.05).toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-green-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[#333333] font-bold text-lg">Total Credit Issued:</span>
                    <span className="text-green-600 font-bold text-base">${creditAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {increasedItems.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-sm text-[#333333]">Product Increase Summary</h4>
                  </div>
                  <div className="space-y-2">
                    {increasedItems.map((item: any, idx: number) => (
                      <div key={`inc-${idx}`} className="flex justify-between text-sm text-[#333333]">
                        <span>{item.productName || 'Item'}</span>
                        <span>+{item.quantityChange} · ${item.priceChange?.toFixed(2) ?? '0.00'}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-[#E8C4A2] text-right font-semibold text-[#2d2416]">
                      Additional charge: ${totalIncrease.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {decreasedItems.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-sm text-[#333333]">Product Reduction Summary</h4>
                  </div>
                  <div className="space-y-2">
                    {decreasedItems.map((item: any, idx: number) => (
                      <div key={`dec-${idx}`} className="flex justify-between text-sm text-[#333333]">
                        <span>{item.productName || 'Item'}</span>
                        <span>{item.quantityChange} · −${Math.abs(item.priceChange ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Full Order Summary (items + financials) ─────────── */}
        <ModalThreeSections order={order} products={products ?? []} summaryLabel="Invoice Total" />
      </>
    </StyleModalShell>
  );
}
