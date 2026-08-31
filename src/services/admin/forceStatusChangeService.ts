/**
 * Force Status Change Service
 * 
 * ✅ CREATED FEB 16, 2026: Admin emergency status override
 * 
 * Handles manual status transitions including backward changes and emergency overrides.
 * Provides audit logging, password validation, and side effect handling.
 * 
 * Features:
 * - Transition type detection (forward/backward/skip)
 * - Admin password validation
 * - Audit trail with flagged transitions
 * - Side effects handling (notifications, invoices, etc.)
 * - Business rule validation
 */

import { Order } from '../../types';
import { updateOrder } from '../data/ordersDataService';
import { createNotification } from '../../firebase/firestore/notifications';
import { getServerTimestamp } from '../../utils/timestamps';
import { toDate } from '../../utils/timestampFormatting';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { displayOrderNumber } from '../../utils/displayId';
import { logger } from '../../utils/logger';


/**
 * Transition type for status changes
 */
export type TransitionType = 'forward' | 'backward' | 'skip' | 'same';

/**
 * Audit log entry for status changes
 */
export interface StatusChangeAudit {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  
  // Status change details
  fromStatus: Order['status'];
  toStatus: Order['status'];
  transitionType: TransitionType;
  
  // Admin details
  adminEmail: string;
  
  // Reason
  reason: string;
  
  // Metadata
  timestamp: string;
  flagged: boolean; // True for unusual transitions (backward, skip)
  
  // Side effects
  sideEffects: string[];
}

/**
 * Detect the type of transition between two statuses
 */
export function detectTransitionType(from: Order['status'], to: Order['status']): TransitionType {
  if (from === to) return 'same';
  
  const statusOrder: Order['status'][] = ['pending', 'approved', 'in_process', 'completed'];
  const fromIndex = statusOrder.indexOf(from);
  const toIndex = statusOrder.indexOf(to);
  
  // Special statuses (rejected, cancelled) are considered emergency
  if (fromIndex === -1 || toIndex === -1) return 'skip';
  
  if (toIndex === fromIndex + 1) return 'forward';
  if (toIndex < fromIndex) return 'backward';
  if (toIndex > fromIndex + 1) return 'skip';
  
  return 'skip';
}

/**
 * Check if a transition is allowed
 */
export function isTransitionAllowed(from: Order['status'], to: Order['status']): boolean {
  // Cannot change from rejected or cancelled (these are final)
  if (from === 'rejected' || from === 'cancelled') {
    return false;
  }
  
  // Cannot change TO rejected or cancelled (use dedicated modals)
  if (to === 'rejected' || to === 'cancelled') {
    return false;
  }
  
  // Cannot change to same status
  if (from === to) {
    return false;
  }
  // All other transitions are allowed (will be logged and flagged if unusual)
  return true;
}

/**
 * Validate admin password via Firebase Auth reauthentication.
 * FIX C5: Previous implementation returned `true` for any non-empty string —
 * no actual credential was checked. An admin could force any order status
 * transition without knowing their real password.
 * Fix: reauthenticate the current Firebase Auth user with the supplied
 * credential. If reauthentication succeeds the password is correct; if it
 * throws auth/wrong-password or auth/invalid-credential we return false.
 */
async function validateAdminPassword(_adminEmail: string, password: string): Promise<boolean> {
  try {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;
    if (!currentUser?.email) return false;
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create audit log entry for status change.
 *
 * FIX H5: Was localStorage-only (cleared on browser clear, switched device, etc.) —
 * now writes to Firestore `statusChangeAudits` collection.
 *
 * FIX T2R5-C1 (CRITICAL — compliance/audit-trail): Was silently swallowing
 * Firestore write errors with logger.warn and returning the audit entry as if
 * it had been persisted.  For a CRA-registered business, the highest-risk
 * admin operation (force-changing an order's status, including backward
 * transitions) must have a durable, server-side audit record — losing the
 * audit because of a transient Firestore error means an unprovable status
 * change.  Now: errors are propagated so the caller (forceStatusChange) can
 * roll back the status change rather than committing it without an audit.
 */
async function createStatusChangeAudit(audit: Omit<StatusChangeAudit, 'id'>): Promise<StatusChangeAudit> {
  // FIX T2R4-H3 (HIGH — collision-prone audit IDs): Was using
  // `Math.random().toString(36).substr(2, 9)` for the audit ID suffix.
  // Math.random() in V8 is reverse-engineerable, and this is the audit
  // record for the highest-risk admin operation in the system (forced
  // status changes including backward transitions).  Two simultaneous
  // force-status-change events in the same millisecond would collide on
  // the suffix — overwriting one audit record with another.  Now uses
  // crypto.getRandomValues() which is cryptographically secure and
  // collision-resistant.
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const suffix = Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
  const auditEntry: StatusChangeAudit = {
    id: `AUDIT-${Date.now()}-${suffix}`,
    ...audit,
  };

  if (!db) {
    // Without Firestore there is no durable audit. Surface this as a hard
    // error so the calling status change can be rejected — the only safe
    // behaviour for a regulated audit trail.
    throw new Error('No Firestore connection available — cannot create audit record');
  }

  await addDoc(collection(db, 'statusChangeAudits'), {
    ...auditEntry,
    createdAt: serverTimestamp(),
  });

  return auditEntry;
}

/**
 * Handle side effects of status changes
 */
async function handleStatusChangeSideEffects(
  order: Order,
  targetStatus: Order['status'],
  adminEmail: string
): Promise<string[]> {
  const sideEffects: string[] = [];
  
  try {
    // Side effect: Customer notification for completed status
    if (targetStatus === 'completed') {
      // Notify customer that order is completed
      await createNotification({
        type: 'ORDER_COMPLETED',
        customerId: order.customerId || "",
        orderId: order.id || "",
        title: 'Order Completed',
        message: `Your order ${displayOrderNumber(order)} has been completed and is ready.`,
        read: false,
        // FIX R9-S5-F62 (HIGH): Was actions: [] — UI rendered the notification
        // with no clickable buttons.  Customer saw "Order completed" with no
        // way to view the order or its invoice.  Now provides a VIEW_ORDER
        // action so the bell-menu modal renders a usable link.
        actions: [{ type: 'VIEW_ORDER', label: 'View Order', payload: { orderId: order.id || '' } }],
        data: {
          orderId: order.id || "",
          orderTotal: order.total,
        },
      });
      sideEffects.push('customer_notified_completed');
    }
    
    // Side effect: Unlock order if rolling back from completed
    if (order.status === 'completed' && targetStatus !== 'completed') {
      sideEffects.push('order_unlocked');
      // Note: The order is already unlocked by the status change
    }
    
    // Side effect: Payment status reset if rolling back from in_process
    if (order.status === 'in_process' && targetStatus === 'approved') {
      sideEffects.push('payment_status_reset');
      // Payment confirmation might need to be re-done
    }
    
    // Side effect: Approval notification if moving to approved
    if (targetStatus === 'approved' && order.status !== 'approved') {
      await createNotification({
        type: 'ORDER_APPROVED_PAY_REQUIRED',
        customerId: order.customerId || "",
        orderId: order.id || "",
        title: 'Order Approved',
        message: `Your order ${displayOrderNumber(order)} has been approved.`,
        read: false,
        // FIX R9-S5-F62 (HIGH): Was actions: [] — customer saw "Order approved"
        // with no link to pay.  Now includes PAY_NOW + VIEW_ORDER actions so
        // the customer has a clear next step.
        actions: [
          { type: 'PAY_NOW', label: 'Pay Now', payload: { orderId: order.id || '' } },
          { type: 'VIEW_ORDER', label: 'View Order', payload: { orderId: order.id || '' } },
        ],
        data: {
          orderId: order.id || "",
          orderTotal: order.total,
        },
      });
      sideEffects.push('customer_notified_approved');
    }
  } catch (error) {
    console.error('❌ Error handling side effects:', error);
    sideEffects.push('side_effects_error');
  }
  
  return sideEffects;
}

/**
 * Main force status change function
 */
export async function forceStatusChange(
  order: Order,
  targetStatus: Order['status'],
  reason: string,
  adminEmail: string,
  adminPassword: string
): Promise<{ success: boolean; message: string; audit?: StatusChangeAudit }> {
  // 1. Validate admin password
  const passwordValid = await validateAdminPassword(adminEmail, adminPassword);
  if (!passwordValid) {
    return { success: false, message: 'Invalid admin password' };
  }
  
  // 2. Detect transition type
  const transitionType = detectTransitionType(order.status, targetStatus);
  
  // 3. Validate transition is allowed
  if (!isTransitionAllowed(order.status, targetStatus)) {
    return { 
      success: false, 
      message: `Transition from "${order.status}" to "${targetStatus}" is not allowed. Use dedicated modals for rejected/cancelled status.` 
    };
  }
  
  // 4. Check if transition is a no-op
  if (transitionType === 'same') {
    return { success: false, message: 'Order is already in the target status' };
  }
  
  try {
    // Capture pre-state for rollback if audit fails.
    const originalStatus = order.status;

    // 5. Update order status
    await updateOrder(order.id, {
      status: targetStatus,
      updatedAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
      updatedBy: adminEmail,
    });

    // 6. Handle side effects
    const sideEffects = await handleStatusChangeSideEffects(order, targetStatus, adminEmail);

    // 7. Create audit log
    //
    // FIX T2R5-C1 (CRITICAL — compliance): Audit write is now atomic-with-status.
    // If the audit fails, we roll back the status change so we never commit a
    // status transition without a durable server-side record.  This is required
    // for a CRA-registered business: every backward / skip transition MUST be
    // attributable to a specific admin via a server-side audit record.
    const flagged = transitionType === 'backward' || transitionType === 'skip';
    let audit: StatusChangeAudit;
    try {
      audit = await createStatusChangeAudit({
        orderId: order.id || "",
        customerId: order.customerId || "",
        customerName: order.customerName,
        fromStatus: order.status,
        toStatus: targetStatus,
        transitionType,
        adminEmail,
        reason,
        timestamp: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
        flagged,
        sideEffects,
      });
    } catch (auditErr) {
      // Roll back the status change. The customer notifications already sent
      // by handleStatusChangeSideEffects cannot be unsent — that's an
      // accepted partial-rollback.  An admin retrying the operation will
      // produce another notification, which is preferable to leaving a
      // status change unaudited.
      logger.warn(`[forceStatusChange] Audit failed — rolling back status change. Reason:`, auditErr);
      try {
        await updateOrder(order.id, {
          status: originalStatus,
          updatedAt: getServerTimestamp() as any,
          updatedBy: adminEmail,
        });
      } catch (rollbackErr) {
        // Both forward write and rollback failed.  Surface a clear error so
        // an admin can manually reconcile the order's state.
        return {
          success: false,
          message:
            `CRITICAL: Status changed to "${targetStatus}" but audit could not be written, ` +
            `AND rollback ALSO failed. Order ${displayOrderNumber(order)} is in an unaudited ` +
            `intermediate state. Please manually correct via Firestore. ` +
            `Audit error: ${(auditErr as any)?.message ?? auditErr}; ` +
            `Rollback error: ${(rollbackErr as any)?.message ?? rollbackErr}`,
        };
      }
      return {
        success: false,
        message:
          `Status change rejected: audit log could not be written. ` +
          `Order has been rolled back to "${originalStatus}". Please retry ` +
          `the change. (${(auditErr as any)?.message ?? auditErr})`,
      };
    }

    return {
      success: true,
      message: `Status changed: ${order.status} → ${targetStatus}`,
      audit,
    };
  } catch (error) {
    console.error('❌ [Force Status Change] Error:', error);
    return {
      success: false,
      message: (error as any)?.message || 'Failed to change status. Please try again.'
    };
  }
}

/**
 * Get all status change audit records from Firestore.
 * FIX H5: Was reading from localStorage — now reads the durable Firestore record.
 * Returns an empty array (gracefully) if Firestore is unavailable.
 */
export async function getStatusChangeAudits(): Promise<StatusChangeAudit[]> {
  try {
    if (!db) return [];
    const { getDocs, orderBy, query } = await import('firebase/firestore');
    const snap = await getDocs(
      query(collection(db, 'statusChangeAudits'), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map(d => d.data() as StatusChangeAudit);
  } catch (error) {
    console.error('❌ Error loading audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific order
 */
export async function getOrderAudits(orderId: string): Promise<StatusChangeAudit[]> {
  const allAudits = await getStatusChangeAudits();
  return allAudits.filter(audit => audit.orderId === orderId);
}

/**
 * Get flagged (unusual) status changes
 */
export async function getFlaggedAudits(): Promise<StatusChangeAudit[]> {
  const allAudits = await getStatusChangeAudits();
  return allAudits.filter(audit => audit.flagged);
}
