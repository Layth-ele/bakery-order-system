/**
 * displayId.ts — Single source of truth for human-readable ID display
 *
 * All modals, lists, PDFs and notifications use these helpers so the
 * fallback logic lives in ONE place instead of scattered across 20+ files.
 *
 * Priority chain (same for every entity):
 *   1. Custom readable ID  (orderNumber / invoiceNumber / customerCode)
 *   2. Firestore doc ID    (order.id — only shown when no readable ID yet)
 *
 * The Firestore doc ID is NEVER sliced/uppercased for display — it's shown
 * in full only in technical "Order ID" / "Reference" fields, never as the
 * primary heading.
 */

import type { Order } from '../types';

/**
 * Returns true if a string looks like a raw Firebase UID
 * (20+ chars of random alphanumeric with no hyphens in human-readable format).
 * Real IDs look like "ORD-2026-03-001" or "DBH-2026-03-26-000001".
 */
function isFirebaseUID(id: string): boolean {
  if (!id) return false;

  const trimmed = id.trim();
  if (!trimmed || trimmed.includes(' ') || trimmed.includes('/')) return false;

  // Real readable IDs follow a stable pattern like DBH-2026-03-26-000001
  // or ORD-2026-03-26-001-47 and include at least one hyphen.
  if (trimmed.includes('-')) return false;

  // Random Firebase doc IDs / raw UIDs are typically long alphanumeric strings
  // without hyphens. Some older records can be shorter than 16 chars, so we
  // treat 10+ character alphanumeric strings without separators as UID-like.
  if (trimmed.length >= 10 && /^[A-Za-z0-9]+$/.test(trimmed)) {
    return true;
  }

  return false;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * Primary display number for an order (heading, title, badge).
 * Returns the human-readable orderNumber when available,
 * falls back to invoiceNumber, then masks the raw Firestore ID.
 *
 * @example displayOrderNumber(order) → "ORD-2026-03-26-001-47"
 */
export function displayOrderNumber(order: Pick<Order, 'id' | 'orderNumber' | 'invoiceNumber'>): string {
  if (order.orderNumber && !isFirebaseUID(order.orderNumber)) return order.orderNumber;
  if (order.invoiceNumber && !isFirebaseUID(order.invoiceNumber)) return order.invoiceNumber;
  // Mask raw Firestore IDs — show only last 6 chars with prefix
  if (order.id) return `ORD-···${order.id.slice(-6).toUpperCase()}`;
  return 'N/A';
}

/**
 * Invoice number for display (payment modals, invoice previews).
 * Returns invoiceNumber when available, falls back to orderNumber, then id.
 *
 * @example displayInvoiceNumber(order) → "DBH-2026-03-26-001-47"
 */
export function displayInvoiceNumber(order: Pick<Order, 'id' | 'orderNumber' | 'invoiceNumber'>): string {
  if (order.invoiceNumber && !isFirebaseUID(order.invoiceNumber)) return order.invoiceNumber;
  if (order.orderNumber && !isFirebaseUID(order.orderNumber)) return order.orderNumber;
  // Mask raw Firestore IDs — show only last 6 chars with prefix
  if (order.id) return `INV-···${order.id.slice(-6).toUpperCase()}`;
  return 'N/A';
}

/**
 * Short label for compact UI (badges, table cells, toasts).
 * Returns "Invoice #DBH-2026-03-26-001-47" or "Order #ORD-2026-03-26-001-47".
 */
export function displayOrderLabel(order: Pick<Order, 'id' | 'orderNumber' | 'invoiceNumber'>): string {
  const invoiceNumber = order.invoiceNumber && !isFirebaseUID(order.invoiceNumber) ? order.invoiceNumber : null;
  const orderNumber = order.orderNumber && !isFirebaseUID(order.orderNumber) ? order.orderNumber : null;

  if (invoiceNumber) return `Invoice #${invoiceNumber}`;
  if (orderNumber) return `Order #${orderNumber}`;

  const maskedId = order.id ? `INV-···${order.id.slice(-6).toUpperCase()}` : 'INV-···N/A';
  return `Invoice #${maskedId}`;
}

// ─── Customers ───────────────────────────────────────────────────────────────

/**
 * Customer display code (profile, admin list, PDF).
 * Returns customerCode when available, falls back to Firebase UID.
 *
 * @example displayCustomerCode(customer) → "CUST-2026-03-26-001-47"
 */
export function displayCustomerCode(customer: { id?: string; customerId?: string; customerCode?: string }): string {
  if (customer.customerCode) return customer.customerCode;
  // Mask raw Firestore UIDs — show only last 6 chars with prefix
  const rawId = customer.customerId || customer.id;
  if (rawId) {
    return rawId.length > 20 ? `···${rawId.slice(-6)}` : rawId;
  }
  return 'N/A';
}

// ─── Credit notes ─────────────────────────────────────────────────────────────

/**
 * Generate a stable credit note reference ID.
 * Format: CREDIT-{customerId-slice}-{timestamp-slice}
 * Used only for internal linking, not shown to customers.
 */
export function generateCreditNoteRef(customerId: string): string {
  const cid = customerId.slice(-6).toUpperCase();
  const ts  = String(Date.now()).slice(-6);
  return `CREDIT-${cid}-${ts}`;
}

// ─── File names ───────────────────────────────────────────────────────────────

/**
 * Build a safe filename for PDF/CSV downloads.
 * Uses the readable ID so filenames are meaningful.
 *
 * @example invoiceFilename(order, "Maria's Cafe") → "Invoice_DBH-2026-03-26-001-47_Marias_Cafe.pdf"
 */
export function invoiceFilename(
  order: Pick<Order, 'id' | 'orderNumber' | 'invoiceNumber'>,
  customerName: string,
  ext: 'pdf' | 'csv' | 'xlsx' = 'pdf'
): string {
  const num  = displayInvoiceNumber(order);
  const name = customerName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `Invoice_${num}_${name}.${ext}`;
}

export function orderFilename(
  order: Pick<Order, 'id' | 'orderNumber' | 'invoiceNumber'>,
  customerName: string,
  ext: 'pdf' | 'csv' | 'xlsx' = 'csv'
): string {
  const num  = displayOrderNumber(order);
  const name = customerName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `Order_${num}_${name}.${ext}`;
}
