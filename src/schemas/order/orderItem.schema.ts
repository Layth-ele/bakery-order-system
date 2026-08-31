/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORDER ITEM SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schema for OrderItem (individual product with daily quantities)
 * 
 * ✅ Daily quantity validation
 * ✅ Total calculation validation
 * ✅ Price validation
 * 
 * LAST UPDATED: 2026-03-05
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  nonEmptyStringSchema,
  positiveAmountSchema,
} from '../shared/primitives';

// ═══════════════════════════════════════════════════════════════════════════
// ORDER ITEM SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Order Item Schema
 * Represents a product with daily quantities for a week
 */
export const orderItemSchema = z.object({
  // Product reference
  productId: idSchema,
  productName: nonEmptyStringSchema,
  price: positiveAmountSchema,
  
  // Daily quantities
  monday: z.number().int().nonnegative(),
  tuesday: z.number().int().nonnegative(),
  wednesday: z.number().int().nonnegative(),
  thursday: z.number().int().nonnegative(),
  friday: z.number().int().nonnegative(),
  saturday: z.number().int().nonnegative(),
  sunday: z.number().int().nonnegative(),
  
  // Total
  total: z.number().int().nonnegative(),

  // Legacy convenience field — alias for total (sum of daily quantities)
  quantity: z.number().int().nonnegative().optional(),

  // Denormalized fields (populated at read time)
  categoryName: z.string().optional(),
  categoryId: z.string().optional(),
  name: z.string().optional(), // alias for productName
}).refine(
  (data) => {
    const calculatedTotal = 
      data.monday + 
      data.tuesday + 
      data.wednesday + 
      data.thursday + 
      data.friday + 
      data.saturday + 
      data.sunday;
    return calculatedTotal === data.total;
  },
  {
    message: 'Total must equal sum of all daily quantities',
    path: ['total'],
  }
);

export type OrderItem = z.infer<typeof orderItemSchema>;

/**
 * Array of Order Items
 */
export const orderItemsArraySchema = z.array(orderItemSchema).min(1, 'Order must have at least one item');

export type OrderItemsArray = z.infer<typeof orderItemsArraySchema>;
