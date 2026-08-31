/**
 * PDF Template Builder — Luxury A4 Format
 * Assembles all components into complete, print-ready HTML documents.
 * Functionality unchanged from original.
 */

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
  generateStatusBadge,
  generateStatusNotice,
} from "./pdfComponents";

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
    status: documentType,
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

  const totals = {
    subtotal: order.subtotal || 0,
    discount: order.discount,
    discountPercentage: order.discountPercentage,
    deliveryFee: order.deliveryFee,
    serviceCharge: order.serviceCharge,
    gst: order.gst || 0,
    total:
      documentType === "rejected"
        ? 0
        : documentType === "cancelled"
          ? order.cancellationFee || 0
          : order.total || 0,
    cancellationFee: order.cancellationFee,
    creditApplied: (order as any).creditApplied || 0,
    // ✅ Compute amountDue if not stored: total - credit
    amountDue: (order as any).amountDue ??
      (((order as any).creditApplied ?? 0) > 0
        ? Math.max(0, (order.total || 0) - ((order as any).creditApplied || 0))
        : undefined),
    invoiceNumber: (() => {
      const isUID = (s?: string) => !!s && s.length >= 16 && !(/^[A-Z]{2,}-\d{4}-/.test(s)) && (s.match(/-/g) || []).length === 0;
      if (order.invoiceNumber && !isUID(order.invoiceNumber)) return order.invoiceNumber;
      if (order.orderNumber && !isUID(order.orderNumber)) return order.orderNumber;
      return undefined;
    })(),
  };

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
  ${generateStatusBadge(documentType)}
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
  ${showPrices ? generateTotals(totals) : ""}
  ${documentType === 'production'
      ? generateStatusNotice('info', '📋 Internal Production Copy', 'For bakery use only — do not share with customers.')
      : documentType === 'completed'
      ? generateStatusNotice('success', '✅ Order Completed', 'This order has been fulfilled and payment received.')
      : ''}
  ${showPaymentInfo && documentType === "approved" ? generatePaymentMethods(settings) : ""}
  ${showTerms && documentType === "approved" ? generateTerms(settings) : ""}
  ${generateFooter((companyInfo.name ?? ""))}
</body>
</html>`;
};

/** Open PDF in a new window and trigger the print dialog */
export const openPDFWindow = (htmlContent: string): void => {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups to generate PDFs.");
    return;
  }
  win.document.write(htmlContent);
  win.document.close();
  win.onload = () =>
    setTimeout(() => {
      win.focus();
      win.print();
    }, 250);
};