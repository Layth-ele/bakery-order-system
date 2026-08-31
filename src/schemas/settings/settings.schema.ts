/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SETTINGS SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schema for system-wide Settings
 * 
 * ✅ Business configuration
 * ✅ Delivery & pricing rules
 * ✅ Email & notification settings
 * 
 * LAST UPDATED: 2026-03-05
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  nonEmptyStringSchema,
  optionalNonEmptyStringSchema,
  emailSchema,
  optionalPhoneSchema,
  positiveAmountSchema,
  percentageSchema,
} from '../shared/primitives';

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Settings Schema
 * System-wide configuration settings
 */
export const settingsSchema = z.object({
  // Delivery & fees
  deliveryFee: positiveAmountSchema.optional(),
  freeDeliveryThreshold: positiveAmountSchema.optional(),
  freeDeliveryMin: positiveAmountSchema.optional(), // Minimum order for free delivery
  deliveryFeeDowntown: positiveAmountSchema.optional(),
  deliveryFeeEastVan: positiveAmountSchema.optional(),
  
  // Service charge
  serviceChargeEnabled: z.boolean().optional(),
  serviceChargeAmount: positiveAmountSchema.optional(), // Default: 3.99

  // Tax (PASS 12)
  // Both fields accepted on read for backwards compat: `gstRate` is what the
  // admin Settings UI writes today; `taxRate` is the legacy alias documented
  // in `SystemSettings`. Resolvers (orderCreationService.resolveGstRate,
  // useOrderPricing, useCustomerDashboardLogic, functions/orders.getTaxRate)
  // all prefer gstRate, fall back to taxRate, then to 0.05.
  // Validated as a fraction in [0, 1) — i.e. 0.05 means 5%, not the literal
  // percentage. Same convention as the Cloud Function and the schema in
  // src/services/data/settingsDataService.ts.
  gstRate: z.number().min(0).max(0.999).optional(),
  taxRate: z.number().min(0).max(0.999).optional(),
  
  // Order deadlines
  orderDeadline: optionalNonEmptyStringSchema, // e.g., "12:00 PM"
  dailyOrderDeadline: optionalNonEmptyStringSchema,
  weeklyOrderDeadline: optionalNonEmptyStringSchema,
  
  // Delivery days
  deliveryDays: z.array(nonEmptyStringSchema).optional(), // e.g., ["Monday", "Tuesday", ...]
  deliveryTimeInfo: optionalNonEmptyStringSchema,
  
  // Business information
  businessName: optionalNonEmptyStringSchema,
  businessLocation: optionalNonEmptyStringSchema,
  businessPhone: optionalPhoneSchema,
  businessEmail: z.union([z.string().email(), z.string().max(0), z.literal(null)]).optional().nullable(),
  businessCity: optionalNonEmptyStringSchema,
  businessNumber: optionalNonEmptyStringSchema, // Tax/Business registration number
  
  // Email settings
  adminEmail: z.union([z.string().email(), z.string().max(0), z.literal(null)]).optional().nullable(),
  ccEmail: z.union([z.string().email(), z.string().max(0), z.literal(null)]).optional().nullable(),
  orderEmail: z.union([z.string().email(), z.string().max(0), z.literal(null)]).optional().nullable(),
  orderCcEmail: z.union([z.string().email(), z.string().max(0), z.literal(null)]).optional().nullable(),
  sendApprovalEmails: z.boolean().optional(),
  
  // Payment methods
  paymentMethod1: optionalNonEmptyStringSchema,
  paymentMethod2: optionalNonEmptyStringSchema,
  paymentAddress: optionalNonEmptyStringSchema,
  
  // Policies
  dailyOrderPolicy: optionalNonEmptyStringSchema,
  weeklyOrderPolicy: optionalNonEmptyStringSchema,
  cancellationPolicy: optionalNonEmptyStringSchema,
  lateCancellationFee: optionalNonEmptyStringSchema,
  maxMonthlyCancellations: z.number().int().positive().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

/**
 * Update Settings Input - All fields optional
 */
export const updateSettingsInputSchema = settingsSchema.partial();

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
