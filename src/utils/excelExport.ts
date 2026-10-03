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
import { orderRevenue } from './orderMoney';
import { changeNotices, documentDays, documentLines, documentTotals, noticeDate, type OrderChange } from './documents/orderDocument';
import { fetchOrderChanges } from './documents/orderChanges';
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
const CURRENCY_FMT = '"$"#,##0.00';

// ─── Single order export ───────────────────────────────────────────────────────
// Same content as the PDF and on-screen invoice (utils/documents/orderDocument):
// only the delivery days that have quantities, prices as charged, the same
// totals rows, and "Changes to this order".
export function exportOrderToExcel(
  order: Order,
  products: Product[],
  categories: Category[],
  changes: OrderChange[] = [],
): Blob | undefined {
  if (!order?.items?.length) {
    logger.warn('[excelExport] exportOrderToExcel called with no items');
    return;
  }
  const days = documentDays(order as any);
  const lines = documentLines(order as any, products, categories);
  const totals = documentTotals(order as any);
  const notices = changeNotices(order as any, changes);

  // Columns: Category | Product | <days> | Qty | Price | Amount
  const C_DAY0 = 2;
  const C_QTY = C_DAY0 + days.length;
  const C_PRICE = C_QTY + 1;
  const C_AMT = C_QTY + 2;
  const LAST = C_AMT;
  const blank = () => new Array(LAST + 1).fill('');
  const row = (cells: Record<number, any>) => { const r = blank(); for (const [c, v] of Object.entries(cells)) r[+c] = v; return r; };

  const orderDate = order.createdAt ? toDate(order.createdAt)?.toLocaleDateString('en-CA') ?? '' : '';
  const weekLabel = order.week ? `Week ${order.week}, ${(order as any).year ?? ''}${days[0]?.date ? ` (${days.map((d) => `${d.short} ${d.date}`).join(', ')})` : ''}` : '—';

  const data: any[][] = [];
  const kinds: string[] = []; // style per row
  const push = (r: any[], kind: string) => { data.push(r); kinds.push(kind); };

  push(row({ 0: `${order.customerName || 'Order'} — ${safeOrderNum(order)}` }), 'title');
  push(blank(), 'spacer');
  push(row({ 0: 'Business / Store', 2: order.customerName || '' }), 'info');
  push(row({ 0: 'Contact', 2: order.customerContactPerson || '' }), 'info');
  push(row({ 0: 'Order #', 2: safeOrderNum(order) }), 'info');
  push(row({ 0: 'Invoice #', 2: safeInvNum(order) }), 'info');
  push(row({ 0: 'Delivery', 2: weekLabel }), 'info');
  push(row({ 0: 'Order date', 2: orderDate }), 'info');
  const STATUS_LABEL: Record<string, string> = {
    pending: 'PENDING REVIEW', approved: 'APPROVED · PAYMENT DUE', in_process: 'PAID · IN PRODUCTION',
    completed: 'COMPLETED · PAID', cancelled: 'CANCELLED', rejected: 'NOT ACCEPTED',
  };
  push(row({ 0: 'Status', 2: STATUS_LABEL[order.status] ?? (order.status || '').toUpperCase() }), 'status');
  push(blank(), 'spacer');

  const header = row({ 0: 'Category', 1: 'Product', [C_QTY]: 'Qty', [C_PRICE]: 'Price', [C_AMT]: 'Amount' });
  const dates = blank();
  days.forEach((d, i) => { header[C_DAY0 + i] = d.short; dates[C_DAY0 + i] = d.date; });
  push(header, 'head');
  push(dates, 'dates');

  const catColour = new Map<string, [string, string, string]>();
  let lastCat = '';
  for (const l of lines) {
    if (!catColour.has(l.categoryName)) catColour.set(l.categoryName, CAT_PALETTE[catColour.size % CAT_PALETTE.length]);
    const r = row({ 0: l.categoryName !== lastCat ? l.categoryName : '', 1: l.name, [C_QTY]: l.total, [C_PRICE]: l.price, [C_AMT]: l.amount });
    days.forEach((d, i) => { r[C_DAY0 + i] = l.qty[d.key] || ''; });
    lastCat = l.categoryName;
    push(r, `line:${l.categoryName}`);
  }
  const totalRow = row({ 1: 'TOTAL', [C_QTY]: lines.reduce((s, l) => s + l.total, 0), [C_AMT]: lines.reduce((s, l) => s + l.amount, 0) });
  days.forEach((d, i) => { totalRow[C_DAY0 + i] = lines.reduce((s, l) => s + l.qty[d.key], 0) || ''; });
  push(totalRow, 'grand');
  push(blank(), 'spacer');

  for (const t of totals) push(row({ [C_PRICE - 1 >= 1 ? C_PRICE - 1 : 1]: t.label, [C_AMT]: t.amount }), `total:${t.kind}`);

  if (notices.length) {
    push(blank(), 'spacer');
    push(row({ 0: 'CHANGES TO THIS ORDER' }), 'section');
    for (const n of notices) push(row({ 0: noticeDate(n.at), 1: `${n.title} — ${n.detail}` }), 'notice');
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 18 }, { wch: 34 },
    ...days.map(() => ({ wch: 9 })),
    { wch: 8 }, { wch: 11 }, { wch: 12 },
  ];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const statusBg = STATUS_COLOUR[order.status] || 'FAFAFA';
  const statusFg = STATUS_TEXT[order.status] || BRAND.BLACK;
  for (let R = range.s.r; R <= range.e.r; R++) {
    const kind = kinds[R] ?? '';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      const money = C === C_PRICE || C === C_AMT;
      if (kind === 'title') { ws[ref].s = cs(BRAND.BLACK, BRAND.GOLD, 15, true, 'left', {}); continue; }
      if (kind === 'spacer') { ws[ref].s = cs(BRAND.WHITE, BRAND.WHITE, 5, false, 'left', {}); continue; }
      if (kind === 'info' || kind === 'status') {
        ws[ref].s = C < 2
          ? cs('F5EDD0', BRAND.GOLD_DARK, 9, true, 'left', BORDER_THIN(BRAND.GOLD))
          : kind === 'status' ? cs(statusBg, statusFg, 10, true, 'left', BORDER_THIN(statusFg))
          : cs('FAFAFA', BRAND.BLACK, 10, false, 'left', BORDER_THIN('DDDDDD'));
        continue;
      }
      if (kind === 'head') {
        const isDay = C >= C_DAY0 && C < C_QTY;
        ws[ref].s = isDay ? cs(BRAND.GOLD, BRAND.BLACK, 10, true, 'center', BORDER_THIN('888888'))
          : cs(BRAND.BLACK, BRAND.WHITE, 10, true, C <= 1 ? 'left' : 'center', BORDER_THIN('444444'));
        continue;
      }
      if (kind === 'dates') { ws[ref].s = cs('F5EDD0', '555555', 9, false, 'center', BORDER_THIN(BRAND.GOLD)); continue; }
      if (kind.startsWith('line:')) {
        const [hdrBg, dataBg, accent] = catColour.get(kind.slice(5)) ?? CAT_PALETTE[0];
        const isDay = C >= C_DAY0 && C < C_QTY;
        const hasVal = !!data[R]?.[C];
        ws[ref].s = C === 0 ? cs(hasVal ? hdrBg : dataBg, BRAND.WHITE, 9, true, 'left', BORDER_THIN(accent))
          : C === 1 ? cs(dataBg, BRAND.BLACK, 10, false, 'left', BORDER_THIN(accent))
          : isDay ? cs(hasVal ? dataBg : 'F8F8F8', hasVal ? hdrBg : 'BBBBBB', hasVal ? 11 : 9, hasVal, 'center', BORDER_THIN(accent))
          : C === C_QTY ? cs('F5EDD0', BRAND.GOLD_DARK, 11, true, 'center', BORDER_THIN(BRAND.GOLD))
          : cs(dataBg, '333333', 10, C === C_AMT, 'right', BORDER_THIN(accent));
        if (money && typeof ws[ref].v === 'number') ws[ref].z = CURRENCY_FMT;
        continue;
      }
      if (kind === 'grand') {
        ws[ref].s = cs(BRAND.BLACK, BRAND.GOLD, 11, true, C <= 1 ? 'left' : 'center', BORDER_MEDIUM(BRAND.GOLD));
        if (money && typeof ws[ref].v === 'number') ws[ref].z = CURRENCY_FMT;
        continue;
      }
      if (kind.startsWith('total:')) {
        const t = kind.slice(6);
        const strong = t === 'total' || t === 'due' || t === 'paid';
        ws[ref].s = data[R][C] === ''
          ? cs(BRAND.WHITE, BRAND.WHITE, 9, false, 'left', {})
          : cs(strong ? BRAND.BLACK : 'FAFAFA', strong ? BRAND.GOLD : (t === 'discount' || t === 'credit' ? '15803D' : '333333'), strong ? 12 : 10, strong, C === C_AMT ? 'right' : 'right', BORDER_THIN('DDDDDD'));
        if (C === C_AMT && typeof ws[ref].v === 'number') ws[ref].z = CURRENCY_FMT;
        continue;
      }
      if (kind === 'section') { ws[ref].s = cs('E8F4FD', '1565C0', 10, true, 'left', BORDER_THIN('1565C0')); continue; }
      if (kind === 'notice') {
        ws[ref].s = C === 0 ? cs('F9F9F9', '555555', 9, false, 'left', BORDER_THIN('DDDDDD'))
          : cs(BRAND.WHITE, BRAND.BLACK, 10, false, 'left', { ...BORDER_THIN('DDDDDD') });
        if (C === 1) ws[ref].s.alignment = { ...(ws[ref].s.alignment || {}), wrapText: true, vertical: 'top' };
        continue;
      }
    }
  }
  const merges: XLSX.Range[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: LAST } }];
  kinds.forEach((k, r) => {
    if (k === 'info' || k === 'status') { merges.push({ s: { r, c: 0 }, e: { r, c: 1 } }, { s: { r, c: 2 }, e: { r, c: LAST } }); }
    if (k === 'section') merges.push({ s: { r, c: 0 }, e: { r, c: LAST } });
    if (k === 'notice') merges.push({ s: { r, c: 1 }, e: { r, c: LAST } });
  });
  ws['!merges'] = merges;
  ws['!rows'] = kinds.map((k) => (k === 'notice' ? { hpt: 30 } : k === 'title' ? { hpt: 28 } : k === 'spacer' ? { hpt: 6 } : { hpt: 18 }));
  // Print setup: landscape, fit to one page wide (shareable / printable).
  (ws as any)['!pageSetup'] = { orientation: days.length > 4 ? 'landscape' : 'portrait', fitToWidth: 1, fitToHeight: 0 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice');

  // Category summary (real amounts at the charged prices)
  const byCat = new Map<string, { units: number; amount: number }>();
  for (const l of lines) {
    const c = byCat.get(l.categoryName) ?? { units: 0, amount: 0 };
    c.units += l.total; c.amount += l.amount; byCat.set(l.categoryName, c);
  }
  const sumData: any[][] = [[`${order.customerName || 'Order'} — Category Summary`], [], ['Category', 'Units', 'Amount']];
  for (const [name, v] of byCat) sumData.push([name, v.units, Math.round(v.amount * 100) / 100]);
  sumData.push(['TOTAL', lines.reduce((s, l) => s + l.total, 0), Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100]);
  const ws2 = XLSX.utils.aoa_to_sheet(sumData);
  ws2['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 14 }];
  const r2 = XLSX.utils.decode_range(ws2['!ref'] || 'A1:C1');
  for (let R = r2.s.r; R <= r2.e.r; R++) {
    for (let C = r2.s.c; C <= r2.e.c; C++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws2[ref]) ws2[ref] = { t: 's', v: '' };
      const last = R === r2.e.r;
      ws2[ref].s = R === 0 ? cs(BRAND.BLACK, BRAND.GOLD, 14, true, 'left', {})
        : R === 1 ? cs(BRAND.WHITE, BRAND.WHITE, 5, false, 'left', {})
        : R === 2 || last ? cs(BRAND.BLACK, last ? BRAND.GOLD : BRAND.WHITE, 10, true, C === 0 ? 'left' : 'center', BORDER_THIN('444444'))
        : cs('FAFAFA', BRAND.BLACK, 10, false, C === 0 ? 'left' : 'center', BORDER_THIN('DDDDDD'));
      if (C === 2 && typeof ws2[ref].v === 'number') ws2[ref].z = CURRENCY_FMT;
    }
  }
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Category Summary');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** exportOrderToExcel with the order's change history loaded first. */
export async function exportOrderToExcelWithChanges(order: Order, products: Product[], categories: Category[]): Promise<Blob | undefined> {
  return exportOrderToExcel(order, products, categories, await fetchOrderChanges(order as any));
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
  // Revenue: sales (approved, paid, completed) + fees kept on cancellations.
  const totalRevenue = validOrders.reduce((s, o) => s + orderRevenue(o as any), 0);
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
