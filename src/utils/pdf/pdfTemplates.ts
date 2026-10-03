/**
 * PDF Template Builder — Luxury A4 Format
 * Assembles all components into complete, print-ready HTML documents.
 * Functionality unchanged from original.
 */

import { discountOn } from '../../functions/src/lib/orderRevision';
import { getPDFStyles } from "./pdfStyles";
import { toDate } from '../timestampFormatting';
import {
  generateHeader,
  generateCustomerSection,
  generateOrderTable,
  generateTotals,
  generateNotes,
  generateRejection,
  generateCancellation,
  generateUpdateRequest,
  generatePaymentMethods,
  generateTerms,
  generateFooter,
  generatePrintButton,
  generateStatusNotice,
  generateChangeNotices,
} from "./pdfComponents";
import { changeNotices, documentTotals, type OrderChange } from '../documents/orderDocument';

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
export const buildPDFTemplate = (
  options: PDFTemplateOptions,
): string => {
  const {
    title,
    documentType,
    order,
    customer,
    products,
    categories,
    settings = {},
    showPrices = true,
    showPaymentInfo = false,
    showTerms = false,
    additionalSections = "",
    changes = [],
  } = options;

  const companyInfo = {
    name:      settings.companyName    || "Your Bakery Name",
    address:   settings.companyAddress || "",
    phone:     settings.companyPhone   || "",
    email:     settings.companyEmail   || "",
    website:   settings.companyWebsite || "",
    gstNumber: settings.gstNumber      || settings.businessNumber || "",
    city:      settings.companyCity    || settings.businessCity   || "",
  };

  const createdDate = order.createdAt
    ? (typeof order.createdAt.toDate === 'function'
        ? order.createdAt.toDate()
        : new Date(order.createdAt))
    : new Date();
  const invoiceDate = createdDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const invoiceInfo = {
    title,
    number: (() => {
      const isUID = (s?: string) => !!s && s.length >= 16 && !(/^[A-Z]{2,}-\d{4}-/.test(s)) && (s.match(/-/g) || []).length === 0;
      if (order.orderNumber && !isUID(order.orderNumber)) return order.orderNumber;
      if (order.invoiceNumber && !isUID(order.invoiceNumber)) return order.invoiceNumber;
      return order.id ? `ORD-···${order.id.slice(-6).toUpperCase()}` : 'N/A';
    })(),
    orderId: order.id,
    date: invoiceDate,
    // Badge = the order's real state (an "approved" invoice may be paid by now).
    status:
      documentType === 'approved'
        ? order.paymentReceived === true ? 'paid' : order.paymentSubmitted === true ? 'review' : order.status === 'pending' ? 'pending' : 'approved'
        : documentType,
  };

  const customerInfo = customer
    ? {
        customerId: customer.customerId || "",
        customerCode: (customer as any).customerCode || undefined,
        name: customer.contactPerson || (customer.storeName ?? ""),
        email: (customer.email ?? ""),
        phone: (customer.phone ?? ""),
        address: customer.address,
        businessName: customer.businessName,
        customerType: customer.type,
      }
    : {
        customerId: "",
        name: order.customerName || order.customerEmail,
        email: order.customerEmail,
        phone: "",
        address: "",
      };

  const orderInfo = {
    orderId: order.id || "",
    orderNumber: order.orderNumber,
    invoiceNumber: order.invoiceNumber,
    weekNumber: order.week,
    year: order.year,
    weekRange: order.weekRange,
    deliveryDate: order.deliveryDate,
    deliveryTime: order.deliveryTime,
    deliveryFee: order.deliveryFee,
  };

  // Totals and change notices: the shared document description
  // (utils/documents/orderDocument) — identical in every format.
  const totalRows = documentTotals(order);
  const notices = documentType === 'production' ? [] : changeNotices(order, changes);

  const itemsWithWeekRange = order.items.map((item: Record<string, unknown>) => ({
    ...item,
    weekRange: order.weekRange,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title} ${invoiceInfo.number}</title>
  <style>${getPDFStyles()}</style>
</head>
<body>
  ${generatePrintButton()}
  ${generateHeader(companyInfo, invoiceInfo)}
  ${generateCustomerSection(customerInfo, orderInfo)}
  ${order.note ? generateNotes(order.note) : ""}
  ${
    documentType === "rejected" && order.rejectionReason
      ? generateRejection(order.rejectionReason)
      : ""
  }
  ${
    documentType === "cancelled" && order.cancellationReason
      ? generateCancellation(order.cancellationReason)
      : ""
  }
  ${
    documentType === "update" && order.updateDetails
      ? generateUpdateRequest(order.updateDetails)
      : ""
  }
  ${additionalSections}
  ${generateOrderTable(itemsWithWeekRange, products, categories, { showPrices, weekRange: order.weekRange, week: order.week, year: order.year })}
  ${showPrices ? generateTotals(totalRows) : ""}
  ${generateChangeNotices(notices)}
  ${documentType === 'production'
      ? generateStatusNotice('info', '📋 Internal Production Copy', 'For bakery use only — do not share with customers.')
      : documentType === 'completed'
      ? generateStatusNotice('success', '✅ Order Completed', 'This order has been fulfilled and payment received.')
      : ''}
  ${showPaymentInfo && documentType === "approved" && order.paymentReceived !== true ? generatePaymentMethods(settings) : ""}
  ${showTerms && documentType === "approved" ? generateTerms(settings) : ""}
  ${generateFooter((companyInfo.name ?? ""))}
</body>
</html>`;
};

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
