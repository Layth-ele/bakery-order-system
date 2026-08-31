/**
 * Balance Calculator - Pure Calculation Logic
 * 
 * ✅ SCHEMA-ALIGNED (Mar 10, 2026): Uses Order type from schemas
 * ✅ PURE FUNCTIONS: No data access, only calculations
 * ✅ TESTABLE: Easy to unit test (no dependencies)
 * 
 * Extracts balance calculation logic from balanceService.ts
 * Following the Service/Calculator architecture pattern.
 */

import type { UnpaidRow } from '../../utils/payments/unpaidSelectors';
import type { Order } from '../../schemas'; // ✅ SCHEMA TYPE

import {getUnpaidRows} from '../../utils/payments/unpaidSelectors'

/**
 * Calculate outstanding balance from unpaid rows
 * 
 * @param unpaidRows - Array of unpaid rows from getUnpaidRows()
 * @returns Total outstanding balance
 */
export function calculateBalanceFromUnpaidRows(unpaidRows: UnpaidRow[]): number {
  return unpaidRows.reduce((balance, row) => {
    if (row.kind === 'base_order') {
      // Base unpaid order: use order total
      const total = Number(row.order.total);
      return balance + (Number.isFinite(total) ? total : 0);
    } else if (row.kind === 'adjustment_increase') {
      // Unpaid increase adjustment: use adjustment paid amount or deltaTotal
      const adj = row.adjustment;
      const amount = Number(adj?.paid?.amount ?? adj?.deltaTotal ?? 0);
      return balance + (Number.isFinite(amount) ? amount : 0);
    }
    return balance;
  }, 0);
}

/**
 * Calculate outstanding balance for a customer's orders
 * 
 * @param customerOrders - Array of orders for a specific customer
 * @returns Total outstanding balance
 */
export function calculateOutstandingBalance(customerOrders: Order[]): number {
  const unpaidRows = getUnpaidRows(customerOrders);
  return calculateBalanceFromUnpaidRows(unpaidRows);
}

/**
 * Calculate net balance (outstanding - available credit)
 * 
 * @param outstandingBalance - Total outstanding balance
 * @param availableCredit - Available credit amount
 * @returns Net balance owed (can be negative if credit exceeds balance)
 */
export function calculateNetBalance(
  outstandingBalance: number,
  availableCredit: number
): number {
  return outstandingBalance - availableCredit;
}

/**
 * Get comprehensive financial summary for customer orders
 * 
 * @param customerOrders - Array of orders for a specific customer
 * @param availableCredit - Customer's available credit (from credit calculator)
 * @returns Financial summary object
 */
export function calculateCustomerFinancialSummary(
  customerOrders: Order[],
  availableCredit: number
) {
  // Calculate outstanding balance
  const unpaidRows = getUnpaidRows(customerOrders);
  const outstandingBalance = calculateBalanceFromUnpaidRows(unpaidRows);
  const netBalance = calculateNetBalance(outstandingBalance, availableCredit);

  // Count unpaid items by type
  const unpaidOrdersCount = unpaidRows.filter(row => row.kind === 'base_order').length;
  const unpaidSupplementaryCount = unpaidRows.filter(row =>
    row.kind === 'adjustment_increase'
  ).length;

  // Paid orders = in_process, completed, OR delivered (payment confirmed)
  // FIX R9-S5-F61 (HIGH): Was excluding 'delivered' status. Combined with
  // S6-F1 (delivered missing from schema), delivered orders disappeared from
  // BOTH paid and unpaid sets — they contributed to no totals.  Customer's
  // financial summary undercounted total spend.  Once 'delivered' is in the
  // schema (R10 fix), it must also count as paid here.
  const paidOrders = customerOrders.filter((order: Order) =>
    order.status === 'in_process' ||
    order.status === 'completed' ||
    order.status === 'delivered'
  );

  // Unpaid orders = approved (always unpaid by definition)
  const unpaidOrders = customerOrders.filter((order: Order) =>
    order.status === 'approved'
  );

  const totalPaid = paidOrders.reduce((sum: number, order: Order) => sum + order.total, 0);
  const totalUnpaid = unpaidOrders.reduce((sum: number, order: Order) => sum + order.total, 0);

  return {
    outstandingBalance,
    unpaidOrdersCount,
    unpaidSupplementaryCount,
    availableCredit,
    netBalance,
    totalPaid,
    totalUnpaid,
    paidOrderCount: paidOrders.length,
    unpaidOrderCount: unpaidOrders.length,
  };
}

/**
 * Check if customer has outstanding balance
 * 
 * @param outstandingBalance - Total outstanding balance
 * @returns true if customer owes money
 */
export function hasOutstandingBalance(outstandingBalance: number): boolean {
  return outstandingBalance > 0;
}

/**
 * Check if customer's credit covers their balance
 * 
 * @param outstandingBalance - Total outstanding balance
 * @param availableCredit - Available credit amount
 * @returns true if credit >= balance
 */
export function creditCoversBalance(
  outstandingBalance: number,
  availableCredit: number
): boolean {
  return availableCredit >= outstandingBalance;
}