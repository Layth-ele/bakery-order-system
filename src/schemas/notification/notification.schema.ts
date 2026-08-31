/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTIFICATION SCHEMA - Zod Validation
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Schema for NotificationItem and related types
 * 
 * ✅ Notification type enum (locked from canonical contract)
 * ✅ Action type enum (locked)
 * ✅ Firestore Timestamp enforcement for createdAt/readAt
 * 
 * LAST UPDATED: 2026-03-05
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import {
  idSchema,
  nonEmptyStringSchema,
  optionalNonEmptyStringSchema,
  emailSchema,
  firestoreTimestampSchema,
  optionalFirestoreTimestampSchema,
  positiveAmountSchema,
} from '../shared/primitives';
import {
  NOTIFICATION_TYPES,
  ACTION_TYPES,
} from '../../types/notification-contract';

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION TYPE ENUM (from canonical contract)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Notification Type Enum
 * ✅ LOCKED: Imported from canonical notification contract
 */
export const notificationTypeSchema = z.enum([
  // Customer notifications
  'ORDER_PENDING',
  'ORDER_APPROVED_PAY_REQUIRED',
  'ORDER_REJECTED',
  'ORDER_CANCELLED',
  'PAYMENT_IN_REVIEW',
  'PAYMENT_CONFIRMED',
  'INVOICE_UPDATED',
  'ADDITIONAL_PAYMENT_REQUIRED',
  'CREDIT_ISSUED',
  'ORDER_COMPLETED',
  'PAYMENT_REMINDER',
  
  // Admin notifications
  'ORDER_SUBMITTED',
  'PAYMENT_SUBMITTED',
  'PAYMENT_CONFIRMED_ADMIN',
  'ORDER_AUTO_COMPLETED_ADMIN',
  'ORDER_UPDATE_REQUESTED',
  'ORDER_DECREASED_ADMIN',
] as const);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// ACTION TYPE ENUM (from canonical contract)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Action Type Enum
 * ✅ LOCKED: Imported from canonical notification contract
 */
export const actionTypeSchema = z.enum([
  'PAY_NOW',
  'VIEW_PAYMENT_PROOF',
  'CONFIRM_PAYMENT',
  'VIEW_ORDER',
  'VIEW_INVOICE',
  'VIEW_CREDIT_HISTORY',
  'REVIEW_ORDER',
  'REVIEW_UPDATE',
  'VIEW_STATUS',
  'VIEW_HISTORY',
] as const);

export type ActionType = z.infer<typeof actionTypeSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION ACTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Notification Action Schema
 * Represents a clickable action button in a notification
 */
export const notificationActionSchema = z.object({
  type: actionTypeSchema,
  label: nonEmptyStringSchema,
  payload: z.record(z.any()).optional(), // Flexible payload for action data
});

export type NotificationAction = z.infer<typeof notificationActionSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION ITEM SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Notification Item Schema
 * Complete notification structure (matches Firestore schema)
 * 
 * Stored in Firestore at:
 * - notifications/admin/items/{notificationId}
 * - notifications/user_{customerId}/items/{notificationId}
 */
export const notificationItemSchema = z.object({
  // Identity
  id: idSchema,
  type: notificationTypeSchema,
  
  // Content
  title: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  
  // Related entities
  orderId: idSchema,
  invoiceId: idSchema.optional(),
  customerId: idSchema.optional(), // For admin notifications
  customerName: optionalNonEmptyStringSchema, // For admin notifications
  
  // State
  read: z.boolean(),
  readAt: optionalFirestoreTimestampSchema, // ✅ Firestore Timestamp
  
  // Timestamps
  createdAt: firestoreTimestampSchema, // ✅ Firestore Timestamp (REQUIRED)
  timestamp: optionalFirestoreTimestampSchema, // For orderBy compatibility
  
  // Actions
  actions: z.array(notificationActionSchema),
  
  // Optional data
  amount: positiveAmountSchema.optional(),
  metadata: z.record(z.any()).optional(),
  
  // Debugging & versioning
  traceId: idSchema.optional(),
  version: z.number().int().positive().optional(),
  
  // Legacy fields (for backward compatibility)
  data: z.record(z.any()).optional(),
});

export type NotificationItem = z.infer<typeof notificationItemSchema>;

/**
 * Array of Notification Items
 */
export const notificationItemsArraySchema = z.array(notificationItemSchema);

export type NotificationItemsArray = z.infer<typeof notificationItemsArraySchema>;

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SUMMARY SCHEMA (for badges/counts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Notification Summary Schema
 * Used for notification bell badges
 */
export const notificationSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
  actionRequired: z.number().int().nonnegative(), // Notifications requiring user action
  lastCheckedAt: optionalFirestoreTimestampSchema,
});

export type NotificationSummary = z.infer<typeof notificationSummarySchema>;
