/**
 * Order status transitions for the web app — re-exported from the ONE
 * lifecycle definition shared with the Cloud Functions
 * (src/functions/src/lib/orderLifecycle.ts). The server enforces the same
 * rules in assertTransitionAllowed(); the client uses them to pre-validate
 * and disable UI actions without a round-trip.
 */
export {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  TERMINAL_STATUSES,
  canTransitionOrderStatus,
  isOrderStatus,
} from '../functions/src/lib/orderLifecycle';
