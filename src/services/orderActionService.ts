/**
 * Order Action Service
 * 
 * Centralized service for all order actions (approve, reject, cancel, confirm payment).
 * Provides standardized error handling and notification workflows.
 * 
 * ✅ MAR 12, 2026: Added support for partial day cancellations with credit calculation
 * ✅ MAR 11, 2026: Added rollback protection for notification failures
 * 
 * @author Bakery Order Management System
 */

import { SystemSettings } from '../services/data/settingsDataService';
import { getSettings } from './data/settingsDataService';
import { ErrorSeverity } from '../components/errors/ErrorLogger';
import { updateOrder } from './data/ordersDataService';
import type { Order } from '../types'; // ✅ Import Order from types
import { invalidateCache } from '../hooks/useCachedFirebase';
import {getServerTimestamp} from '../utils/timestamps'
import { Timestamp } from 'firebase/firestore';
import { 
  notifyOrderApproved, 
  notifyOrderRejected, 
  notifyOrderCancelled,
  notifyPaymentConfirmed
} from '../notifications';
import { 
  submitPaymentWorkflow,
} from '../notifications';
import { 
  approveOrder as approveOrderService, 
  rejectOrder as rejectOrderService,
  qualifiesForFreeDelivery,
  validateDeliveryFee,
  type ApprovalResult,
  type AdminUser
} from './ordersService';
import { logOrderEvent } from './orders/orderAuditService';
import { ENV } from '../config/environment'; // ✅ Use centralized environment config
import { ErrorLogger } from '../components/errors/ErrorLogger'; // ✅ Use centralized error logger
import { recordVoidedInvoice } from './invoicing/voidedInvoiceService'; // Fix 4: void log
import { displayOrderNumber } from '../utils/displayId';
import { logger } from '../utils/logger';


// 🔧 Debug flag using centralized config
const DEBUG = ENV.isDevelopment;

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
 * ✅ MAR 11, 2026: Added rollback protection for notification failures
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


    // Check if this is an UPDATE REQUEST (different workflow)
    if (order.updateRequested) {
      return await approveOrderUpdate(order, admin);
    }

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
 * Approve an order UPDATE request
 * Different from new order approval - handles paid orders
 * 
 * ✅ MAR 11, 2026: Added rollback protection for notification failures
 * 
 * @param order - The order with update request
 * @param admin - Admin user info
 * @returns Promise<OrderActionResult>
 */
async function approveOrderUpdate(
  order: Order,
  admin: AdminInfo
): Promise<OrderActionResult> {
  const originalStatus = order.status;
  const originalUpdateRequested = order.updateRequested;
  
  try {


    // ✅ FIX: Calculate new totals accounting for discount before GST
    const flatDiscount = order.discount || 0;
    const pctDiscount = order.discountPercentage ? (order.subtotal * order.discountPercentage / 100) : 0;
    // FIX BUG 5 (MEDIUM): Was `flatDiscount || pctDiscount` — silently dropped one
    // discount when both were set. Changed to + so both always apply.
    const totalDiscount = flatDiscount + pctDiscount;
    const discountedBase = Math.max(0, (order.subtotal || 0) - totalDiscount);
    const gst = Math.round((discountedBase * 0.05 + Number.EPSILON) * 100) / 100;
    const total = discountedBase + gst + (order.deliveryFee || 0) + (order.serviceChargeWaived ? 0 : (order.serviceCharge || 0)) - (order.creditApplied || 0);

    // Update order
    await updateOrder(order.id, {
      status: 'approved' as const,
      updateRequested: false,
      updateRequestedAt: undefined,
      approvedBy: (admin.email ?? ""),
      approvedAt: getServerTimestamp() as any,
      gst,
      total
    });

    // Log event
    const updatedOrder = { ...order, status: 'approved' as const, approvedBy: (admin.email ?? ""), approvedAt: Timestamp.now() as any, gst, total };
    void logOrderEvent(updatedOrder, 'approve', (admin.email ?? ""), `Order update approved by ${admin.email}`); // ✅ MAR 17: Non-fatal async audit log

    // Invalidate cache
    await invalidateCache.orders();

    // BUG 7 FIX (HIGH): Notifications are non-critical infrastructure.
    // Previously a notification failure rolled back the Firestore approval —
    // a fully committed business operation was reverted because an email/push
    // delivery failed. The admin saw an error, the order stayed unapproved,
    // and the customer was neither notified nor able to see the approval.
    // Fix: approval is always committed. Notification failure is logged at MEDIUM
    // severity and the result includes a warning flag so the UI can surface it.
    let notificationSent = true;
    try {
      await notifyOrderApproved(updatedOrder, total);
    } catch (notificationError: unknown) {
      notificationSent = false;
      ErrorLogger.log(notificationError as unknown as Error, {
        additionalContext: { context: 'approveOrderUpdate - notification failed (non-fatal)', orderId: order.id || "" },
        severity: ErrorSeverity.MEDIUM, // degraded, not a business failure
      });
      // No rollback — approval is committed and correct.
      // The customer will see the status change on their next dashboard load.
    }

    return {
      success: true,
      message: notificationSent
        ? 'Order update approved successfully!'
        : 'Order update approved. Customer notification could not be sent — they will see the status change on their next login.',
      data: { orderId: order.id || "", total, gst }
    };

  } catch (error) {
    ErrorLogger.log(error as unknown as Error, {
      additionalContext: { context: 'approveOrderUpdate', orderId: order.id || "" },
      severity: ErrorSeverity.HIGH
    });
    
    return {
      success: false,
      error: (error as any).message || 'Unknown error',
      message: 'Failed to approve order update. Please try again.'
    };
  }
}

/**
 * Reject a pending order
 * 
 * ✅ MAR 11, 2026: Added rollback protection for notification failures
 * 
 * @param order - The order to reject
 * @param admin - Admin user info
 * @param reason - Optional rejection reason
 * @returns Promise<OrderActionResult>
 */
export async function rejectOrderAction(
  order: Order,
  admin: AdminInfo,
  reason?: string
): Promise<OrderActionResult> {
  // FIX T2R4-C2 (CRITICAL — workflow bypass): Was purely client-side. Every
  // other action (approve/cancel/confirm-payment) prefers the Cloud Function
  // path for atomic state-transition + audit + notification, with client
  // fallback ONLY on transport errors.  Reject was inconsistent — admin
  // rejects went directly to client-side updateOrder + logOrderEvent, missing
  // the server-side audit boundary and the centralized notification path.
  // The `rejectOrderViaCloudFunction` callable already exists; this just
  // wires it in.
  try {
    const { rejectOrderViaCloudFunction } = await import('./firebase/cloudFunctions');
    await rejectOrderViaCloudFunction({ orderId: order.id, reason });
    await invalidateCache.orders();
    return {
      success: true,
      message: 'Order rejected successfully',
      data: { orderId: order.id || '' },
    };
  } catch (cfError: any) {
    const isTransportError =
      cfError?.code === 'functions/internal' ||
      cfError?.code === 'functions/unavailable' ||
      cfError?.code === 'functions/deadline-exceeded' ||
      cfError?.code === 'functions/not-found';
    if (!isTransportError) {
      ErrorLogger.log(cfError as Error, {
        additionalContext: { context: 'rejectOrderAction (CF)', orderId: order.id || '' },
        severity: ErrorSeverity.HIGH,
      });
      return {
        success: false,
        error: cfError?.message ?? 'Unknown error',
        message: cfError?.message ?? 'Failed to reject order. Please try again.',
      };
    }
    logger.warn('⚠️ [rejectOrderAction] Cloud Function unavailable, falling back to client logic');
    // Fall through to legacy client-side path below.
  }

  const originalStatus = order.status;

  try {
    // ─── Legacy client-side path (fallback only) ──────────────────────────
    // Update order in database
    await updateOrder(order.id, {
      status: 'rejected' as const,
      rejectedBy: (admin.email ?? ""),
      rejectedAt: getServerTimestamp() as any,
      rejectionReason: reason
    });

    // Log event
    const updatedOrder = { 
      ...order, 
      status: 'rejected' as const, 
      rejectedBy: (admin.email ?? ""), 
      rejectedAt: Timestamp.now() as any,
      rejectionReason: reason
    };
    logOrderEvent(updatedOrder, 'cancel', (admin.email ?? ""), `Order rejected by ${admin.email}${reason ? `: ${reason}` : ''}`);

    // Invalidate cache
    await invalidateCache.orders();

    // Send notification to customer (with rollback on failure for consistency
    // with the other action handlers — was previously best-effort/non-fatal,
    // which created a partial state where status was 'rejected' but the
    // customer never learned).
    try {
      await notifyOrderRejected(order, reason ?? '');
    } catch (notificationError: unknown) {
      ErrorLogger.log(notificationError as unknown as Error, {
        additionalContext: { context: 'rejectOrderAction - notification failed (rolling back)', orderId: order.id || "" },
        severity: ErrorSeverity.HIGH
      });

      // Rollback to original status
      await updateOrder(order.id, {
        status: originalStatus,
        rejectedBy: undefined,
        rejectedAt: undefined,
        rejectionReason: undefined,
      } as any);
      await invalidateCache.orders();

      throw new Error(`Notification failed: ${(notificationError as any).message}`);
    }

    return {
      success: true,
      message: 'Order rejected successfully',
      data: { orderId: order.id || "" }
    };

  } catch (error) {
    ErrorLogger.log(error as unknown as Error, {
      additionalContext: { context: 'rejectOrderAction', orderId: order.id || "" },
      severity: ErrorSeverity.HIGH
    });
    
    return {
      success: false,
      error: (error as any).message || 'Unknown error',
      message: 'Failed to reject order. Please try again.'
    };
  }
}

/**
 * Cancel an order
 * 
 * Can be used for any order status (approved, unpaid, etc.)
 * 
 * ✅ MAR 12, 2026: Added support for partial day cancellations with credit calculation
 * ✅ MAR 11, 2026: Added rollback protection for notification failures
 * 
 * @param order - The order to cancel
 * @param admin - Admin user info
 * @param reason - Cancellation reason
 * @param cancelledDays - Optional array of days being cancelled (for partial cancellations)
 * @param cancellationFeePercentage - Optional cancellation fee percentage (0-100)
 * @param creditAmount - Optional credit amount to issue to customer
 * @returns Promise<OrderActionResult>
 */

export async function cancelOrderAction(
  order: Order,
  admin: AdminInfo,
  reason: string,
  cancelledDays?: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>,
  cancellationFeePercentage?: number,
  creditAmount?: number
): Promise<OrderActionResult> {
  // ✅ PASS 2: Prefer Cloud Function path (atomic: status flip + voided invoice
  // + audit log committed together).
  try {
    const { cancelOrderViaCloudFunction } = await import('./firebase/cloudFunctions');
    await cancelOrderViaCloudFunction({
      orderId: order.id,
      reason,
      cancelledDays: cancelledDays as string[] | undefined,
      cancellationFeePercentage,
      creditAmount,
    });
    await invalidateCache.orders();
    return {
      success: true,
      message: `Order ${displayOrderNumber(order)} has been cancelled.`,
      data: { orderId: order.id || '', reason },
    };
  } catch (cfError: any) {
    const isTransportError =
      cfError?.code === 'functions/internal' ||
      cfError?.code === 'functions/unavailable' ||
      cfError?.code === 'functions/deadline-exceeded' ||
      cfError?.code === 'functions/not-found';
    if (!isTransportError) {
      ErrorLogger.log(cfError as Error, {
        additionalContext: { context: 'cancelOrderAction (CF)', orderId: order.id || '' },
        severity: ErrorSeverity.HIGH,
      });
      return {
        success: false,
        error: cfError?.message ?? 'Unknown error',
        message: 'Failed to cancel order. Please try again.',
      };
    }
    logger.warn('⚠️ [cancelOrderAction] Cloud Function unavailable, falling back to client logic');
    // Fall through to legacy
  }

  const originalStatus = order.status;

  try {
    // ─── Legacy client-side path (fallback only) ──────────────────────────
    // Update order status
    await updateOrder(order.id, {
      status: 'cancelled' as const,
      cancelledAt: getServerTimestamp() as any,
      cancelledBy: (admin.email ?? ""),
      cancellationReason: reason,
      ...(cancelledDays && { cancelledDays }),
      ...(cancellationFeePercentage !== undefined && { cancellationFeePercentage }),
      ...(creditAmount !== undefined && { creditAmount })
    });

    // ✅ FIX 4: Record void so sequential gap is documented for CRA audit
    await recordVoidedInvoice(order, 'cancelled', admin.email ?? 'system', reason);

    // Log event
    const cancelledOrder = {
      ...order,
      status: 'cancelled' as const,
      cancelledAt: Timestamp.now() as any,
      cancelledBy: (admin.email ?? ""),
      cancellationReason: reason,
      ...(cancelledDays && { cancelledDays }),
      ...(cancellationFeePercentage !== undefined && { cancellationFeePercentage }),
      ...(creditAmount !== undefined && { creditAmount })
    };
    logOrderEvent(
      cancelledOrder,
      'cancel',
      (admin.email ?? ""),
      `Order cancelled by ${admin.email} - Reason: ${reason}`
    );

    // Invalidate cache
    await invalidateCache.orders();

    // Send notification to customer (with rollback on failure)
    try {
      await notifyOrderCancelled(cancelledOrder, reason ?? '');
    } catch (notificationError: unknown) {
      // Rollback order status if notification fails
      ErrorLogger.log(notificationError as unknown as Error, {
        additionalContext: { context: 'cancelOrderAction - notification failed', orderId: order.id || "" },
        severity: ErrorSeverity.HIGH
      });

      // FIX T2R4-C3 part A (CRITICAL — partial-state corruption): Was rolling
      // back ONLY status/cancelledAt/cancelledBy/cancellationReason — but the
      // line above sets cancelledDays, cancellationFeePercentage, creditAmount
      // too.  Notification failure left the order with status reverted to
      // original BUT cancelledDays/feePct/creditAmount still set, so the next
      // admin or audit reader sees a confusing half-cancelled order.  Now we
      // clear all six fields the cancel write set.
      await updateOrder(order.id, {
        status: originalStatus,
        cancelledAt: undefined,
        cancelledBy: undefined,
        cancellationReason: undefined,
        cancelledDays: undefined,
        cancellationFeePercentage: undefined,
        creditAmount: undefined,
      } as any);
      await invalidateCache.orders();
      
      throw new Error(`Notification failed: ${(notificationError as any).message}`);
    }

    // FIX T2R4-C3 part B (CRITICAL — silent loss of customer money): Was
    // swallowing createCreditNote() errors with a "non-fatal" comment. The
    // order WAS marked cancelled and the customer notification said "credit
    // issued" — but if the credit note write failed, no credit existed in
    // the customer's account. Real money silently lost.
    //
    // Now: if the credit note fails, surface it as a partial-success warning
    // so the admin knows to retry the credit issuance manually. Do NOT
    // rollback the cancellation (the customer has been notified that their
    // order is cancelled — un-cancelling would be more confusing than
    // leaving the credit pending). The result includes a flag so the UI can
    // present a "credit issuance failed — retry" banner to the admin.
    let creditNoteIssued = false;
    let creditNoteError: string | undefined;
    if (creditAmount && creditAmount > 0 && order.customerId) {
      try {
        const { createCreditNote } = await import('./creditService');
        await createCreditNote(
          order.customerId,
          order.id,
          creditAmount,
          `Order cancellation: ${reason}`,
          'cancellation',
          admin.email ?? 'admin'
        );
        creditNoteIssued = true;
      } catch (creditErr) {
        creditNoteError = (creditErr as any)?.message ?? 'Unknown credit-note error';
        ErrorLogger.log(creditErr as Error, {
          additionalContext: {
            context: 'cancelOrderAction - createCreditNote FAILED — credit not issued',
            orderId: order.id || '',
            customerId: order.customerId,
            creditAmount,
          },
          severity: ErrorSeverity.HIGH,
        });
        // Do NOT swallow — propagate as a warning in the result so the UI
        // can show a clear "credit issuance failed, please retry" banner.
      }
    } else {
      // No credit owed — successful cancellation with nothing to issue.
      creditNoteIssued = true;
    }

    return {
      success: true,
      message: creditNoteIssued
        ? `Order ${displayOrderNumber(order)} has been cancelled.`
        : `Order ${displayOrderNumber(order)} cancelled — but credit-note issuance FAILED. Please issue credit manually. (${creditNoteError})`,
      data: {
        orderId: order.id || "",
        reason,
        creditNoteIssued,
        creditNoteError,
      } as any,
    };

  } catch (error) {
    ErrorLogger.log(error as unknown as Error, {
      additionalContext: { context: 'cancelOrderAction', orderId: order.id || "" },
      severity: ErrorSeverity.HIGH
    });
    
    return {
      success: false,
      error: (error as any).message || 'Unknown error',
      message: 'Failed to cancel order. Please try again.'
    };
  }
}

/**
 * Confirm payment for an order
 * 
 * @param order - The order to confirm payment for
 * @param admin - Admin user info
 * @returns Promise<OrderActionResult>
 */

// Payment confirmation — extracted to paymentActionService for clarity
export { confirmPaymentAction } from './orders/paymentActionService';
