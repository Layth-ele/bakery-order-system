/**
 * PDF Utilities — Entry Point
 * All PDF generation functions for Delight Bakehouse.
 *
 * ✅ FIREBASE MODE: Settings fetched from Firestore.
 * Customer data passed in from callers who already have it.
 */

import type { Order, Product, Category } from "../../types";
import { toDate } from '../timestampFormatting';
import { buildPDFTemplate, openPDFWindow } from "./pdfTemplates";
import { getPDFStyles } from "./pdfStyles";

// ── Settings helper ────────────────────────────────────────────────────────
// Fetch from Firebase cache (useCachedSettings) or fall back to defaults
let _cachedSettings: Record<string, any> = {};

export function setPDFSettings(settings: Record<string, any>) {
  _cachedSettings = settings;
}

function getSettings(): Record<string, any> {
  return {
    // Defaults — overridden by _cachedSettings from Firestore (via setPDFSettings)
    companyName:    'Your Bakery Name',
    companyAddress: '123 Example St, City, BC V0V 0V0',
    companyPhone:   '604-555-0100',
    companyEmail:   'orders@example.com',
    gstNumber:      '',
    companyCity:    'North Vancouver',
    ..._cachedSettings,
  };
}

/** Compact branded company block for inline PDF headers */
function companyHeaderBlock(s: Record<string, any>): string {
  const gst = s.gstNumber ? `<span style="font-size:7.5pt;color:#888"> &nbsp;·&nbsp; GST/HST: ${s.gstNumber}</span>` : '';
  return `
    <div style="margin-bottom:6px">
      <span style="font-size:13pt;font-weight:700;font-family:'Georgia',serif;color:#1a1a1a">${s.companyName}</span>
    </div>
    <div style="font-size:8pt;color:#555;line-height:1.6">
      ${s.companyAddress ? `${s.companyAddress}<br>` : ''}
      ${s.companyPhone || ''}
      ${s.companyEmail ? ` &nbsp;·&nbsp; ${s.companyEmail}` : ''}
      ${gst}
    </div>`;
}

const formatPeriod = (
  period: string,
  customStartDate?: string,
  customEndDate?: string,
): string => {
  switch (period) {
    case "last7days":   return "Last 7 Days";
    case "last30days":  return "Last 30 Days";
    case "last3months": return "Last 3 Months";
    case "last6months": return "Last 6 Months";
    case "last12months":return "Last Year";
    case "custom":      return `${customStartDate} to ${customEndDate}`;
    default:            return "All Time";
  }
};

// ── 1. Production Sheet ────────────────────────────────────────────────────
export const downloadBakeryProductionPDF = (
  order: Order,
  products: Product[],
  categories: Category[],
) => {
  openPDFWindow(buildPDFTemplate({
    title: "Production Sheet",
    documentType: "production",
    order,
    products,
    categories,
    settings: getSettings(),
    showPrices: false,
    showPaymentInfo: false,
    showTerms: false,
  }));
};

// ── 2. Approved Invoice ────────────────────────────────────────────────────
export const downloadOrderPDF = (
  order: Order,
  products: Product[],
  categories: Category[],
) => {
  openPDFWindow(buildPDFTemplate({
    title: "Invoice",
    documentType: "approved",
    order,
    products,
    categories,
    settings: getSettings(),
    showPrices: true,
    showPaymentInfo: true,
    showTerms: true,
  }));
};

// ── 3. Rejected Order ──────────────────────────────────────────────────────
export const downloadRejectedOrderPDF = (
  order: Order,
  products: Product[],
  categories: Category[],
) => {
  openPDFWindow(buildPDFTemplate({
    title: "Rejected Order",
    documentType: "rejected",
    order,
    products,
    categories,
    settings: getSettings(),
    showPrices: true,
    showPaymentInfo: false,
    showTerms: false,
  }));
};

// ── 4. Completed & Paid Invoice ────────────────────────────────────────────
export const downloadCompleteOrderPDF = (
  order: Order,
  products: Product[],
  categories: Category[],
) => {
  openPDFWindow(buildPDFTemplate({
    title: "Invoice — Paid",
    documentType: "completed",
    order,
    products,
    categories,
    settings: getSettings(),
    showPrices: true,
    showPaymentInfo: false,
    showTerms: false,
  }));
};

// ── 5. Update Request ──────────────────────────────────────────────────────
export const downloadUpdateRequestPDF = (
  order: Order,
  products: Product[],
  categories: Category[],
) => {
  openPDFWindow(buildPDFTemplate({
    title: "Order Update Request",
    documentType: "update",
    order,
    products,
    categories,
    settings: getSettings(),
    showPrices: true,
    showPaymentInfo: false,
    showTerms: false,
  }));
};

// ── 6. Cancelled Order ─────────────────────────────────────────────────────
export const generateCancelledOrderPDF = (
  order: Order,
  products: Product[],
  categories: Category[],
) => {
  openPDFWindow(buildPDFTemplate({
    title: "Cancelled Order",
    documentType: "cancelled",
    order,
    products,
    categories,
    settings: getSettings(),
    showPrices: true,
    showPaymentInfo: false,
    showTerms: false,
  }));
};

// ── 7. Sales Analytics ─────────────────────────────────────────────────────
export const downloadAnalyticsPDF = (
  analytics: Record<string, any>,
  period: string,
  customStartDate?: string,
  customEndDate?: string,
) => {
  const settings = getSettings();
  const periodDisplay = formatPeriod(period, customStartDate, customEndDate);
  const generatedDate = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  const topProductsSection = (analytics.topProducts?.length)
    ? `<p class="section-title" style="margin-top:28px">Top Products</p>
      <table class="order-table"><thead><tr>
        <th style="width:5%">#</th><th>Product</th>
        <th class="center" style="width:18%">Units Sold</th>
        <th class="right" style="width:20%">Revenue</th>
      </tr></thead><tbody>
        ${analytics.topProducts.map((p: any, i: number) => `
          <tr>
            <td class="text-muted">${i + 1}</td>
            <td><strong>${p.name}</strong></td>
            <td class="center">${p.quantity}</td>
            <td class="right gold">$${(p.revenue || 0).toFixed(2)}</td>
          </tr>`).join("")}
      </tbody></table>` : "";

  const topCustomersSection = (analytics.topCustomers?.length)
    ? `<p class="section-title" style="margin-top:28px">Top Customers</p>
      <table class="order-table"><thead><tr>
        <th style="width:5%">#</th><th>Customer</th>
        <th class="center" style="width:18%">Orders</th>
        <th class="right" style="width:22%">Total Spent</th>
      </tr></thead><tbody>
        ${analytics.topCustomers.map((c: any, i: number) => `
          <tr>
            <td class="text-muted">${i + 1}</td>
            <td><strong>${c.storeName || c.contactPerson || c.name || "Unknown"}</strong></td>
            <td class="center">${c.orderCount}</td>
            <td class="right gold">$${(c.totalSpent || 0).toFixed(2)}</td>
          </tr>`).join("")}
      </tbody></table>` : "";

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8">
  <title>Sales Analytics — ${periodDisplay}</title>
  <style>${getPDFStyles()}</style>
</head><body>
  <button class="print-button no-print" onclick="window.print()">Print / Save PDF</button>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #D4A574;padding-bottom:16px;margin-bottom:20px">
    <div>${companyHeaderBlock(settings)}</div>
    <div style="text-align:right">
      <div style="font-size:14pt;font-weight:700;color:#1a1a1a;letter-spacing:.04em">Sales Analytics</div>
      <div style="font-size:9pt;color:#8B6F47;font-weight:600;margin-top:4px">${periodDisplay}</div>
      <div style="font-size:7.5pt;color:#aaa;margin-top:2px">Generated ${generatedDate}</div>
    </div>
  </div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-label">Total Revenue</div><div class="stat-value">$${(analytics.totalRevenue || 0).toFixed(2)}</div></div>
    <div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-value">${analytics.totalOrders || 0}</div></div>
    <div class="stat-card"><div class="stat-label">Average Order</div><div class="stat-value">$${(analytics.averageOrderValue || 0).toFixed(2)}</div></div>
    <div class="stat-card"><div class="stat-label">GST Collected</div><div class="stat-value">$${(analytics.totalGST || 0).toFixed(2)}</div></div>
    <div class="stat-card"><div class="stat-label">Total Customers</div><div class="stat-value">${analytics.totalCustomers || 0}</div></div>
    <div class="stat-card"><div class="stat-label">Units Sold</div><div class="stat-value">${analytics.totalProductsSold || 0}</div></div>
  </div>
  ${topProductsSection}
  ${topCustomersSection}
  <div class="footer">
    <div><strong>${settings.companyName}</strong>${settings.gstNumber ? ` &nbsp;·&nbsp; GST/HST: ${settings.gstNumber}` : ''} — Confidential / Internal Use Only</div>
    <div class="footer-right">Generated ${generatedDate}</div>
  </div>
</body></html>`;

  openPDFWindow(html);
};

// ── 8. Order History ───────────────────────────────────────────────────────
export const downloadOrderHistoryPDF = (
  orders: Order[],
  period: string,
  customStartDate?: string,
  customEndDate?: string,
) => {
  const settings = getSettings();
  const periodDisplay = formatPeriod(period, customStartDate, customEndDate);
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const generatedDate = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  const statusColor: Record<string, string> = {
    pending: "#D97706", approved: "#2E7D32", rejected: "#C62828",
    cancelled: "#E65100", completed: "#1565C0",
  };

  const rows = orders.map((order) => {
    const color = statusColor[order.status] || "#555";
    const orderNum = order.orderNumber || order.invoiceNumber || `ORD-···${(order.id || "").slice(-6).toUpperCase()}`;
    return `<tr>
      <td style="font-family:'Courier New',monospace;font-size:8.5pt">${orderNum}</td>
      <td>${order.customerName || order.customerEmail || "—"}</td>
      <td>${(toDate(order.createdAt) ?? new Date()).toLocaleDateString()}</td>
      <td class="text-muted">${order.week && order.year ? `Wk ${order.week} / ${order.year}` : "—"}</td>
      <td><span style="color:${color};font-weight:700;font-size:8pt;letter-spacing:.06em;text-transform:uppercase">${order.status}</span></td>
      <td class="right gold" style="font-weight:600">$${(order.total || 0).toFixed(2)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><title>Order History — ${periodDisplay}</title>
  <style>${getPDFStyles()}</style>
</head><body>
  <button class="print-button no-print" onclick="window.print()">Print / Save PDF</button>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #D4A574;padding-bottom:16px;margin-bottom:20px">
    <div>${companyHeaderBlock(settings)}</div>
    <div style="text-align:right">
      <div style="font-size:14pt;font-weight:700;color:#1a1a1a;letter-spacing:.04em">Order History</div>
      <div style="font-size:9pt;color:#8B6F47;font-weight:600;margin-top:4px">${periodDisplay}</div>
      <div style="font-size:7.5pt;color:#aaa;margin-top:2px">Generated ${generatedDate}</div>
    </div>
  </div>
  <div class="customer-section" style="grid-template-columns:1fr 1fr;margin-bottom:24px">
    <div class="info-box">
      <h3>Total Orders</h3>
      <p style="font-family:'Georgia',serif;font-size:26pt;font-weight:700;color:#1a1a1a;line-height:1.1">${orders.length}</p>
    </div>
    <div class="info-box">
      <h3>Total Revenue</h3>
      <p style="font-family:'Georgia',serif;font-size:26pt;font-weight:700;color:#D4A857;line-height:1.1">$${totalRevenue.toFixed(2)}</p>
    </div>
  </div>
  <table class="order-table"><thead><tr>
    <th style="width:14%">Order #</th>
    <th style="width:26%">Customer</th>
    <th style="width:12%">Date</th>
    <th style="width:12%">Period</th>
    <th style="width:14%">Status</th>
    <th class="right" style="width:22%">Total</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">
    <div><strong>${settings.companyName}</strong>${settings.gstNumber ? ` &nbsp;·&nbsp; GST/HST: ${settings.gstNumber}` : ''} — Confidential / Internal Use Only</div>
    <div class="footer-right">Generated ${generatedDate}</div>
  </div>
</body></html>`;

  openPDFWindow(html);
};

export { buildPDFTemplate, openPDFWindow };
