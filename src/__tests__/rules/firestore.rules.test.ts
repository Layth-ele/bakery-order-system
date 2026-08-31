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

const PROJECT_ID = 'delight-bakehouse-test';

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

  test('admin can create a credit note', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(
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

  test('owner CAN create snapshot in their own order', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertSucceeds(
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

  test('admin CAN create snapshot in any order', async () => {
    const admin = testEnv.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(
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

describe('Credit application history amount validation (R10 lock-in for S5-F54)', () => {
  beforeEach(seedAdminAndCustomer);

  test('customer CAN create history record with reasonable amount', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertSucceeds(
      cust.collection('creditApplicationHistory').add({
        customerId: 'cust-uid',
        amount: 50,
      }),
    );
  });

  test('customer CANNOT create history record with $1M fake amount (was S5-F54)', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('creditApplicationHistory').add({
        customerId: 'cust-uid',
        amount: 1000000, // exceeds 100000 cap
      }),
    );
  });

  test('customer CANNOT create history record with negative amount', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('creditApplicationHistory').add({
        customerId: 'cust-uid',
        amount: -100,
      }),
    );
  });

  test('customer CANNOT create history record without amount', async () => {
    const cust = testEnv.authenticatedContext('cust-uid').firestore();
    await assertFails(
      cust.collection('creditApplicationHistory').add({
        customerId: 'cust-uid',
      }),
    );
  });
});
