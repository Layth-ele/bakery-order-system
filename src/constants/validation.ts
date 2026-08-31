/**
 * Validation Rules Configuration
 * ✅ MARCH 10, 2026: Refactored - moved validation logic to /services/validators/inputValidator.ts
 * 
 * PURPOSE:
 * - Static validation constraints (min/max lengths, regex patterns)
 * - Single source of truth for business constraints
 * - Easy to update validation rules
 * 
 * ⚠️ IMPORTANT:
 * - This file contains ONLY static values
 * - All validation logic is in /services/validators/inputValidator.ts
 * - Do NOT add functions to this file
 * 
 * USAGE:
 * ```typescript
 * import { VALIDATION_RULES } from '@/constants/validation';
 * import { isValidEmail, validatePaymentProofFile } from '@/services/validators';
 * 
 * if (order.items.length < VALIDATION_RULES.order.minItems) {
 *   throw new Error('Order must have at least 1 item');
 * }
 * 
 * if (!isValidEmail(email)) {
 *   throw new Error('Invalid email address');
 * }
 * ```
 */

import { BUSINESS_RULES } from './businessRules';

export const VALIDATION_RULES = {
  /**
   * Order Validation Rules
   */
  order: {
    // Quantity Constraints
    minItems: 1,
    maxItems: 100,
    minQuantityPerItem: 1,
    maxQuantityPerItem: 99,
    
    // Value Constraints
    minSubtotal: 0, // No minimum order value
    maxSubtotal: 50000, // $50,000 reasonable maximum
    
    // Delivery Window
    minAdvanceDays: 2, // At least 2 days notice
    maxAdvanceWeeks: BUSINESS_RULES.MAX_WEEKS_AHEAD,
    
    // Special Instructions
    maxSpecialInstructionsLength: 500,
  },

  /**
   * Customer Validation Rules
   */
  customer: {
    // Name Constraints
    nameMinLength: 2,
    nameMaxLength: 100,
    
    // Email Constraints
    emailMaxLength: 255,
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    
    // Phone Constraints
    phoneMinLength: 10,
    phoneMaxLength: 20,
    phoneRegex: /^[\d\s\-\(\)\+]+$/,
    
    // Address Constraints
    addressMaxLength: 200,
    cityMaxLength: 100,
    postalCodeMaxLength: 10,
    
    // Business Name
    businessNameMaxLength: 150,
  },

  /**
   * Payment Validation Rules
   */
  payment: {
    minAmount: 0.01, // Minimum $0.01
    maxAmount: 50000, // Maximum $50,000
    
    // Payment Proof
    proofMaxLength: 500,
    referenceNumberMaxLength: 100,
  },

  /**
   * Product Validation Rules
   */
  product: {
    // Name and Description
    nameMinLength: 2,
    nameMaxLength: 150,
    descriptionMaxLength: 1000,
    
    // Pricing
    minPrice: 0.01,
    maxPrice: 10000, // $10,000 per item
    
    // Inventory
    minStock: 0,
    maxStock: 9999,
  },

  /**
   * File Upload Validation Rules
   */
  fileUpload: {
    // Payment Proof Images
    paymentProof: {
      maxSizeMB: 5,
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    },
    
    // Product Images
    productImage: {
      maxSizeMB: 2,
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    },
  },

  /**
   * Date Validation Rules
   */
  dates: {
    minAdvanceDays: 2,
    maxAdvanceWeeks: BUSINESS_RULES.MAX_WEEKS_AHEAD,
    cutoffHours: BUSINESS_RULES.CUTOFF_HOURS,
  },

  /**
   * Discount Validation Rules
   */
  discount: {
    minPercentage: 0,
    maxPercentage: 100,
    minFixedAmount: 0,
    maxFixedAmount: 10000,
    codeMaxLength: 50,
  },

  /**
   * Search and Filter Validation
   */
  search: {
    minQueryLength: 2,
    maxQueryLength: 100,
    maxResultsPerPage: 100,
  },
} as const;

/**
 * Type-safe validation rules
 */
export type ValidationRules = typeof VALIDATION_RULES;
