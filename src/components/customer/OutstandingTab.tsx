/**
 * Outstanding Tab - Payment Management for Approved Unpaid Orders
 *
 * ✅ PURPOSE:
 * Shows ALL APPROVED orders awaiting admin payment confirmation
 * Filter: status='approved' (regardless of paymentSubmitted flag)
 * 
 * ✅ FEB 17, 2026: BALANCE FIX
 * - Shows ALL approved orders (even after customer submits payment proof)
 * - Balance only removed when admin confirms payment (status → 'in_process')
 * - Customer can see orders in "Payment Under Review" state
 * 
 * ✅ WHAT CUSTOMERS SEE:
 * - Base unpaid orders ONLY (main order payment before production starts)
 * - ❌ REMOVED (Feb 5, 2026): Unpaid increase adjustments (concept removed)
 * 
 * ✅ WHAT CUSTOMERS CAN DO:
 * - Submit payment proof
 * - View order details
 * - Download order details
 * 
 * ✅ BUSINESS RULES:
 * - Only admin can DECREASE order quantities
 * - Admin CANNOT increase quantities anymore
 * - Customer CANNOT increase quantities
 * 
 * ❌ REMOVED: Unpaid adjustments concept (Feb 5, 2026)
 * ✅ STEP 5 (Feb 4, 2026): Error boundary protection
 */

import { CustomerUnpaidOrders } from './CustomerUnpaidOrders';
import { SectionErrorBoundary } from '../errors/SectionErrorBoundary';
import type { User } from '../../hooks/useAuth';

interface OutstandingTabProps {
  user: User;
  onNavigateBack: () => void;
  onViewOrder: (orderId: string) => void;
}

export function OutstandingTab({
  user,
  onNavigateBack,
}: OutstandingTabProps): JSX.Element | null {
  return (
    // ✅ STEP 5: Error boundary wrapper
    <SectionErrorBoundary
      sectionName="Unpaid Orders"
      fallbackHeight="400px"
      onError={(error, errorInfo) => {
        console.error('CustomerUnpaidOrders error:', error, errorInfo);
      }}
    >
      <CustomerUnpaidOrders user={user} onNavigateBack={onNavigateBack} />
    </SectionErrorBoundary>
  );
}