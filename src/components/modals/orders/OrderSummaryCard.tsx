import React from "react";
/**
 * OrderSummaryCard — Shared component used by all order modals.
 * Shows a clean, consistent price breakdown.
 * Conditionally shows: delivery fee, service charge, discount, credit, GST.
 */

import { Receipt, Truck, Tag, Wallet, Minus } from 'lucide-react';

interface OrderSummaryCardProps {
  subtotal: number;
  gst?: number;
  deliveryFee?: number;
  serviceCharge?: number;
  serviceChargeWaived?: boolean;
  discount?: number;
  creditApplied?: number;   // credit used by customer
  total: number;
  label?: string;           // "Order Total", "Amount Due" etc.
  variant?: 'warning' | 'info' | 'default'; // amber / blue / gold
}

const VARIANTS = {
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    header: 'text-amber-800',
    divider: 'bg-amber-200',
    iconBg: 'bg-amber-600',
    total: 'text-amber-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'text-blue-800',
    divider: 'bg-blue-200',
    iconBg: 'bg-blue-600',
    total: 'text-blue-800',
  },
  default: {
    bg: 'bg-[#FFF8F0]',
    border: 'border-[#D4A574]/40',
    header: 'text-[#8B6F47]',
    divider: 'bg-[#D4A574]/30',
    iconBg: 'bg-[#D4A574]',
    total: 'text-[#8B6F47]',
  },
};

export function OrderSummaryCard({
  subtotal,
  gst = 0,
  deliveryFee = 0,
  serviceCharge = 0,
  serviceChargeWaived = false,
  discount = 0,
  creditApplied = 0,
  total,
  label = 'Order Total',
  variant = 'default',
}: OrderSummaryCardProps) {
  const v = VARIANTS[variant];
  const showDelivery = deliveryFee > 0;
  const showService  = !serviceChargeWaived && serviceCharge > 0;
  const showDiscount = discount > 0;
  const showCredit   = creditApplied > 0;

  const Row = ({
    icon,
    label: rowLabel,
    value,
    valueClass = 'text-neutral-800',
    bold = false,
  }: {
    icon?: React.ReactNode;
    label: string;
    value: string;
    valueClass?: string;
    bold?: boolean;
  }) => (
    <div className={`flex items-center justify-between py-2.5 ${bold ? '' : 'border-b border-neutral-200/60'}`}>
      <span className={`flex items-center gap-2 text-sm ${bold ? 'font-bold text-neutral-800' : 'text-neutral-600'}`}>
        {icon && <span className="text-neutral-400">{icon}</span>}
        {rowLabel}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${valueClass} ${bold ? 'text-base font-bold' : ''}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className={`rounded-xl border ${v.bg} ${v.border} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${v.border}`}>
        <div className={`w-7 h-7 rounded-lg ${v.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Receipt className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className={`text-sm font-bold uppercase tracking-wide ${v.header}`}>
          Order Summary
        </h3>
      </div>

      {/* Rows */}
      <div className="px-4 pt-1 pb-3">
        <Row label="Items Subtotal" value={`$${subtotal.toFixed(2)}`} />

        {showDelivery && (
          <Row
            icon={<Truck className="w-3.5 h-3.5" />}
            label="Delivery Fee"
            value={`$${deliveryFee.toFixed(2)}`}
          />
        )}

        {showService && (
          <Row label="Service Charge" value={`$${serviceCharge.toFixed(2)}`} />
        )}

        {showDiscount && (
          <Row
            icon={<Tag className="w-3.5 h-3.5" />}
            label="Discount"
            value={`-$${discount.toFixed(2)}`}
            valueClass="text-green-600"
          />
        )}

        {gst > 0 && (
          <Row label="GST (5%)" value={`$${gst.toFixed(2)}`} />
        )}

        {showCredit && (
          <Row
            icon={<Wallet className="w-3.5 h-3.5" />}
            label="Credit Applied"
            value={`-$${creditApplied.toFixed(2)}`}
            valueClass="text-green-600"
          />
        )}

        {/* Divider */}
        <div className={`h-px ${v.divider} my-2`} />

        {/* Total */}
        <div className="flex items-center justify-between pt-1">
          <span className={`text-sm font-bold ${v.total}`}>{label}</span>
          <span className={`text-lg font-extrabold tabular-nums ${v.total}`}>
            ${total.toFixed(2)}
          </span>
        </div>

        {showCredit && (
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <Minus className="w-3 h-3" />
            ${creditApplied.toFixed(2)} store credit applied
          </p>
        )}
      </div>
    </div>
  );
}
