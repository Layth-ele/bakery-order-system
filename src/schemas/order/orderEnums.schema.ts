/**
 * orderEnums.schema.ts
 * Order-related enums extracted to avoid circular imports between
 * order.schema.ts and orderSnapshot.schema.ts
 */
import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'pending',
  'approved',
  'in_process',
  'completed',
  // FIX R5-S6-F1 (CRITICAL): Cloud Functions write `status: 'delivered'` (per
  // _shared.ts allowed-transitions matrix), but the schema previously rejected
  // this value, causing parseArrayPartial to silently drop delivered orders from
  // every read path. Effects: orders disappeared from admin dashboards after
  // delivery, balance calculations excluded delivered orders, financial summaries
  // miscounted. Adding 'delivered' brings schema into agreement with the writer.
  'delivered',
  'rejected',
  'cancelled',
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const snapshotTriggerSchema = z.enum([
  'create',
  'approve',
  'edit',
  'payment',
  'status_change',
  'adjustment',
  'cancel',
  'complete',
]);

export type SnapshotTrigger = z.infer<typeof snapshotTriggerSchema>;
