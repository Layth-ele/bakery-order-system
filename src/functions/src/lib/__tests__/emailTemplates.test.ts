/**
 * Unit tests for the pure email template modules (no Firebase).
 * Run with the root `npm test`.
 */
import { describe, it, expect } from 'vitest';
import { emailBrandFrom, esc, money, renderEmail, htmlToText, DEFAULT_BRAND_NAME } from '../emailLayout';
import {
  normalizeOrder,
  paymentInfoFrom,
  buildOrderStatusEmail,
  buildPaymentReminderEmail,
  buildOrderUpdatedEmail,
  buildPasswordResetEmail,
  buildTestEmail,
  isEmailedStatus,
  EMAILED_STATUSES,
} from '../emailContent';

const settings = {
  businessName: 'Maple Crumb Bakery',
  businessLocation: '42 Oven Lane, Vancouver, BC\nSuite 2',
  businessPhone: '604-555-0142',
  businessEmail: 'hello@maplecrumb.test',
  orderEmail: 'orders@maplecrumb.test',
  businessNumber: '123456789RT0001',
  paymentMethod1: 'E-transfer to pay@maplecrumb.test',
  paymentMethod2: 'Cheque on delivery',
  paymentAddress: '42 Oven Lane',
};
const brand = emailBrandFrom(settings, 'https://portal.maplecrumb.test/');
const pay = paymentInfoFrom(settings);

const rawOrder = {
  orderNumber: 'ORD-2026-09-28-001',
  customerName: 'Corner Café',
  customerContactPerson: 'Sam Lee',
  customerAddress: '9 Main St',
  week: 'Week 40',
  weekRange: 'Sep 28 – Oct 4',
  items: [
    { productName: 'Sourdough Loaf', price: 6.5, total: 10, monday: 4, wednesday: 6 },
    { productName: 'Croissant', price: 2.25, total: 24, friday: 24 },
  ],
  subtotal: 119,
  gst: 5.95,
  deliveryFee: 15,
  serviceCharge: 3.99,
  total: 143.94,
  status: 'approved',
};
const order = normalizeOrder(rawOrder, 'abcDEF123456');

describe('emailBrandFrom', () => {
  it('uses the bakery settings, first address line, and trims the portal URL', () => {
    expect(brand).toMatchObject({
      name: 'Maple Crumb Bakery',
      address: '42 Oven Lane, Vancouver, BC',
      email: 'orders@maplecrumb.test',
      website: 'https://portal.maplecrumb.test',
    });
  });

  it('falls back to a generic placeholder and rejects non-https URLs', () => {
    const b = emailBrandFrom({ emailLogoUrl: 'http://insecure.test/logo.png' }, 'http://x.test');
    expect(b.name).toBe(DEFAULT_BRAND_NAME);
    expect(b.logoUrl).toBe('');
    expect(b.website).toBe('');
  });
});

describe('helpers', () => {
  it('escapes HTML', () => {
    expect(esc('<script>"x"&\'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
  });

  it('formats money', () => {
    expect(money(1234.5)).toBe('$1,234.50');
    expect(money(-3)).toBe('-$3.00');
    expect(money(NaN)).toBe('$0.00');
  });
});

describe('normalizeOrder', () => {
  it('reads items with per-day breakdown and readable order number', () => {
    expect(order.number).toBe('ORD-2026-09-28-001');
    expect(order.items[0]).toEqual({ name: 'Sourdough Loaf', quantity: 10, price: 6.5, detail: 'Mon 4 · Wed 6' });
    expect(order.amountDue).toBe(143.94);
  });

  it('masks raw Firestore ids like the client does', () => {
    expect(normalizeOrder({}, 'abcDEF123456').number).toBe('ORD-···123456');
  });
});

describe('order status emails', () => {
  it('has a subject, html and text for every emailed status', () => {
    for (const status of EMAILED_STATUSES) {
      const e = buildOrderStatusEmail(status, order, brand, pay);
      expect(e.subject).toContain('ORD-2026-09-28-001');
      expect(e.subject).toContain('Maple Crumb Bakery');
      expect(e.html).toContain('<!DOCTYPE html>');
      expect(e.text.length).toBeGreaterThan(50);
      expect(e.html).not.toMatch(/ele\s*caf/i);
    }
  });

  it('only emails known statuses', () => {
    expect(isEmailedStatus('approved')).toBe(true);
    expect(isEmailedStatus('completed')).toBe(true);
    expect(isEmailedStatus('delivered')).toBe(false);
    expect(isEmailedStatus(undefined)).toBe(false);
  });

  it('approved email shows the amount due and payment instructions', () => {
    const e = buildOrderStatusEmail('approved', order, brand, pay);
    expect(e.subject).toContain('$143.94 due');
    expect(e.html).toContain('E-transfer to pay@maplecrumb.test');
    expect(e.html).toContain('https://portal.maplecrumb.test/customer');
  });

  it('rejected email includes the escaped reason', () => {
    const o = normalizeOrder({ ...rawOrder, rejectionReason: 'Past <b>cutoff</b>' }, 'x');
    const e = buildOrderStatusEmail('rejected', o, brand, pay);
    expect(e.html).toContain('Past &lt;b&gt;cutoff&lt;/b&gt;');
    expect(e.html).not.toContain('<b>cutoff</b>');
  });

  it('escapes customer-controlled fields', () => {
    const o = normalizeOrder({ ...rawOrder, customerName: '<img src=x onerror=alert(1)>' }, 'x');
    const e = buildOrderStatusEmail('pending', o, brand, pay);
    expect(e.html).not.toContain('<img src=x');
  });

  it('hides the portal button when APP_URL is not configured', () => {
    const noUrl = emailBrandFrom(settings, '');
    const e = buildOrderStatusEmail('completed', order, noUrl, pay);
    expect(e.html).not.toContain('View your orders');
  });
});

describe('other emails', () => {
  it('payment reminder numbers the reminder', () => {
    const e = buildPaymentReminderEmail(order, 3, brand, pay);
    expect(e.subject).toMatch(/^Payment reminder #3: order ORD-2026-09-28-001 — \$143\.94 due/);
    expect(e.html).toContain('Cheque on delivery');
  });

  it('order updated email lists the updated items', () => {
    const e = buildOrderUpdatedEmail(order, brand);
    expect(e.html).toContain('Sourdough Loaf');
    expect(e.html).toContain('Mon 4 · Wed 6');
  });

  it('password reset email contains the link and the recipient', () => {
    const link = 'https://portal.maplecrumb.test/reset-password?mode=resetPassword&oobCode=abc';
    const e = buildPasswordResetEmail(link, 'sam@corner.test', brand);
    expect(e.html).toContain(esc(link));
    expect(e.html).toContain('sam@corner.test');
    expect(e.text).toContain(link);
  });

  it('test email names the admin who sent it', () => {
    expect(buildTestEmail(brand, 'admin@maplecrumb.test').html).toContain('admin@maplecrumb.test');
  });
});

describe('renderEmail + htmlToText', () => {
  it('produces readable plain text without markup', () => {
    const html = renderEmail({ brand, preheader: 'pre', eyebrow: 'Eyebrow', title: 'Hello & welcome', body: ['<p>Body</p>'] });
    const text = htmlToText(html);
    expect(text).toContain('Hello & welcome');
    expect(text).toContain('Body');
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).not.toContain('@media');
  });
});
