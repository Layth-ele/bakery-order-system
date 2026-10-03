/**
 * PDF Components v2.0 — Luxury A4 Format
 * Reusable HTML builders. Consistent brand across all document types.
 */
import { documentDays, documentLines, noticeDate, type ChangeNotice, type DocTotalRow } from '../documents/orderDocument';
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
    approved: 'Approved · Payment due', paid: 'Paid · In production', review: 'Payment in review', completed: 'Completed & Paid', rejected: 'Rejected',
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
// Only the delivery days that have quantities, at the price charged
// (utils/documents/orderDocument — same as the on-screen invoice and Excel).
export const generateOrderTable = (
  items: any[], products: any[], categories: any[],
  options: { showPrices?: boolean; weekRange?: string; week?: number; year?: number } | boolean = {}
): string => {
  if (typeof options === 'boolean') options = { showPrices: options };
  const lines = documentLines({ items } as any, products, categories);
  if (!lines.length) return '<p style="color:#999;font-size:9pt;padding:8px 0">No items in this order.</p>';
  const days = documentDays({ items, week: options.week, year: options.year } as any);
  const priceCol = options.showPrices !== false;
  const cols = 2 + days.length + (priceCol ? 2 : 0);
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

  const headers = `
    <thead>
      <tr>
        <th class="product-col">Product</th>
        ${days.map((d) => `<th class="day-header"><div>${d.short}</div>${d.date ? `<div class="day-date">${d.date}</div>` : ''}</th>`).join('')}
        <th>Qty</th>
        ${priceCol ? '<th class="num">Price</th><th class="num">Amount</th>' : ''}
      </tr>
    </thead>`;

  let body = '';
  let currentCat = '';
  lines.forEach((l, idx) => {
    if (l.categoryName !== currentCat) {
      currentCat = l.categoryName;
      body += `<tr class="cat-header"><td colspan="${cols}">${esc(currentCat).toUpperCase()}</td></tr>`;
    }
    body += `<tr class="product-row"${idx % 2 ? ' style="background:#FDFAF6"' : ''}>
      <td class="product-name">${esc(l.name)}</td>
      ${days.map((d) => `<td class="qty-cell${l.qty[d.key] ? ' has-qty' : ''}">${l.qty[d.key] || ''}</td>`).join('')}
      <td class="total-cell">${l.total}</td>
      ${priceCol ? `<td class="price-cell">$${l.price.toFixed(2)}</td><td class="price-cell">$${l.amount.toFixed(2)}</td>` : ''}
    </tr>`;
  });
  const dayTotals = days.map((d) => lines.reduce((s, l) => s + l.qty[d.key], 0));
  const foot = `<tr class="grand-row">
      <td class="product-name">Total</td>
      ${dayTotals.map((t) => `<td class="qty-cell has-qty">${t || ''}</td>`).join('')}
      <td class="total-cell">${lines.reduce((s, l) => s + l.total, 0)}</td>
      ${priceCol ? `<td></td><td class="price-cell">$${lines.reduce((s, l) => s + l.amount, 0).toFixed(2)}</td>` : ''}
    </tr>`;

  return `<div class="table-scroll"><table class="order-table">${headers}<tbody>${body}${foot}</tbody></table></div>`;
};

// ── Changes to this order ────────────────────────────────────────
export const generateChangeNotices = (notices: ChangeNotice[]): string => {
  if (!notices.length) return '';
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const color = { info: '#2563eb', credit: '#059669', fee: '#b45309', warn: '#dc2626', ok: '#15803d' } as const;
  return `
  <div class="changes-section">
    <div class="box-label">Changes to this order</div>
    ${notices.map((n) => `
      <div class="change-row">
        <span class="change-dot" style="background:${color[n.tone]}"></span>
        <div>
          <div class="change-title">${esc(n.title)}${n.at ? `<span class="change-date">${noticeDate(n.at)}</span>` : ''}</div>
          <div class="change-detail">${esc(n.detail)}</div>
        </div>
      </div>`).join('')}
  </div>`;
};

// ── Totals ───────────────────────────────────────────────────────
export const generateTotals = (rows: DocTotalRow[], invoiceNumber?: string): string => {
  const fmt = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;
  const cls = { line: '', discount: ' discount', credit: ' discount', total: ' subtotal-row', due: ' grand-total', paid: ' grand-total' } as const;
  return `
  <div class="totals-section">
    <div class="totals-box">
      ${invoiceNumber ? `<div class="totals-row"><span class="t-label">Invoice #</span><span class="t-value" style="color:#D4A574">${invoiceNumber}</span></div>` : ''}
      ${rows.map((r) => `<div class="totals-row${cls[r.kind]}"><span class="t-label">${r.label}</span><span class="t-value">${fmt(r.amount)}</span></div>`).join('')}
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
