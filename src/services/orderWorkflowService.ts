/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORDER WORKFLOW SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 PURPOSE:
 * Centralized business logic for complex order workflows that were previously
 * scattered across hooks and components.
 * 
 * 📋 RESPONSIBILITIES:
 * - Order approval workflow (with delivery fee logic)
 * - Order rejection workflow
 * - Order editing workflow (items, fees, charges)
 * - Order update approval (order adjustments)
 * - Service charge management
 * - Delivery fee management
 * - Email notification orchestration
 * 
 * ✅ BENEFITS:
 * - Single source of truth for order workflows
 * - Testable business logic (isolated from React)
 * - Reusable across components
 * - Consistent error handling
 * - Clear separation from UI concerns
 * 
 * 🔄 REPLACES:
 * - Business logic from useOrderActionHandlers.tsx
 * - Business logic from hooks/orders/useOrderActions.ts
 * - Complex workflows scattered in components
 * 
 * 📅 Created: March 8, 2026 - Phase 1 Hooks Refactoring
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { updateOrder, getOrder } from './data/ordersDataService';
import { getSettings } from './data/settingsDataService';
import { getAllCustomers } from './customersService';
import { invalidateCache } from '../hooks/useCachedFirebase';
import { getServerTimestamp } from '../utils/timestamps';
import {
  approveOrderAction,
  rejectOrderAction,
  getAdminInfo,
  type AdminInfo,
  type OrderActionResult,
} from './orderActionService';
import type { Order } from '../types';
import { toDate } from '../utils/timestampFormatting';
import { displayOrderNumber } from '../utils/displayId';
import { logger } from '../utils/logger';
import {
  isDeliveryFeeRequired,
  qualifiesForFreeDelivery,
  calculateDeliveryFee,
  calculateOrderTotals,
} from './orders/deliveryFeeService';

// ═════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Workflow result with UI hints
 */
export interface WorkflowResult extends OrderActionResult {
  requiresInput?: boolean; // Indicates UI needs to prompt for input
  inputType?: 'DELIVERY_FEE' | 'PASSWORD' | 'CONFIRMATION';
  inputData?: any; // Data needed for the input prompt
}

/**
 * Admin user type for workflows
 */
export interface WorkflowAdminUser {
  email: string;
  name?: string;
  storeName?: string;
  role: 'admin' | 'customer'; // Widened to match User type
}

/**
 * Options for approval workflow
 */
export interface ApprovalWorkflowOptions {
  deliveryFee?: number; // Pre-calculated delivery fee
  skipDeliveryFeeCheck?: boolean; // Skip delivery fee requirement check
}

/**
 * Options for editing workflow
 */
export interface EditWorkflowOptions {
  sendEmail?: boolean; // Send email notification to customer
  recalculateFees?: boolean; // Recalculate delivery and service fees
}

/**
 * Email notification result
 */
interface EmailResult {
  success: boolean;
  error?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// BUSINESS RULES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Check if order requires delivery fee to be set
 * 
 * Business Rule:
 * - Orders with undefined/null delivery fee require admin to set it
 * - Free delivery (0) is valid and doesn't require input
 */
// Delivery fee helpers — extracted to deliveryFeeService.ts for clarity
export {
  isDeliveryFeeRequired,
  qualifiesForFreeDelivery,
  calculateDeliveryFee,
  calculateOrderTotals,
} from './orders/deliveryFeeService';

// ═════════════════════════════════════════════════════════════════════════════
// APPROVAL WORKFLOWS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Approve a pending order
 * 
 * Workflow:
 * 1. Check if delivery fee is required
 * 2. If required and not provided, return requiresInput = true
 * 3. Otherwise, execute approval via orderActionService
 * 4. Return result with success/error message
 * 
 * @param orderId - Order ID to approve
 * @param adminUser - Admin user performing the action
 * @param options - Approval options
 * @returns Workflow result
 */
export async function approveOrderWorkflow(
  orderId: string,
  adminUser: WorkflowAdminUser,
  options: ApprovalWorkflowOptions = {}
): Promise<WorkflowResult> {
  try {
    // Get order
    const order = await getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    // Get admin info
    const admin = getAdminInfo(adminUser);

    // Check if delivery fee is required
    if (!options.skipDeliveryFeeCheck && isDeliveryFeeRequired(order)) {
      // Calculate suggested delivery fee
      const suggestedFee = await calculateDeliveryFee(order);
      
      return {
        success: false,
        requiresInput: true,
        inputType: 'DELIVERY_FEE',
        inputData: {
          orderId,
          suggestedFee,
          freeDeliveryQualified: qualifiesForFreeDelivery(order),
        },
        message: 'Delivery fee required',
      };
    }

    // Determine delivery fee
    const deliveryFee = options.deliveryFee ?? (await calculateDeliveryFee(order));

    // Execute approval
    const result = await approveOrderAction(order, admin, deliveryFee);

    return result;
  } catch (error) {
    console.error('❌ Approval workflow error:', error);
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Failed to approve order',
    };
  }
}

/**
 * Complete the approval after delivery fee is provided
 * 
 * This is called after the UI prompts for delivery fee
 * and the admin provides it.
 */
export async function completeApprovalWorkflow(
  orderId: string,
  adminUser: WorkflowAdminUser,
  deliveryFee: number
): Promise<WorkflowResult> {
  return approveOrderWorkflow(orderId, adminUser, {
    deliveryFee,
    skipDeliveryFeeCheck: true,
  });
}

/**
 * Approve order update request
 * 
 * Workflow:
 * 1. Find order and validate it's an update request
 * 2. Execute approval workflow
 * 3. Return result
 */
export async function approveOrderUpdateWorkflow(
  orderId: string,
  adminUser: WorkflowAdminUser
): Promise<WorkflowResult> {
  try {
    const order = await getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    const admin = getAdminInfo(adminUser);

    // Execute approval (service handles update request logic)
    const result = await approveOrderAction(order, admin);

    return result;
  } catch (error) {
    console.error('❌ Update approval workflow error:', error);
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Failed to approve update',
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// REJECTION WORKFLOWS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Reject a pending order
 * 
 * Workflow:
 * 1. Get order
 * 2. Execute rejection via orderActionService
 * 3. Return result
 */
export async function rejectOrderWorkflow(
  orderId: string,
  adminUser: WorkflowAdminUser
): Promise<WorkflowResult> {
  try {
    const order = await getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    const admin = getAdminInfo(adminUser);
    const result = await rejectOrderAction(order, admin);

    return result;
  } catch (error) {
    console.error('❌ Rejection workflow error:', error);
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Failed to reject order',
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// EDITING WORKFLOWS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Edit order items and recalculate totals
 * 
 * Workflow:
 * 1. Validate edited items
 * 2. Calculate new subtotal
 * 3. Recalculate fees (delivery, service charge, GST)
 * 4. Update order in database
 * 5. Send email notification if requested
 * 6. Invalidate caches
 * 
 * Business Rules:
 * - Service charge is reset (no longer waived)
 * - Delivery fee recalculated based on new subtotal
 * - Original delivery fee is preserved
 */
export async function editOrderItemsWorkflow(
  orderId: string,
  editedItems: Order['items'],
  adminUser: WorkflowAdminUser,
  options: EditWorkflowOptions = {}
): Promise<WorkflowResult> {
  try {
    const order = await getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    // Calculate new subtotal
    const subtotal = editedItems.reduce((sum, item) => sum + item.total * item.price, 0);

    // Get settings for service charge
    const settings = await getSettings();
    const serviceCharge = settings.serviceChargeAmount ?? 3.99;

    // Calculate new delivery fee based on new subtotal
    const deliveryFee = options.recalculateFees !== false
      ? (subtotal >= 250 ? 0 : settings.deliveryFee || 50)
      : order.deliveryFee;

    // FIX T2R5-C2 (CRITICAL — financial calculation): Was
    //     const effectiveDiscount = existingFlatDiscount || existingPctDiscount;
    // The `||` operator silently dropped the percentage discount when the
    // flat discount was non-zero — so an order with BOTH a $5 flat AND a 10%
    // percentage discount only got the $5 discount applied during edit.
    // Customer was overcharged on every edit.
    //
    // Same fix template as Tier 1 BUG 5 in ordersService.ts:160 (already
    // fixed there with `+` to apply both). Applying it here too for
    // consistency.
    const existingFlatDiscount = order.discount || 0;
    const existingPctDiscount = order.discountPercentage
      ? subtotal * order.discountPercentage / 100 : 0;
    const effectiveDiscount = existingFlatDiscount + existingPctDiscount;
    const discountedSubtotal = Math.max(0, subtotal - effectiveDiscount);
    const { gst, total: rawTotal } = calculateOrderTotals(discountedSubtotal, deliveryFee, serviceCharge, false);
    const total = Math.max(0, rawTotal - (order.creditApplied || 0));

    // Update order
    await updateOrder(orderId, {
      items: editedItems,
      subtotal,
      gst,
      deliveryFee,
      serviceCharge,
      serviceChargeWaived: false, // Reset waiver on edit
      total,
      updatedAt: getServerTimestamp() as any,
      updatedBy: (adminUser.email ?? ""),
      originalDeliveryFee: order.originalDeliveryFee || order.deliveryFee,
    });

    // Invalidate cache
    invalidateCache.orders();

    // Send email if requested
    let emailResult: EmailResult | null = null;
    if (options.sendEmail !== false) {
      emailResult = await sendOrderUpdateEmail(orderId);
    }

    return {
      success: true,
      // FIX T2R5-C3: was claiming "customer notified via email!" even when
      // no email was sent (the mock claimed success).  Now reads the real
      // delivery state.
      message: emailResult?.success
        ? 'Order updated and customer notified via email!'
        : (emailResult?.error?.includes('No email provider')
            ? 'Order updated. Email notification queued (no email provider configured).'
            : 'Order updated successfully'),
      data: {
        subtotal,
        gst,
        deliveryFee,
        serviceCharge,
        total,
        emailSent: emailResult?.success || false,
      },
    };
  } catch (error) {
    console.error('❌ Edit order workflow error:', error);
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Failed to edit order',
    };
  }
}

/**
 * Update order delivery fee
 * 
 * Workflow:
 * 1. Validate delivery fee
 * 2. Recalculate total
 * 3. Update order
 * 4. Invalidate cache
 */
export async function updateDeliveryFeeWorkflow(
  orderId: string,
  newDeliveryFee: number,
  adminUser: WorkflowAdminUser
): Promise<WorkflowResult> {
  try {
    // Validate
    if (newDeliveryFee < 0) {
      return {
        success: false,
        error: 'Delivery fee cannot be negative',
      };
    }

    const order = await getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    // ✅ FIX: Account for discount before computing GST on delivery fee update
    const flatDisc = order.discount || 0;
    const pctDisc = order.discountPercentage ? (order.subtotal || 0) * order.discountPercentage / 100 : 0;
    const effDiscount = flatDisc || pctDisc;
    const discBase = Math.max(0, (order.subtotal || 0) - effDiscount);
    const { gst, total: rawTotal } = calculateOrderTotals(
      discBase,
      newDeliveryFee,
      order.serviceCharge,
      order.serviceChargeWaived
    );
    const total = Math.max(0, rawTotal - (order.creditApplied || 0));

    // Update order
    await updateOrder(orderId, {
      deliveryFee: newDeliveryFee,
      gst,
      total,
    });

    // Invalidate cache
    invalidateCache.orders();

    return {
      success: true,
      message: 'Delivery fee updated successfully',
      data: { deliveryFee: newDeliveryFee, gst, total },
    };
  } catch (error) {
    console.error('❌ Update delivery fee workflow error:', error);
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Failed to update delivery fee',
    };
  }
}

/**
 * Toggle service charge waived status
 * 
 * Workflow:
 * 1. Toggle waived status
 * 2. Recalculate total
 * 3. Update order
 * 4. Invalidate cache
 */
export async function toggleServiceChargeWorkflow(
  orderId: string,
  adminUser: WorkflowAdminUser
): Promise<WorkflowResult> {
  try {
    const order = await getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    const waived = !order.serviceChargeWaived;

    // ✅ FIX: Honour discount when toggling service charge waiver
    const scFlatDisc = order.discount || 0;
    const scPctDisc = order.discountPercentage ? (order.subtotal || 0) * order.discountPercentage / 100 : 0;
    const scEffDiscount = scFlatDisc || scPctDisc;
    const scDiscBase = Math.max(0, (order.subtotal || 0) - scEffDiscount);
    const { gst, total: scRawTotal } = calculateOrderTotals(
      scDiscBase,
      order.deliveryFee,
      order.serviceCharge,
      waived
    );
    const total = Math.max(0, scRawTotal - (order.creditApplied || 0));

    // Update order
    await updateOrder(orderId, {
      serviceChargeWaived: waived,
      gst,
      total,
    });

    // Invalidate cache
    invalidateCache.orders();

    return {
      success: true,
      message: waived ? 'Service charge waived' : 'Service charge applied',
      data: { serviceChargeWaived: waived, gst, total },
    };
  } catch (error) {
    console.error('❌ Toggle service charge workflow error:', error);
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Failed to toggle service charge',
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// EMAIL NOTIFICATION HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Send order update email notification
 *
 * FIX T2R5-C3 (CRITICAL — silent business-impact failure): This was a SECOND
 * copy of the silent-mock email service that T2R3-C5 fixed in
 * `services/emailService.ts`.  Both files claimed success without sending.
 * The caller `editOrderItemsWorkflow` then told the admin "Order updated and
 * customer notified via email!" — a lie.  Plus the customer lookup at line
 * 533 used `storeName` (collision-prone) rather than `customerId`.
 *
 * Fix: Mirror the T2R3-C5 fix exactly — return success: false with a clear
 * "no provider configured" reason, and persist the would-have-sent envelope
 * to localStorage for admin audit.  Caller's success message no longer
 * misrepresents what happened.
 */
async function sendOrderUpdateEmail(orderId: string): Promise<EmailResult> {
  try {
    const order = await getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // FIX T2R5-C3: customer lookup now uses customerId (the canonical key)
    // rather than storeName (which collides for shared business names).
    const customers = await getAllCustomers();
    const customer =
      (order.customerId && customers.find((c) => c.id === order.customerId)) ||
      customers.find((c) => c.storeName === order.customerName);

    if (!customer || !(customer.email ?? '')) {
      throw new Error('Customer email not found');
    }

    // Build envelope for the audit log.  Body is computed but not delivered.
    const itemsTable = order.items
      .map(
        (item) =>
          `${item.productName}: Mon(${item.monday || 0}) Tue(${item.tuesday || 0}) Wed(${item.wednesday || 0}) Thu(${item.thursday || 0}) Fri(${item.friday || 0}) Sat(${item.saturday || 0}) Sun(${item.sunday || 0}) - Total: ${item.total} × $${item.price?.toFixed(2) || '0.00'} = $${((item.total * item.price) || 0).toFixed(2)}`
      )
      .join('\n');

    // Resolve dynamic business name from settings (T2R3-C1 sibling).
    let bizName = 'Your Bakery';
    try {
      const settings = await getSettings();
      if (settings?.businessName) bizName = settings.businessName;
    } catch { /* keep default */ }

    const emailBody = `
Dear ${customer.contactPerson || customer.storeName},

Your order ${displayOrderNumber(order)} has been updated by the admin.

ORDER DETAILS:
Week: ${order.week} (${order.weekRange})
Order Date: ${(toDate(order.createdAt) ?? new Date()).toLocaleDateString()}
Last Updated: ${(toDate(order.updatedAt || order.createdAt) ?? new Date()).toLocaleDateString()}

ITEMS:
${itemsTable}

PRICING:
Subtotal: $${order.subtotal?.toFixed(2) || '0.00'}
Delivery Fee: $${order.deliveryFee?.toFixed(2) || '0.00'}
Service Charge: $${order.serviceChargeWaived ? '0.00 (waived)' : (order.serviceCharge?.toFixed(2) || '0.00')}
GST (5%): $${order.gst?.toFixed(2) || '0.00'}
TOTAL: $${order.total?.toFixed(2) || '0.00'}

Delivery Address: ${order.customerAddress}

${order.note ? `Customer Note: ${order.note}` : ''}

Please review the updated order. If you have any questions, please contact us.

Best regards,
${bizName} Team
    `;

    // Persist to localStorage so admin can audit what would have been sent.
    // Bounded at 200 entries to prevent unbounded growth.
    try {
      const raw = localStorage.getItem('bakery_sent_emails');
      const log: any[] = raw ? JSON.parse(raw) : [];
      log.push({
        to: customer.email,
        subject: `Order Update Notification - Order ${displayOrderNumber(order)}`,
        body: emailBody,
        sentAt: new Date().toISOString(),
        orderId: order.id || '',
        type: 'order-update-workflow',
        delivered: false,
      });
      while (log.length > 200) log.shift();
      localStorage.setItem('bakery_sent_emails', JSON.stringify(log));
    } catch { /* localStorage unavailable */ }

    // Dev-mode warning so the gap is visible during development.
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      logger.warn(
        '⚠️ [orderWorkflowService.sendOrderUpdateEmail] No email provider is ' +
        'configured. Mail is NOT being sent. Wire up SendGrid/SES/Postmark ' +
        'via a Cloud Function to enable real email delivery.'
      );
    }

    // Honest result: NOT delivered. Caller will surface this to the admin.
    return {
      success: false,
      error: 'No email provider configured — message queued for audit only',
    };
  } catch (error) {
    console.error('❌ Email sending error:', error);
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Failed to send email',
    };
  }
}
