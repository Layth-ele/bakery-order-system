/**
 * Load an order's change history (orderEditHistory, written by the editOrder,
 * editPaidOrder and cancelOrder Cloud Functions) for documents.
 *
 * Filtered by customerId as well as orderId: the Firestore rules let a
 * customer read only their own records, and a query must prove that.
 * Best effort — a document still builds without it.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { OrderChange } from './orderDocument';

export async function fetchOrderChanges(order: { id?: string; customerId?: string; editCount?: unknown }): Promise<OrderChange[]> {
  if (!db || !order.id || !order.customerId) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'orderEditHistory'), where('orderId', '==', order.id), where('customerId', '==', order.customerId))
    );
    return snap.docs.map((d) => d.data() as OrderChange);
  } catch {
    return [];
  }
}
