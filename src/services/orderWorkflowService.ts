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
import { logger } from '../utils/logger';
import { sendOrderUpdatedEmail, describeEmailResult } from './emailService';
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
        : (emailResult
            ? `Order updated. Customer was NOT emailed — ${emailResult.error}`
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
 * Send the "your order was updated" email.
 *
 * Delivered by the sendOrderUpdatedEmail Cloud Function (Resend, branded
 * template, audit-logged in /emailLog). Resolves the real delivery state so
 * the caller never claims "customer notified" when nothing was sent.
 */
async function sendOrderUpdateEmail(orderId: string): Promise<EmailResult> {
  try {
    const result = await sendOrderUpdatedEmail(orderId);
    return result.state === 'sent'
      ? { success: true }
      : { success: false, error: describeEmailResult(result) };
  } catch (error) {
    logger.warn('[orderWorkflowService] order-updated email failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
