import { db, isFirebaseConfigured } from '../../firebase/config';
import { collection, getDocs, limit, orderBy, query, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { getWeeksInYear } from '../../utils/weekUtilsExport';
import { getISOWeekInfo } from '../../utils/weekUtils';
import { getOrders } from '../data/ordersDataService';
import { logger } from '../../utils/logger';
 // ✅ MAR 17: Use data service for order reads

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  createdAt: string; // ISO string
  year: number;
  yearMonth: string; // "2026-01"
  isoWeek: number;
  weekKey: string; // "2026-W04"
  finalTotal: number;
  invoiceStatus: 'paid' | 'unpaid' | 'partial' | 'credit' | 'void';
  pdfUrl?: string;
  pdfPath?: string;
  paymentReceived?: boolean; // legacy
  notes?: string;
  expiresAt?: string;
}

export interface InvoiceSearchParams {
  customerId?: string;
  invoiceNumber?: string;
  year?: number | 'all';
  yearMonth?: string;
  weekKey?: string;
  month?: number | 'all';
  week?: number | 'all';
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

export interface InvoiceSearchResult {
  invoices: Invoice[];
  hasMore: boolean;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
  totalCount?: number;
}

function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? new Date() : d;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function mapCompletedOrderToInvoice(order: any): Invoice {
  const created = toDate(order.completedAt || order.finalizedAt || order.createdAt).toISOString();
  
 // FIX - Calculate week/year properly when missing or invalid
  let year: number;
  let isoWeek: number;
  
  if (order.week && order.week >= 1) {
    // Use existing week/year if valid
    isoWeek = order.isoWeek || order.week;
    year = order.year || toDate(order.createdAt).getFullYear();
  } else {
    // Calculate from order date if missing or invalid
    const orderDate = toDate(order.completedAt || order.createdAt);
    const weekInfo = getISOWeekInfo(orderDate);
    isoWeek = weekInfo.week;
    year = weekInfo.year;
  }
  
  const month = toDate(order.createdAt).getMonth() + 1;
  const yearMonth = order.yearMonth || `${year}-${pad2(month)}`;
  const weekKey = order.weekKey || `${year}-W${pad2(isoWeek)}`;

  return {
    id: order.finalInvoiceId || order.invoiceNumber || order.id,
    invoiceNumber: order.invoiceNumber || (() => {
      const d = new Date().toISOString().slice(0, 10);
      return `DBH-${d}-${String(Date.now()).slice(-3).padStart(3,'0')}-00`; // fallback
    })(),
    orderId: order.id || "",
    customerId: order.customerId || '',
    customerName: order.customerName || 'Unknown',
    customerEmail: order.customerEmail || "",
    createdAt: created,
    year,
    yearMonth,
    isoWeek,
    weekKey,
    finalTotal: Number(order.total || order.finalTotal || 0),
    invoiceStatus: order.paymentReceived ? 'paid' : 'unpaid',
    paymentReceived: !!order.paymentReceived,
    notes: order.note,
  };
}

/**
 * ✅ ONLY FINAL INVOICES:
 * - Firestore collection: invoices (final snapshots)
 * - Local completed orders (ONLY if completed/locked OR has finalInvoiceId)
 * 
 * This ensures Firebase mode shows completed orders correctly
 */
export async function getAllInvoicesMerged(limitCount: number = 1000): Promise<Invoice[]> {
  try {
    const merged = new Map<string, Invoice>(); // ✅ key by orderId first

    let localOrders: any[] = [];
    try {
      localOrders = await getOrders();
    } catch (e) {
      logger.warn('[invoiceQueryService] Could not load orders:', e);
    }

    const finalizedOrders = localOrders.filter((o) => {
      if (!o?.id) return false;
      const completed = o.status === 'completed';
      const locked = !!o.locked;
      const hasFinalInvoice = !!o.finalInvoiceId;
      return (completed || locked || hasFinalInvoice);
    });

    for (const o of finalizedOrders) {
      const inv = mapCompletedOrderToInvoice(o);
      const key = inv.orderId || inv.invoiceNumber || inv.id;
      merged.set(key, inv);
    }

    // 2) Firestore invoices (authoritative) - only in Firebase mode
    if (isFirebaseConfigured && db) {
      try {
        const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(limitCount));
        const snap = await getDocs(q);

        snap.forEach((doc) => {
          const data: any = doc.data();
          const createdAt = toDate(data.createdAt || data.createdAtServer || data.completedAt).toISOString();

          const orderId = data.orderId || data.order?.id;
          const year = Number(data.year || toDate(createdAt).getFullYear());
          const yearMonth = data.yearMonth || `${year}-${pad2(toDate(createdAt).getMonth() + 1)}`;
          const isoWeek = Number(data.isoWeek || data.week || 0);
          const weekKey = data.weekKey || `${year}-W${pad2(isoWeek)}`;

          const inv: Invoice = {
            id: doc.id,
            invoiceNumber: data.invoiceNumber || `DBH-${new Date().toISOString().slice(0,10)}-${(orderId || doc.id).slice(-3).toUpperCase()}`,
            orderId,
            customerId: data.customerId || '',
            customerName: data.customerName || 'Unknown',
            customerEmail: data.customerEmail || "",
            createdAt,
            year,
            yearMonth,
            isoWeek,
            weekKey,
            finalTotal: Number(data.finalTotal ?? data.total ?? 0),
            invoiceStatus: (data.invoiceStatus || (data.paymentReceived ? 'paid' : 'unpaid')) as Invoice['invoiceStatus'],
            paymentReceived: !!data.paymentReceived,
            pdfUrl: data.pdfUrl,
            pdfPath: data.pdfPath,
            notes: data.notes,
            expiresAt: data.expiresAt,
          };

          const key = inv.orderId || inv.invoiceNumber || inv.id;
          merged.set(key, inv); // Firestore overwrites local
        });
      } catch (firestoreErr) {
        logger.warn('[invoiceQueryService] Firestore invoices query failed, using local data only:', firestoreErr);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      .slice(0, limitCount);
  } catch (err) {
    console.error('Error getAllInvoicesMerged:', err);
    return [];
  }
}

export async function searchByInvoiceNumber(invoiceNumber: string, customerId?: string): Promise<Invoice | null> {
  const all = await getAllInvoicesMerged(2000);
  const match = all.find((inv) => inv.invoiceNumber === invoiceNumber && (!customerId || inv.customerId === customerId));
  return match || null;
}

export async function searchCustomerInvoices(params: InvoiceSearchParams): Promise<InvoiceSearchResult> {
  const { customerId, year, yearMonth, weekKey, pageSize = 25 } = params;
  if (!customerId) return { invoices: [], hasMore: false };

  const all = await getAllInvoicesMerged(2000);

  const filtered = all.filter((inv) => {
    const matchesCustomer = inv.customerId === customerId;
    const matchesYear = !year || year === 'all' || inv.year === year;
    const matchesMonth = !yearMonth || inv.yearMonth === yearMonth;
    const matchesWeek = !weekKey || inv.weekKey === weekKey;
    return matchesCustomer && matchesYear && matchesMonth && matchesWeek;
  });

  return {
    invoices: filtered.slice(0, pageSize),
    hasMore: filtered.length > pageSize,
  };
}

export async function getRecentInvoices(limitCount: number = 50): Promise<Invoice[]> {
  const all = await getAllInvoicesMerged(limitCount * 2);
  return all.slice(0, limitCount);
}

export async function getCustomersWithInvoices(): Promise<
  Array<{ id: string; name: string; email?: string; orderCount: number; totalRevenue: number }>
> {
  const all = await getAllInvoicesMerged(2000);
  const map = new Map<string, { name: string; email?: string; orderCount: number; totalRevenue: number }>();

  for (const inv of all) {
    const cid = inv.customerId;
    if (!cid) continue;
    const amount = inv.finalTotal || 0;

    const cur = map.get(cid);
    if (cur) {
      cur.orderCount += 1;
      cur.totalRevenue += amount;
    } else {
      map.set(cid, {
        name: inv.customerName || 'Unknown',
        email: inv.customerEmail,
        orderCount: 1,
        totalRevenue: amount,
      });
    }
  }

  return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
}

export async function getInvoiceStatistics(currentWeek: number, currentYear: number): Promise<{
  totalInvoices: number;
  totalRevenue: number;
  thisWeekRevenue: number;
  lastWeekRevenue: number;
  averageInvoice: number;
}> {
  const all = await getAllInvoicesMerged(2000);

  let totalRevenue = 0;
  let thisWeekRevenue = 0;
  let lastWeekRevenue = 0;

  const currentWeekKey = `${currentYear}-W${pad2(currentWeek)}`;
  const lastWeekNum = currentWeek > 1 ? currentWeek - 1 : getWeeksInYear(currentYear - 1);
  const lastYearNum = currentWeek > 1 ? currentYear : currentYear - 1;
  const lastWeekKey = `${lastYearNum}-W${pad2(lastWeekNum)}`;

  for (const inv of all) {
    const amount = inv.finalTotal || 0;
    totalRevenue += amount;
    if (inv.weekKey === currentWeekKey) thisWeekRevenue += amount;
    if (inv.weekKey === lastWeekKey) lastWeekRevenue += amount;
  }

  return {
    totalInvoices: all.length,
    totalRevenue,
    thisWeekRevenue,
    lastWeekRevenue,
    averageInvoice: all.length ? totalRevenue / all.length : 0,
  };
}