// src/utils/payments/unpaidSelectors.ts
import type { OrderAdjustment } from '../../types';
import type { Order } from "../../types";

export type UnpaidKind = "base_order" | "adjustment_increase";

export type UnpaidBaseRow = {
  kind: "base_order";
  order: Order;
};

export type UnpaidAdjustmentRow = {
  kind: "adjustment_increase";
  order: Order;
  adjustment: OrderAdjustment;
};

export type UnpaidRow = UnpaidBaseRow | UnpaidAdjustmentRow;

function money(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

// --- Canonical unpaid rules ---
export function isBaseOrderUnpaid(order: unknown): boolean {
 // BALANCE FIX - Balance should only be removed when admin confirms payment
  // and status changes to 'in_process', NOT when customer submits payment proof
  // 
  // OLD BEHAVIOR: Balance removed when paymentSubmitted=true (customer action)
  // NEW BEHAVIOR: Balance removed only when status='in_process' (admin confirmation)
  
  // ✅ Must be approved status (once admin confirms payment, status changes to 'in_process')
  if ((order as any)?.status !== "approved") return false;
  
  // ✅ REMOVED: paymentSubmitted check
  // Balance should show for ALL approved orders, even after customer submits payment proof
  // Only when admin confirms (status → 'in_process') should balance be removed
  
  // ✅ Additional safety: Exclude completed/cancelled orders
  if ((order as any)?.status === 'completed' || (order as any)?.status === 'cancelled') return false;
  
  return true;
}

// ❌ DEPRECATED (Feb 5, 2026): Increase adjustments concept removed
// Business rule: Only admin can DECREASE quantities, no one can INCREASE
// This function remains for backward compatibility with legacy data only
export function isIncreaseAdjustmentUnpaid(adj: OrderAdjustment): boolean {
  if (adj.type !== "increase") return false;
  
  // ✅ CRITICAL FIX: Default to 'unpaid' if status is missing
  const status = adj.paid?.status ?? 'unpaid';
  const amt = money(adj.paid?.amount ?? 0);
  
  // ✅ Include BOTH unpaid AND submitted (exclude 'confirmed')
  const needsAdminAction = status === 'unpaid' || status === 'submitted';
  
  return needsAdminAction && amt > 0;
}

export function getUnpaidRows(allOrders: Order[]): UnpaidRow[] {
  const rows: UnpaidRow[] = [];

  for (const order of allOrders) {
    // 1) base unpaid
    if (isBaseOrderUnpaid(order)) rows.push({ kind: "base_order", order });

    // 2) ❌ DEPRECATED (Feb 5, 2026): Increase adjustments removed from business logic
    // This code remains for backward compatibility with legacy data only
    const adjustments = Array.isArray(order.adjustments) ? order.adjustments : [];
    for (const adj of adjustments) {
      if (isIncreaseAdjustmentUnpaid(adj)) {
        rows.push({ kind: "adjustment_increase", order, adjustment: adj });
      }
    }
  }

  return rows;
}

// ============================================================================
// ✅ UTILITY FUNCTIONS
// ============================================================================

/**
 * ✅ Check if adjustment needs payment (alias for clarity)
 * ✅ PASS 6: Wrapper accepts `unknown` for forward compatibility with
 * legacy data sources that may pass partial/non-validated values. The
 * underlying `isIncreaseAdjustmentUnpaid` is defensively coded against
 * missing fields (sees `adj.type !== "increase"` first), so this is safe.
 */
export function isAdjustmentNeedsPayment(adj: unknown): boolean {
  return isIncreaseAdjustmentUnpaid(adj as OrderAdjustment);
}

/**
 * ✅ Get only base unpaid orders (convenience filter)
 */
export function getUnpaidBaseOrders(all: Order[]): Order[] {
  return (all || []).filter((o) => {
    if (!o?.id) return false;
    if (o.locked) return false;
    if (o.status === 'completed') return false;
    return isBaseOrderUnpaid(o);
  });
}

/**
 * ✅ Get orders awaiting payment verification (submitted but not confirmed)
 */
export function getPaymentVerificationOrders(all: Order[]): Order[] {
  return (all || []).filter((o) => {
    if (!o?.id) return false;
    if (o.locked) return false;
    if (o.status !== 'approved') return false;
    // Payment submitted by customer but not yet confirmed by admin
    return o.paymentSubmitted === true && o.paymentReceived !== true;
  });
}

/**
 * ✅ Get all payment adjustments (for payment tabs)
 * Returns adjustments that need payment
 */
export function getAllPaymentAdjustments(all: Order[]): Array<{
  kind: 'adjustment';
  orderId: string;
  customerId: string;
  customerName: string;
  amountDue: number;
  adjustment: unknown;
}> {
  const rows: Array<{
    kind: 'adjustment';
    orderId: string;
    customerId: string;
    customerName: string;
    amountDue: number;
    adjustment: unknown;
  }> = [];

  for (const o of (all || []) as any[]) {
    if (!o?.id) continue;

    // Get unpaid adjustments
    const adjustments = Array.isArray(o.adjustments) ? o.adjustments : [];
    for (const a of adjustments) {
      if (!isAdjustmentNeedsPayment(a)) continue;
      rows.push({
        kind: 'adjustment',
        orderId: o.id || "",
        customerId: o.customerId || "",
        customerName: o.customerName,
        amountDue: money(a?.paid?.amount ?? a?.deltaTotal ?? 0),
        adjustment: a,
      });
    }
  }

  return rows;
}