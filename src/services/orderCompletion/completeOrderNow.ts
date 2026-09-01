/**
 * 🎯 UNIFIED ORDER COMPLETION SERVICE
 * 
 * Central service for completing orders and generating final invoices.
 * Used by both manual admin completion and automated Friday noon scheduler.
 * 
 * DESIGN PRINCIPLES:
 * 1. ✅ Idempotent: Can be called multiple times safely
 * 2. ✅ Atomic: All state changes happen in correct order
 * 3. ✅ Actor tracking: Records who/what triggered completion
 * 4. ✅ Financial integrity: Validates before finalizing
 * 5. ✅ One source of truth: Eliminates code duplication
 * 
 * ✅ TIMESTAMP FIX: Mar 5, 2026
 * - Prevents "RangeError: Invalid time value" in invoice generation
 * 
 * - All order reads/writes now go through getOrder()/updateOrder()
 * - createAndSaveInvoiceSnapshot() is now properly awaited
 * 
 * FLOW:
 * 1️⃣ Validate (order exists, not already completed)
 * 2️⃣ Mark order status = "completed" + lock via updateOrder()
 * 3️⃣ Generate final invoice via finalizeOrderToInvoice()
 * 4️⃣ Attach finalInvoiceId to order via updateOrder()
 * 5️⃣ Create snapshot via createAndSaveInvoiceSnapshot()
 * 6️⃣ Invalidate cache
 * 7️⃣ Send notification
 * 8️⃣ Return result
 */

import { Order } from '../../types';
import { finalizeOrderToInvoice } from '../invoicing/finalizeOrderToInvoice';
import { invalidateCache } from '../../hooks/useCachedFirebase';
import { createAndSaveInvoiceSnapshot } from '../orders/invoiceSnapshotService';
import { notifyOrderAutoCompleted } from '../../notifications';
import { getWeekInfoByNumber } from '../../utils/weekUtils';
import { getServerTimestamp } from '../../utils/timestamps';
import { getOrder, updateOrder } from '../data/ordersDataService';
import { logger } from '../../utils/logger';


export interface CompleteOrderResult {
  success: boolean;
  invoiceId?: string;
  error?: string;
  errorType?: 'already_completed' | 'validation_failed' | 'invoice_generation_failed' | 'invoice_attach_failed' | 'unknown';
}

export interface CompleteOrderOptions {
  actor: string; // "admin@bakery.com" or "auto-scheduler" or customer email
}

/**
 * Complete an order and generate its final invoice.
 * 
 * ✅ MAR 17, 2026: Now uses ordersDataService for all reads/writes
 * 
 * @param order - The order to complete
 * @param options - Completion options (actor, etc.)
 * @returns Result object with success status and invoice ID or error
 */
export async function completeOrderNow(
  order: Order,
  options: CompleteOrderOptions
): Promise<CompleteOrderResult> {
  try {
    // ---------------------------
    // 🚨 GUARD 1: Validate order exists
    // ---------------------------
    if (!order?.id) {
      return {
        success: false,
        error: 'Invalid order: missing order ID',
        errorType: 'validation_failed',
      };
    }

    // ---------------------------
    // 🚨 GUARD 2: Check if already completed (idempotency)
    // ---------------------------
    const currentStatus = order.status;
    if ((currentStatus as string) === 'complete' || currentStatus === 'completed') {
      logger.warn(`⚠️ [completeOrderNow] Order ${order.id} already completed, returning existing invoice`);
      
      const existingInvoiceId = order.finalInvoiceId;
      if (existingInvoiceId) {
        return {
          success: true,
          invoiceId: existingInvoiceId,
        };
      }
      
      // Edge case: Order marked complete but no invoice ID (should not happen)
      console.error(`❌ [completeOrderNow] Order ${order.id} has status=completed but no finalInvoiceId!`);
      return {
        success: false,
        error: 'Order already completed but missing invoice ID',
        errorType: 'already_completed',
      };
    }

    // ---------------------------
    // ✅ SIMPLIFIED: No adjustment blocking
    // ---------------------------

    // ---------------------------
    // 1️⃣ STEP 1: Calculate deliveryDate if missing
    // ---------------------------
    let deliveryDate = order.deliveryDate;
    if (!deliveryDate && order.week && order.year) {
      try {
        const { weekEnd } = getWeekInfoByNumber(order.week, order.year);
        deliveryDate = weekEnd.toISOString().split('T')[0]; // Format as YYYY-MM-DD string
      } catch (error) {
        logger.warn(`⚠️ [completeOrderNow] Failed to calculate deliveryDate for order ${order.id}:`, error);
      }
    }

    // ISO now for the completedOrder in-memory object (used by finalizeOrderToInvoice)
    const nowISO = new Date().toISOString();

    // ---------------------------
    // 2️⃣ STEP 2: Mark order as COMPLETED via data service (Firestore-aware)
    // ✅ Uses getServerTimestamp() for Firestore timestamp fields
    // ---------------------------
    await updateOrder(order.id, {
      status: 'completed' as any,
      locked: true,
      completedAt: getServerTimestamp() as any,
      finalizedAt: getServerTimestamp() as any,
      completedBy: options.actor,
      ...(deliveryDate && { deliveryDate }),
    } as any);
    

    // ---------------------------
    // 3️⃣ STEP 3: Build completedOrder for invoice generation
    // We need the full order object with updated status
    // Uses ISO string for in-memory object (not Firestore write)
    // ---------------------------
    const completedOrder: Order = {
      ...order,
      status: 'completed' as any,
      locked: true,
      completedAt: nowISO as any,
      finalizedAt: nowISO as any,
      completedBy: options.actor,
      ...(deliveryDate && { deliveryDate }),
    } as any;

    // ---------------------------
    // 4️⃣ STEP 4: Generate final invoice (status is now "completed" ✅)
    // ---------------------------
    let invoiceId: string;
    try {
      invoiceId = await finalizeOrderToInvoice(completedOrder);
    } catch (invoiceError) {
      console.error(`❌ [completeOrderNow] Failed to generate invoice for order ${order.id}:`, invoiceError);
      
      // ROLLBACK: Restore order to previous status via data service
      try {
        await updateOrder(order.id, {
          status: currentStatus,
          locked: false,
          completedAt: undefined as any,
          finalizedAt: undefined as any,
          completedBy: undefined as any,
        } as any);
        logger.warn(`⚠️ [completeOrderNow] Rolled back order ${order.id} to status: ${currentStatus}`);
      } catch (rollbackError) {
        console.error(`❌ [completeOrderNow] Rollback failed for order ${order.id}:`, rollbackError);
      }
      
      return {
        success: false,
        error: invoiceError instanceof Error ? invoiceError.message : 'Failed to generate invoice',
        errorType: 'invoice_generation_failed',
      };
    }

    // ---------------------------
    // 5️⃣ STEP 5: Attach invoice ID to order via data service
    //
    // FIX T2R5-H2 (HIGH — half-commit on step 5 failure): Steps 2-4 had
    // proper rollback (lines 161-172). Step 5 did not. If `updateOrder`
    // failed to attach the invoiceId (network blip, transient Firestore
    // error, rules issue), the order was committed in `completed` +
    // `locked: true` state but without `finalInvoiceId` — leaving it in a
    // permanently broken state. The next completion attempt would hit the
    // idempotency guard at line 86-99 and return "completed but missing
    // invoice ID" with no path to recover except manual Firestore fixup.
    //
    // Fix: wrap in try/catch. On failure, ROLL BACK the order from
    // 'completed' + locked → its prior status. The invoice number IS
    // already minted server-side (cannot be unminted — sequential numbers),
    // but it's now orphaned (not attached to any order). Voidedinvoices
    // catch-up: surface the orphaned invoice number in the error so admin
    // can reconcile via voided-invoice tooling. Better than a permanently
    // bricked order.
    // ---------------------------
    try {
      await updateOrder(order.id, {
        finalInvoiceId: invoiceId,
      } as any);
    } catch (attachError) {
      console.error(
        `❌ [completeOrderNow] Failed to attach finalInvoiceId=${invoiceId} ` +
        `to order ${order.id}:`, attachError
      );

      // Roll back the order to its prior status. The locked flag is also
      // reset so an admin can retry completion — the rollback flow mirrors
      // the step 4 (invoice generation) rollback above.
      try {
        await updateOrder(order.id, {
          status: currentStatus,
          locked: false,
          completedAt: undefined as any,
          finalizedAt: undefined as any,
          completedBy: undefined as any,
        } as any);
        logger.warn(
          `⚠️ [completeOrderNow] Rolled back order ${order.id} to status: ` +
          `${currentStatus} (invoiceId ${invoiceId} is orphaned — record it ` +
          `in voidedInvoices via the admin tooling before retrying ` +
          `completion to avoid a sequential-number gap).`
        );
      } catch (rollbackError) {
        console.error(
          `❌ [completeOrderNow] CRITICAL: step-5 attach FAILED and ` +
          `rollback ALSO FAILED for order ${order.id}. The order is in ` +
          `an inconsistent state and requires manual reconciliation. ` +
          `Original attach error:`, attachError,
          `Rollback error:`, rollbackError
        );
      }

      return {
        success: false,
        error: attachError instanceof Error
          ? attachError.message
          : 'Failed to attach invoice ID to order',
        errorType: 'invoice_attach_failed',
      };
    }

    // ---------------------------
    // 6️⃣ STEP 6: Create invoice snapshot (properly awaited)
    // ✅ MAR 17: Now properly awaited (was fire-and-forget before)
    // ---------------------------
    const orderWithInvoice: Order = {
      ...completedOrder,
      finalInvoiceId: invoiceId,
    } as any;

    const snapshotMessage = options.actor === 'system' || options.actor === 'auto-scheduler'
      ? 'Auto-completed by system'
      : `Manually completed by ${options.actor}`;
    
    try {
      await createAndSaveInvoiceSnapshot(
        orderWithInvoice,
        'complete',
        options.actor,
        snapshotMessage
      );
    } catch (snapshotError) {
      // Non-fatal: log but don't fail the completion
      logger.warn(`⚠️ [completeOrderNow] Snapshot creation failed for order ${order.id}:`, snapshotError);
    }

    // ---------------------------
    // 7️⃣ STEP 7: Invalidate cache to refresh UI
    // ---------------------------
    invalidateCache.orders();
    

    // ---------------------------
    // 8️⃣ STEP 8: Send completion notification to customer
    // ---------------------------
    try {
      await notifyOrderAutoCompleted(orderWithInvoice, invoiceId);
    } catch (notifError) {
      console.error(`⚠️ [completeOrderNow] Failed to send notification for order ${order.id}:`, notifError);
      // Don't fail the entire operation if notification fails
    }

    return {
      success: true,
      invoiceId,
    };

  } catch (error) {
    console.error(`❌ [completeOrderNow] Unexpected error completing order ${order?.id}:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? (error as any).message : 'Unknown error occurred',
      errorType: 'unknown',
    };
  }
}

/**
 * Batch complete multiple orders (for auto-scheduler).
 * Completes orders in sequence to avoid race conditions.
 * 
 * @param orders - Array of orders to complete
 * @param options - Completion options
 * @returns Array of results for each order
 */
export async function completeOrdersBatch(
  orders: Order[],
  options: CompleteOrderOptions
): Promise<CompleteOrderResult[]> {
  
  const results: CompleteOrderResult[] = [];
  
  for (const order of orders) {
    const result = await completeOrderNow(order, options);
    results.push(result);
    
    if (result.success) {
    } else {
      console.error(`❌ [completeOrdersBatch] Order ${order.id} failed: ${result.error}`);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  
  return results;
}