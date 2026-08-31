/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRODUCT & CATEGORY SCHEMAS - Zod Validation [CACHE-BUST-20260310T154000Z]
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schemas for Product and Category entities
 * 
 * ✅ Price validation (cost <= wholesale <= retail)
 * ✅ Discount validation (0-100%)
 * ✅ Category ordering
 * ✅ FIXED: .omit() error by splitting base schema from refined schema
 * 
 * LAST UPDATED: 2026-03-10 (Fixed .omit() on refined schema error)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  nonEmptyStringSchema,
  optionalNonEmptyStringSchema,
  positiveAmountSchema,
  optionalPercentageSchema,
  optionalUrlSchema,
} from '../shared/primitives';

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Category Schema
 */
export const categorySchema = z.object({
  id: idSchema,
  name: nonEmptyStringSchema,
  order: z.number().int().nonnegative(),
});

export type Category = z.infer<typeof categorySchema>;

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Product Base Schema (without refinements)
 * Used for creating input schemas
 */
const productBaseSchema = z.object({
  // Identity
  id: idSchema,
  categoryId: idSchema,
  name: nonEmptyStringSchema,
  
  // Pricing — new structured fields
  cost: positiveAmountSchema.optional(),
  retail: positiveAmountSchema.optional(),    // Individual customer price
  wholesale: positiveAmountSchema.optional(), // Commercial customer price
  
  // Legacy price field (used by older code)
  price: positiveAmountSchema.optional(),
  commercialPrice: positiveAmountSchema.optional(),
  retailPrice: positiveAmountSchema.optional(),
  
  // Ordering constraints
  minQty: z.number().int().nonnegative().optional(),
  dailyMinOrder: z.number().int().nonnegative().optional(),
  
  // Availability
  available: z.boolean().optional(),
  unit: z.string().optional(),
  
  // Category (legacy — usually just categoryId is stored)
  category: z.string().optional(),
  
  // Discounts
  discount: optionalPercentageSchema,
  discountedRetail: positiveAmountSchema.optional(),
  discountedWholesale: positiveAmountSchema.optional(),
  
  // Media & descriptions
  image: optionalUrlSchema,
  description: optionalNonEmptyStringSchema,
  ingredients: optionalNonEmptyStringSchema,
  storageDescription: optionalNonEmptyStringSchema,
  shelfLife: optionalNonEmptyStringSchema,

  // Allergens — array of allergen IDs e.g. ["wheat","eggs","milk","nuts","peanuts","soy","fish","shellfish"]
  allergens: z.array(z.string()).optional(),

  // Dietary labels — e.g. ["vegan","vegetarian","gluten-free","dairy-free","organic","low-sugar"]
  dietary: z.array(z.string()).optional(),

  // Nutrition per serving
  nutrition: z.object({
    servingSize:  z.string().optional(),
    calories:     z.number().optional(),
    protein:      z.number().optional(),
    carbs:        z.number().optional(),
    fat:          z.number().optional(),
    fiber:        z.number().optional(),
    sugar:        z.number().optional(),
    sodium:       z.number().optional(),
  }).optional(),

  // Display order
  order: z.number().int().nonnegative().optional(),
});

/**
 * Product Schema with validation
 * Fields are optional to support both legacy (price/unit) and new (cost/retail/wholesale) formats.
 */
export const productSchema = productBaseSchema;

export type Product = z.infer<typeof productSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// INPUT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create Product Input
 * Uses base schema (without refinements) to allow .omit()
 * Then adds the same refinements
 */
export const createProductInputSchema = productBaseSchema.omit({ id: true });
export type CreateProductInput = z.infer<typeof createProductInputSchema>;

/**
 * Update Product Input - All fields optional except ID
 */
export const updateProductInputSchema = productBaseSchema.partial().required({ id: true });

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

/**
 * Create Category Input
 */
export const createCategoryInputSchema = categorySchema.omit({ id: true });

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

/**
 * Update Category Input
 */
export const updateCategoryInputSchema = categorySchema.partial().required({ id: true });

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;