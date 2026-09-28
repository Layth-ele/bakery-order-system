/**
 * orderEnums.schema.ts
 * Order-related enums extracted to avoid circular imports between
 * order.schema.ts and orderSnapshot.schema.ts
 */
import { z } from 'zod';
import { ORDER_STATUSES } from '../../functions/src/lib/orderLifecycle';

// The status list is defined once in src/functions/src/lib/orderLifecycle.ts
// and shared with the Cloud Functions. It still accepts the legacy
// 'delivered' value so older order documents keep parsing.
export const orderStatusSchema = z.enum(ORDER_STATUSES);

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
