/**
 * OrderItemsSimpleTable — Product | Price | Qty | Subtotal table
 *
 * Shows credit applied as a highlighted row when order.creditApplied > 0.
 * Used across all order modals for consistent item display.
 */

import { DollarSign } from 'lucide-react';
import type { Order, Product, Category } from '../../../types';

interface OrderItemsSimpleTableProps {
  order: Order;
  products?: Product[];
  categories?: Category[];
  /** Show the header bar with title + totals (default: true) */
  showHeader?: boolean;
}

function getItemQty(item: Order['items'][number]): number {
  return (
    (item.monday    || 0) +
    (item.tuesday   || 0) +
    (item.wednesday || 0) +
    (item.thursday  || 0) +
    (item.friday    || 0) +
    (item.saturday  || 0) +
    (item.sunday    || 0)
  );
}

export function OrderItemsSimpleTable({
  order,
  products = [],
  showHeader = true,
}: OrderItemsSimpleTableProps): JSX.Element | null {
  const items = order.items ?? [];
  if (items.length === 0) return null;

  const itemsSubtotal = order.subtotal ?? items.reduce((s, i) => s + (i.price ?? 0) * getItemQty(i), 0);
  const gst          = order.gst ?? 0;
  const deliveryFee  = order.deliveryFee ?? 0;
  const serviceCharge = (!order.serviceChargeWaived && order.serviceCharge) ? order.serviceCharge : 0;
  const discount     = order.discount ?? 0;
  const orderTotal   = order.total ?? 0;
  const creditApplied = (order.creditApplied as number | undefined) ?? 0;
  const amountDue    = Math.max(0, orderTotal - creditApplied);
  const productCount = items.length;
  const totalQty     = items.reduce((s, i) => s + getItemQty(i), 0);
  const hasCredit    = creditApplied > 0;
  const finalTotal   = orderTotal;

  return (
    <div className="bg-white rounded-xl border-2 border-[#E8C4A2] shadow-lg overflow-hidden">
      {/* Header */}
      {showHeader && (
        <div className="flex items-start justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-[#E8C4A2]">
          <h3 className="text-sm sm:text-base text-[#333333] font-bold uppercase tracking-wider">
            Order Items
          </h3>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-[#8B6F47]">Order Total</p>
            <p className={`text-lg font-bold ${hasCredit ? 'line-through text-neutral-400' : 'text-[#333333]'}`}>
              ${orderTotal.toFixed(2)}
            </p>
            {hasCredit && (
              <p className="text-lg font-bold text-green-700">${amountDue.toFixed(2)}</p>
            )}
            <p className="text-[10px] text-[#666666] mt-0.5">
              {productCount} product{productCount !== 1 ? 's' : ''},{' '}
              {totalQty} total item{totalQty !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Credit Used Banner — highlighted prominently */}
      {hasCredit && (
        <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-3.5 h-3.5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-green-800 uppercase tracking-wide">
              💳 Store Credit Applied
            </p>
            <p className="text-[10px] text-green-700">
              Customer redeemed store credit on this order
            </p>
          </div>
          <span className="text-sm font-bold text-green-700 flex-shrink-0">
            −${creditApplied.toFixed(2)}
          </span>
        </div>
      )}

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white">
              <th className="px-3 py-2 text-left font-bold">Product</th>
              <th className="px-3 py-2 text-center font-bold">Price</th>
              <th className="px-3 py-2 text-center font-bold">Qty</th>
              <th className="px-3 py-2 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8C4A2]">
            {items.map((item, idx) => {
              const qty = getItemQty(item);
              const catalogProduct = products.find(p => p.id === item.productId);
              const name = item.productName || catalogProduct?.name || 'Unknown Product';
              const price = item.price ?? catalogProduct?.retail ?? 0;
              const subtotal = item.total ?? (price * qty);

              return (
                <tr key={idx} className="hover:bg-[#F5E9D9]/30">
                  <td className="px-3 py-2 text-[#333333] font-medium">{name}</td>
                  <td className="px-3 py-2 text-[#666666] text-center">${price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-[#333333] font-bold text-center">{qty}</td>
                  <td className="px-3 py-2 text-[#8B6F47] font-bold text-right">${subtotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {/* Items subtotal */}
            <tr className="bg-[#F5E9D9]/40 border-t border-[#D4A574]">
              <td colSpan={3} className="px-3 py-2 text-right text-[#8B6F47] font-semibold text-xs uppercase">
                Items Subtotal:
              </td>
              <td className="px-3 py-2 text-right text-[#8B6F47] font-bold">
                ${itemsSubtotal.toFixed(2)}
              </td>
            </tr>

            {/* Service charge */}
            {serviceCharge > 0 && (
              <tr className="border-t border-[#E8C4A2]/60">
                <td colSpan={3} className="px-3 py-2 text-right text-[#666] font-medium text-xs">Service Charge:</td>
                <td className="px-3 py-2 text-right text-[#666] font-bold">${serviceCharge.toFixed(2)}</td>
              </tr>
            )}

            {/* Delivery fee */}
            {deliveryFee > 0 && (
              <tr className="border-t border-[#E8C4A2]/60">
                <td colSpan={3} className="px-3 py-2 text-right text-[#666] font-medium text-xs">Delivery Fee:</td>
                <td className="px-3 py-2 text-right text-[#666] font-bold">${deliveryFee.toFixed(2)}</td>
              </tr>
            )}

            {/* Discount */}
            {discount > 0 && (
              <tr className="border-t border-[#E8C4A2]/60">
                <td colSpan={3} className="px-3 py-2 text-right text-green-700 font-medium text-xs">Discount:</td>
                <td className="px-3 py-2 text-right text-green-700 font-bold">−${discount.toFixed(2)}</td>
              </tr>
            )}

            {/* GST */}
            {gst > 0 && (
              <tr className="border-t border-[#E8C4A2]/60">
                <td colSpan={3} className="px-3 py-2 text-right text-[#666] font-medium text-xs">GST (5%):</td>
                <td className="px-3 py-2 text-right text-[#666] font-bold">${gst.toFixed(2)}</td>
              </tr>
            )}

            {/* Invoice total */}
            <tr className="bg-gradient-to-r from-[#8B6F47]/10 to-[#D4A574]/10 border-t-2 border-[#D4A574]">
              <td colSpan={3} className="px-3 py-3 text-right text-[#8B6F47] font-bold uppercase text-xs">
                Invoice Total:
              </td>
              <td className="px-3 py-3 text-right font-bold text-base text-[#8B6F47]">
                ${orderTotal.toFixed(2)}
              </td>
            </tr>

            {/* Credit applied */}
            {hasCredit && (
              <tr className="bg-emerald-50 border-t border-emerald-300">
                <td colSpan={3} className="px-3 py-2 text-right text-emerald-700 font-semibold text-xs">
                  💳 Credit Applied:
                </td>
                <td className="px-3 py-2 text-right text-emerald-700 font-bold">
                  −${creditApplied.toFixed(2)}
                </td>
              </tr>
            )}

            {/* Amount due after credit */}
            {hasCredit && (
              <tr className="bg-emerald-100 border-t-2 border-emerald-400">
                <td colSpan={3} className="px-3 py-3 text-right text-emerald-900 font-bold uppercase text-xs">
                  AMOUNT DUE:
                </td>
                <td className="px-3 py-3 text-right font-bold text-base text-emerald-900">
                  ${amountDue.toFixed(2)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
