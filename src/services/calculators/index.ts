/**
 * Calculators - Pure Business Logic Layer
 * 
 * ✅ CLEAN ARCHITECTURE: Barrel export for all calculator modules
 * 
 * These are pure functions with NO side effects:
 * - No Firebase/Firestore calls
 * - No cache invalidation
 * - No network requests
 * - Fully testable and predictable
 * 
 * ✅ UPDATED MARCH 10, 2026: Added pricingCalculator
 * 
 * Usage:
 * ```typescript
 * import { calculateGST, calculateAvailableCredit, money, calculateDeliveryFee } from '@/services/calculators';
 * ```
 */

// Order calculations
export * from './orderCalculator';

// Financial calculations (money, currency, GST)
export * from './financialCalculator';

// Balance calculations
export * from './balanceCalculator';

// Credit calculations
export * from './creditCalculator';

// Notification calculations
export * from './notificationCalculator';

// Pricing calculations (delivery fees, discounts, taxes)
// Note: explicit exports to avoid name conflicts with orderCalculator
export {
  calculateDeliveryFee as calculateDeliveryFeeFromPricing,
  calculateEarlyBirdDiscount,
  calculateBulkDiscount,
  calculateVolumeDiscount,
  calculateTaxes,
  calculateOrderTotal as calculateOrderTotalFromPricing,
  formatCurrency,
  qualifiesForFreeDelivery as qualifiesForFreeDeliveryFromPricing,
  amountNeededForFreeDelivery,
} from './pricingCalculator';