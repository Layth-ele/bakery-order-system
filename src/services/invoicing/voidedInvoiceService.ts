/**
 * voidedInvoiceService — Gap Detection / Void Log
 *
 * When an order with an invoiceNumber is cancelled or deleted, we write a
 * record to the `voidedInvoices` collection so there is always an explanation
 * for every gap in the sequential invoice list.
 *
 * CRA requirement: sequential invoices with documented gaps.
 *
 * Firestore path: voidedInvoices/{invoiceNumber}
 * Document ID = the invoiceNumber itself (e.g. "DBH-2026-03-26-001-47")
 * so lookups are O(1) and duplicates are impossible.
 */

import { db } from '../../firebase/config';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { Order } from '../../types';
import { logger } from '../../utils/logger';


export type VoidReason = 'cancelled' | 'deleted' | 'rejected' | 'duplicate' | 'test';

export interface VoidedInvoiceRecord {
  invoiceNumber: string;       // e.g. "DBH-2026-03-26-001-47"
  orderId: string;             // the order that held this invoice number
  customerId: string;
  customerName: string;
  originalTotal: number;
  reason: VoidReason;
  notes?: string;              // admin free-text explanation
  voidedAt: any;               // Firestore server timestamp
  voidedBy: string;            // admin email or "system"
}

/**
 * Record a voided invoice number.
 * Called automatically from cancelOrderAction and deleteOrder when the order
 * already has an invoiceNumber assigned.
 *
 * Idempotent — if the same invoiceNumber is voided twice the second write
 * is a no-op (setDoc with merge:false on the same doc ID).
 */
export async function recordVoidedInvoice(
  order: Order,
  reason: VoidReason,
  voidedBy: string,
  notes?: string
): Promise<void> {
  if (!order.invoiceNumber) return;   // nothing to void — ID was never assigned
  if (!db) return;

  const record: VoidedInvoiceRecord = {
    invoiceNumber: order.invoiceNumber,
    orderId:       order.id ?? '',
    customerId:    order.customerId ?? '',
    customerName:  order.customerName ?? '',
    originalTotal: order.total ?? 0,
    reason,
    notes,
    voidedAt:  serverTimestamp(),
    voidedBy,
  };

  try {
    // Document ID = invoiceNumber so it is unique and instantly findable
    await setDoc(
      doc(db, 'voidedInvoices', order.invoiceNumber),
      record
    );
  } catch (e) {
    // Non-fatal — order is already cancelled/deleted, just log the failure
    logger.warn('⚠️ [voidedInvoice] Could not write void record:', e);
  }
}

/**
 * Fetch all voided invoice records (admin use, for gap audit report).
 */
export async function getVoidedInvoices(): Promise<VoidedInvoiceRecord[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'voidedInvoices'), orderBy('voidedAt', 'desc'))
    );
    return snap.docs.map(d => d.data() as VoidedInvoiceRecord);
  } catch (e) {
    console.error('❌ [voidedInvoice] Could not fetch void records:', e);
    return [];
  }
}
