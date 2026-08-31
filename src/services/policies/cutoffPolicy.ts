/**
 * 📋 CUTOFF POLICY SERVICE
 *
 * Business rules for delivery cutoffs and order timing.
 * Single source of truth for cutoff rules.
 *
 * ✅ MAR 7, 2026: Migrated from /utils/cutoffValidator.ts to /services/policies
 * ✅ MAR 18, 2026: API aligned with test contract
 */

import { isDayLocked } from '../../utils/time/vancouverCutoff';
import { isBeforeThursdayCutoff, getCurrentWeekIdentifier, getNextWeekIdentifier } from '../../utils/weekSelection';
import { CUTOFF_MESSAGES } from '../../constants/messages';

/**
 * Result of cutoff validation
 */
export interface CutoffValidationResult {
  allowed: boolean;
  reason?: string;
  metadata?: {
    cutoffDate?: Date;
    hoursRemaining?: number;
  };
}

// ============================================================================
// DELIVERY DAY VALIDATORS
// ============================================================================

export function canModifyDeliveryDay(deliveryDate: Date): CutoffValidationResult {
  try {
    const isLocked = isDayLocked(deliveryDate);
    return {
      allowed: !isLocked,
      reason: isLocked ? CUTOFF_MESSAGES.DELIVERY_LOCKED : undefined,
    };
  } catch {
    return { allowed: false, reason: 'Invalid delivery date' };
  }
}

export function canModifyDeliveryDays(deliveryDates: Date[]): {
  allowedDates: Date[];
  blockedDates: Date[];
  allAllowed: boolean;
  anyAllowed: boolean;
} {
  const allowedDates: Date[] = [];
  const blockedDates: Date[] = [];

  deliveryDates.forEach(date => {
    const { allowed } = canModifyDeliveryDay(date);
    if (allowed) {
      allowedDates.push(date);
    } else {
      blockedDates.push(date);
    }
  });

  return {
    allowedDates,
    blockedDates,
    allAllowed: blockedDates.length === 0,
    anyAllowed: allowedDates.length > 0,
  };
}

// ============================================================================
// WEEK SELECTION VALIDATORS
// ============================================================================

export function canOrderCurrentWeek(): CutoffValidationResult {
  const beforeCutoff = isBeforeThursdayCutoff();
  return {
    allowed: beforeCutoff,
    reason: beforeCutoff ? undefined : CUTOFF_MESSAGES.THURSDAY_CUTOFF,
  };
}

/**
 * Get the appropriate week identifier for ordering.
 * Returns current week before Thursday noon, next week after.
 * Format: "YYYY-WNN"
 */
export function getOrderWeek(): string {
  const beforeCutoff = isBeforeThursdayCutoff();
  return beforeCutoff ? getCurrentWeekIdentifier() : getNextWeekIdentifier();
}

// ============================================================================
// PRODUCTION VALIDATORS
// ============================================================================

/**
 * Check if an order is in the production window.
 * Takes an order object and returns a plain boolean.
 */
export function isInProductionWindow(order: { week?: string; status?: string } | null): boolean {
  if (!order) return false;
  if (order.status && order.status !== 'approved') return false;
  if (!order.week) return false;
  return true;
}

// ============================================================================
// COMBINED VALIDATORS
// ============================================================================

/**
 * Check if an order can be edited.
 * Takes a single order object ({ status?, deliveryDates? }).
 */
export function canEditOrder(
  order: { status?: string; deliveryDates?: Record<string, any> | Date[] } | null
): CutoffValidationResult {
  if (!order) {
    return { allowed: false, reason: 'No order provided' };
  }

  const orderStatus = order.status ?? '';

  // FIX R8-S6-F31 (HIGH): Was only blocking completed/cancelled/rejected.
  // - 'in_process' was editable, meaning a customer could change items on an
  //   order the kitchen was already preparing — production planning corruption.
  // - 'delivered' was missing from the schema entirely (S6-F1) and from this
  //   blocklist; once delivered is added to the schema, it must also be
  //   blocked here (a delivered order is finalized — no further edits).
  if (
    orderStatus === 'completed' ||
    orderStatus === 'cancelled' ||
    orderStatus === 'rejected' ||
    orderStatus === 'in_process' ||
    orderStatus === 'delivered'
  ) {
    return {
      allowed: false,
      reason: `Cannot edit ${orderStatus} orders.`,
    };
  }

  // Derive Date array from deliveryDates (supports both array and object map)
  let deliveryDates: Date[] = [];
  if (Array.isArray(order.deliveryDates)) {
    deliveryDates = order.deliveryDates as Date[];
  } else if (order.deliveryDates && typeof order.deliveryDates === 'object') {
    deliveryDates = Object.values(order.deliveryDates)
      .filter((v): v is string => typeof v === 'string')
      .map(v => new Date(v));
  }

  if (deliveryDates.length === 0) {
    return { allowed: true };
  }

  const { allowedDates, blockedDates, anyAllowed } = canModifyDeliveryDays(deliveryDates);

  return {
    allowed: anyAllowed,
    reason: anyAllowed ? undefined : 'All delivery days are within the cutoff window',
    metadata: {
      // Extended metadata for callers that want day counts
      editableDays: allowedDates.length,
      lockedDays: blockedDates.length,
      allowedDates,
      blockedDates,
    } as any,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatValidationError(result: CutoffValidationResult): string {
  if (result.allowed) return '';
  return result.reason || 'Action not allowed';
}

export function isValidationError(result: CutoffValidationResult): boolean {
  return !result.allowed;
}
