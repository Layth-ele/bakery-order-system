/**
 * Excel Export — Delight Bakehouse
 * Professional, colour-coded XLSX files.
 *
 * Sheet 1: Weekly Order  (product grid by category, colour-coded rows)
 * Sheet 2: Category Summary
 * Sheet 3: Invoice Details
 *
 * ✅ FIX: Custom items (admin-added) now appear under "Custom Items" category
 * ✅ FIX: Day-date sub-row no longer shows "undefined" — built from week+year fallback
 * ✅ FORMAT: Category header rows coloured, data rows lightly tinted — matches reference
 */
import * as XLSX from 'xlsx-js-style';
import { toDate } from './timestampFormatting';
import type { Order, Product, Category } from '../types';
import { logger } from './logger';


// Detect raw Firebase UIDs and mask them
const isUID = (s?: string) => !!s && s.length >= 16 && !(/^[A-Z]{2,}-\d{4}-/.test(s)) && (s.match(/-/g) || []).length === 0;
const safeOrderNum = (o: Order) => {
  if (o.orderNumber && !isUID(o.orderNumber)) return o.orderNumber;
  if (o.invoiceNumber && !isUID(o.invoiceNumber)) return o.invoiceNumber;
  return o.id ? `ORD-···${o.id.slice(-6).toUpperCase()}` : 'N/A';
};
const safeInvNum = (o: Order) => {
  if (o.invoiceNumber && !isUID(o.invoiceNumber)) return o.invoiceNumber;
  if (o.orderNumber && !isUID(o.orderNumber)) return o.orderNumber;
  return o.id ? `INV-···${o.id.slice(-6).toUpperCase()}` : 'N/A';
};
import {
  CAT_PALETTE,
  DELIGHT_PALETTE,
  BRAND,
  STATUS_COLOUR,
  STATUS_TEXT,
  BORDER_MEDIUM,
  BORDER_THIN,
  cs,
} from './excelStyles';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) => `$${n.toFixed(2)}`;
const CURRENCY_FMT = '"$"#,##0.00';

/**
 * Build 7 "Mon 3/24" labels from an order.
 * Uses weekRange string first, falls back to ISO week+year calculation.
 */
function buildWeekDateLabels(order: Order): string[] {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Try weekRange string: "Mar 23-29, 2026" ──────────────────────────────
  if (order.weekRange) {
    const m = order.weekRange.match(/(\w+)\s+(\d+)-(\d+),\s+(\d+)/);
    if (m) {
      const monthIdx = MONTH_ABBR.indexOf(m[1]);
      if (monthIdx !== -1) {
        const start = new Date(parseInt(m[4]), monthIdx, parseInt(m[2]));
        return DAY_NAMES.map((day, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          return `${day} ${d.getMonth() + 1}/${d.getDate()}`;
        });
      }
    }
  }

  // ── Fallback: ISO week + year ─────────────────────────────────────────────
  if (order.week && order.year) {
    // ISO week Monday = Jan 4 of year is always in week 1
    const jan4 = new Date(order.year, 0, 4);
    const jan4Day = jan4.getDay() || 7; // 1=Mon … 7=Sun
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4Day - 1) + (order.week - 1) * 7);
    return DAY_NAMES.map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return `${day} ${d.getMonth() + 1}/${d.getDate()}`;
    });
  }

  // ── Last resort: just day names ───────────────────────────────────────────
  return DAY_NAMES;
}

/**
 * Group order items by category — mirrors groupItemsByCategory in orderCalculator.ts.
 * Custom items (productId not in products array) go into a "Custom Items" group.
 */
function groupForExcel(
  order: Order,
  products: Product[],
  categories: Category[],
): Array<{ catId: string; catName: string; catOrder: number; colour: [string,string,string]; items: typeof order.items }> {
  const prodMap = new Map(products.map(p => [p.id, p]));
  const sortedCats = [...categories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // assign palette colours
  const colourMap = new Map<string, [string,string,string]>();
  sortedCats.forEach((c, i) => colourMap.set(c.id, CAT_PALETTE[i % CAT_PALETTE.length]));

  const groups: ReturnType<typeof groupForExcel> = [];
  const usedIds = new Set<string>();

  sortedCats.forEach(cat => {
    const items = order.items.filter(item => {
      const p = prodMap.get(item.productId);
      return p?.categoryId === cat.id || (p as any)?.category === cat.id;
    });
    if (!items.length) return;
    items.forEach(i => usedIds.add(i.productId));
    groups.push({
      catId: cat.id,
      catName: cat.name,
      catOrder: cat.order ?? 999,
      colour: colourMap.get(cat.id) ?? CAT_PALETTE[0],
      items,
    });
  });

  // custom / admin-added items
  const customItems = order.items.filter(i => !usedIds.has(i.productId));
  if (customItems.length) {
    groups.push({
      catId: '__custom__',
      catName: 'Custom Items',
      catOrder: 9999,
      colour: ['8B6F47', 'F5F0EA', '8B6F47'],
      items: customItems,
    });
  }

  return groups;
}

// ─── Single order export ───────────────────────────────────────────────────────
export function exportOrderToExcel(
  order: Order,
  products: Product[],
  categories: Category[],
): Blob | undefined {
  if (!order?.items?.length) {
    logger.warn('[excelExport] exportOrderToExcel called with no items');
    return;
  }
  const orderNum  = safeOrderNum(order);
  const invNum    = safeInvNum(order);
  const orderDate = (order as any).orderDate
    || (order.createdAt ? toDate(order.createdAt)?.toLocaleDateString('en-CA') ?? '' : '');

  // prodMap needed for per-item cost/retail/minOrder lookups inside the groups loop
  const prodMap = new Map(products.map(p => [p.id, p]));

  const data: any[][] = [];

  // Row 0 — title
  data.push(['', `${order.customerName || 'Delight Bakehouse'} — Weekly Order`, ...new Array(11).fill('')]);
  // Row 1 — spacer
  data.push(new Array(13).fill(''));
  // Rows 2-6 — info block
  data.push(['Business / Store',  order.customerName || '',              ...new Array(11).fill('')]);
  data.push(['Contact Person',    order.customerContactPerson || '',     ...new Array(11).fill('')]);
  data.push(['Order Date',        orderDate,                             ...new Array(11).fill('')]);
  data.push(['Order #',           orderNum,                              ...new Array(11).fill('')]);
  data.push(['Invoice #',         invNum,                                ...new Array(11).fill('')]);
  // Row 7 — spacer
  data.push(new Array(13).fill(''));
  // Row 8 — column headers
  data.push(['Category', 'Product', 'Unit Cost', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Total Qty', 'Retail', 'Min/Day']);
  // Row 9 — date sub-row  ✅ FIXED: no more "undefined"
  const weekDateLabels = buildWeekDateLabels(order);
  data.push(['', '', '', ...weekDateLabels, '', '', '']);

  // ── product rows ───────────────────────────────────────────────────────────
  const groups = groupForExcel(order, products, categories);

  let dataRow = 10;
  const catMerges: Array<{ startRow: number; len: number }> = [];
  const categorySummary: Array<{ name: string; total: number; revenue: number; colour: [string,string,string] }> = [];
  let grandTotal = 0;
  let grandRevenue = 0;

  groups.forEach(({ catName, colour, items }) => {
    catMerges.push({ startRow: dataRow, len: items.length });
    let catTotal = 0; let catRevenue = 0;

    items.forEach((item, idx) => {
      const prod    = prodMap.get(item.productId);
      // Compute qty from day fields (item.total can be monetary total in some flows)
      const qty = (item.monday||0)+(item.tuesday||0)+(item.wednesday||0)+
                  (item.thursday||0)+(item.friday||0)+(item.saturday||0)+(item.sunday||0)
                  || item.total || 0;
      // For custom items: use item.price directly (set by admin); for catalog: use prod.cost
      const cost    = prod?.cost ?? item.price ?? 0;
      const retail  = prod?.retail ?? prod?.price ?? item.price ?? 0;
      const rev     = qty * cost;
      catTotal      += qty;
      catRevenue    += rev;

      data.push([
        idx === 0 ? catName : '',
        item.productName,
        cost || '',
        item.monday    || '',
        item.tuesday   || '',
        item.wednesday || '',
        item.thursday  || '',
        item.friday    || '',
        item.saturday  || '',
        item.sunday    || '',
        qty,
        retail ? fmt$(retail) : '',
        prod?.dailyMinOrder || '',
      ]);
      dataRow++;
    });

    categorySummary.push({ name: catName, total: catTotal, revenue: catRevenue, colour });
    grandTotal   += catTotal;
    grandRevenue += catRevenue;
  });

  // grand total row
  data.push(new Array(13).fill(''));
  data.push(['', 'GRAND TOTAL', '', '', '', '', '', '', '', '', grandTotal, fmt$(grandRevenue), '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();  // ← was missing — caused "wb is not defined" crash

  ws['!cols'] = [
    { wch: 18 }, { wch: 36 }, { wch: 11 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 11 }, { wch: 12 }, { wch: 10 },
  ];
  ws['!rows'] = [
    { hpt: 36 }, { hpt: 5 },
    { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 5 },
    { hpt: 28 }, { hpt: 18 },
  ];

  // ── styles ────────────────────────────────────────────────────────────────
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:M1');

  // Build a fast lookup: data row index → category colour
  const rowColour = new Map<number, [string,string,string]>();
  groups.forEach(({ colour, items }, gi) => {
    const start = 10 + groups.slice(0, gi).reduce((s, g) => s + g.items.length, 0);
    for (let r = start; r < start + items.length; r++) rowColour.set(r, colour);
  });

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let Ci = range.s.c; Ci <= range.e.c; Ci++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: Ci });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };

      // Title row
      if (R === 0) {
        ws[ref].s = Ci === 1
          ? cs(BRAND.BLACK, BRAND.GOLD, 16, true, 'left', {})
          : cs(BRAND.WHITE, BRAND.WHITE, 10, false, 'left', {});
        continue;
      }
      // Spacer rows
      if (R === 1 || R === 7) {
        ws[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 5, false, 'left', {});
        continue;
      }
      // Info label col A (rows 2-6)
      if (R >= 2 && R <= 6 && Ci === 0) {
        ws[ref].s = cs('F5EDD0', BRAND.GOLD_DARK, 9, true, 'left', BORDER_THIN(BRAND.GOLD));
        continue;
      }
      // Info value (rows 2-6, col B+)
      if (R >= 2 && R <= 6 && Ci >= 1) {
        ws[ref].s = cs('FAFAFA', BRAND.BLACK, 10, false, 'left', BORDER_THIN('DDDDDD'));
        continue;
      }
      // Column header row 8
      if (R === 8) {
        const isDayCol = Ci >= 3 && Ci <= 9;
        ws[ref].s = isDayCol
          ? cs(BRAND.GOLD, BRAND.BLACK, 10, true, 'center', BORDER_THIN('888888'))
          : cs(BRAND.BLACK, BRAND.WHITE, 10, true, 'center', BORDER_THIN('444444'));
        continue;
      }
      // Date sub-row 9
      if (R === 9) {
        ws[ref].s = cs('F5EDD0', '555555', 9, false, 'center', BORDER_THIN(BRAND.GOLD));
        continue;
      }
      // Spacer before grand total
      if (R >= 10 && data[R]?.[0] === '' && data[R]?.[1] === '' && !data[R]?.[10]) {
        ws[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 4, false, 'left', {});
        continue;
      }
      // Grand total row
      if (data[R]?.[1] === 'GRAND TOTAL') {
        ws[ref].s = Ci === 1
          ? cs(BRAND.BLACK, BRAND.GOLD, 11, true, 'left', BORDER_MEDIUM(BRAND.GOLD))
          : (Ci === 10 || Ci === 11)
          ? cs(BRAND.BLACK, BRAND.GOLD, 12, true, 'center', BORDER_MEDIUM(BRAND.GOLD))
          : cs(BRAND.BLACK, BRAND.WHITE, 10, false, 'center', {});
        continue;
      }
      // Product data rows (10+)
      if (R >= 10) {
        const [hdrBg, dataBg, accent] = rowColour.get(R) ?? CAT_PALETTE[0];
        if (Ci === 0) {
          // Category label cell — coloured header with rotated text
          ws[ref].s = {
            font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: BRAND.WHITE } },
            fill: { fgColor: { rgb: hdrBg } },
            alignment: { vertical: 'center', horizontal: 'center', textRotation: 90 },
            border: BORDER_MEDIUM(accent),
          };
        } else if (Ci === 1) {
          ws[ref].s = cs(dataBg, BRAND.BLACK, 10, false, 'left', BORDER_THIN(accent));
        } else if (Ci === 2) {
          ws[ref].s = cs(dataBg, '555555', 9, false, 'right', BORDER_THIN(accent));
        } else if (Ci >= 3 && Ci <= 9) {
          const hasVal = !!data[R]?.[Ci];
          ws[ref].s = cs(
            hasVal ? dataBg : 'F8F8F8',
            hasVal ? hdrBg : 'BBBBBB',
            hasVal ? 11 : 9, hasVal, 'center', BORDER_THIN(accent),
          );
        } else if (Ci === 10) {
          ws[ref].s = cs('F5EDD0', BRAND.GOLD_DARK, 11, true, 'center', BORDER_MEDIUM(BRAND.GOLD));
        } else {
          ws[ref].s = cs(dataBg, '666666', 9, false, 'center', BORDER_THIN(accent));
        }
      }
    }
  }

  // ── merges ────────────────────────────────────────────────────────────────
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 12 } },   // title
    { s: { r: 2, c: 1 }, e: { r: 2, c: 12 } },   // store
    { s: { r: 3, c: 1 }, e: { r: 3, c: 12 } },   // contact
    { s: { r: 4, c: 1 }, e: { r: 4, c: 12 } },   // date
    { s: { r: 5, c: 1 }, e: { r: 5, c: 12 } },   // order#
    { s: { r: 6, c: 1 }, e: { r: 6, c: 12 } },   // invoice#
    { s: { r: 8, c: 0 }, e: { r: 9, c: 0 } },    // Category header
    { s: { r: 8, c: 1 }, e: { r: 9, c: 1 } },    // Product header
    { s: { r: 8, c: 2 }, e: { r: 9, c: 2 } },    // Cost header
    { s: { r: 8, c: 10 }, e: { r: 9, c: 10 } },  // Total header
    { s: { r: 8, c: 11 }, e: { r: 9, c: 11 } },  // Retail header
    { s: { r: 8, c: 12 }, e: { r: 9, c: 12 } },  // Min header
  ];
  catMerges.forEach(({ startRow, len }) => {
    if (len > 1) merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow + len - 1, c: 0 } });
  });
  ws['!merges'] = merges;
  XLSX.utils.book_append_sheet(wb, ws, 'Weekly Order');

  /* ═══════════════════════════════════════════
     SHEET 2 — CATEGORY SUMMARY
  ═══════════════════════════════════════════ */
  const sumData: any[][] = [
    [`${order.customerName || 'Delight Bakehouse'} — Category Summary`],
    [],
    ['Category', 'Total Units', 'Est. Revenue'],
  ];
  categorySummary.forEach(({ name, total, revenue }) => sumData.push([name, total, revenue]));
  sumData.push(['', '', '']);
  sumData.push(['GRAND TOTAL', grandTotal, grandRevenue]);

  const ws2 = XLSX.utils.aoa_to_sheet(sumData);
  ws2['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }];

  const r2 = XLSX.utils.decode_range(ws2['!ref'] || 'A1:C1');
  for (let R = r2.s.r; R <= r2.e.r; R++) {
    for (let Ci = r2.s.c; Ci <= r2.e.c; Ci++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: Ci });
      if (!ws2[ref]) ws2[ref] = { t: 's', v: '' };
      if (R === 0) { ws2[ref].s = cs(BRAND.BLACK, BRAND.GOLD, 14, true, 'left', {}); continue; }
      if (R === 1) { ws2[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 5, false, 'left', {}); continue; }
      if (R === 2) {
        ws2[ref].s = cs(BRAND.BLACK, BRAND.WHITE, 10, true, Ci === 0 ? 'left' : 'center', BORDER_THIN('444444'));
        continue;
      }
      const di = R - 3;
      if (di >= 0 && di < categorySummary.length) {
        const [hdrBg, dataBg] = categorySummary[di].colour;
        ws2[ref].s = Ci === 0
          ? cs(dataBg, BRAND.BLACK, 10, true, 'left', BORDER_THIN(hdrBg))
          : cs(hdrBg, BRAND.WHITE, 11, true, 'center', BORDER_THIN(hdrBg));
        if (Ci === 2 && ws2[ref].t === 'n') ws2[ref].z = CURRENCY_FMT;
        continue;
      }
      if (ws2[ref].v === '') { ws2[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 5, false, 'left', {}); continue; }
      ws2[ref].s = Ci === 0
        ? cs(BRAND.BLACK, BRAND.GOLD, 11, true, 'left', BORDER_MEDIUM(BRAND.GOLD))
        : cs(BRAND.BLACK, BRAND.GOLD, 12, true, 'center', BORDER_MEDIUM(BRAND.GOLD));
      if (Ci === 2 && ws2[ref].t === 'n') ws2[ref].z = CURRENCY_FMT;
    }
  }
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Category Summary');

  /* ═══════════════════════════════════════════
     SHEET 3 — INVOICE DETAILS
  ═══════════════════════════════════════════ */
  const subtotal = order.subtotal ?? 0;
  const gst      = order.gst ?? 0;
  const delivFee = order.deliveryFee ?? 0;
  const svcChg   = order.serviceCharge ?? 0;
  const discount = order.discount ?? 0;
  const total    = order.total ?? 0;

  const invData: any[][] = [
    ['INVOICE DETAILS'],
    [],
    ['Field', 'Value'],
    ['Invoice #',     invNum],
    ['Order #',       orderNum],
    ['Customer',      order.customerName || '—'],
    ['Contact',       order.customerContactPerson || '—'],
    ['Email',         order.customerEmail || '—'],
    ['Week',          order.week ? `Week ${order.week} / ${order.year}` : '—'],
    ['Order Date',    (toDate(order.createdAt) ?? new Date()).toLocaleDateString()],
    ['Status',        (order.status || '').toUpperCase()],
    [],
    ['FINANCIALS', ''],
    ['Subtotal',      subtotal],
    ['GST (5%)',      gst],
    ['Delivery Fee',  delivFee],
    ['Service Charge', svcChg],
    ...(discount ? [['Discount', -discount]] : []),
    ...((order as any).creditApplied ? [['Credit Applied', -((order as any).creditApplied)]] : []),
    [],
    ['INVOICE TOTAL',  total],
    ...(((order as any).creditApplied ?? 0) > 0
      ? [['AMOUNT DUE (After Credit)', Math.max(0, total - ((order as any).creditApplied || 0))]]
      : [['TOTAL DUE', total]]),
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(invData);
  ws3['!cols'] = [{ wch: 20 }, { wch: 32 }];

  const r3 = XLSX.utils.decode_range(ws3['!ref'] || 'A1:B1');
  const statusBg = STATUS_COLOUR[order.status] || 'FAFAFA';
  const statusFg = STATUS_TEXT[order.status] || BRAND.BLACK;

  for (let R = r3.s.r; R <= r3.e.r; R++) {
    for (let Ci = r3.s.c; Ci <= r3.e.c; Ci++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: Ci });
      if (!ws3[ref]) ws3[ref] = { t: 's', v: '' };
      const v = invData[R]?.[Ci] ?? '';
      if (R === 0) { ws3[ref].s = cs(BRAND.BLACK, BRAND.GOLD, 15, true, 'left', {}); continue; }
      if (R === 1 || v === '') { ws3[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 5, false, 'left', {}); continue; }
      if (R === 2) { ws3[ref].s = cs(BRAND.BLACK, BRAND.WHITE, 10, true, Ci === 0 ? 'right' : 'left', BORDER_THIN('444444')); continue; }
      if (v === 'FINANCIALS') { ws3[ref].s = cs('E8F4FD', '1565C0', 10, true, 'left', BORDER_THIN('1565C0')); continue; }
      if (v === 'TOTAL DUE') {
        ws3[ref].s = cs(BRAND.BLACK, BRAND.GOLD, 13, true, Ci === 0 ? 'left' : 'right', BORDER_MEDIUM(BRAND.GOLD));
        if (Ci === 1 && typeof ws3[ref].v === 'number') ws3[ref].z = CURRENCY_FMT;
        continue;
      }
      if (v === (order.status || '').toUpperCase() && Ci === 1) {
        ws3[ref].s = cs(statusBg, statusFg, 10, true, 'left', BORDER_THIN(statusFg)); continue;
      }
      if (typeof v === 'number') {
        ws3[ref].z = CURRENCY_FMT;
        ws3[ref].s = cs('F5EDD0', BRAND.GOLD_DARK, 10, true, 'right', BORDER_THIN(BRAND.GOLD)); continue;
      }
      if (Ci === 0) { ws3[ref].s = cs('F9F9F9', '555555', 9, true, 'right', BORDER_THIN('DDDDDD')); continue; }
      ws3[ref].s = cs(BRAND.WHITE, BRAND.BLACK, 10, false, 'left', BORDER_THIN('DDDDDD'));
    }
  }
  ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Invoice Details');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALL-ORDERS SUMMARY EXPORT
═══════════════════════════════════════════════════════════════════════════ */
export function exportAllOrdersToExcel(
  orders: Order[],
  products: Product[],
  categories: Category[],
): Blob | undefined {
  const validOrders = orders.filter(o => o?.id);
  if (!validOrders.length) {
    logger.warn('[excelExport] exportAllOrdersToExcel: no orders');
    return;
  }

  const generatedDate = new Date().toLocaleDateString('en-CA');
  const wb = XLSX.utils.book_new();

  /* ── SHEET 1: ORDERS SUMMARY ─────────────────────────────────────── */
  const data: any[][] = [
    ['Delight Bakehouse — Order History', ...new Array(7).fill('')],
    [`Generated: ${generatedDate}`,       ...new Array(7).fill('')],
    new Array(8).fill(''),
    ['Order #', 'Invoice #', 'Customer', 'Contact', 'Week', 'Status', 'Total', 'Date'],
  ];

  validOrders.forEach(o => {
    data.push([
      safeOrderNum(o as Order),
      safeInvNum(o as Order),
      o.customerName || '',
      o.customerContactPerson || '',
      o.week ? `Week ${o.week} / ${o.year}` : '—',
      (o.status || '').toUpperCase(),
      o.total || 0,
      (toDate(o.createdAt) ?? new Date()).toLocaleDateString(),
    ]);
  });

  data.push(new Array(8).fill(''));
  const totalRevenue = validOrders.reduce((s, o) => s + (o.total || 0), 0);
  data.push(['', '', '', '', '', 'TOTAL REVENUE', totalRevenue, '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 26 }, { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 14 },
  ];
  ws['!rows'] = [{ hpt: 30 }, { hpt: 16 }, { hpt: 6 }, { hpt: 26 }];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:H1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let Ci = 0; Ci < 8; Ci++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: Ci });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      if (R === 0) {
        ws[ref].s = Ci === 0 ? cs(BRAND.BLACK, BRAND.GOLD, 15, true, 'left', {}) : cs(BRAND.BLACK, BRAND.WHITE, 10, false, 'left', {});
        continue;
      }
      if (R === 1) { ws[ref].s = Ci === 0 ? cs(BRAND.WHITE, '888888', 9, false, 'left', {}) : cs(BRAND.WHITE, BRAND.WHITE, 9, false, 'left', {}); continue; }
      if (R === 2) { ws[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 5, false, 'left', {}); continue; }
      if (R === 3) { ws[ref].s = cs(BRAND.BLACK, BRAND.WHITE, 10, true, 'center', BORDER_THIN('444444')); continue; }
      if (R >= 4 && R < 4 + validOrders.length) {
        const idx = R - 4;
        const status = validOrders[idx]?.status || '';
        const bg = STATUS_COLOUR[status] || 'FAFAFA';
        const fg = STATUS_TEXT[status] || BRAND.BLACK;
        const stripe = idx % 2 === 0 ? 'FAFAFA' : 'F5F5F5';
        if (Ci === 5) { ws[ref].s = cs(bg, fg, 9, true, 'center', BORDER_THIN(fg)); }
        else if (Ci === 6) {
          ws[ref].s = cs('F5EDD0', BRAND.GOLD_DARK, 10, true, 'right', BORDER_THIN(BRAND.GOLD));
          if (typeof ws[ref].v === 'number') ws[ref].z = CURRENCY_FMT;
        } else {
          const halign: 'left'|'center'|'right' = Ci <= 1 ? 'center' : Ci === 7 ? 'center' : 'left';
          ws[ref].s = cs(stripe, Ci <= 1 ? '555555' : BRAND.BLACK, 9, false, halign, BORDER_THIN('DDDDDD'));
        }
        continue;
      }
      if (R === 4 + validOrders.length) { ws[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 4, false, 'left', {}); continue; }
      if (R === 4 + validOrders.length + 1) {
        ws[ref].s = Ci === 5 ? cs(BRAND.BLACK, BRAND.GOLD, 10, true, 'right', BORDER_MEDIUM(BRAND.GOLD))
          : Ci === 6 ? cs(BRAND.BLACK, BRAND.GOLD, 12, true, 'right', BORDER_MEDIUM(BRAND.GOLD))
          : cs(BRAND.BLACK, BRAND.WHITE, 10, false, 'center', {});
        if (Ci === 6 && typeof ws[ref].v === 'number') ws[ref].z = CURRENCY_FMT;
      }
    }
  }
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Orders Summary');

  /* ── SHEET 2: REVENUE BY STATUS ───────────────────────────────────── */
  const statusGroups = ['pending', 'approved', 'completed', 'rejected', 'cancelled'];
  const statusData: any[][] = [
    ['Revenue by Status'], [], ['Status', 'Orders', 'Total Revenue'],
  ];
  statusGroups.forEach(s => {
    const grp = validOrders.filter(o => o.status === s);
    statusData.push([s.toUpperCase(), grp.length, grp.reduce((sum, o) => sum + (o.total || 0), 0)]);
  });
  statusData.push(['', '', '']);
  statusData.push(['ALL ORDERS', validOrders.length, totalRevenue]);

  const ws4 = XLSX.utils.aoa_to_sheet(statusData);
  ws4['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 18 }];

  const r4 = XLSX.utils.decode_range(ws4['!ref'] || 'A1:C1');
  for (let R = r4.s.r; R <= r4.e.r; R++) {
    for (let Ci = r4.s.c; Ci <= r4.e.c; Ci++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: Ci });
      if (!ws4[ref]) ws4[ref] = { t: 's', v: '' };
      const v = statusData[R]?.[Ci] ?? '';
      if (R === 0) { ws4[ref].s = cs(BRAND.BLACK, BRAND.GOLD, 14, true, 'left', {}); continue; }
      if (R === 1 || v === '') { ws4[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 5, false, 'left', {}); continue; }
      if (R === 2) { ws4[ref].s = cs(BRAND.BLACK, BRAND.WHITE, 10, true, Ci === 0 ? 'left' : 'center', BORDER_THIN('444444')); continue; }
      const di = R - 3;
      if (di >= 0 && di < statusGroups.length) {
        const st = statusGroups[di];
        const bg = STATUS_COLOUR[st] || 'FAFAFA';
        const fg = STATUS_TEXT[st] || BRAND.BLACK;
        ws4[ref].s = Ci === 0 ? cs(bg, fg, 10, true, 'left', BORDER_THIN(fg))
          : Ci === 2 ? cs('F5EDD0', BRAND.GOLD_DARK, 10, true, 'right', BORDER_THIN(BRAND.GOLD))
          : cs('F9F9F9', BRAND.BLACK, 10, false, 'center', BORDER_THIN('DDDDDD'));
        if (Ci === 2 && typeof ws4[ref].v === 'number') ws4[ref].z = CURRENCY_FMT;
        continue;
      }
      ws4[ref].s = Ci === 0 ? cs(BRAND.BLACK, BRAND.GOLD, 11, true, 'left', BORDER_MEDIUM(BRAND.GOLD))
        : cs(BRAND.BLACK, BRAND.GOLD, 12, true, Ci === 2 ? 'right' : 'center', BORDER_MEDIUM(BRAND.GOLD));
      if (Ci === 2 && typeof ws4[ref].v === 'number') ws4[ref].z = CURRENCY_FMT;
    }
  }
  ws4['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Revenue by Status');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── download helpers ──────────────────────────────────────────────────────────
export function downloadExcel(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.replace('.csv', '.xlsx'); a.style.display = 'none';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function downloadCSV(content: string | Blob, filename: string) {
  if (content instanceof Blob) { downloadExcel(content, filename); return; }
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  downloadExcel(blob, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// BLANK ORDER FORM TEMPLATE — Delight Bakehouse
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generates a blank weekly order form pre-filled with the current product
 * catalogue from Firebase, grouped and colour-coded by category.
 *
 * Layout mirrors the reference template:
 *   Col A  — Category label (merged vertically, coloured header shade)
 *   Col B  — Product description
 *   Col C  — Unit cost (wholesale)
 *   Col D-J — Mo–Su  (blank, customer fills in)
 *   Col K  — TOTAL   =SUM(D:J)  live formula
 *   Col L  — Retail price
 *   Col M  — Daily minimum order
 *
 * Supports unlimited categories — cycles through 12 distinct pastel colours.
 * First 6 colours match the reference template exactly.
 *
 * @param products     — flat Product[] from useCachedProducts()
 * @param categories   — flat Category[] from useCachedCategories()
 * @param customerName — pre-fill the store name header (optional)
 */
export function exportOrderFormTemplate(
  products: Product[],
  categories: Category[],
  customerName = '',
): Blob {
  const N_COLS = 13; // A–M
  const empty = () => new Array(N_COLS).fill('');

  const aoa: any[][] = [];

  // ── Row 1: title ────────────────────────────────────────────────────────
  aoa.push(['', 'DELIGHT BAKEHOUSE — Weekly Order Form', ...new Array(N_COLS - 2).fill('')]);
  // ── Row 2: spacer ───────────────────────────────────────────────────────
  aoa.push(empty());
  // ── Rows 3-5: store info ────────────────────────────────────────────────
  aoa.push(['LOCATION / NAME OF STORE:', customerName,  ...new Array(N_COLS - 2).fill('')]);
  aoa.push(['NAME OF ORDERING PERSON:',  '',             ...new Array(N_COLS - 2).fill('')]);
  aoa.push(['ORDER DATE:',               '',             ...new Array(N_COLS - 2).fill('')]);
  // ── Row 6: spacer ───────────────────────────────────────────────────────
  aoa.push(empty());
  // ── Row 7: column headers ───────────────────────────────────────────────
  aoa.push([
    'Category', 'Description', 'Unit cost',
    'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su',
    'TOTAL', 'Retail (Min)', 'Daily Min Order',
  ]);

  const HEADER_ROWS = aoa.length; // = 7  (0-indexed row of first product)

  // ── Product rows ─────────────────────────────────────────────────────────
  const sortedCats = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const merges: XLSX.Range[] = [];
  let catColorIdx = 0; // increments only when we actually emit a non-empty category

  sortedCats.forEach((cat) => {
    const catProducts = products
      .filter((p) => p.categoryId === cat.id && p.available !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));

    if (!catProducts.length) return; // skip empty categories silently

    const catStartRow = aoa.length; // 0-indexed

    catProducts.forEach((p, i) => {
      const excelRowNum = aoa.length + 1; // 1-indexed for the SUM formula
      aoa.push([
        i === 0 ? cat.name : '',          // A — label only on first row of group
        p.name,                           // B
        p.wholesale ?? p.cost ?? '',      // C
        '', '', '', '', '', '', '',       // D-J  blank input cells
        { f: `SUM(D${excelRowNum}:J${excelRowNum})` }, // K — live formula
        p.retail ?? p.price ?? '',        // L
        p.dailyMinOrder ?? p.minQty ?? '', // M
      ]);
    });

    // Merge col A vertically across all product rows for this category
    if (catProducts.length > 1) {
      merges.push({
        s: { r: catStartRow,                        c: 0 },
        e: { r: catStartRow + catProducts.length - 1, c: 0 },
      });
    }

    catColorIdx++;
  });

  // ── Build worksheet ───────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 20 }, // A Category
    { wch: 36 }, // B Description
    { wch: 11 }, // C Unit cost
    { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 },
    { wch: 5 }, { wch: 5 }, { wch: 5 }, // D-J days
    { wch: 9 }, // K Total
    { wch: 17 }, // L Retail
    { wch: 17 }, // M Daily min
  ];
  ws['!rows'] = [
    { hpt: 32 }, // row 1 title
    { hpt: 4  }, // spacer
    { hpt: 18 }, // info rows
    { hpt: 18 },
    { hpt: 18 },
    { hpt: 4  }, // spacer
    { hpt: 24 }, // column headers
  ];

  // ── Apply styles ───────────────────────────────────────────────────────────
  const range = XLSX.utils.decode_range(ws['!ref']!);

  // Helper: ensure a cell object exists before setting .s
  const ensure = (r: number, c: number) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
    return ref;
  };

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const ref = ensure(R, C);

      // ── Title row (R=0) ────────────────────────────────────────────────
      if (R === 0) {
        ws[ref].s = C === 1
          ? cs(BRAND.BLACK, BRAND.GOLD, 16, true,  'left',   {})
          : cs(BRAND.BLACK, BRAND.GOLD,  9, false, 'left',   {});
        continue;
      }

      // ── Spacer rows (R=1, R=5) ─────────────────────────────────────────
      if (R === 1 || R === 5) {
        ws[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 4, false, 'left', {});
        continue;
      }

      // ── Info block (R=2,3,4) ───────────────────────────────────────────
      if (R >= 2 && R <= 4) {
        ws[ref].s = C === 0
          ? cs('F5EDD0', BRAND.GOLD_DARK, 10, true,  'left', BORDER_THIN(BRAND.GOLD))
          : cs('FAFAFA', BRAND.BLACK,     10, false, 'left', BORDER_THIN('DDDDDD'));
        continue;
      }

      // ── Column header row (R=6) ────────────────────────────────────────
      if (R === 6) {
        const isDayCol = C >= 3 && C <= 9;
        ws[ref].s = isDayCol
          ? cs(BRAND.GOLD,  BRAND.BLACK,  10, true, 'center', BORDER_THIN('888888'))
          : cs(BRAND.BLACK, BRAND.WHITE,  10, true, 'center', BORDER_THIN('444444'));
        continue;
      }

      // ── Product rows (R >= HEADER_ROWS) ────────────────────────────────
      if (R >= HEADER_ROWS) {
        // Determine which colour slot this row belongs to by scanning
        // backwards for the most recent non-empty category cell in col A
        let slot = 0;
        let colorCount = 0;
        for (let rr = HEADER_ROWS; rr <= R; rr++) {
          const aRef = XLSX.utils.encode_cell({ r: rr, c: 0 });
          if (ws[aRef]?.v && ws[aRef].v !== '') {
            slot = colorCount % DELIGHT_PALETTE.length;
            colorCount++;
          }
        }

        const pal = DELIGHT_PALETTE[slot];
        // Teal (slot 4) has a dark header — use white text there
        const headerTextColor = slot === 4 ? 'FFFFFF' : '1A1A1A';

        if (C === 0) {
          // Category label cell — darker shade, bold, vertically centered
          ws[ref].s = cs(pal.header, headerTextColor, 11, true, 'center',
            BORDER_THIN(pal.header), { alignment: { vertical: 'center', horizontal: 'center', wrapText: true } });
        } else if (C >= 3 && C <= 9) {
          // Day input cells — white background so they stand out as fillable
          ws[ref].s = cs('FFFFFF', '444444', 11, false, 'center', BORDER_THIN(pal.header));
        } else if (C === 10) {
          // TOTAL formula cell — row colour, bold
          ws[ref].s = cs(pal.row, '1A1A1A', 11, true, 'center', BORDER_THIN(pal.header));
        } else if (C === 1) {
          // Product name — left aligned
          ws[ref].s = cs(pal.row, '1A1A1A', 11, false, 'left', BORDER_THIN(pal.header));
        } else {
          // Price / retail / min — centered
          ws[ref].s = cs(pal.row, '333333', 10, false, 'center', BORDER_THIN(pal.header));
        }
      }
    }
  }

  const sheetName = new Date().toISOString().slice(0, 7).replace('-', ''); // e.g. "202404"
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // cellStyles: true is REQUIRED — without it SheetJS silently drops all .s objects
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
