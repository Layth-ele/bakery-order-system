/**
 * Firestore notification document → NotificationItem. Shared by the admin
 * and customer providers so both feeds read documents the same way.
 *
 * Handles documents written by the onOrderLifecycle Cloud Function
 * (top-level customerId / customerName / amount / invoiceId) as well as
 * older ones that only carried those in `metadata`.
 */
import type { DocumentData } from 'firebase/firestore';
import type { NotificationItem } from '@/types/notification-contract';

/** Firestore Timestamp (or anything with toDate()) — duck-typed on purpose. */
const isTimestamp = (v: unknown): v is { toDate: () => Date } =>
  !!v && typeof (v as { toDate?: unknown }).toDate === 'function';

function isoTime(data: DocumentData): string {
  for (const v of [data.createdAt, data.timestamp]) {
    if (isTimestamp(v)) return v.toDate().toISOString();
  }
  if (typeof data.createdAt === 'number') return new Date(data.createdAt).toISOString();
  if (typeof data.createdAt === 'string' && data.createdAt) return data.createdAt;
  // Pending server timestamp (local write not yet acknowledged).
  return new Date().toISOString();
}

/** A notification as the feeds expose it: timestamps are ISO strings. */
export type FeedNotification = Omit<NotificationItem, 'createdAt' | 'readAt'> & {
  createdAt: string;
  readAt?: string;
};

function isoOrUndefined(v: unknown): string | undefined {
  if (isTimestamp(v)) return v.toDate().toISOString();
  if (typeof v === 'number') return new Date(v).toISOString();
  return typeof v === 'string' && v ? v : undefined;
}

export function toNotificationItem(id: string, data: DocumentData): FeedNotification {
  const metadata = (data.metadata ?? {}) as Record<string, any>;
  return {
    ...data,
    id,
    type: data.type,
    title: data.title ?? '',
    message: data.message ?? '',
    orderId: data.orderId || metadata.orderId || '',
    invoiceId: data.invoiceId ?? metadata.invoiceId,
    customerId: data.customerId || metadata.customerId,
    customerName: data.customerName || metadata.customerName,
    amount: data.amount ?? metadata.amount ?? metadata.creditAmount,
    metadata,
    read: data.read === true,
    createdAt: isoTime(data),
    readAt: isoOrUndefined(data.readAt),
    actions: Array.isArray(data.actions) ? data.actions : [],
  } as FeedNotification;
}
