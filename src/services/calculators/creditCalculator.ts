/**
 * Credit Calculator - Pure Business Logic
 * 
 * ✅ CLEAN ARCHITECTURE: Pure functions with no side effects
 * - No Firebase calls
 * - Fully testable
 * 
 * Extracted from creditService.ts (data access/orchestration removed)
 */

import { CreditNote } from '../../types'; // ✅ Import from types (re-exported from schemas)
import { toDate } from '../../utils/timestampFormatting';

// ✅ MAR 10, 2026: Removed duplicate CreditNote interface - now imported from /schemas

export interface OrderEditHistory {
  id: string;
  orderId: string;
  editedBy: string;
  editedAt: string;
  reason: string;
  changesSummary: string;
  originalTotal: number;
  newTotal: number;
  creditIssued: number;
  itemsChanged: Array<{
    productId: string;
    productName: string;
    originalQuantity: number;
    newQuantity: number;
    quantityChange: number;
    priceChange: number;
  }>;
}

/**
 * Calculate available credit from credit notes
 * 
 * @param creditNotes - Array of customer's credit notes
 * @returns Total available credit balance
 */
export function calculateAvailableCredit(creditNotes: CreditNote[]): number {
  return creditNotes
    .filter((note: CreditNote) => note.status === 'available' || note.status === 'partially_used')
    .reduce((total: number, note: CreditNote) => {
      // Use remainingBalance if available, otherwise fall back to amount
      const balance = note.remainingBalance ?? note.amount ?? 0;
      return total + balance;
    }, 0);
}

/**
 * Get maximum credit that can be applied to an order
 * 
 * @param availableCredit - Customer's total available credit
 * @param orderTotal - Order total amount
 * @returns Maximum credit that can be applied (cannot exceed order total)
 */
export function getMaxApplicableCredit(availableCredit: number, orderTotal: number): number {
  return Math.min(availableCredit, orderTotal);
}

/**
 * Calculate credit issued from order total reduction
 * 
 * @param originalTotal - Original order total
 * @param newTotal - New (reduced) order total
 * @returns Credit amount (0 if total didn't decrease)
 */
export function calculateCreditFromReduction(originalTotal: number, newTotal: number): number {
  const creditAmount = originalTotal - newTotal;
  return Math.max(0, creditAmount); // Ensure non-negative
}

/**
 * Calculate total admin edit credit for an order
 * 
 * @param editHistory - Array of edit history records for the order
 * @returns Total credit issued from all admin edits
 */
export function calculateTotalAdminEditCredit(editHistory: OrderEditHistory[]): number {
  return editHistory.reduce((total, edit) => total + (edit.creditIssued || 0), 0);
}

/**
 * Format credit amount for display
 * 
 * @param amount - Credit amount (can be undefined/null)
 * @returns Formatted string (e.g., "$50.00")
 */
export function formatCreditAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0.00';
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Calculate credit application breakdown
 * 
 * @param creditNotes - Available credit notes (sorted by oldest first)
 * @param amountToApply - Amount of credit to apply
 * @returns Array of credit applications and remaining notes
 */
export function calculateCreditApplications(
  creditNotes: CreditNote[],
  amountToApply: number
): {
  applications: Array<{ noteId: string; amountUsed: number; newBalance: number; newStatus: CreditNote['status'] }>;
  remainingAmount: number;
} {
  const applications: Array<{
    noteId: string;
    amountUsed: number;
    newBalance: number;
    newStatus: CreditNote['status'];
  }> = [];
  
  let remainingAmount = amountToApply;

  // Sort credit notes by creation date (oldest first - FIFO)
  const sortedNotes = [...creditNotes]
    .filter(note => note.status === 'available' || note.status === 'partially_used')
    .sort((a, b) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0));

  for (const note of sortedNotes) {
    if (remainingAmount <= 0) break;

    const noteBalance = note.remainingBalance ?? note.amount ?? 0;
    const amountToUse = Math.min(noteBalance, remainingAmount);
    const newBalance = noteBalance - amountToUse;
    const newStatus: CreditNote['status'] = newBalance <= 0 ? 'fully_used' : 'partially_used';

    applications.push({
      noteId: note.id,
      amountUsed: amountToUse,
      newBalance,
      newStatus,
    });

    remainingAmount -= amountToUse;
  }

  return {
    applications,
    remainingAmount,
  };
}

/**
 * Get credit summary statistics
 * 
 * @param creditNotes - Array of customer's credit notes
 * @returns Credit statistics object
 */
export function getCreditSummary(creditNotes: CreditNote[]) {
  const available = creditNotes.filter(n => n.status === 'available');
  const partiallyUsed = creditNotes.filter(n => n.status === 'partially_used');
  const fullyUsed = creditNotes.filter(n => n.status === 'fully_used');
  const paidOut = creditNotes.filter(n => n.status === 'paid_out');

  const totalAvailable = calculateAvailableCredit(creditNotes);
  const totalIssued = creditNotes.reduce((sum, note) => sum + (note.amount ?? 0), 0);
  const totalUsed = creditNotes.reduce((sum, note) => {
    const used = (note.amount ?? 0) - (note.remainingBalance ?? (note.amount ?? 0));
    return sum + used;
  }, 0);

  return {
    totalAvailable,
    totalIssued,
    totalUsed,
    availableCount: available.length,
    partiallyUsedCount: partiallyUsed.length,
    fullyUsedCount: fullyUsed.length,
    paidOutCount: paidOut.length,
    totalNotes: creditNotes.length,
  };
}

/**
 * Check if customer can request credit payout
 * 
 * @param availableCredit - Customer's available credit
 * @param minimumPayout - Minimum amount required for payout
 * @returns true if payout is allowed
 */
export function canRequestPayout(availableCredit: number, minimumPayout: number = 0): boolean {
  return availableCredit > minimumPayout;
}

/**
 * Validate order item edit for credit calculation
 * 
 * @param originalQuantity - Original item quantity
 * @param newQuantity - New item quantity
 * @returns Validation result
 */
export function validateItemEdit(originalQuantity: number, newQuantity: number): {
  valid: boolean;
  error?: string;
  quantityChange?: number;
} {
  if (newQuantity < 0) {
    return { valid: false, error: 'Quantity cannot be negative' };
  }

  if (newQuantity > originalQuantity) {
    return { valid: false, error: 'Cannot increase quantity on paid order (decreases only)' };
  }

  const quantityChange = newQuantity - originalQuantity;
  return { valid: true, quantityChange };
}

/**
 * Check if a paid order can be edited
 * 
 * @param orderStatus - Current order status
 * @returns Validation result
 */
export function canEditPaidOrder(orderStatus: string): { canEdit: boolean; reason?: string } {
  // Only in_process and completed orders can be edited (these are paid)
  if (orderStatus === 'in_process' || orderStatus === 'completed') {
    return { canEdit: true };
  }

  if (orderStatus === 'approved') {
    return { canEdit: false, reason: 'Order must be paid before editing' };
  }

  if (orderStatus === 'pending') {
    return { canEdit: false, reason: 'Order must be approved and paid before editing' };
  }

  if (orderStatus === 'cancelled' || orderStatus === 'rejected') {
    return { canEdit: false, reason: `Cannot edit ${orderStatus} orders` };
  }

  return { canEdit: false, reason: 'Invalid order status' };
}

/**
 * Calculate the credit note amount from an order total reduction
 *
 * @param originalTotal - The original order total before edit
 * @param newTotal - The new (reduced) order total after edit
 * @returns Credit amount to issue (always >= 0)
 */
export function calculateCreditNoteAmount(originalTotal: number, newTotal: number): number {
  const diff = originalTotal - newTotal;
  return Math.max(0, Math.round(diff * 100) / 100);
}

/**
 * Check whether a credit balance can be applied to an order
 *
 * @param availableCredit - Customer's current credit balance
 * @param orderTotal - Total value of the order
 * @returns true when both values are positive (credit exists and order has value)
 */
export function canApplyCreditToOrder(availableCredit: number, orderTotal: number): boolean {
  return availableCredit > 0 && orderTotal > 0;
}
// Re-export CreditNote so test files importing from this module
// can get the type from a single import.
export type { CreditNote } from '../../types';
