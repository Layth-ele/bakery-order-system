/**
 * Orders Service - Order Orchestration Layer
 * 
 * ✅ REFACTORED: Now uses pure calculators from /calculators
 * ✅ This service focuses on ORCHESTRATION:
 * - Coordinating Firebase updates
 * - Sending notifications
 * - Invalidating caches
 * - Managing workflows
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
import {updateOrder} from './data/ordersDataService'
import { getServerTimestamp } from '../utils/timestamps';
import { invalidateCache } from '../hooks/useCachedFirebase';
import { notifyOrderApproved, notifyOrderRejected } from '../notifications';
import {
  calculateGST,
  calculateOrderTotal,
  qualifiesForFreeDelivery,
  validateDeliveryFee,
} from './calculators/orderCalculator';
// ✅ PASS 2: Cloud Function wrappers — preferred path for state transitions.
import {
  approveOrderViaCloudFunction,
  rejectOrderViaCloudFunction,
} from './firebase/cloudFunctions';
import { logger } from '../utils/logger';


// 🔧 Debug flag - only log in development
const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

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
 * ✅ FIX #1: Approve an order (extracted from AdminDashboard)
 * 
 * This function handles the complete approval workflow:
 * 1. Calculate GST (5% of subtotal)
 * 2. Calculate total (subtotal + GST + delivery fee + service charge)
 * 3. Update order status to 'approved' in Firebase
 * 4. Add approval metadata (who, when)
 * 5. Clear any update request flags
 * 6. Send notification to customer
 * 7. Invalidate cache to refresh UI
 * 
 * @param orderId - Order ID to approve
 * @param order - Full order object (for calculations)
 * @param deliveryFee - Delivery fee amount (0 for free delivery)
 * @param admin - Admin user who is approving
 * @returns Promise<ApprovalResult>
 * 
 * @example
 * ```typescript
 * const result = await approveOrder(
 *   'order-123',
 *   orderObject,
 *   15.50,
 *   { email: 'admin@bakery.com', name: 'Admin' }
 * );
 * 
 * if (result.success) {
 *   logger.log('Order approved! Total:', result.total);
 * }
 * ```
 */
export async function approveOrder(
  orderId: string,
  order: Order,
  deliveryFee: number,
  admin: AdminUser
): Promise<ApprovalResult> {
  // ✅ PASS 2: Prefer the Cloud Function path (server enforces state transition,
  // recomputes totals, writes status audit, notifies customer atomically).
  // Falls back to legacy client-side logic only on transport-level failures —
  // business errors (HttpsError) propagate as failures, not fallbacks.
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
  } catch (cfError: any) {
    // Distinguish a deployment problem (CF not available) from a business
    // error (e.g. transition not allowed). For Firebase callables, business
    // errors come back with `code === 'functions/...'` matching their type.
    const isTransportError =
      cfError?.code === 'functions/internal' ||
      cfError?.code === 'functions/unavailable' ||
      cfError?.code === 'functions/deadline-exceeded' ||
      cfError?.code === 'functions/not-found';
    if (!isTransportError) {
      // Real business error — surface it
      console.error('❌ [approveOrder] Cloud Function rejected:', cfError);
      return {
        success: false,
        orderId,
        total: 0,
        gst: 0,
        deliveryFee: 0,
        error: cfError?.message ?? 'Failed to approve order',
      };
    }
    logger.warn('⚠️ [approveOrder] Cloud Function unavailable, falling back to client logic:', cfError);
    // Fall through to legacy client implementation below
  }

  try {
    // ─── Legacy client-side path (fallback only) ──────────────────────────
    // ✅ Step 1: Calculate GST on discounted subtotal (5%)
    const flatDiscount = order.discount || 0;
    const pctDiscount = order.discountPercentage
      ? (order.subtotal || 0) * order.discountPercentage / 100
      : 0;
    // FIX BUG 5 (MEDIUM): Was `flatDiscount || pctDiscount` — the || operator means
    // if flatDiscount > 0 the percentage discount is silently dropped (only if
    // flatDiscount === 0 would pctDiscount be used). An order with both a flat and a
    // percentage discount set would lose one silently. Changed to + so both apply.
    const totalDiscount = flatDiscount + pctDiscount;
    const discountedBase = Math.max(0, (order.subtotal || 0) - totalDiscount);
    const gst = calculateGST(discountedBase);

    // ✅ Step 2: Calculate total (service charge added if not waived)
    const effectiveServiceCharge = order.serviceChargeWaived ? 0 : (order.serviceCharge || 0);
    const creditApplied = order.creditApplied || 0;
    const newTotal = Math.max(0, discountedBase + gst + deliveryFee + effectiveServiceCharge - creditApplied);

    // ✅ Step 3: Update order in Firebase (single source of truth)
    await updateOrder(orderId, {
      status: 'approved' as const,
      deliveryFee: deliveryFee,
      gst: gst,
      total: newTotal,
      updateRequested: false, // Clear update request flag
      updateRequestedAt: undefined,
      approvedBy: (admin.email ?? ""),
      approvedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
    });

    if (DEBUG) logger.log('✅ Order updated in Firebase');

    // ✅ Step 4: Invalidate cache to refresh UI immediately
    invalidateCache.orders();
    if (DEBUG) logger.log('✅ Cache invalidated - UI will refresh');

    // ✅ Step 5: Send V3.2 aligned notification to customer
    // ✅ V3.2: Use aligned notification service (Firestore paths with /items)
    await notifyOrderApproved(
      {
        ...order,
        status: 'approved',
        total: newTotal,
        gst,
        deliveryFee
      },
      newTotal
    );

    return {
      success: true,
      orderId: orderId,
      total: newTotal,
      gst: gst,
      deliveryFee: deliveryFee,
      message: 'Order approved successfully!',
    };
  } catch (error) {
    console.error('❌ Error approving order:', error);
    return {
      success: false,
      orderId: orderId,
      total: 0,
      gst: 0,
      deliveryFee: 0,
      error: error instanceof Error ? (error as any).message : 'Unknown error',
    };
  }
}

/**
 * Reject an order
 * 
 * @param orderId - Order ID to reject
 * @param order - Full order object (for notifications)
 * @param reason - Optional rejection reason
 * @returns Promise<boolean> - Success status
 */
export async function rejectOrder(
  orderId: string,
  order?: Order,
  reason?: string
): Promise<boolean> {
  // ✅ PASS 2: Prefer Cloud Function path
  try {
    await rejectOrderViaCloudFunction({ orderId, reason });
    invalidateCache.orders();
    return true;
  } catch (cfError: any) {
    const isTransportError =
      cfError?.code === 'functions/internal' ||
      cfError?.code === 'functions/unavailable' ||
      cfError?.code === 'functions/deadline-exceeded' ||
      cfError?.code === 'functions/not-found';
    if (!isTransportError) {
      console.error('❌ [rejectOrder] Cloud Function rejected:', cfError);
      return false;
    }
    logger.warn('⚠️ [rejectOrder] Cloud Function unavailable, falling back to client logic');
    // Fall through to legacy
  }

  try {
    if (DEBUG) logger.log('Rejecting order:', orderId);

    await updateOrder(orderId, {
      status: 'rejected' as const,
    });

    invalidateCache.orders();

    if (order) {
      await notifyOrderRejected(order, reason ?? '');
    }

    return true;

  } catch (error) {
    console.error('Error rejecting order:', error);
    return false;
  }
}