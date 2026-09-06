/**
 * Client-side mirror of the canonical order status transition matrix.
 * Source of truth lives in src/functions/src/_shared.ts (ALLOWED_TRANSITIONS) —
 * the server enforces this via assertTransitionAllowed(); this copy exists so
 * the client can pre-validate/disable UI actions without a round-trip.
 * Keep both maps in sync if the workflow changes.
 *
 * pending     → approved | rejected | cancelled
 * approved    → in_process | cancelled
 * in_process  → delivered | cancelled
 * delivered   → completed | cancelled
 * completed   → (terminal)
 * rejected    → (terminal)
 * cancelled   → (terminal)
 */
import type { OrderStatus } from '../schemas/order/orderEnums.schema';

const ALLOWED_TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['in_process', 'cancelled'],
  in_process: ['delivered', 'cancelled'],
  delivered: ['completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
