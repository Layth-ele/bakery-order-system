/**
 * Firestore Rules Test Suite — Pass 8
 *
 * Locks in the security guarantees established by Passes 1, 2, and 4:
 *   - C1: customers cannot mint credit by writing to creditNotes
 *   - C3: customers cannot tamper with order pricing
 *   - H1: rateLimits are bound to the caller's customerId
 *   - H2: idCounters can only be written by Cloud Functions
 *   - H4: customer-set invoiceNumber is forbidden
 *   - M2 (Pass 4): snapshot reads use denormalized customerId fast path
 *
 * Run with: npm run test:rules
 *
 * The Firebase emulator is required. The CI workflow handles this via
 * actions/setup-java + the firebase-tools `emulators:exec` runner.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, beforeAll, afterAll, beforeEach, test } from 'vitest';

// "demo-" ids never reach a real Firebase project; must match test:rules --project.
const PROJECT_ID = 'demo-bakery-rules';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rulesPath = resolve(__dirname, '../../../firestore.rules');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(rulesPath, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// Test fixtures: seed common docs via security-bypass
async function seedAdminAndCustomer() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('customers').doc('admin-uid').set({
      email: 'admin@example.com',
      customerType: 'admin',
      status: 'approved',
    });
    await db.collection('customers').doc('cust-uid').set({
      email: 'customer@example.com',
      customerType: 'commercial',
      status: 'approved',
      storeName: 'Test Store',
    });
    await db.collection('customers').doc('other-uid').set({
      email: 'other@example.com',
      customerType: 'commercial',
      status: 'approved',
      storeName: 'Other Store',
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// C1 — Credit notes: customer cannot mint credit
// ─────────────────────────────────────────────────────────────────────────────

describe('Credit notes (C1)', () => {
  beforeEach(seedAdminAndCustomer);

  test('admin CANNOT create a credit note from the browser (issueStoreCredit does it)', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(
      admin.collection('creditNotes').add({
        customerId: 'cust-uid',
        amount: 100,
        remainingBalance: 100,
        status: 'available',
        createdAt: new Date(),
      }),
    );
  });

  test('customer CANNOT create a credit note (would let them mint credit)', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('creditNotes').add({
        customerId: 'cust-uid',
        amount: 99999,
        remainingBalance: 99999,
        status: 'available',
      }),
    );
  });

  test('customer CANNOT update their own credit note (Pass 2 lockdown)', async () => {
    // Seed a credit note via admin
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('creditNotes').doc('note-1').set({
        customerId: 'cust-uid',
        amount: 100,
        remainingBalance: 100,
        status: 'available',
      });
    });

    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    // Attempt to inflate remainingBalance — Pass 1 patched the rule, Pass 2
    // tightened it further to deny customer writes entirely.
    await assertFails(
      cust.collection('creditNotes').doc('note-1').update({
        remainingBalance: 99999,
      }),
    );
  });

  test('customer CANNOT read another customer\'s credit notes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('creditNotes').doc('note-other').set({
        customerId: 'other-uid',
        amount: 100,
        remainingBalance: 100,
        status: 'available',
      });
    });

    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('creditNotes').doc('note-other').get(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H1 — rateLimits cross-tenant access
// ─────────────────────────────────────────────────────────────────────────────

describe('Rate limits (H1)', () => {
  beforeEach(seedAdminAndCustomer);

  test('customer can read their own rate limit doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('rateLimits').doc('limit-1').set({
        customerId: 'cust-uid',
        attempts: 1,
        windowStart: Date.now(),
      });
    });

    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertSucceeds(
      cust.collection('rateLimits').doc('limit-1').get(),
    );
  });

  test('customer CANNOT read another customer\'s rate limit doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('rateLimits').doc('limit-other').set({
        customerId: 'other-uid',
        attempts: 1,
        windowStart: Date.now(),
      });
    });

    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('rateLimits').doc('limit-other').get(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H2 — idCounters: Cloud Function only
// ─────────────────────────────────────────────────────────────────────────────

describe('ID counters (H2)', () => {
  beforeEach(seedAdminAndCustomer);

  test('NO ONE can write idCounters from the client (admin or customer)', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    const cust = testEnv.authenticatedContext('cust-uid').firestore();

    await assertFails(
      admin.collection('idCounters').doc('orders').set({ value: 9999 }),
    );
    await assertFails(
      cust.collection('idCounters').doc('orders').set({ value: 9999 }),
    );
  });

  test('admin CAN read idCounters (for diagnostics)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('idCounters').doc('orders').set({ value: 100 });
    });

    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(
      admin.collection('idCounters').doc('orders').get(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot reads — Pass 4 (M2) denormalized customerId fast path
// ─────────────────────────────────────────────────────────────────────────────

describe('Order snapshots (M2)', () => {
  beforeEach(async () => {
    await seedAdminAndCustomer();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Order owned by cust-uid
      await db.collection('orders').doc('order-1').set({
        customerId: 'cust-uid',
        status: 'completed',
        total: 100,
      });
      // New-style snapshot with denormalized customerId
      await db
        .collection('orders').doc('order-1')
        .collection('snapshots').doc('snap-new')
        .set({ customerId: 'cust-uid', orderId: 'order-1', total: 100 });
      // Legacy snapshot without customerId — falls back to parent get()
      await db
        .collection('orders').doc('order-1')
        .collection('snapshots').doc('snap-legacy')
        .set({ orderId: 'order-1', total: 100 });
    });
  });

  test('customer CAN read their own snapshot via fast path (denormalized)', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertSucceeds(
      cust.collection('orders').doc('order-1')
        .collection('snapshots').doc('snap-new').get(),
    );
  });

  test('customer CAN read their own legacy snapshot via fallback path', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertSucceeds(
      cust.collection('orders').doc('order-1')
        .collection('snapshots').doc('snap-legacy').get(),
    );
  });

  test('other customer CANNOT read someone else\'s snapshot', async () => {
    const other = testEnv.authenticatedContext('other-uid').firestore();
    await assertFails(
      other.collection('orders').doc('order-1')
        .collection('snapshots').doc('snap-new').get(),
    );
  });

  test('snapshots are immutable — no updates allowed', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(
      admin.collection('orders').doc('order-1')
        .collection('snapshots').doc('snap-new').update({ total: 999 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order ownership boundaries
// ─────────────────────────────────────────────────────────────────────────────

describe('Orders', () => {
  beforeEach(async () => {
    await seedAdminAndCustomer();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('orders').doc('cust-order').set({
        customerId: 'cust-uid',
        status: 'pending',
        total: 50,
      });
    });
  });

  test('customer CAN read their own order', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertSucceeds(cust.collection('orders').doc('cust-order').get());
  });

  test('other customer CANNOT read another\'s order', async () => {
    const other = testEnv.authenticatedContext('other-uid').firestore();
    await assertFails(other.collection('orders').doc('cust-order').get());
  });

  test('admin CAN read any order', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(admin.collection('orders').doc('cust-order').get());
  });

  test('unauthenticated user CANNOT read any order', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(anon.collection('orders').doc('cust-order').get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R10 FIXES — Lock in the new ownership checks on create branches
// (Pre-R10, these were the CRITICAL holes documented as S1-F18, S2-F23, S2-F24,
// S2-F25, S5-F54.  Each fix tightened the rule; the tests below would have
// caught each regression had they existed at the time.)
// ─────────────────────────────────────────────────────────────────────────────

describe('Snapshot create ownership (R10 lock-in for S1-F18)', () => {
  beforeEach(async () => {
    await seedAdminAndCustomer();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('orders').doc('cust-order').set({
        customerId: 'cust-uid',
        status: 'completed',
        total: 100,
      });
    });
  });

  test('owner CANNOT create snapshot (server-only)', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('orders').doc('cust-order').collection('snapshots').add({
        customerId: 'cust-uid',
        orderId: 'cust-order',
        total: 100,
        status: 'completed',
        trigger: 'edit',
        createdBy: 'cust-uid',
      }),
    );
  });

  test('OTHER customer CANNOT create snapshot in someone else\'s order (was S1-F18)', async () => {
    const other = testEnv.authenticatedContext('other-uid').firestore();
    await assertFails(
      other.collection('orders').doc('cust-order').collection('snapshots').add({
        customerId: 'other-uid', // even with "their own" customerId, parent isn't theirs
        orderId: 'cust-order',
        total: 999,
        status: 'completed',
        trigger: 'edit',
        createdBy: 'other-uid',
      }),
    );
  });

  test('admin CANNOT create snapshot from the browser (server-only)', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(
      admin.collection('orders').doc('cust-order').collection('snapshots').add({
        customerId: 'cust-uid',
        orderId: 'cust-order',
        total: 100,
        status: 'completed',
        trigger: 'admin_edit',
        createdBy: 'admin@example.com',
      }),
    );
  });
});

describe('Order events create ownership (R10 lock-in for S2-F23)', () => {
  beforeEach(async () => {
    await seedAdminAndCustomer();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('orders').doc('cust-order').set({
        customerId: 'cust-uid',
        status: 'pending',
        total: 50,
      });
    });
  });

  test('OTHER customer CANNOT create event in someone else\'s order (was S2-F23)', async () => {
    const other = testEnv.authenticatedContext('other-uid').firestore();
    await assertFails(
      other.collection('orders').doc('cust-order').collection('events').add({
        customerId: 'other-uid',
        action: 'fake_action',
      }),
    );
  });
});

describe('Voided invoices create ownership (R10 lock-in for S2-F24)', () => {
  beforeEach(seedAdminAndCustomer);

  test('OTHER customer CANNOT create voidedInvoice with their own customerId (was S2-F24)', async () => {
    const other = testEnv.authenticatedContext('other-uid').firestore();
    await assertFails(
      other.collection('voidedInvoices').doc('FAKE-INV-001').set({
        customerId: 'cust-uid', // Trying to pollute another customer's void log
        voidedAt: new Date(),
      }),
    );
  });

  test('OTHER customer CANNOT create voidedInvoice without a customerId field (was S2-F24)', async () => {
    const other = testEnv.authenticatedContext('other-uid').firestore();
    await assertFails(
      other.collection('voidedInvoices').doc('FAKE-INV-002').set({
        voidedAt: new Date(),
      }),
    );
  });
});

describe('Credit application history (T2R7-C2: server-only writer)', () => {
  beforeEach(seedAdminAndCustomer);

  // The applyOrderCredit Cloud Function (Admin SDK) is the only legitimate
  // writer. Customers must not be able to write ANY history entry — not even
  // a "reasonable" one — or they could fake credit applications that don't
  // reconcile against the credit notes.
  for (const [label, data] of [
    ['a reasonable amount', { customerId: 'cust-uid', amount: 50 }],
    ['a $1M fake amount', { customerId: 'cust-uid', amount: 1000000 }],
    ['a negative amount', { customerId: 'cust-uid', amount: -100 }],
    ['no amount', { customerId: 'cust-uid' }],
  ] as const) {
    test(`customer CANNOT create a history record with ${label}`, async () => {
      const cust = testEnv.authenticatedContext('cust-uid').firestore();
      await assertFails(cust.collection('creditApplicationHistory').add(data));
    });
  }

  test('admin CANNOT create a history record from the browser (server-only)', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(admin.collection('creditApplicationHistory').add({ customerId: 'cust-uid', amount: 50 }));
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Notifications + email audit (written only by Cloud Functions)
// ─────────────────────────────────────────────────────────────────────────────

describe('Notifications', () => {
  beforeEach(seedAdminAndCustomer);

  test('customer CANNOT post to the admin feed (no fake admin alerts)', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('notifications').doc('admin').collection('items').doc('x').set({
        type: 'PAYMENT_SUBMITTED',
        orderId: 'order-1',
        title: 'Fake',
        message: 'Fake',
      }),
    );
  });

  test('customer CANNOT create notifications in their own feed', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('notifications').doc('user_cust-uid').collection('items').doc('x').set({
        type: 'PAYMENT_CONFIRMED',
        title: 'Fake',
      }),
    );
  });

  test('customer CAN mark their own notification read, and nothing else', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('notifications').doc('user_cust-uid').collection('items').doc('n1').set({
        type: 'ORDER_APPROVED_PAY_REQUIRED',
        title: 'Approved',
        read: false,
      });
    });
    const ref = testEnv
      .authenticatedContext('cust-uid')
      .firestore()
      .collection('notifications')
      .doc('user_cust-uid')
      .collection('items')
      .doc('n1');
    await assertSucceeds(ref.update({ read: true }));
    await assertFails(ref.update({ title: 'Changed' }));
  });

  test("customer CANNOT read another customer's notifications", async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(cust.collection('notifications').doc('user_someone-else').collection('items').get());
  });

  test('admin CAN read the admin feed', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(admin.collection('notifications').doc('admin').collection('items').get());
  });
});

describe('Email audit log + quotas', () => {
  beforeEach(seedAdminAndCustomer);

  test('admin CAN read the email log; nobody can write it from a browser', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(admin.collection('emailLog').get());
    await assertFails(admin.collection('emailLog').doc('x').set({ state: 'sent' }));
  });

  test('customers cannot read the email log', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(cust.collection('emailLog').get());
  });

  test('rate-limit quotas are server-only', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(admin.collection('emailQuota').doc('x').get());
    await assertFails(admin.collection('emailQuota').doc('x').set({ timestamps: [] }));
  });
});

describe('Public business card (publicProfile)', () => {
  beforeEach(seedAdminAndCustomer);

  test('anyone — even signed out — can read it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('publicProfile/business').set({ businessName: 'Test Bakery' });
    });
    await assertSucceeds(testEnv.unauthenticatedContext().firestore().doc('publicProfile/business').get());
  });

  test('nobody can write it from a browser (server sync only)', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(admin.doc('publicProfile/business').set({ businessName: 'Hacked' }));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(anon.doc('publicProfile/business').set({ businessName: 'Hacked' }));
  });

  test('private settings stay private to signed-out visitors', async () => {
    await assertFails(testEnv.unauthenticatedContext().firestore().doc('settings/general').get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server-only order lifecycle: the browser never writes orders, credit,
// edit history or notifications — not even an admin.
// ─────────────────────────────────────────────────────────────────────────────

describe('Server-only order lifecycle', () => {
  beforeEach(async () => {
    await seedAdminAndCustomer();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('orders').doc('o-approved').set({
        customerId: 'cust-uid',
        status: 'approved',
        subtotal: 100,
        total: 105,
        amountDue: 105,
        paymentSubmitted: false,
      });
    });
  });

  const order = { customerId: 'cust-uid', items: [], subtotal: 100, total: 105, status: 'pending' };

  test('customer CANNOT create an order directly (placeOrder only)', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(cust.collection('orders').doc('x').set(order));
  });

  test('admin CANNOT create, update or delete an order from the browser', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(admin.collection('orders').doc('y').set(order));
    await assertFails(admin.collection('orders').doc('o-approved').update({ total: 1 }));
    await assertFails(admin.collection('orders').doc('o-approved').update({ status: 'in_process' }));
    await assertFails(admin.collection('orders').doc('o-approved').delete());
  });

  test('customer CANNOT self-submit payment fields (submitPaymentProof only)', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('orders').doc('o-approved').update({ paymentSubmitted: true, paymentReference: 'ET-1' }),
    );
  });

  test('admin CANNOT write notifications, edit history or voided invoices from the browser', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(admin.doc('notifications/user_cust-uid/items/fake').set({ type: 'CREDIT_ISSUED', read: false }));
    await assertFails(admin.doc('notifications/admin/items/fake').set({ type: 'ORDER_PLACED_TRACKING', read: false }));
    await assertFails(admin.collection('orderEditHistory').add({ orderId: 'o-approved', customerId: 'cust-uid' }));
    await assertFails(admin.doc('voidedInvoices/DBH-1').set({ invoiceNumber: 'DBH-1', customerId: 'cust-uid' }));
  });

  test('a new user CANNOT create their own profile (createCustomerWithCode only)', async () => {
    const fresh = testEnv.authenticatedContext('new-uid').firestore();
    await assertFails(fresh.collection('customers').doc('new-uid').set({ email: 'n@x.com', status: 'pending', customerType: 'individual' }));
  });

  test('customer CAN still read their own order and mark notifications read', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('notifications/user_cust-uid/items/n1').set({ type: 'PAYMENT_REMINDER', read: false });
    });
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertSucceeds(cust.collection('orders').doc('o-approved').get());
    await assertSucceeds(cust.doc('notifications/user_cust-uid/items/n1').update({ read: true }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accounts: status, type, ID and email change only in Cloud Functions
// ─────────────────────────────────────────────────────────────────────────────

describe('Customer accounts', () => {
  beforeEach(seedAdminAndCustomer);

  test('customer CAN edit their own profile details', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertSucceeds(cust.collection('customers').doc('cust-uid').update({ phone: '604-555-0199', storeName: 'New Name' }));
  });

  test('customer CANNOT approve themselves, change type, or change email', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('customers').doc('pend-uid').set({ email: 'p@x.com', customerType: 'individual', status: 'pending' });
    });
    const pending = testEnv.authenticatedContext('pend-uid').firestore();
    await assertFails(pending.collection('customers').doc('pend-uid').update({ status: 'approved' }));
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(cust.collection('customers').doc('cust-uid').update({ customerType: 'admin' }));
    await assertFails(cust.collection('customers').doc('cust-uid').update({ email: 'other@x.com' }));
  });

  test('admin CAN edit profile details but NOT status/type/code (server actions)', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(admin.collection('customers').doc('cust-uid').update({ contactPerson: 'Sam', storeAddress: '1 Main St' }));
    await assertFails(admin.collection('customers').doc('cust-uid').update({ status: 'suspended' }));
    await assertFails(admin.collection('customers').doc('cust-uid').update({ customerType: 'admin' }));
    await assertFails(admin.collection('customers').doc('cust-uid').update({ customerCode: 'CUST-FAKE' }));
  });

  test('nobody creates or deletes account profiles from the browser', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertFails(admin.collection('customers').doc('x-uid').set({ email: 'x@x.com', status: 'approved' }));
    await assertFails(admin.collection('customers').doc('cust-uid').delete());
  });

  test('customer CANNOT read another customer\'s profile', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(cust.collection('customers').doc('other-uid').get());
  });
});
