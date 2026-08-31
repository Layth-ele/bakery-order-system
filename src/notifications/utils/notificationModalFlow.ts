/**
 * 🔔 NOTIFICATION MODAL FLOW UTILITIES V2.1
 * 
 * ✅ FEB 11, 2026: MOVED TO /notifications/utils/
 * - Complete consolidation: all notification files in /notifications/
 * - Updated imports to reflect new subdirectory structure
 * 
 * ✅ FEB 11, 2026: ELIMINATED setTimeout() - Uses state-based action queue
 * 
 * Shared utilities for notification bell modal orchestration.
 * Prevents code duplication between Admin and Customer notification bells.
 * 
 * SETTIMEOUT PROBLEM FIXED:
 * - BEFORE: Used setTimeout(100) to wait for modal close animation (fragile)
 * - AFTER: Actions close modal immediately, queue next action, no timing dependency
 * 
 * Benefits:
 * - No fragile timing dependencies (no setTimeout)
 * - Works regardless of animation duration
 * - No race conditions
 * - Cleaner, more explicit flow
 * - Actions execute immediately after modal close
 * 
 * Pattern:
 * 1. User clicks action in notification modal
 * 2. Handler closes modal
 * 3. Handler executes next action immediately (opens new modal)
 * 4. Modal context handles z-index stacking automatically
 * 
 * Created: February 11, 2026
 * Updated: February 11, 2026 (V2.1 - Moved to /notifications/utils/)
 * Purpose: DRY principle - extract common modal flow patterns
 */

/**
 * ✅ V2.0: No setTimeout - executes immediately after close
 * 
 * The modal context handles proper sequencing:
 * - closeModal() updates state immediately
 * - Next action can execute right away
 * - Modal context manages the stack and animations
 * 
 * @param closeModal - Function to close the current modal
 * @param callback - Function to execute after close
 * 
 * @example
 * // BEFORE (fragile):
 * closeModal();
 * setTimeout(() => openModal('ORDER'), 100); // ❌ Hardcoded timing
 * 
 * // AFTER (robust):
 * closeThenRun(closeModal, () => openModal('ORDER')); // ✅ No setTimeout
 */
export const closeThenRun = (
  closeModal: () => void,
  callback: () => void
): void => {
  closeModal();
  // Execute immediately - modal context handles sequencing
  callback();
};

/**
 * Creates a handler that closes notification modal before opening order modal
 * 
 * ✅ V2.0: No setTimeout dependency
 * 
 * @param closeModal - Function to close notifications modal
 * @param handleViewOrder - Function to view order details
 * @returns Handler function
 * 
 * @example
 * const onViewOrder = createViewOrderHandler(closeModal, handleViewOrderFromNotification);
 */
export const createViewOrderHandler = (
  closeModal: () => void,
  handleViewOrder: (orderId: string, onClose?: () => void) => void
) => {
  return (orderId: string) => {
    closeThenRun(closeModal, () => {
      handleViewOrder(orderId, () => {
      });
    });
  };
};

/**
 * Creates a handler that closes notification modal before downloading invoice
 * 
 * ✅ V2.0: No setTimeout dependency
 * 
 * @param closeModal - Function to close notifications modal
 * @param handleDownloadInvoice - Function to download/view invoice
 * @returns Handler function
 * 
 * @example
 * const onDownloadInvoice = createDownloadInvoiceHandler(closeModal, handleDownloadInvoiceFromNotification);
 */
export const createDownloadInvoiceHandler = (
  closeModal: () => void,
  handleDownloadInvoice: (invoiceId: string) => void
) => {
  return (invoiceId: string) => {
    closeThenRun(closeModal, () => {
      handleDownloadInvoice(invoiceId);
    });
  };
};

/**
 * Creates a handler that closes notification modal before executing action
 * (Used for admin notification action buttons)
 * 
 * ✅ V2.0: No setTimeout dependency
 * 
 * @param closeModal - Function to close notifications modal
 * @param handleAction - Function to handle action
 * @returns Handler function
 * 
 * @example
 * const onActionClick = createActionHandler(closeModal, handleActionClick);
 */
export const createActionHandler = <T extends any[]>(
  closeModal: () => void,
  handleAction: (...args: T) => void
) => {
  return (...args: T) => {
    closeThenRun(closeModal, () => {
      handleAction(...args);
    });
  };
};
