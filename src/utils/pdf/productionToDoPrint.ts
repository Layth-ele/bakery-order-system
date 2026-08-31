/**
 * Production To-Do Sheet — Luxury A4 Print Format
 *
 * Generates a print-optimised daily production sheet.
 * Organised by category then product, with commercial and individual
 * client breakdowns. No prices — production quantities only.
 *
 * Functionality unchanged from original.
 */

import type {
  Order,
  Product,
  Category,
  OrderItem,
} from "../../types";
import { getWeekDayDate } from "../../utils/weekUtils";
import { getPDFStyles } from "./pdfStyles";

const DAY_KEYS: Array<keyof OrderItem> = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function getMonBasedDayIndex(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 6 : js - 1;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getItemQtyForOrderOnDate(
  order: Order,
  date: Date,
  item: OrderItem,
): number {
  if (order.week == null || order.year == null) return 0;
  const idx = getMonBasedDayIndex(date);
  const expectedDate = getWeekDayDate(
    order.week,
    idx,
    order.year,
  );
  if (formatDate(expectedDate) !== formatDate(date)) return 0;
  return (item[DAY_KEYS[idx]] || 0) as number;
}

interface ProductionPrintInput {
  date: Date;
  weekLabel: string;
  timezoneLabel?: string;
  orders: Order[];
  products: Product[];
  categories: Category[];
}

interface AggregatedProduct {
  productName: string;
  categoryName: string;
  qty: number;
  ordersCount: number;
}

interface ClientRow {
  name: string;
  orderId: string;
  orderNumber?: string;
  items: Array<{ name: string; qty: number }>;
}

export function openProductionPrintView(
  input: ProductionPrintInput,
) {
  const {
    date,
    weekLabel,
    timezoneLabel = "America/Vancouver",
    orders,
    products,
    categories,
  } = input;

  const aggregated = new Map<string, AggregatedProduct>();
  const commercialClients: ClientRow[] = [];
  const individualClients: ClientRow[] = [];
  let totalUnits = 0;
  let contributingOrders = 0;

  for (const order of orders) {
    const lineItems: Array<{ name: string; qty: number }> = [];
    let orderHasAny = false;

    for (const item of order.items ?? []) {
      const qty = getItemQtyForOrderOnDate(order, date, item);
      if (qty <= 0) continue;

      orderHasAny = true;
      totalUnits += qty;

      const product = products.find(
        (p) => p.id === item.productId,
      );
      const category = categories.find(
        (c) => c.id === product?.categoryId,
      );

      lineItems.push({ name: item.productName, qty });

      const existing = aggregated.get(item.productId);
      if (existing) {
        existing.qty += qty;
        existing.ordersCount += 1;
      } else {
        aggregated.set(item.productId, {
          productName: item.productName,
          categoryName: category?.name || "Uncategorized",
          qty,
          ordersCount: 1,
        });
      }
    }

    if (!orderHasAny) continue;
    contributingOrders += 1;

    const row: ClientRow = {
      name:
        order.customerName ||
        order.customerContactPerson ||
        "Unknown",
      orderId: order.id || "",
      orderNumber: order.orderNumber || order.invoiceNumber || undefined,
      items: lineItems,
    };

    if (order.customerType === "commercial") {
      commercialClients.push(row);
    } else {
      individualClients.push(row);
    }
  }

  const aggregatedRows = Array.from(aggregated.values()).sort(
    (a, b) => {
      if (a.categoryName !== b.categoryName)
        return a.categoryName.localeCompare(b.categoryName);
      return a.productName.localeCompare(b.productName);
    },
  );

  const categoryTotals = new Map<string, number>();
  for (const row of aggregatedRows) {
    categoryTotals.set(
      row.categoryName,
      (categoryTotals.get(row.categoryName) || 0) + row.qty,
    );
  }
  const categoryRows = Array.from(
    categoryTotals.entries(),
  ).sort((a, b) => a[0].localeCompare(b[0]));

  const html = buildProductionHTML({
    date,
    weekLabel,
    timezoneLabel,
    contributingOrders,
    totalUnits,
    aggregatedRows,
    categoryRows,
    commercialClients,
    individualClients,
  });

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      setTimeout(() => win.print(), 250);
    };
  }
}

interface BuildInput {
  date: Date;
  weekLabel: string;
  timezoneLabel: string;
  contributingOrders: number;
  totalUnits: number;
  aggregatedRows: AggregatedProduct[];
  categoryRows: [string, number][];
  commercialClients: ClientRow[];
  individualClients: ClientRow[];
}

function buildProductionHTML(input: BuildInput): string {
  const {
    date,
    weekLabel,
    timezoneLabel,
    contributingOrders,
    totalUnits,
    aggregatedRows,
    categoryRows,
    commercialClients,
    individualClients,
  } = input;

  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format date as MM/DD for subtitle
  const shortDate = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;

  const generatedAt = new Date().toLocaleString("en-US");

  const categorySection = categoryRows
    .map(
      ([cat, qty]) => `
    <tr>
      <td style="font-weight:600">${cat}</td>
      <td style="text-align:center;font-weight:700;font-size:12pt">${qty}</td>
    </tr>`,
    )
    .join("");

  const productSection = aggregatedRows
    .map(
      (row) => `
    <tr>
      <td style="font-weight:600">${row.productName}</td>
      <td style="color:#7C5A1E">${row.categoryName}</td>
      <td style="text-align:center;font-weight:700;font-size:11pt">${row.qty}</td>
      <td style="text-align:center;color:#666">${row.ordersCount}</td>
    </tr>`,
    )
    .join("");

  const clientRows = (clients: ClientRow[]) =>
    clients
      .map(
        (c) => `
    <tr>
      <td style="font-weight:600">${c.name}</td>
      <td style="font-family:'Courier New',monospace;font-size:8pt;color:#666">${c.orderNumber || ('···' + c.orderId.slice(-6))}</td>
      <td style="font-size:8.5pt">${c.items.map((i) => `${i.name} <strong>(${i.qty})</strong>`).join(" &nbsp;·&nbsp; ")}</td>
    </tr>`,
      )
      .join("");

  const emptyMsg = (label: string) =>
    `<p style="text-align:center;color:#aaa;padding:16px 0;font-style:italic">No ${label} clients for this date</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Production Sheet — ${weekLabel} — ${shortDate}</title>
  <style>${getPDFStyles()}
    /* Production-specific table styles (complement shared styles) */
    table { width:100%; border-collapse:collapse; margin-bottom:0; font-size:9pt; }
    table thead tr { background:#1a1a1a; color:#fff; }
    table thead th {
      padding:7px 9px; text-align:left;
      font-size:7pt; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
      border-right:1px solid #333;
    }
    table thead th:last-child { border-right:none; }
    table tbody tr { border-bottom:1px solid #E8E8E8; }
    table tbody tr:nth-child(even) { background:#FAF7F2; }
    table tbody td { padding:7px 9px; vertical-align:middle; }
    table + .section-header { margin-top:18px; }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Print / Save PDF</button>

  <div class="doc-header">
    <h1>Production Sheet</h1>
    <div class="subtitle">${weekLabel} &ensp;·&ensp; ${dateStr} &ensp;(${shortDate})</div>
    <div class="meta">Timezone: ${timezoneLabel} &ensp;·&ensp; Generated: ${generatedAt}</div>
  </div>

  <div class="summary-box">
    <div class="summary-item"><div class="lbl">Orders</div><div class="val">${contributingOrders}</div></div>
    <div class="summary-item"><div class="lbl">Total Units</div><div class="val">${totalUnits}</div></div>
    <div class="summary-item"><div class="lbl">Products</div><div class="val">${aggregatedRows.length}</div></div>
    <div class="summary-item"><div class="lbl">Commercial</div><div class="val">${commercialClients.length}</div></div>
    <div class="summary-item"><div class="lbl">Individual</div><div class="val">${individualClients.length}</div></div>
    <div class="summary-item"><div class="lbl">Categories</div><div class="val">${categoryRows.length}</div></div>
  </div>

  <div class="section-header">Category Summary</div>
  <table>
    <thead><tr><th>Category</th><th style="text-align:center;width:120px">Total Units</th></tr></thead>
    <tbody>${categorySection}</tbody>
  </table>

  <div class="section-header">Production List — All Products</div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th style="width:22%">Category</th>
        <th style="text-align:center;width:90px">Qty</th>
        <th style="text-align:center;width:90px">Orders</th>
      </tr>
    </thead>
    <tbody>${productSection}</tbody>
  </table>

  <div class="section-header green">Commercial Clients (${commercialClients.length})</div>
  ${
    commercialClients.length
      ? `<table>
        <thead><tr><th style="width:22%">Client</th><th style="width:14%">Order ID</th><th>Items</th></tr></thead>
        <tbody>${clientRows(commercialClients)}</tbody>
       </table>`
      : emptyMsg("commercial")
  }

  <div class="section-header blue">Individual Clients (${individualClients.length})</div>
  ${
    individualClients.length
      ? `<table>
        <thead><tr><th style="width:22%">Client</th><th style="width:14%">Order ID</th><th>Items</th></tr></thead>
        <tbody>${clientRows(individualClients)}</tbody>
       </table>`
      : emptyMsg("individual")
  }

  <div class="doc-footer">
    <div><strong>Production Sheet</strong> ${weekLabel} &ensp;·&ensp; ${shortDate}</div>
    <div class="right">Confidential — Internal Use Only<br>Generated ${generatedAt}</div>
  </div>
</body>
</html>`;
}