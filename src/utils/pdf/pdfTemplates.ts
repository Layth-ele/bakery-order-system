/**
 * Order documents (PDF). Layout: utils/pdf/invoiceDocument.
 */
import { buildInvoiceDocument } from './invoiceDocument';
import type { OrderChange } from '../documents/orderDocument';

interface PDFTemplateOptions {
  title: string;
  documentType:
    | "approved"
    | "completed"
    | "rejected"
    | "cancelled"
    | "update"
    | "production";
  order: any;
  customer?: any;
  products: any[];
  categories: any[];
  settings?: any;
  showPrices?: boolean;
  showPaymentInfo?: boolean;
  showTerms?: boolean;
  additionalSections?: string;
  /** Change history (orderEditHistory) — shown as "Changes to this order". */
  changes?: OrderChange[];
}

/** Build complete PDF HTML document */
export const buildPDFTemplate = (options: PDFTemplateOptions): string =>
  // One professional layout for every order document (utils/pdf/invoiceDocument).
  buildInvoiceDocument({
    order: options.order,
    products: options.products,
    categories: options.categories,
    settings: options.settings ?? {},
    changes: options.changes ?? [],
    kind: options.documentType === 'production' || options.showPrices === false ? 'production' : 'invoice',
  });

/**
 * Open the document window NOW (inside the tap, so phones don't block it),
 * then fill it when the content is ready. The page has a Print / Save as PDF
 * button and opens the print dialog (share sheet on phones) automatically.
 */
export const openPDFWindowAsync = (build: () => Promise<string> | string): void => {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups to generate PDFs.");
    return;
  }
  win.document.write('<!DOCTYPE html><title>Preparing…</title><p style="font-family:sans-serif;padding:24px;color:#8B6F47">Preparing your document…</p>');
  Promise.resolve()
    .then(build)
    .then((html) => {
      win.document.open();
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.focus(); win.print(); }, 400);
    })
    .catch(() => {
      win.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px;color:#b91c1c">Sorry — the document could not be created. Please try again.</p>';
    });
};

/** Open PDF in a new window and trigger the print dialog */
export const openPDFWindow = (htmlContent: string): void => openPDFWindowAsync(() => htmlContent);
