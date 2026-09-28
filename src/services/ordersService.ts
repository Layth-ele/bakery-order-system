/**
 * Orders Service - Order Orchestration Layer
 * 
 * ✅ REFACTORED: Now uses pure calculators from /calculators
 * ✅ This service focuses on ORCHESTRATION:
 * - Calling the order-action Cloud Functions (the only writers of status)
 * - Invalidating caches
 * 
 * ✅ CALCULATIONS moved to: /services/calculators/orderCalculator.ts
 * 
 * Benefits:
 * - ✅ Clear separation of concerns
 * - ✅ Calculators are independently testable
 * - ✅ Orchestration logic is focused and readable
 * - ✅ No duplication across services
 */

import type { Order } from '../types';
import { invalidateCache } from '../hooks/useCachedFirebase';
import {
  calculateGST,
  calculateOrderTotal,
  qualifiesForFreeDelivery,
  validateDeliveryFee,
} from './calculators/orderCalculator';
// Order state transitions run only in Cloud Functions.
import {
  approveOrderViaCloudFunction,
  rejectOrderViaCloudFunction,
  callableErrorMessage,
} from './firebase/cloudFunctions';
import { logger } from '../utils/logger';

/**
 * Admin user identity for audit trail
 */
export interface AdminUser {
  email: string;
  name?: string;
}

/**
 * Approval result containing updated order data
 */
export interface ApprovalResult {
  success: boolean;
  orderId: string;
  total: number;
  gst: number;
  deliveryFee: number;
  message?: string;
  error?: string;
}

// ✅ Re-export calculator functions for backward compatibility
export {
  calculateGST,
  calculateOrderTotal,
  qualifiesForFreeDelivery,
  validateDeliveryFee,
};

/**
 * Approve a pending order.
 *
 * Runs ONLY in the approveOrder Cloud Function, which enforces the status
 * transition, recomputes totals from server settings, and writes the status
 * audit atomically. The customer notification and email come from the
 * onOrderLifecycle trigger. `order` and `admin` are accepted for call-site
 * compatibility; the server derives both itself.
 */
export async function approveOrder(
  orderId: string,
  _order: Order,
  deliveryFee: number,
  _admin: AdminUser
): Promise<ApprovalResult> {
  try {
    const result = await approveOrderViaCloudFunction({ orderId, deliveryFee });
    invalidateCache.orders();
    return {
      success: true,
      orderId: result.orderId,
      total: result.total,
      gst: result.gst,
      deliveryFee: result.deliveryFee,
      message: 'Order approved successfully!',
    };
  } catch (error) {
    logger.warn('[approveOrder] Cloud Function failed:', error);
    return {
      success: false,
      orderId,
      total: 0,
      gst: 0,
      deliveryFee: 0,
      error: callableErrorMessage(error, 'approve this order'),
    };
  }
}

/**
 * Reject a pending order — rejectOrder Cloud Function only (see approveOrder).
 *
 * @returns true when the order was rejected
 */
export async function rejectOrder(
  orderId: string,
  _order?: Order,
  reason?: string
): Promise<boolean> {
  try {
    await rejectOrderViaCloudFunction({ orderId, reason });
    invalidateCache.orders();
    return true;
  } catch (error) {
    logger.warn('[rejectOrder] Cloud Function failed:', callableErrorMessage(error, 'reject this order'));
    return false;
  }
}
