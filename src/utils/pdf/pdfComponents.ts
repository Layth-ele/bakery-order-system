/**
 * PDF Components v2.0 — Luxury A4 Format
 * Reusable HTML builders. Consistent brand across all document types.
 */
import { toDate } from '../timestampFormatting';

// Detect raw Firebase UIDs (20+ random chars with no hyphen-separated pattern)
function isFirebaseUID(id: string): boolean {
  if (!id) return false;
  if (id.length >= 16 && !/^[A-Z]{2,}-\d{4}-/.test(id)) {
    const hyphenCount = (id.match(/-/g) || []).length;
    if (hyphenCount === 0) return true;
  }
  return false;
}
function safeOrderNum(orderNumber?: string, invoiceNumber?: string, id?: string): string {
  if (orderNumber && !isFirebaseUID(orderNumber)) return orderNumber;
  if (invoiceNumber && !isFirebaseUID(invoiceNumber)) return invoiceNumber;
  return id ? `ORD-···${id.slice(-6).toUpperCase()}` : 'N/A';
}
function safeInvoiceNum(invoiceNumber?: string, orderNumber?: string, id?: string): string {
  if (invoiceNumber && !isFirebaseUID(invoiceNumber)) return invoiceNumber;
  if (orderNumber && !isFirebaseUID(orderNumber)) return orderNumber;
  return id ? `INV-···${id.slice(-6).toUpperCase()}` : 'N/A';
}

// ── Types ───────────────────────────────────────────────────────
interface CompanyInfo { name: string; address?: string; phone?: string; email?: string; website?: string; gstNumber?: string; city?: string; }
interface InvoiceHeaderData { title: string; number: string; date: string; status?: string; }
interface CustomerInfo { customerId?: string; customerCode?: string; name: string; storeName?: string; contactPerson?: string; email: string; phone?: string; address?: string; businessName?: string; customerType?: string; }
interface OrderInfo { orderId: string; orderNumber?: string; invoiceNumber?: string; week?: number; weekNumber?: number; year?: number; weekRange?: string; deliveryDate?: string; deliveryFee?: number; }

// ── Header ──────────────────────────────────────────────────────
export const generateHeader = (company: CompanyInfo, invoice: InvoiceHeaderData): string => {
  const statusMap: Record<string, string> = {
    approved: 'Approved', completed: 'Completed & Paid', rejected: 'Rejected',
    cancelled: 'Cancelled', update: 'Update Requested', production: 'Production Sheet', pending: 'Pending',
  };
  const badge = invoice.status
    ? `<div class="status-badge status-${invoice.status}">${statusMap[invoice.status] ?? invoice.status}</div>` : '';

  return `
  <div class="doc-header">
    <div class="company-block">
      <h1>${company.name}</h1>
      <div class="tagline">Wholesale Order Management</div>
      <div class="contact-line">
        ${company.address ? `${company.address}` : ''}
        ${company.phone ? ` &nbsp;·&nbsp; ${company.phone}` : ''}
        ${company.email ? `<br>${company.email}` : ''}
        ${company.gstNumber ? `<br><span style="font-size:7.5pt;color:#888">GST/HST: ${company.gstNumber}</span>` : ''}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-type">${invoice.title}</div>
      <div class="doc-number">${invoice.number}</div>
      <div class="doc-date">${invoice.date}</div>
      ${badge}
    </div>
  </div>`;
};

// ── Customer + Order Info Grid ───────────────────────────────────
export const generateCustomerSection = (customer: CustomerInfo, order: OrderInfo): string => {
  const weekLabel = order.week ? `Week ${order.week}${order.year ? `, ${order.year}` : ''}` : '';
  const custId = customer.customerCode ||
    (customer.customerId && customer.customerId.length > 20
      ? `···${customer.customerId.slice(-6)}`
      : customer.customerId) || '';
  const ordNum = safeOrderNum(order.orderNumber, order.invoiceNumber, order.orderId);

  return `
  <div class="info-grid">
    <div class="info-box">
      <div class="box-label">Bill To</div>
      ${customer.storeName || customer.businessName ? `<div class="info-row"><span class="info-key">Business</span><span class="info-val">${customer.storeName || customer.businessName}</span></div>` : ''}
      <div class="info-row"><span class="info-key">Contact</span><span class="info-val">${customer.contactPerson || customer.name}</span></div>
      <div class="info-row"><span class="info-key">Email</span><span class="info-val">${customer.email}</span></div>
      ${customer.phone ? `<div class="info-row"><span class="info-key">Phone</span><span class="info-val">${customer.phone}</span></div>` : ''}
      ${customer.address ? `<div class="info-row"><span class="info-key">Address</span><span class="info-val">${customer.address}</span></div>` : ''}
      ${custId ? `<div class="info-row"><span class="info-key">Customer #</span><span class="info-val">${custId}</span></div>` : ''}
    </div>
    <div class="info-box">
      <div class="box-label">Order Details</div>
      <div class="info-row"><span class="info-key">Order #</span><span class="info-val">${ordNum}</span></div>
      ${safeInvoiceNum(order.invoiceNumber, order.orderNumber, order.orderId) !== ordNum ? `<div class="info-row"><span class="info-key">Invoice #</span><span class="info-val" style="color:#D4A574">${safeInvoiceNum(order.invoiceNumber, order.orderNumber, order.orderId)}</span></div>` : ''}
      ${weekLabel ? `<div class="info-row"><span class="info-key">Period</span><span class="info-val">${weekLabel}</span></div>` : ''}
      ${order.weekRange ? `<div class="info-row"><span class="info-key">Dates</span><span class="info-val">${order.weekRange}</span></div>` : ''}
      ${order.deliveryFee !== undefined ? `<div class="info-row"><span class="info-key">Delivery Fee</span><span class="info-val">${order.deliveryFee === 0 ? 'FREE' : `$${order.deliveryFee.toFixed(2)}`}</span></div>` : ''}
    </div>
  </div>`;
};

// ── Order Table ──────────────────────────────────────────────────
export const generateOrderTable = (
  items: any[], products: any[], categories: any[],
  options: { showPrices?: boolean; weekRange?: string; week?: number; year?: number } | boolean = {}
): string => {
  // Handle legacy boolean arg (backward compat)
  if (typeof options === 'boolean') {
    options = { showPrices: options };
  }
  if (!items?.length) return '<p style="color:#999;font-size:9pt;padding:8px 0">No items in this order.</p>';

  const prodMap = new Map(products.map(p => [p.id, p]));
  const catMap  = new Map(categories.map(c => [c.id, c]));
  const byCat   = new Map<string, any[]>();
  items.forEach(item => {
    const prod = prodMap.get(item.productId); // may be undefined for deleted products — keep the item anyway
    const cid = prod?.categoryId || (item as any).categoryId || 'other';
    if (!byCat.has(cid)) byCat.set(cid, []);
    byCat.get(cid)!.push({ item, prod });
  });

  const sorted = Array.from(byCat.entries())
    .map(([cid, rows]) => ({ cid, catName: (catMap.get(cid) as any)?.name || 'Other', catOrder: (catMap.get(cid) as any)?.order ?? 999, rows }))
    .sort((a, b) => a.catOrder - b.catOrder);

  // Parse dates from weekRange
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayFull = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

  // Derive actual dates from ISO week number + year (reliable)
  let dateLabels: string[] = days;
  const weekNum = (options as any).week;
  const weekYear = (options as any).year || new Date().getFullYear();
  if (weekNum) {
    try {
      // ISO week: Jan 4 is always in week 1
      const jan4 = new Date(weekYear, 0, 4);
      const jan4Day = jan4.getDay() || 7; // Mon=1..Sun=7
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - (jan4Day - 1) + (weekNum - 1) * 7);
      dateLabels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
    } catch { dateLabels = days; }
  } else if ((options as any).weekRange) {
    // Fallback: try to parse weekRange string
    try {
      const wRange = (options as any).weekRange as string;
      const yearMatch = wRange.match(/(20\d{2})/);
      const yr = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      const parts = wRange.split(/[–-]/);
      if (parts.length >= 2) {
        const startStr = parts[0].trim().replace(/(\d+)\s*$/, `$1 ${yr}`);
        const start = new Date(startStr);
        if (!isNaN(start.getTime())) {
          dateLabels = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start); d.setDate(d.getDate() + i);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          });
        }
      }
    } catch { dateLabels = days; }
  }

  const priceCol = options.showPrices !== false;

  const headers = `
    <thead>
      <tr>
        <th style="width:28%">Product</th>
        ${days.map((day, i) => `<th style="width:7%" class="day-header">
          <div>${day}</div>
          <div style="font-weight:400;font-size:8pt;opacity:0.8">${dateLabels[i]}</div>
        </th>`).join('')}
        <th style="width:7%">Total</th>
        ${priceCol ? '<th style="width:10%">Amount</th>' : ''}
      </tr>
    </thead>`;

  const rows = sorted.map(({ catName, rows }) => {
    const catRow = `<tr class="cat-header"><td colspan="${priceCol ? 10 : 9}">${catName.toUpperCase()}</td></tr>`;
    const prodRows = rows.map(({item, prod}, idx) => {
      // Guard: item[d] might be an object in migrated data — force numeric
      const qty = dayFull.reduce((s, d) => {
        const v = item[d];
        return s + (typeof v === 'number' ? v : 0);
      }, 0);
      const qtyCells = dayFull.map(d => {
        const v = typeof item[d] === 'number' ? item[d] : 0;
        return `<td class="qty-cell${v ? ' has-qty' : ''}">${v || ''}</td>`;
      }).join('');
      const unitPrice = item.price ?? prod?.retail ?? prod?.price ?? prod?.cost ?? 0;
      const rawLineTotal = item.subtotal ?? item.lineTotal ?? (qty * unitPrice);
      const lineTotal = typeof rawLineTotal === 'number' && isFinite(rawLineTotal) ? rawLineTotal : 0;
      const amount = priceCol ? `<td class="price-cell">$${lineTotal.toFixed(2)}</td>` : '';
      const stripe = idx % 2 === 0 ? '' : 'style="background:#FDFAF6"';

      // productName may be stored as an object in older orders — extract string safely
      const rawName = item.productName;
      const productName = typeof rawName === 'string' && rawName
        ? rawName
        : (rawName as any)?.en || (rawName as any)?.value
        || prod?.name
        || (item as any).name
        || 'Unknown product';

      return `<tr class="product-row" ${stripe}>
        <td class="product-name">${productName}</td>
        ${qtyCells}
        <td class="total-cell">${qty}</td>
        ${amount}
      </tr>`;
    }).join('');
    return catRow + prodRows;
  }).join('');

  return `<table class="order-table">${headers}<tbody>${rows}</tbody></table>`;
};

// ── Totals ───────────────────────────────────────────────────────
export const generateTotals = (totals: {
  subtotal: number; discount?: number; discountPercentage?: number;
  deliveryFee?: number; serviceCharge?: number; gst?: number; total: number;
  creditApplied?: number; amountDue?: number; invoiceNumber?: string;
}): string => {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const rows = [
    totals.invoiceNumber ? `<div class="totals-row"><span class="t-label">Invoice #</span><span class="t-value" style="color:#D4A574">${totals.invoiceNumber}</span></div>` : '',
    `<div class="totals-row"><span class="t-label">Subtotal</span><span class="t-value">${fmt(totals.subtotal)}</span></div>`,
    totals.discount ? `<div class="totals-row discount"><span class="t-label">Discount${totals.discountPercentage ? ` (${totals.discountPercentage}%)` : ''}</span><span class="t-value">−${fmt(totals.discount)}</span></div>` : '',
    totals.deliveryFee !== undefined ? `<div class="totals-row"><span class="t-label">Delivery Fee</span><span class="t-value">${totals.deliveryFee === 0 ? '<span style="color:#2D7A3A">FREE</span>' : fmt(totals.deliveryFee)}</span></div>` : '',
    totals.serviceCharge ? `<div class="totals-row"><span class="t-label">Service Charge</span><span class="t-value">${fmt(totals.serviceCharge)}</span></div>` : '',
    totals.gst ? `<div class="totals-row"><span class="t-label">GST (5%)</span><span class="t-value">${fmt(totals.gst)}</span></div>` : '',
    totals.creditApplied ? `<div class="totals-row discount"><span class="t-label">Credit Applied</span><span class="t-value">−${fmt(totals.creditApplied)}</span></div>` : '',
  ].filter(Boolean).join('');

  const due = totals.amountDue !== undefined ? totals.amountDue : totals.total;

  return `
  <div class="totals-section">
    <div class="totals-box">
      ${rows}
      <div class="totals-row grand-total">
        <span class="t-label">${totals.creditApplied ? 'AMOUNT DUE' : 'TOTAL'}</span>
        <span class="t-value">${fmt(due)}</span>
      </div>
    </div>
  </div>`;
};

// ── Payment Methods ──────────────────────────────────────────────
export const generatePaymentMethods = (settings: any = {}): string => {
  const m1 = settings.paymentMethod1 || 'E-Transfer';
  const m2 = settings.paymentMethod2;
  const addr = settings.paymentAddress || settings.adminEmail || '';
  return `
  <div class="payment-section">
    <div class="section-title">Payment Information</div>
    <div class="payment-method">
      <div class="pm-icon">💳</div>
      <div><div class="pm-name">${m1}</div>${addr ? `<div class="pm-detail">Send to: <strong>${addr}</strong></div>` : ''}</div>
    </div>
    ${m2 ? `<div class="payment-method"><div class="pm-icon">🏦</div><div class="pm-name">${m2}</div></div>` : ''}
    ${settings.transferPassword ? `<div style="margin-top:6px;font-size:8pt;color:#C86400">Transfer password: <strong>${settings.transferPassword}</strong></div>` : ''}
  </div>`;
};

// ── Alert blocks ─────────────────────────────────────────────────
export const generateStatusNotice = (type: string, title: string, message: string): string =>
  `<div class="alert-block ${type}"><div><div class="alert-title">${title}</div><div>${message}</div></div></div>`;

export const generateRejection = (reason: string): string =>
  generateStatusNotice('danger', '❌ Order Rejected', reason || 'This order has been rejected by the bakery.');

export const generateCancellation = (reason: string): string =>
  generateStatusNotice('warning', '⚠️ Order Cancelled', reason || 'This order has been cancelled.');

// ── Notes ────────────────────────────────────────────────────────
export const generateNotes = (note: string): string => note ? `
  <div class="alert-block info">
    <div><div class="alert-title">📝 Order Notes</div><div>${note}</div></div>
  </div>` : '';

// ── Update Request ───────────────────────────────────────────────
export const generateUpdateRequest = (changes: any): string =>
  generateStatusNotice('info', '🔄 Update Requested', JSON.stringify(changes));

// ── Terms ────────────────────────────────────────────────────────
export const generateTerms = (settings: any = {}): string => `
  <div class="terms-section">
    <div class="terms-title">Terms &amp; Conditions</div>
    ${settings.cancellationPolicy || 'Cancellations must be submitted 24 hours before the delivery date. Late cancellations may incur a fee.'}
    ${settings.weeklyOrderPolicy ? `<br><br>${settings.weeklyOrderPolicy}` : ''}
  </div>`;

// ── Footer ───────────────────────────────────────────────────────
export const generateFooter = (companyName: string): string => {
  const date = new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
  return `
  <div class="doc-footer">
    <div><span class="footer-brand">${companyName}</span><br><span class="footer-note">Thank you for your business</span></div>
    <div style="text-align:right">Generated ${date}<br><span class="footer-note">Page 1</span></div>
  </div>`;
};

// ── Print button ─────────────────────────────────────────────────
export const generatePrintButton = (): string =>
  `<div class="no-print"><button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button></div>`;

// ── Status badge (standalone) ─────────────────────────────────────
export const generateStatusBadge = (status: string): string =>
  `<span class="status-badge status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
