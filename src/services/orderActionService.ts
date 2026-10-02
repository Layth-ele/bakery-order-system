/**
 * Order Action Service
 * 
 * Admin order actions (approve, reject, cancel, confirm payment). Each one
 * calls its Cloud Function — the only place order status changes — and
 * returns a uniform OrderActionResult. Notifications and emails come from the
 * onOrderLifecycle trigger, not from here.
 * 
 * @author Bakery Order Management System
 */

import { getSettings } from './data/settingsDataService';
import { ErrorSeverity } from '../components/errors/ErrorLogger';
import type { Order } from '../types'; // ✅ Import Order from types
import { invalidateCache } from '../hooks/useCachedFirebase';
import { 
  approveOrder as approveOrderService, 
  qualifiesForFreeDelivery,
  validateDeliveryFee,
  type ApprovalResult,
  type AdminUser
} from './ordersService';
import { ErrorLogger } from '../components/errors/ErrorLogger'; // ✅ Use centralized error logger
import {
  rejectOrderViaCloudFunction,
  cancelOrderViaCloudFunction,
  callableErrorMessage,
} from './firebase/cloudFunctions';
import { displayOrderNumber } from '../utils/displayId';

// ============================================
// TYPES
// ============================================

export interface OrderActionResult {
  success: boolean;
  message?: string;  // User-friendly message
  error?: string;    // Error code/message
  data?: any;        // Optional result data
}

export interface AdminInfo {
  id?: string;
  email: string;
  name: string;
  storeName: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Extract admin info from user object
 */
export function getAdminInfo(user: unknown): AdminInfo {
  const u = user as any;
  return {
    email: u?.email || 'admin@bakery.com',
    name: u?.name || u?.email || 'Admin',
    storeName: u?.storeName || u?.name || u?.email || 'Admin'
  };
}

// ============================================
// ORDER ACTIONS
// ============================================

/**
 * Approve a pending order
 * 
 * 
 * @param order - The order to approve
 * @param admin - Admin user info
 * @param deliveryFee - Optional delivery fee (if already calculated)
 * @returns Promise<OrderActionResult>
 */
export async function approveOrderAction(
  order: Order,
  admin: AdminInfo,
  deliveryFee?: number
): Promise<OrderActionResult> {
  try {


    // Normal new order approval
    const adminUser: AdminUser = {
      email: (admin.email ?? ""),
      name: admin.storeName || admin.name || admin.email
    };

    // Calculate delivery fee if not provided
    let finalDeliveryFee = deliveryFee;
    if (finalDeliveryFee === undefined) {
      // FIX BUG 3 (HIGH): Was `safeParseJSON('bakery_settings', {})` — reads from localStorage
      // even in Firebase/production mode. If an admin updates freeDeliveryMin in System Settings
      // (which writes to Firestore), the approval path wouldn't see the change and would fall
      // back to a stale localStorage value or the hardcoded 250 default.
      // Fix: read from Firestore via getSettings() so approval always uses the live value.
      const settings = await getSettings();
      const freeDeliveryMin = settings.freeDeliveryMin ?? 250;
      
      if (qualifiesForFreeDelivery(order.subtotal, freeDeliveryMin)) {
        finalDeliveryFee = 0;
      } else {
        // Return error - delivery fee required
        return {
          success: false,
          error: 'DELIVERY_FEE_REQUIRED',
          message: 'Order does not qualify for free delivery. Please provide delivery fee.',
          data: { freeDeliveryMin }
        };
      }
    }

    // Validate delivery fee
    const feeError = validateDeliveryFee(finalDeliveryFee);
    if (feeError) {
      return {
        success: false,
        error: 'INVALID_DELIVERY_FEE',
        message: feeError
      };
    }

    // Call centralized approval service
    const result = await approveOrderService(
      order.id,
      order,
      finalDeliveryFee,
      adminUser
    );

    if (result.success) {
      return {
        success: true,
        message: result.message || 'Order approved successfully!',
        data: {
          orderId: result.orderId || "",
          total: result.total,
          gst: result.gst,
          deliveryFee: result.deliveryFee
        }
      };
    } else {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to approve order'
      };
    }

  } catch (error) {
    ErrorLogger.log(error as unknown as Error, {
      additionalContext: { context: 'approveOrderAction', orderId: order.id || "" },
      severity: ErrorSeverity.HIGH
    });
    
    return {
      success: false,
      error: (error as any).message || 'Unknown error',
      message: 'Failed to approve order. Please try again.'
    };
  }
}

/**
 * Reject a pending order — rejectOrder Cloud Function only.
 *
 * The server enforces the transition, records the reason and audit trail;
 * the customer notification + email come from the onOrderLifecycle trigger.
 * There is deliberately no client-side fallback (see callableErrorMessage).
 */
export async function rejectOrderAction(
  order: Order,
  _admin: AdminInfo,
  reason?: string
): Promise<OrderActionResult> {
  try {
    await rejectOrderViaCloudFunction({ orderId: order.id, reason });
    await invalidateCache.orders();
    return {
      success: true,
      message: 'Order rejected successfully',
      data: { orderId: order.id || '' },
    };
  } catch (error) {
    const message = callableErrorMessage(error, 'reject this order');
    ErrorLogger.log(error as Error, {
      additionalContext: { context: 'rejectOrderAction', orderId: order.id || '' },
      severity: ErrorSeverity.HIGH,
    });
    return { success: false, error: message, message };
  }
}

/**
 * Cancel an order, or some of its delivery days — cancelOrder Cloud Function
 * only. The server computes the store credit (same rules as the cancel
 * screen's preview) and commits it atomically with the change.
 */
export async function cancelOrderAction(
  order: Order,
  _admin: AdminInfo,
  reason: string,
  cancelledDays?: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>,
  cancellationFeePercentage?: number
): Promise<OrderActionResult> {
  try {
    const r = await cancelOrderViaCloudFunction({
      orderId: order.id,
      reason,
      cancelledDays: cancelledDays as string[] | undefined,
      cancellationFeePercentage,
    });
    await invalidateCache.orders();
    const credit = r.credit > 0 ? ` $${r.credit.toFixed(2)} store credit issued.` : '';
    return {
      success: true,
      message: r.full
        ? `Order ${displayOrderNumber(order)} has been cancelled.${credit} The customer has been notified.`
        : `Selected days removed from order ${displayOrderNumber(order)}.${credit} The customer has been notified.`,
      data: r,
    };
  } catch (error) {
    const message = callableErrorMessage(error, 'cancel this order');
    ErrorLogger.log(error as Error, {
      additionalContext: { context: 'cancelOrderAction', orderId: order.id || '' },
      severity: ErrorSeverity.HIGH,
    });
    return { success: false, error: message, message };
  }
}

// Payment confirmation — confirmOrderPayment Cloud Function only.
export { confirmPaymentAction } from './orders/paymentActionService';
