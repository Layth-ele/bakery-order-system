/**
 * Centralized User-Facing Messages
 * ✅ FEB 9, 2026: Single source of truth for all UI messages
 * 
 * PURPOSE:
 * - Consistent wording across the application
 * - Easy to update if business rules change
 * - Localization-ready (future)
 * 
 * USAGE:
 * ```typescript
 * import { CUTOFF_MESSAGES } from '../constants/messages';
 * 
 * toast.error(CUTOFF_MESSAGES.DELIVERY_LOCKED);
 * <input title={isLocked ? CUTOFF_MESSAGES.DELIVERY_LOCKED : ''} />
 * ```
 */

import { BUSINESS_RULES } from './businessRules';

// ============================================================================
// CUTOFF MESSAGES
// ============================================================================

export const CUTOFF_MESSAGES = {
  /**
   * Full delivery cutoff message
   * Used in: Tooltips, error modals, help text
   */
  DELIVERY_LOCKED: `Ordering closed (${BUSINESS_RULES.CUTOFF_HOURS}-hour delivery cutoff)`,
  
  /**
   * Short delivery cutoff message
   * Used in: Input field titles, compact UI
   */
  DELIVERY_LOCKED_SHORT: `${BUSINESS_RULES.CUTOFF_HOURS}h cutoff`,
  
  /**
   * Edit blocked message
   * Used in: Toast notifications, inline errors
   */
  EDIT_BLOCKED: `Cannot edit - delivery is within ${BUSINESS_RULES.CUTOFF_HOURS} hours`,
  
  /**
   * Week selection cutoff message
   * Used in: Week selector UI
   */
  THURSDAY_CUTOFF: 'Past Thursday noon cutoff - please order for next week',
  
  /**
   * Production locked message
   * Used in: Production sheet, admin dashboard
   */
  PRODUCTION_LOCKED: 'Production locked - within delivery window',
} as const;

// ============================================================================
// ORDER STATUS MESSAGES
// ============================================================================

export const ORDER_MESSAGES = {
  /**
   * Order approval messages
   */
  APPROVAL: {
    PENDING: 'Order is awaiting admin review',
    APPROVED: 'Order approved - awaiting payment',
    IN_REVIEW: 'Order is under review',
  },
  
  /**
   * Payment messages
   */
  PAYMENT: {
    AWAITING: 'Awaiting payment submission',
    SUBMITTED: 'Payment submitted - pending admin confirmation',
    CONFIRMED: 'Payment confirmed',
    REQUIRED: 'Payment required to proceed',
  },
  
  /**
   * Edit permission messages
   */
  EDIT: {
    ALLOWED: 'You can edit this order',
    LOCKED_APPROVED: 'Approved orders cannot be edited. Please contact the bakery to request changes.',
    LOCKED_COMPLETED: 'Completed orders cannot be edited.',
    LOCKED_CANCELLED: 'Cancelled orders cannot be edited.',
  },
} as const;

// ============================================================================
// DELIVERY MESSAGES
// ============================================================================

export const DELIVERY_MESSAGES = {
  /**
   * Delivery cutoff information
   */
  CUTOFF_INFO: `Orders must be placed before ${BUSINESS_RULES.DELIVERY_CUTOFF_HOUR}:00 PM Vancouver time, ${BUSINESS_RULES.CUTOFF_HOURS} hours before delivery.`,
  
  /**
   * Delivery schedule
   */
  SCHEDULE_INFO: 'Deliveries are made Monday through Sunday based on your selected week.',
  
  /**
   * Quality guarantee
   */
  QUALITY_GUARANTEE: `Quality guaranteed for ${BUSINESS_RULES.CUTOFF_HOURS} hours after delivery.`,
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  /**
   * Generic errors
   */
  UNKNOWN: 'An unknown error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  
  /**
   * Order errors
   */
  ORDER: {
    NOT_FOUND: 'Order not found.',
    LOAD_FAILED: 'Failed to load order. Please refresh the page.',
    SAVE_FAILED: 'Failed to save order. Please try again.',
    DELETE_FAILED: 'Failed to delete order. Please try again.',
  },
  
  /**
   * Payment errors
   */
  PAYMENT: {
    SUBMIT_FAILED: 'Failed to submit payment. Please try again.',
    CONFIRM_FAILED: 'Failed to confirm payment. Please try again.',
    INVALID_AMOUNT: 'Invalid payment amount.',
  },
  
  /**
   * Validation errors
   */
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    INVALID_PHONE: 'Please enter a valid phone number.',
    MIN_ORDER: 'Order does not meet minimum quantity requirements.',
  },
} as const;

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
  /**
   * Order success messages
   */
  ORDER: {
    CREATED: 'Order created successfully!',
    UPDATED: 'Order updated successfully!',
    DELETED: 'Order deleted successfully!',
    APPROVED: 'Order approved successfully!',
    REJECTED: 'Order rejected.',
  },
  
  /**
   * Payment success messages
   */
  PAYMENT: {
    SUBMITTED: 'Payment submitted successfully!',
    CONFIRMED: 'Payment confirmed successfully!',
  },
  
  /**
   * Save success messages
   */
  SAVE: {
    SETTINGS: 'Settings saved successfully!',
    PROFILE: 'Profile updated successfully!',
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get delivery cutoff message with custom hours
 * Useful for dynamic cutoff periods
 */
export function getDeliveryCutoffMessage(hours: number): string {
  return `Ordering closed (${hours}-hour delivery cutoff)`;
}

/**
 * Get edit blocked message with custom hours
 * Useful for dynamic cutoff periods
 */
export function getEditBlockedMessage(hours: number): string {
  return `Cannot edit - delivery is within ${hours} hours`;
}

/**
 * Get cutoff info with custom parameters
 * Useful for different regions or business rules
 */
export function getCutoffInfo(cutoffHour: number, cutoffHours: number): string {
  return `Orders must be placed before ${cutoffHour}:00 PM Vancouver time, ${cutoffHours} hours before delivery.`;
}