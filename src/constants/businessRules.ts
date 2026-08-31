/**
 * Business Rules Configuration
 * Centralized constants for bakery order management system
 */

export const BUSINESS_RULES = {
  /**
   * Maximum number of weeks ahead a customer can place an order
   * Default: 10 weeks from current week
   */
  MAX_WEEKS_AHEAD: 10,

  /**
   * Minimum order subtotal for free delivery
   * Default: $250 CAD
   */
  DEFAULT_FREE_DELIVERY_MIN: 250,

  /**
   * Standard delivery fee (when order is below free delivery minimum)
   * Default: $10 CAD
   */
  DEFAULT_DELIVERY_FEE: 10,

  /**
   * Service charge amount when enabled
   * Default: $3.99 CAD
   */
  DEFAULT_SERVICE_CHARGE: 3.99,

  /**
   * GST (Goods and Services Tax) rate
   * Default: 5% (0.05)
   */
  GST_RATE: 0.05,

  /**
   * Minimum hours before delivery for order changes
   * Orders cannot be modified within this window
   * Default: 48 hours
   */
  CUTOFF_HOURS: 48,

  /**
   * Delivery cutoff time (Vancouver timezone)
   * Orders must be placed before this time for next-day consideration
   * Format: 24-hour time
   */
  DELIVERY_CUTOFF_HOUR: 12, // 12:00 PM (noon)
} as const;

export type BusinessRules = typeof BUSINESS_RULES;
