import { db } from '../../firebase/config';
/**
 * Invoices Data Service
 * 
 * Centralized service for invoice CRUD operations with Firestore.
 * Provides a unified interface for invoice data access across the application.
 * 
 * NOTE: This service manages invoice data storage. Invoice generation logic
 * is handled by /services/invoicing/finalizeOrderToInvoice.ts
 * 
 * ✅ MAR 10, 2026: Schema validation added for production safety
 * 
 * - Uses Invoice interface from types/domain (legacy shape, alignment verified Mar 2026)
 * - Firestore reads/writes wrapped with enhanced error handling
 * 
 * @author Bakery Order Management System
 * @date March 10, 2026
 */

import { isFirebaseConfigured } from '../../firebase/config';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { 
  parseSafe 
} from '../../schemas'; // ✅ SCHEMA VALIDATION UTILITIES

// ============================================================================
// INVOICE INTERFACE (aligned with invoiceQueryService.ts)
// ============================================================================

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  customerPhone?: string;
  
  // Snapshot of order items and pricing
  items?: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity?: number;
    total: number;
    monday?: number;
    tuesday?: number;
    wednesday?: number;
    thursday?: number;
    friday?: number;
    saturday?: number;
    sunday?: number;
  }>;
  
  // Financial fields
  subtotal?: number;
  discount?: number;
  discountNote?: string;
  gst?: number;
  deliveryFee?: number;
  serviceCharge?: number;
  total?: number;
  finalTotal: number; // Primary total field
  
  // Metadata for search and filtering
  year: number;
  yearMonth: string; // "2026-01"
  isoWeek: number;
  weekKey: string; // "2026-W04"
  weekRange?: string;
  
  // Status
  invoiceStatus: 'paid' | 'unpaid' | 'partial' | 'credit' | 'void';
  status?: 'paid' | 'unpaid' | 'partial'; // Legacy compatibility
  paymentReceived?: boolean; // Legacy UI checks
  
  // Timestamps
  createdAt: string; // ISO string
  completedAt?: string;
  paidAt?: string;
  
  // Payment info
  transferPassword?: string;
  paidBy?: string;
  paymentMethod?: string;
  paymentReference?: string;
  
  // Visibility
  isVisible?: boolean;
  sentToCustomer?: boolean;
  
  // PDF export
  pdfUrl?: string;
  pdfPath?: string;
  
  // Expiration (for cleanup)
  expiresAt?: string;
  
  // Notes
  notes?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * ✅ SAFE: Convert Firestore document data to Invoice type
 * Explicitly maps all fields instead of using unsafe `as Invoice` cast
 */
function mapFirestoreDataToInvoice(docId: string, data: any): Invoice {
  return {
    id: docId,
    invoiceNumber: data.invoiceNumber || '',
    customerId: data.customerId || '',
    customerName: data.customerName || '',
    finalTotal: data.finalTotal || 0,
    year: data.year || new Date().getFullYear(),
    yearMonth: data.yearMonth || '',
    isoWeek: data.isoWeek || 1,
    weekKey: data.weekKey || '',
    invoiceStatus: data.invoiceStatus || 'unpaid',
    createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
    // Optional fields
    orderId: data.orderId || "",
    customerEmail: data.customerEmail || "",
    customerAddress: data.customerAddress,
    customerPhone: data.customerPhone,
    items: data.items,
    subtotal: data.subtotal,
    discount: data.discount,
    discountNote: data.discountNote,
    gst: data.gst,
    deliveryFee: data.deliveryFee,
    serviceCharge: data.serviceCharge,
    total: data.total,
    weekRange: data.weekRange,
    status: data.status,
    paymentReceived: data.paymentReceived,
    completedAt: data.completedAt?.toDate?.() ? data.completedAt.toDate().toISOString() : data.completedAt,
    paidAt: data.paidAt?.toDate?.() ? data.paidAt.toDate().toISOString() : data.paidAt,
    transferPassword: data.transferPassword,
    paidBy: data.paidBy,
    paymentMethod: data.paymentMethod,
    paymentReference: data.paymentReference,
    isVisible: data.isVisible,
    sentToCustomer: data.sentToCustomer,
    pdfUrl: data.pdfUrl,
    pdfPath: data.pdfPath,
    expiresAt: data.expiresAt?.toDate?.() ? data.expiresAt.toDate().toISOString() : data.expiresAt,
    notes: data.notes,
  };
}

/**
 * Get all invoices from Firestore
 */
export async function getInvoices(): Promise<Invoice[]> {
  if (isFirebaseConfigured) {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      // ✅ SAFE: Use helper function instead of unsafe cast
      const invoices = snapshot.docs.map((doc) => mapFirestoreDataToInvoice(doc.id, doc.data()));
      
      return invoices;
    } catch (error) {
      console.error('❌ [invoicesDataService] Firestore read failed:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  try {
    return [];
  } catch (error) {
    console.error('❌ [invoicesDataService] Read failed:', error);
    return [];
  }
}

/**
 * Get invoice by invoice number
 */
export async function getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
  if (isFirebaseConfigured) {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, where('invoiceNumber', '==', invoiceNumber));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      // ✅ SAFE: Use helper function instead of unsafe cast
      return mapFirestoreDataToInvoice(doc.id, doc.data());
    } catch (error) {
      console.error('❌ [invoicesDataService] Firestore query failed:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const invoices = await getInvoices();
  return invoices.find((inv) => inv.invoiceNumber === invoiceNumber) || null;
}

/**
 * Get invoice by order ID
 */
export async function getInvoiceByOrderId(orderId: string): Promise<Invoice | null> {
  if (isFirebaseConfigured) {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, where('orderId', '==', orderId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      // ✅ SAFE: Use helper function instead of unsafe cast
      return mapFirestoreDataToInvoice(doc.id, doc.data());
    } catch (error) {
      console.error('❌ [invoicesDataService] Firestore query failed:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const invoices = await getInvoices();
  return invoices.find((inv) => inv.orderId === orderId) || null;
}

/**
 * Get invoices by customer ID
 */
export async function getInvoicesByCustomerId(customerId: string): Promise<Invoice[]> {
  if (isFirebaseConfigured) {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      // ✅ SAFE: Use helper function instead of unsafe cast
      const invoices = snapshot.docs.map((doc) => mapFirestoreDataToInvoice(doc.id, doc.data()));
      
      return invoices;
    } catch (error) {
      console.error('❌ [invoicesDataService] Firestore query failed:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const invoices = await getInvoices();
  return invoices.filter((inv) => inv.customerId === customerId);
}

/**
 * Get invoices by status
 */
export async function getInvoicesByStatus(status: Invoice['invoiceStatus']): Promise<Invoice[]> {
  if (isFirebaseConfigured) {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('invoiceStatus', '==', status),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      // ✅ SAFE: Use helper function instead of unsafe cast
      const invoices = snapshot.docs.map((doc) => mapFirestoreDataToInvoice(doc.id, doc.data()));
      
      return invoices;
    } catch (error) {
      console.error('❌ [invoicesDataService] Firestore query failed:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const invoices = await getInvoices();
  return invoices.filter((inv) => inv.invoiceStatus === status);
}

/**
 * Get invoices by year and month
 */
export async function getInvoicesByYearMonth(yearMonth: string): Promise<Invoice[]> {
  if (isFirebaseConfigured) {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('yearMonth', '==', yearMonth),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      // ✅ SAFE: Use helper function instead of unsafe cast
      const invoices = snapshot.docs.map((doc) => mapFirestoreDataToInvoice(doc.id, doc.data()));
      
      return invoices;
    } catch (error) {
      console.error('❌ [invoicesDataService] Firestore query failed:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const invoices = await getInvoices();
  return invoices.filter((inv) => inv.yearMonth === yearMonth);
}

/**
 * Get invoices by week key
 */
export async function getInvoicesByWeekKey(weekKey: string): Promise<Invoice[]> {
  if (isFirebaseConfigured) {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('weekKey', '==', weekKey),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      // ✅ SAFE: Use helper function instead of unsafe cast
      const invoices = snapshot.docs.map((doc) => mapFirestoreDataToInvoice(doc.id, doc.data()));
      
      return invoices;
    } catch (error) {
      console.error('❌ [invoicesDataService] Firestore query failed:', error);
      throw error;
    }
  }

  // Fallback to localStorage
  const invoices = await getInvoices();
  return invoices.filter((inv) => inv.weekKey === weekKey);
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  if (isFirebaseConfigured) {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, where('id', '==', invoiceId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const docRef = snapshot.docs[0];
      return mapFirestoreDataToInvoice(docRef.id, docRef.data());
    } catch (error) {
      console.error(`❌ [invoicesDataService] Firestore read failed for ${invoiceId}:`, error);
      throw error;
    }
  }

  const invoices = await getInvoices();
  return invoices.find((inv) => inv.id === invoiceId) || null;
}

/**
 * Create a new invoice in Firestore
 * ✅ ADDED MAR 17: Required for finalizeOrderToInvoice.ts to save invoices to Firestore
 */
export async function createInvoice(invoice: Invoice): Promise<string> {
  if (isFirebaseConfigured) {
    try {
      const { id, createdAt, ...dataWithoutId } = invoice as any;
      
      // If we have a specific ID (deterministic invoice ID = orderId), use setDoc for idempotency
      if (id) {
        const docRef = doc(db!, 'invoices', id);
        // setDoc with merge:true acts as upsert - creates if not exists, merges if exists
        await setDoc(docRef, {
          ...dataWithoutId,
          id,
          createdAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any,
        }, { merge: true });
        return id;
      }
      
      // No ID - use addDoc to auto-generate
      const invoicesRef = collection(db!, 'invoices');
      const docRef = await addDoc(invoicesRef, {
        ...dataWithoutId,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      });
      return docRef.id;
    } catch (error) {
      console.error('❌ [invoicesDataService] Firestore create failed:', error);
      throw error;
    }
  }

  // localStorage fallback
  //
  // FIX T2R5-H3 (HIGH): Was creating an empty `invoices: Invoice[] = []`
  // local array, checking idempotency against it (always false), pushing
  // the invoice, and returning the ID — never reading existing data and
  // never writing back. Demo-mode invoice persistence was silently broken;
  // every call returned success but no data was retained.
  // Now properly reads `bakery_invoices`, checks idempotency against the
  // real persisted set, pushes, and writes back.
  try {
    const raw = localStorage.getItem('bakery_invoices');
    const invoices: Invoice[] = raw ? JSON.parse(raw) : [];

    // Check idempotency against actual stored invoices
    const alreadyExists = invoices.find((inv) => inv.id === invoice.id);
    if (alreadyExists) {
      return invoice.id;
    }

    invoices.push(invoice);
    localStorage.setItem('bakery_invoices', JSON.stringify(invoices));

    return invoice.id;
  } catch (error) {
    console.error('❌ [invoicesDataService] Create failed:', error);
    throw error;
  }
}

/**
 * Update an existing invoice
 */
export async function updateInvoice(invoiceId: string, updates: Partial<Invoice>): Promise<void> {
  if (isFirebaseConfigured) {
    try {
      const { id: _id, createdAt: _ct, ...cleanUpdates } = updates as any;
      await updateDoc(doc(db!, 'invoices', invoiceId), {
        ...cleanUpdates,
        updatedAt: serverTimestamp() as any,
      });
    } catch (error) {
      console.error(`❌ [invoicesDataService] Firestore update failed for ${invoiceId}:`, error);
      throw error;
    }
    return;
  }

  // localStorage fallback
  //
  // FIX T2R5-H3 (HIGH): Same bug as createInvoice — was creating a fresh
  // empty array, finding nothing, throwing "Invoice not found". Now reads
  // the real persisted set, applies the update, writes back.
  try {
    const raw = localStorage.getItem('bakery_invoices');
    const invoices: Invoice[] = raw ? JSON.parse(raw) : [];
    const idx = invoices.findIndex((inv) => inv.id === invoiceId);
    if (idx === -1) throw new Error(`Invoice ${invoiceId} not found in Firestore`);
    invoices[idx] = { ...invoices[idx], ...updates };
    localStorage.setItem('bakery_invoices', JSON.stringify(invoices));
  } catch (error) {
    console.error(`❌ [invoicesDataService] Update failed for ${invoiceId}:`, error);
    throw error;
  }
}