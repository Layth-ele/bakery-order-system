/**
 * Constants Barrel Export
 * ✅ FEB 18, 2026: Centralized constants export
 * ✅ MAR 14, 2026: Removed unused theme.ts and routes.ts
 * 
 * PURPOSE:
 * - Single import point for all constants
 * - Clean import statements throughout the app
 * - Easy to maintain and extend
 * 
 * USAGE:
 * ```typescript
 * // Instead of multiple imports:
 * import { BUSINESS_RULES } from '@/constants/businessRules';
 * import { CUTOFF_MESSAGES } from '@/constants/messages';
 * 
 * // Use single import:
 * import { BUSINESS_RULES, CUTOFF_MESSAGES } from '@/constants';
 * ```
 */

// ============================================================================
// CORE CONSTANTS
// ============================================================================

export * from './businessRules';
export * from './businessDefaults'; // Phase 1 - Added to barrel export
export * from './messages';
// ✅ MAR 14, 2026: Removed theme.ts (unused - only in examples)
export * from './tableColumns';

// ============================================================================
// NEW CONSTANTS (FEB 18, 2026)
// ============================================================================

export * from './validation';
export * from './pricing';
// ✅ MAR 14, 2026: Removed routes.ts (unused - app uses AdminPage type instead)
export * from './storage';
export * from './permissions';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

// Business Rules
export type { BusinessRules } from './businessRules';

// ✅ MAR 14, 2026: Removed theme types (file deleted)

// Table Columns
export type { DayKey } from './tableColumns';

// Validation
export type { ValidationRules } from './validation';

// Pricing
export type { PricingRules } from './pricing';

// ✅ MAR 14, 2026: Removed route types (file deleted)

// Storage
export { STORAGE_KEYS } from './storage';

// Permissions
export type { UserRole, Permission } from './permissions';

// ============================================================================
// COMMONLY USED HELPER FUNCTIONS
// ============================================================================

// Validation helpers (functions live in inputValidator, not validation constants file)
export {
  isValidEmail,
  isValidPhone,
  isValidFileSize,
  isValidFileType,
  getFileSizeMB,
} from '../services/validators/inputValidator';

// Pricing helpers
export {
  calculateDeliveryFee,
  calculateEarlyBirdDiscount,
  calculateBulkDiscount,
  calculateVolumeDiscount,
  calculateTaxes,
  calculateOrderTotal,
  formatCurrency,
  qualifiesForFreeDelivery,
  amountNeededForFreeDelivery,
} from '../services/calculators/pricingCalculator';

// Storage helpers (deprecated - use Firestore instead)

// Permission helpers
export {
  hasPermission,
  canAccessOwnResource,
  isAdmin,
  isCustomer,
  getRolePermissions,
  hasAnyPermission,
  hasAllPermissions,
  getRoleDisplayName,
  ROLE_DISPLAY_NAMES,
} from './permissions';

// Message helpers
export {
  getDeliveryCutoffMessage,
  getEditBlockedMessage,
  getCutoffInfo,
} from './messages';

// Business defaults helpers
export {
  getBusinessSettingsWithDefaults,
} from './businessDefaults';