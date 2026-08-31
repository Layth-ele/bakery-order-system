import type { Order, Product, Category } from '../types';
import { getSettings } from './data/settingsDataService';
import { toDate } from '../utils/timestampFormatting';
import { toast } from 'sonner';
import { getServerTimestamp } from '../utils/timestamps';
import { displayOrderNumber } from '../utils/displayId';
import { logger } from '../utils/logger';

// FIX T2R3-C5 (CRITICAL — silent failure): These functions previously logged
// "email sent" via toast even though no email was ever sent — this file is a
// MOCK that pretends to send mail. In production that meant: admin clicks
// "Send Reminder" → toast says "Sent to customer@x.com" → customer receives
// nothing → admin assumes communication happened. For collections this is a
// significant business-impact bug (and for the "order updated" notification,
// a customer-relations bug).
//
// The honest fix is to integrate a real provider (SendGrid / SES / Postmark)
// via a Cloud Function. Until then we no longer claim success — toasts now
// say "queued (no email provider configured)" and dev mode emits a console
// warning so the gap is visible during development.
//
// Also fixes T2R3-C1: prior version hardcoded "Delight Bakehouse" in subject
// lines and signatures; now reads from settings with generic placeholder.
//
// The mock log in localStorage (sentEmails array) was also broken before:
// the array was mutated locally but never written back via setItem. Now it's
// actually persisted so admins can audit what would have been sent.
const EMAIL_PROVIDER_NOT_CONFIGURED_WARNING =
  '⚠️ [emailService] No email provider is configured. Mail is NOT being sent. ' +
  'Wire up SendGrid/SES/Postmark via a Cloud Function to enable real email delivery.';

// Safe localStorage JSON parse helper
function safeParseJSON<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch { return defaultValue; }
}

function persistMockEmail(entry: Record<string, unknown>): void {
  // Persist to localStorage so admin can audit what would have been sent.
  // Bounded at 200 entries to prevent unbounded growth.
  try {
    const log = safeParseJSON<any[]>('bakery_sent_emails', []);
    log.push(entry);
    while (log.length > 200) log.shift();
    localStorage.setItem('bakery_sent_emails', JSON.stringify(log));
  } catch (err) {
    logger.warn('[emailService] Could not persist mock email entry:', err);
  }
}

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

async function resolveBizName(): Promise<string> {
  try {
    const settings = await getSettings();
    if (settings?.businessName) return settings.businessName;
  } catch { /* keep fallback */ }
  return 'Your Bakery';
}

export async function sendPaymentReminderEmail(
  order: Order,
  customerEmail: string,
  reminderNumber: number
): Promise<void> {
  const bizName = await resolveBizName();
  const emailBody = await generatePaymentReminderEmailBody(order, reminderNumber);

  const emailData: EmailData = {
    to: customerEmail,
    subject: `Payment Reminder #${reminderNumber} - Order ${displayOrderNumber(order)} - ${bizName}`,
    body: emailBody,
  };

  // FIX T2R3-C5: surface the mock-provider state honestly to admin.
  if (import.meta.env?.DEV) logger.warn(EMAIL_PROVIDER_NOT_CONFIGURED_WARNING);
  toast.warning('Payment reminder queued (no email provider configured)', {
    description: `Order ${displayOrderNumber(order)} — Reminder #${reminderNumber}. ` +
      `Configure an email provider to actually send. Recipient: ${customerEmail}`,
    duration: 6000,
  });

  persistMockEmail({
    ...emailData,
    sentAt: getServerTimestamp() as any,
    orderId: order.id || '',
    type: 'payment-reminder',
    reminderNumber,
    delivered: false,
  });
}

async function generatePaymentReminderEmailBody(
  order: Order,
  reminderNumber: number
): Promise<string> {
  const approvedDate = order.approvedAt
    ? (toDate(order.approvedAt) ?? new Date()).toLocaleDateString()
    : 'N/A';

  // FIX T2R3-C1: Defaults are generic placeholders.  Real values come from
  // Firestore settings.
  let bizEmail = 'orders@example.com';
  let bizAddress = '123 Example St, City, BC V0V 0V0';
  let bizName = 'Your Bakery';
  try {
    const settings = await getSettings();
    if (settings?.businessEmail) bizEmail = settings.businessEmail;
    if (settings?.businessLocation) bizAddress = settings.businessLocation.split('\n')[0];
    if (settings?.businessName) bizName = settings.businessName;
  } catch { /* use defaults */ }

  return `
Dear ${order.customerContactPerson},

This is payment reminder #${reminderNumber} for your unpaid order.

ORDER DETAILS:
--------------
Order Ref: ${displayOrderNumber(order)}
Store: ${order.customerName}
Week: ${order.week} (${order.weekRange})
Status: APPROVED - AWAITING PAYMENT
Approved Date: ${approvedDate}

AMOUNT DUE:
-----------
Subtotal: $${order.subtotal.toFixed(2)}
GST (5%): $${order.gst.toFixed(2)}
Service Charge: $${order.serviceCharge.toFixed(2)}
Delivery Fee: $${order.deliveryFee.toFixed(2)}
${order.discount ? `Discount: -$${order.discount.toFixed(2)}` : ''}

TOTAL AMOUNT DUE: $${order.total.toFixed(2)}

PAYMENT INSTRUCTIONS:
---------------------
Please make payment as soon as possible to avoid any delays.

Payment can be made via:
• E-transfer to: ${bizEmail}
• Cheque mailed to: ${bizAddress}

If you have already made payment, please disregard this reminder.

If you have any questions, please contact us immediately.

Thank you for your business!

Best regards,
${bizName}
${bizEmail}
`;
}

export async function sendOrderUpdateEmail(
  order: Order,
  customerEmail: string,
  products: Product[],
  categories: Category[]
): Promise<void> {
  const bizName = await resolveBizName();
  const emailBody = generateOrderUpdateEmailBody(order, products, categories, bizName);

  const emailData: EmailData = {
    to: customerEmail,
    subject: `Your ${bizName} Order ${displayOrderNumber(order)} Has Been Updated`,
    body: emailBody,
  };

  // FIX T2R3-C5: surface the mock-provider state honestly.
  if (import.meta.env?.DEV) logger.warn(EMAIL_PROVIDER_NOT_CONFIGURED_WARNING);
  toast.warning('Order update queued (no email provider configured)', {
    description: `Order ${displayOrderNumber(order)} update notification. ` +
      `Configure an email provider to actually send. Recipient: ${customerEmail}`,
    duration: 6000,
  });

  persistMockEmail({
    ...emailData,
    sentAt: getServerTimestamp() as any,
    orderId: order.id || '',
    type: 'order-update',
    delivered: false,
  });
}

function generateOrderUpdateEmailBody(
  order: Order,
  products: Product[],
  categories: Category[],
  bizName: string
): string {
  const itemsText = order.items
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const categoryName = product
        ? categories.find((c) => c.id === product.categoryId)?.name
        : 'Unknown';

      return `
- ${item.productName} (${categoryName})
  Price: $${item.price.toFixed(2)}
  Mon: ${item.monday} | Tue: ${item.tuesday} | Wed: ${item.wednesday} | Thu: ${item.thursday}
  Fri: ${item.friday} | Sat: ${item.saturday} | Sun: ${item.sunday}
  Total: ${item.total} units = $${(item.total * item.price).toFixed(2)}
`;
    })
    .join('\n');

  return `
Dear ${order.customerContactPerson},

Your order has been successfully updated by our team.

ORDER DETAILS:
--------------
Order Ref: ${displayOrderNumber(order)}
Store: ${order.customerName}
Week: ${order.week} (${order.weekRange})
Status: ${order.status.toUpperCase()}

ITEMS:
${itemsText}

SUMMARY:
--------
Subtotal: $${order.subtotal.toFixed(2)}
Delivery Fee: $${order.deliveryFee.toFixed(2)}
TOTAL: $${order.total.toFixed(2)}

${order.note ? `\nNOTE: ${order.note}\n` : ''}

If you have any questions about this update, please contact us.

Thank you for your business!

Best regards,
${bizName} Team
`;
}
