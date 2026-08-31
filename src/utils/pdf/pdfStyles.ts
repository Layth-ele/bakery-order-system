/**
 * PDF Styles — Luxury A4 Format  v2.0
 * Premium print-ready CSS for all Delight Bakehouse documents.
 * Consistent brand identity across every document type.
 */

export const BRAND = {
  gold:       '#D4A574',
  goldDark:   '#8B6F47',
  goldLight:  '#F5E6D0',
  goldXlight: '#FBF5EC',
  black:      '#1A1A1A',
  darkGray:   '#3D3D3D',
  midGray:    '#6B6B6B',
  lightGray:  '#E8E8E8',
  white:      '#FFFFFF',
  cream:      '#FDFAF6',
  // Status
  green:      '#2D7A3A',
  greenLight: '#EBF5ED',
  red:        '#C0392B',
  redLight:   '#FDECEA',
  blue:       '#1E5FA8',
  blueLight:  '#EAF1FB',
  orange:     '#C86400',
  orangeLight:'#FEF0E0',
};

export const getPDFStyles = () => `
  /* ── Page Setup ─────────────────────────────────────────────── */
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 16mm 14mm;
  }

  @media print {
    html, body {
      width: 210mm;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      font-size: 9pt !important;
    }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; break-before: page; }

    .doc-header, .section-title, .category-block-header,
    .totals-section, .info-grid { break-inside: avoid; page-break-inside: avoid; }

    table { page-break-inside: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr    { break-inside: avoid; page-break-inside: avoid; }

    .order-table td, .order-table th { padding: 4px 6px !important; }
  }

  /* ── Reset ───────────────────────────────────────────────────── */
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── Typography ──────────────────────────────────────────────── */
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    color: ${BRAND.darkGray};
    background: ${BRAND.white};
    line-height: 1.45;
  }

  h1 { font-size: 20pt; font-weight: 800; color: ${BRAND.black}; letter-spacing: -0.5px; }
  h2 { font-size: 13pt; font-weight: 700; color: ${BRAND.black}; }
  h3 { font-size: 10pt; font-weight: 600; color: ${BRAND.darkGray}; }

  /* ── Document wrapper ────────────────────────────────────────── */
  .invoice-container {
    max-width: 182mm;
    margin: 0 auto;
    background: ${BRAND.white};
    padding: 0;
  }

  /* ── Header ──────────────────────────────────────────────────── */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 0 14px;
    border-bottom: 3px solid ${BRAND.gold};
    margin-bottom: 16px;
    gap: 20px;
  }
  .company-block h1 {
    font-size: 18pt;
    color: ${BRAND.black};
    margin-bottom: 3px;
  }
  .company-block .tagline {
    font-size: 8pt;
    color: ${BRAND.midGray};
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .company-block .contact-line {
    font-size: 8pt;
    color: ${BRAND.midGray};
    margin-top: 5px;
    line-height: 1.6;
  }
  .doc-meta {
    text-align: right;
    flex-shrink: 0;
  }
  .doc-meta .doc-type {
    font-size: 14pt;
    font-weight: 700;
    color: ${BRAND.black};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .doc-meta .doc-number {
    font-size: 10pt;
    font-weight: 600;
    color: ${BRAND.gold};
    margin-bottom: 2px;
  }
  .doc-meta .doc-date {
    font-size: 8pt;
    color: ${BRAND.midGray};
  }
  .doc-meta .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 6px;
  }
  .status-approved  { background: ${BRAND.blueLight};   color: ${BRAND.blue};   }
  .status-completed { background: ${BRAND.greenLight};  color: ${BRAND.green};  }
  .status-rejected  { background: ${BRAND.redLight};    color: ${BRAND.red};    }
  .status-cancelled { background: ${BRAND.redLight};    color: ${BRAND.red};    }
  .status-pending   { background: ${BRAND.orangeLight}; color: ${BRAND.orange}; }
  .status-production{ background: ${BRAND.goldLight};   color: ${BRAND.goldDark}; }

  /* ── Gold accent divider ─────────────────────────────────────── */
  .gold-bar {
    height: 2px;
    background: linear-gradient(90deg, ${BRAND.gold} 0%, ${BRAND.goldLight} 100%);
    margin: 10px 0;
    border-radius: 2px;
  }

  /* ── Info grid (customer + order details) ────────────────────── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;
  }
  .info-box {
    background: ${BRAND.cream};
    border: 1px solid ${BRAND.goldLight};
    border-radius: 6px;
    padding: 10px 12px;
  }
  .info-box .box-label {
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${BRAND.gold};
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid ${BRAND.goldLight};
  }
  .info-row {
    display: flex;
    gap: 6px;
    margin-bottom: 3px;
    font-size: 8.5pt;
  }
  .info-row .info-key {
    color: ${BRAND.midGray};
    font-weight: 500;
    min-width: 70px;
    flex-shrink: 0;
  }
  .info-row .info-val {
    color: ${BRAND.black};
    font-weight: 600;
  }

  /* ── Section titles ──────────────────────────────────────────── */
  .section-title {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: ${BRAND.goldDark};
    padding: 6px 0 4px;
    border-bottom: 1.5px solid ${BRAND.goldLight};
    margin: 12px 0 8px;
  }

  /* ── Order table ─────────────────────────────────────────────── */
  .order-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8.5pt;
    margin-bottom: 12px;
  }
  .order-table thead tr {
    background: ${BRAND.black};
    color: ${BRAND.white};
  }
  .order-table thead th {
    padding: 7px 6px;
    text-align: center;
    font-size: 7.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border: none;
  }
  .order-table thead th:first-child { text-align: left; }
  .order-table thead th.day-header {
    background: ${BRAND.gold};
    color: ${BRAND.black};
  }

  /* Date sub-row */
  .order-table .date-row td {
    background: ${BRAND.goldXlight};
    font-size: 7pt;
    color: ${BRAND.goldDark};
    text-align: center;
    padding: 3px 4px;
    border-bottom: 1px solid ${BRAND.goldLight};
    font-weight: 500;
  }

  /* Category header rows */
  .order-table .cat-header td {
    background: ${BRAND.black};
    color: ${BRAND.gold};
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 5px 8px;
  }

  /* Product rows */
  .order-table .product-row td {
    padding: 5px 6px;
    border-bottom: 1px solid ${BRAND.lightGray};
    vertical-align: middle;
  }
  .order-table .product-row:nth-child(even) td { background: ${BRAND.cream}; }
  .order-table .product-row:hover td { background: ${BRAND.goldXlight}; }

  .order-table td.product-name { text-align: left; font-weight: 500; }
  .order-table td.qty-cell {
    text-align: center;
    font-weight: 700;
    color: ${BRAND.black};
  }
  .order-table td.qty-cell.has-qty {
    background: ${BRAND.goldXlight} !important;
    color: ${BRAND.goldDark};
    font-size: 10pt;
  }
  .order-table td.total-cell {
    text-align: right;
    font-weight: 700;
    color: ${BRAND.black};
  }
  .order-table td.price-cell {
    text-align: right;
    color: ${BRAND.midGray};
    font-size: 8pt;
  }

  /* ── Totals section ─────────────────────────────────────────── */
  .totals-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }
  .totals-box {
    min-width: 200px;
    border: 1.5px solid ${BRAND.goldLight};
    border-radius: 6px;
    overflow: hidden;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 12px;
    font-size: 8.5pt;
    border-bottom: 1px solid ${BRAND.lightGray};
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-row .t-label { color: ${BRAND.midGray}; }
  .totals-row .t-value { font-weight: 600; color: ${BRAND.black}; }
  .totals-row.grand-total {
    background: ${BRAND.black};
    padding: 8px 12px;
  }
  .totals-row.grand-total .t-label { color: ${BRAND.gold}; font-weight: 700; font-size: 9pt; }
  .totals-row.grand-total .t-value { color: ${BRAND.gold}; font-weight: 800; font-size: 11pt; }
  .totals-row.discount .t-value { color: ${BRAND.green}; }

  /* ── Payment info ───────────────────────────────────────────── */
  .payment-section {
    background: ${BRAND.cream};
    border: 1px solid ${BRAND.goldLight};
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .payment-method {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 8.5pt;
    margin-bottom: 4px;
  }
  .payment-method .pm-icon {
    width: 20px; height: 20px;
    background: ${BRAND.gold};
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    font-size: 10pt;
  }
  .payment-method .pm-name { font-weight: 600; }
  .payment-method .pm-detail { color: ${BRAND.midGray}; font-size: 8pt; }

  /* ── Alert/Notice blocks ─────────────────────────────────────── */
  .alert-block {
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 10px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 8.5pt;
  }
  .alert-block.info    { background: ${BRAND.blueLight};   border-left: 3px solid ${BRAND.blue};   color: ${BRAND.blue};   }
  .alert-block.warning { background: ${BRAND.orangeLight}; border-left: 3px solid ${BRAND.orange}; color: ${BRAND.orange}; }
  .alert-block.danger  { background: ${BRAND.redLight};    border-left: 3px solid ${BRAND.red};    color: ${BRAND.red};    }
  .alert-block.success { background: ${BRAND.greenLight};  border-left: 3px solid ${BRAND.green};  color: ${BRAND.green};  }
  .alert-block .alert-title { font-weight: 700; margin-bottom: 2px; }

  /* ── Terms ───────────────────────────────────────────────────── */
  .terms-section {
    border-top: 1px solid ${BRAND.lightGray};
    padding-top: 8px;
    margin-top: 10px;
    font-size: 7.5pt;
    color: ${BRAND.midGray};
    line-height: 1.5;
  }
  .terms-title {
    font-weight: 700;
    color: ${BRAND.darkGray};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 7pt;
    margin-bottom: 4px;
  }

  /* ── Footer ──────────────────────────────────────────────────── */
  .doc-footer {
    margin-top: 14px;
    padding-top: 8px;
    border-top: 2px solid ${BRAND.gold};
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 7.5pt;
    color: ${BRAND.midGray};
  }
  .doc-footer .footer-brand { font-weight: 700; color: ${BRAND.goldDark}; font-size: 8.5pt; }
  .doc-footer .footer-note { font-style: italic; }

  /* ── Print button ────────────────────────────────────────────── */
  .print-btn {
    display: block;
    margin: 20px auto 10px;
    padding: 10px 28px;
    background: ${BRAND.black};
    color: ${BRAND.gold};
    border: none;
    border-radius: 6px;
    font-size: 11pt;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.5px;
    transition: background 0.2s;
  }
  .print-btn:hover { background: ${BRAND.gold}; color: ${BRAND.black}; }
  @media print { .print-btn { display: none !important; } }

  /* ── Production sheet specifics ──────────────────────────────── */
  .production-day-header {
    background: ${BRAND.gold};
    color: ${BRAND.black};
    font-weight: 700;
    font-size: 9pt;
    padding: 6px 10px;
    border-radius: 4px;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .production-row td { padding: 4px 6px; font-size: 8.5pt; }
  .production-qty {
    background: ${BRAND.goldXlight};
    color: ${BRAND.goldDark};
    font-weight: 700;
    font-size: 10pt;
    text-align: center;
    border-radius: 3px;
    padding: 2px 6px;
  }

  /* ── Summary stats cards ─────────────────────────────────────── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .stat-card {
    background: ${BRAND.cream};
    border: 1px solid ${BRAND.goldLight};
    border-radius: 6px;
    padding: 8px 10px;
    text-align: center;
  }
  .stat-card .stat-value {
    font-size: 16pt;
    font-weight: 800;
    color: ${BRAND.black};
    line-height: 1;
  }
  .stat-card .stat-label {
    font-size: 7pt;
    color: ${BRAND.midGray};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 3px;
  }
  .stat-card.highlight {
    background: ${BRAND.black};
    border-color: ${BRAND.black};
  }
  .stat-card.highlight .stat-value { color: ${BRAND.gold}; }
  .stat-card.highlight .stat-label { color: ${BRAND.goldLight}; }
`;
