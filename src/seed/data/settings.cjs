/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SETTINGS DATA — Aligned with settingsDataService.ts DEFAULT_SETTINGS
 * ✅ FIXED:
 *   - businessName matches app ("Delight Bakehouse")
 *   - adminEmail matches VITE_ADMIN_EMAIL default (admin@bakery.com)
 *   - freeDeliveryMin: 250 (matches app default)
 *   - deliveryFee: 50 (matches app default)
 *   - businessCity added (used by HomePage)
 * ═══════════════════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');

module.exports = {
  // ── Business info ───────────────────────────────────────────────────────
  businessName: 'Delight Bakehouse',                    // ✅ matches app
  businessCity: 'North Vancouver',
  businessLocation: '1185 16th St West, North Vancouver, BC V7P 1R4',
  businessPhone: '+1 (604) 985-0123',
  businessEmail: 'delightbakehouse@yahoo.com',
  adminEmail: 'admin@bakery.com',                       // ✅ matches VITE_ADMIN_EMAIL default
  orderEmail: 'delightbakehouse@yahoo.com',

  // ── Fees & rates ────────────────────────────────────────────────────────
  deliveryFee: 50.00,                                   // ✅ matches app DEFAULT_SETTINGS
  freeDeliveryMin: 250.00,                              // ✅ matches app DEFAULT_SETTINGS
  serviceChargeEnabled: true,
  serviceChargeAmount: 3.99,
  gstRate: 0.05,

  // ── Order rules ─────────────────────────────────────────────────────────
  cutoffTime: '12:00',
  timezone: 'America/Vancouver',
  minimumOrderAmount: 0,
  orderDeadline: '12:00 PM',
  dailyOrderDeadline: '12:00 PM (Vancouver Time)',
  weeklyOrderDeadline: 'Thursday 12:00 PM (Vancouver Time)',

  // ── Delivery ────────────────────────────────────────────────────────────
  deliveryDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  deliveryTimeInfo: 'Deliveries between 6:00 AM - 10:00 AM',

  // ── Payment methods ──────────────────────────────────────────────────────
  paymentMethod1: 'E-Transfer to delightbakehouse@yahoo.com',
  paymentMethod2: "Cheque payable to 'Delight Bakehouse'",
  paymentAddress: '1185 16th St West, North Vancouver, BC V7P 1R4',

  // ── Policy ──────────────────────────────────────────────────────────────
  cancellationPolicy: '24-hour notice required for cancellations',
  lateCancellationFee: '50% of order total',
  maxMonthlyCancellations: 3,

  // ── Timestamps (Firestore-compatible) ────────────────────────────────────
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};
