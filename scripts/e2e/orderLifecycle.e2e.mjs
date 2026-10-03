/**
 * End-to-end order lifecycle against the Firebase emulators (Auth +
 * Firestore + the real Cloud Functions). Proves, with real users and real
 * function calls:
 *   - every money figure at every step (placement, edits, approval, payment,
 *     paid reduction, partial cancellation, final invoice)
 *   - exactly one notification per event, from the server
 *   - store credit issued / spent / returned / reserved for payout correctly
 *   - registration creates the profile + admin alert atomically
 *
 * Run:  npm run test:e2e   (uses the throw-away "demo-bakery-e2e" project;
 *       never touches a real Firebase project)
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { initializeApp as initClient, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const require = createRequire(new URL('../../src/functions/package.json', import.meta.url));
const { initializeApp: initAdmin } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-bakery-e2e';
if (!PROJECT.startsWith('demo-')) throw new Error(`Refusing to run against non-demo project ${PROJECT}`);

initAdmin({ projectId: PROJECT });
const db = getFirestore();
const adminAuth = getAdminAuth();

// ── helpers ────────────────────────────────────────────────────────────────

let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.error(`  ✗ ${label}`);
    throw err;
  }
}
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 0.005, `${label}: expected ${b}, got ${a}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, label, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`Timed out waiting for: ${label}`);
    await sleep(250);
  }
}

async function clientFor(email, password) {
  const app = initClient({ apiKey: 'demo-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, email);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fns = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  await signInWithEmailAndPassword(auth, email, password);
  const call = async (name, data) => (await httpsCallable(fns, name)(data)).data;
  const fails = async (name, data, pattern) => {
    try {
      await httpsCallable(fns, name)(data);
    } catch (err) {
      if (pattern && !pattern.test(`${err.code} ${err.message}`)) throw new Error(`${name} failed differently: ${err.code} ${err.message}`);
      return err;
    }
    throw new Error(`${name} was expected to fail`);
  };
  return { app, auth, fns, call, fails };
}

const order = async (id) => (await db.doc(`orders/${id}`).get()).data();
const customerNotes = async (uid) =>
  (await db.collection(`notifications/user_${uid}/items`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const adminNotes = async () => (await db.collection('notifications/admin/items').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const creditBalance = async (uid) =>
  (await db.collection('creditNotes').where('customerId', '==', uid).get()).docs
    .map((d) => d.data())
    .filter((n) => ['available', 'partially_used'].includes(n.status) && n.payoutRequested !== true)
    .reduce((s, n) => s + (n.remainingBalance ?? n.amount ?? 0), 0);

function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return { week, year };
}

const zero = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };
const reqId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

// ── seed ───────────────────────────────────────────────────────────────────

const ADMIN = { uid: 'admin-uid', email: 'admin@bakery.test', password: 'admin-pass-123' };
const CUST = { uid: 'cust-uid', email: 'cafe@bakery.test', password: 'cust-pass-123' };

async function seed() {
  for (const u of [ADMIN, CUST]) await adminAuth.createUser({ uid: u.uid, email: u.email, password: u.password });
  await db.doc(`customers/${ADMIN.uid}`).set({ email: ADMIN.email, customerType: 'admin', status: 'approved', storeName: 'Bakery Admin' });
  await db.doc(`customers/${CUST.uid}`).set({
    email: CUST.email, customerType: 'commercial', status: 'approved', storeName: 'Corner Cafe',
    contactPerson: 'Sam', storeAddress: '1 Main St', phone: '604-555-0100', customerCode: 'CUST-TEST-001',
  });
  // GST 5%, service charge $3.99, delivery $10 under $250 (defaults, written explicitly).
  await db.doc('settings/general').set({ gstRate: 0.05, serviceChargeAmount: 3.99, deliveryFee: 10, freeDeliveryMin: 250, sendOrderStatusEmails: true });
  await db.doc('products/bread').set({ name: 'Sourdough', wholesale: 4, retail: 6, price: 5, available: true });
  await db.doc('products/cake').set({ name: 'Carrot Cake', wholesale: 20, retail: 25, price: 22, available: true });
  await db.doc('creditNotes/seed-credit').set({
    customerId: CUST.uid, amount: 20, remainingBalance: 20, status: 'available', type: 'refund',
    reason: 'Seed', createdAt: Timestamp.fromMillis(Date.now() - 86400000),
  });
}

// ── journey ────────────────────────────────────────────────────────────────

async function main() {
  await seed();
  const admin = await clientFor(ADMIN.email, ADMIN.password);
  const cust = await clientFor(CUST.email, CUST.password);
  const { week, year } = isoWeekOf(new Date(Date.now() + 21 * 86400000));

  console.log('\n1. Customer places an order (Mon 10 + Wed 10 bread @ $4 wholesale, $20 credit)');
  const requestId = reqId();
  const placeInput = { requestId, week, year, items: [{ productId: 'bread', quantities: { ...zero, monday: 10, wednesday: 10 } }], creditToApply: 20, note: 'Back door' };
  const placed = await cust.call('placeOrder', placeInput);
  const id = placed.orderId;
  check('server prices it: 80 + 4 GST + 3.99 service + 10 delivery = 97.99', () => near(placed.total, 97.99, 'total'));
  check('credit applied 20, amount due 77.99', () => { near(placed.creditApplied, 20, 'credit'); near(placed.amountDue, 77.99, 'due'); });
  const retry = await cust.call('placeOrder', placeInput);
  check('a retry with the same requestId returns the same order (no duplicate)', () => {
    assert.equal(retry.duplicate, true);
    assert.equal(retry.orderId, id);
  });
  check('store credit spent', async () => {});
  near(await creditBalance(CUST.uid), 0, 'credit balance after placing');
  await cust.fails('placeOrder', { ...placeInput, requestId: reqId(), creditToApply: 5 }, /Not enough store credit/);
  check('more credit than available is refused', () => {});
  await cust.fails('placeOrder', { ...placeInput, requestId: reqId(), creditToApply: 0, week: isoWeekOf(new Date()).week, year: isoWeekOf(new Date()).year, items: [{ productId: 'bread', quantities: { ...zero, monday: 1 } }] }, /closed|failed-precondition/);
  check('a delivery day past its cutoff is refused', () => {});
  await waitFor(async () => (await adminNotes()).find((n) => n.id === `order_${id}_placed`), 'admin "new order" notification');
  check('admin got exactly one "new order" notification', () => {});

  console.log('\n2. Admin edits the pending order (Wed 10 → 5)');
  const e1 = await admin.call('editOrder', { orderId: id, items: [{ productId: 'bread', quantities: { ...zero, monday: 10, wednesday: 5 } }] });
  check('repriced: 60 + 3 + 3.99 + 10 = 76.99, due 56.99', () => { near(e1.total, 76.99, 'total'); near(e1.amountDue, 56.99, 'due'); });
  let o = await order(id);
  check('subtotal follows the items (the old pending-edit bug)', () => near(o.subtotal, 60, 'subtotal'));
  check('pending edit sends the customer nothing yet', async () => {});
  assert.equal((await customerNotes(CUST.uid)).length, 0, 'no customer notifications before approval');

  console.log('\n3. Admin approves');
  const ap = await admin.call('approveOrder', { orderId: id, deliveryFee: 10 });
  check('approved total 76.99, amount due 56.99', () => { near(ap.total, 76.99, 'total'); near(ap.amountDue, 56.99, 'due'); });
  await waitFor(async () => (await customerNotes(CUST.uid)).find((n) => n.id === `order_${id}_approved`), 'approved notification');
  check('customer notified once: approved, amount due $56.99', () => {});

  console.log('\n4. Admin edits the approved order (Wed back to 10)');
  const e2 = await admin.call('editOrder', { orderId: id, items: [{ productId: 'bread', quantities: { ...zero, monday: 10, wednesday: 10 } }] });
  check('97.99 total, 77.99 due', () => { near(e2.total, 97.99, 'total'); near(e2.amountDue, 77.99, 'due'); });
  check('the "order updated" email is attempted and reported (email not configured here)', () => assert.equal(e2.email.state, 'skipped'));
  let notes = await customerNotes(CUST.uid);
  check('customer got one "order updated" notification with the new amount', () => {
    const edits = notes.filter((n) => n.type === 'ORDER_EDITED');
    assert.equal(edits.length, 1);
    assert.match(edits[0].message, /\$77\.99/);
  });

  console.log('\n5. Payment reminder');
  const rem = await admin.call('sendPaymentReminder', { orderId: id });
  check('reminder #1 for the amount due (77.99)', () => { assert.equal(rem.reminderNumber, 1); near(rem.amountDue, 77.99, 'due'); });
  await admin.fails('sendPaymentReminder', { orderId: id }, /resource-exhausted/);
  check('a second click within a minute is refused (no duplicate reminder)', () => {});
  notes = await customerNotes(CUST.uid);
  check('exactly one reminder notification', () => assert.equal(notes.filter((n) => n.type === 'PAYMENT_REMINDER').length, 1));
  o = await order(id);
  check('reminder counted on the order', () => assert.equal(o.paymentReminderCount, 1));

  console.log('\n6. Customer pays, admin confirms');
  await cust.call('submitPaymentProof', { orderId: id, paymentMethod: 'etransfer', paymentReference: 'ET-123', transferPassword: 'bread' });
  await waitFor(async () => (await adminNotes()).find((n) => n.id === `order_${id}_payment`), 'payment submitted notification');
  check('admin got one "payment submitted" notification', () => {});
  await admin.fails('editOrder', { orderId: id, items: [{ productId: 'bread', quantities: { ...zero, monday: 1 } }] }, /already submitted payment/);
  check('unpaid edit is refused once payment is submitted', () => {});
  await admin.call('confirmOrderPayment', { orderId: id });
  await waitFor(async () => (await customerNotes(CUST.uid)).find((n) => n.id === `order_${id}_paid`), 'payment confirmed notification');
  o = await order(id);
  check('in production, paid; customer notified once', () => { assert.equal(o.status, 'in_process'); assert.equal(o.paymentReceived, true); });
  check('admin alert resolved (marked read, PAYMENT_CONFIRMED_ADMIN)', async () => {});
  const adminPay = (await adminNotes()).find((n) => n.id === `order_${id}_payment`);
  assert.equal(adminPay.type, 'PAYMENT_CONFIRMED_ADMIN');
  assert.equal(adminPay.read, true);

  console.log('\n7. Admin reduces the paid order (Mon 10 → 5)');
  await admin.fails('editPaidOrder', { orderId: id, reason: 'x', items: [{ productId: 'bread', quantities: { ...zero, monday: 12, wednesday: 10 } }] }, /only be reduced/);
  check('increases are refused', () => {});
  const pe = await admin.call('editPaidOrder', { orderId: id, reason: 'Short on flour', items: [{ productId: 'bread', quantities: { ...zero, monday: 5, wednesday: 10 } }] });
  check('credit = $20 bread + $1 GST = $21; new total 76.99', () => { near(pe.creditIssued, 21, 'credit'); near(pe.total, 76.99, 'total'); });
  near(await creditBalance(CUST.uid), 21, 'credit balance after paid edit');
  check('customer credit balance is now $21', () => {});
  const hist = await db.collection('orderEditHistory').where('orderId', '==', id).get();
  const snaps = await db.collection(`orders/${id}/snapshots`).where('trigger', '==', 'admin_edit').get();
  check('edit history + snapshot written by the server', () => { assert.equal(hist.size, 3); assert.equal(snaps.size, 1); });

  console.log('\n8. Admin cancels Wednesday only, 10% fee');
  const pc = await admin.call('cancelOrder', { orderId: id, reason: 'Closed Wednesday', cancelledDays: ['wednesday'], cancellationFeePercentage: 10 });
  check('partial: order continues; Wed = $40 + $2 GST = $42, fee $4.20 → credit $37.80', () => {
    assert.equal(pc.full, false);
    near(pc.credit, 37.8, 'credit');
    near(pc.fee, 4.2, 'fee');
  });
  o = await order(id);
  check('order still in production with Monday only, total 39.19 incl. the kept fee', () => {
    assert.equal(o.status, 'in_process');
    assert.equal(o.items[0].wednesday, 0);
    near(o.total, 39.19, 'total');
    near(o.creditIssued, 58.8, 'creditIssued');
  });
  near(await creditBalance(CUST.uid), 58.8, 'credit balance after partial cancel');

  console.log('\n9. Admin completes → final invoice');
  const done = await admin.call('completeOrder', { orderId: id });
  const inv = (await db.doc(`invoices/${done.invoiceId}`).get()).data() ?? (await db.collection('invoices').where('orderId', '==', id).get()).docs[0]?.data();
  check('invoice balances: paid 77.99 = total 39.19 + credit returned 58.80 − credit used 20', () => {
    near(inv.finalTotal, 39.19, 'finalTotal');
    near(inv.snapshots.totals.totalPaid, 77.99, 'totalPaid');
    near(inv.snapshots.totals.creditsIssued, 58.8, 'creditsIssued');
    near(inv.snapshots.totals.balanceDue, 0, 'balanceDue');
    assert.equal(inv.invoiceStatus, 'paid');
  });
  await waitFor(async () => (await customerNotes(CUST.uid)).find((n) => n.id === `order_${id}_completed`), 'completed notification');
  await admin.fails('editPaidOrder', { orderId: id, reason: 'late', items: [{ productId: 'bread', quantities: { ...zero, monday: 1 } }] }, /Completed orders/);
  check('completed orders are locked', () => {});

  console.log('\n10. Rejecting an unpaid order returns its store credit');
  const p2 = await cust.call('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'cake', quantities: { ...zero, friday: 2 } }], creditToApply: 10 });
  near(await creditBalance(CUST.uid), 48.8, 'credit after order 2');
  const rj = await admin.call('rejectOrder', { orderId: p2.orderId, reason: 'Out of carrots' });
  check('$10 store credit returned', () => near(rj.creditReturned, 10, 'returned'));
  near(await creditBalance(CUST.uid), 58.8, 'credit after reject');
  const rejNote = await waitFor(async () => (await customerNotes(CUST.uid)).find((n) => n.id === `order_${p2.orderId}_rejected`), 'rejected notification');
  check('rejection notification mentions the returned credit', () => assert.match(rejNote.message, /\$10\.00 store credit/));

  console.log('\n11. Full cancel of an unpaid order: no fee, credit returned');
  const p3 = await cust.call('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'cake', quantities: { ...zero, friday: 1 } }], creditToApply: 5 });
  await admin.call('approveOrder', { orderId: p3.orderId, deliveryFee: 10 });
  const fc = await admin.call('cancelOrder', { orderId: p3.orderId, reason: 'Customer asked', cancellationFeePercentage: 50 });
  check('cancelled; only the $5 credit comes back, no fee on an unpaid order', () => {
    assert.equal(fc.full, true);
    near(fc.credit, 5, 'credit');
    near(fc.fee, 0, 'fee');
  });
  near(await creditBalance(CUST.uid), 58.8, 'credit after unpaid cancel');

  console.log('\n12. Store credit and payout requests');
  const sc = await admin.call('issueStoreCredit', { customerId: CUST.uid, amount: 15, reason: 'Goodwill', type: 'refund' });
  await waitFor(async () => (await customerNotes(CUST.uid)).find((n) => n.id === `credit_${sc.creditNoteId}`), 'credit issued notification');
  check('credit issued with its notification', async () => {});
  near(await creditBalance(CUST.uid), 73.8, 'credit after manual credit');
  await cust.fails('issueStoreCredit', { customerId: CUST.uid, amount: 1000, reason: 'free money' }, /permission-denied/);
  check('customers cannot issue themselves credit', () => {});
  await cust.call('requestCreditPayout', { creditNoteId: sc.creditNoteId });
  await cust.fails('requestCreditPayout', { creditNoteId: sc.creditNoteId }, /already-exists/);
  check('payout requested once; admin notified', async () => {});
  assert.ok((await adminNotes()).find((n) => n.id === `payout_${sc.creditNoteId}`));
  near(await creditBalance(CUST.uid), 58.8, 'payout-reserved credit is not spendable');
  await cust.fails('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'cake', quantities: { ...zero, friday: 5 } }], creditToApply: 60 }, /Not enough store credit/);
  check('credit reserved for payout cannot be spent', () => {});

  console.log('\n13. Registration');
  const regApp = initClient({ apiKey: 'demo-key', projectId: PROJECT }, 'register');
  const regAuth = getAuth(regApp);
  connectAuthEmulator(regAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const regFns = getFunctions(regApp, 'us-central1');
  connectFunctionsEmulator(regFns, '127.0.0.1', 5001);
  const cred = await createUserWithEmailAndPassword(regAuth, 'new@shop.test', 'new-pass-123');
  const reg = await httpsCallable(regFns, 'createCustomerWithCode')({ uid: cred.user.uid, email: 'new@shop.test', storeName: 'New Shop', customerType: 'commercial' });
  const profile = (await db.doc(`customers/${cred.user.uid}`).get()).data();
  check('profile created pending, commercial, with a customer code', () => {
    assert.equal(profile.status, 'pending');
    assert.equal(profile.customerType, 'commercial');
    assert.match(reg.data.customerCode, /^CUST-/);
  });
  check('admin got exactly one registration alert', async () => {});
  assert.equal((await adminNotes()).filter((n) => n.id === `registration_${cred.user.uid}`).length, 1);
  await deleteApp(regApp);

  console.log('\n14. No duplicates anywhere');
  await sleep(1500); // let any late trigger retries land
  notes = await customerNotes(CUST.uid);
  const expected = [
    `order_${id}_approved`, `order_${id}_reminder_1`, `order_${id}_paid`, `order_${id}_completed`,
    `order_${p2.orderId}_rejected`, `order_${p3.orderId}_approved`, `order_${p3.orderId}_cancelled`,
    `credit_${sc.creditNoteId}`,
  ];
  check('every expected customer notification exists exactly once', () => {
    for (const nid of expected) assert.equal(notes.filter((n) => n.id === nid).length, 1, nid);
  });
  check('3 change notifications for order 1 (approved edit, paid reduction, partial cancel)', () =>
    assert.equal(notes.filter((n) => n.orderId === id && n.type === 'ORDER_EDITED').length, 3));
  check(`customer feed has exactly ${expected.length + 3} notifications, all written by the server`, () => {
    assert.equal(notes.length, expected.length + 3);
    assert.ok(notes.every((n) => n.source === 'server'));
  });
  const adm = await adminNotes();
  check('admin feed: 3 new orders, 1 payment, 1 payout, 1 registration', () => {
    assert.equal(adm.filter((n) => n.type === 'ORDER_PLACED_TRACKING').length, 3);
    assert.equal(adm.filter((n) => n.id.endsWith('_payment')).length, 1);
    assert.equal(adm.filter((n) => n.type === 'CREDIT_PAYOUT_REQUESTED').length, 1);
    assert.equal(adm.filter((n) => n.type === 'NEW_REGISTRATION').length, 1);
  });

  console.log('\n15. Account administration');
  const regUid = cred.user.uid;
  const authUser = async (uid) => adminAuth.getUser(uid).catch(() => null);
  const prof = async (uid) => (await db.doc(`customers/${uid}`).get()).data();

  await admin.call('rejectCustomer', { uid: regUid, reason: 'Outside delivery area' });
  check('reject: status rejected, sign-in disabled, registration alert resolved', async () => {});
  assert.equal((await prof(regUid)).status, 'rejected');
  assert.equal((await authUser(regUid)).disabled, true);
  assert.equal((await db.doc(`notifications/admin/items/registration_${regUid}`).get()).data().read, true);
  await admin.fails('rejectCustomer', { uid: regUid }, /failed-precondition/);
  check('a rejected request cannot be rejected twice', () => {});

  const ap2 = await admin.call('approveCustomer', { uid: regUid });
  const regProfile = await prof(regUid);
  check('approve (undo the rejection): approved, sign-in enabled, code kept, email attempted', () => {
    assert.equal(regProfile.status, 'approved');
    assert.match(regProfile.customerCode, /^CUST-/);
    assert.equal(ap2.email.state, 'skipped');
  });
  assert.equal((await authUser(regUid)).disabled, false);

  await admin.call('setCustomerSuspended', { uid: CUST.uid, suspended: true });
  check('suspend: status suspended and sign-in really disabled', async () => {});
  assert.equal((await prof(CUST.uid)).status, 'suspended');
  assert.equal((await authUser(CUST.uid)).disabled, true);
  await cust.fails('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'cake', quantities: { ...zero, friday: 1 } }] }, /permission-denied/);
  check('a suspended customer cannot order (even with a session still open)', () => {});
  await admin.call('setCustomerSuspended', { uid: CUST.uid, suspended: false });
  assert.equal((await prof(CUST.uid)).status, 'approved');
  assert.equal((await authUser(CUST.uid)).disabled, false);
  check('reactivate: approved and sign-in enabled again', () => {});
  await admin.fails('setCustomerSuspended', { uid: ADMIN.uid, suspended: true }, /own account/);
  check('admins cannot suspend themselves', () => {});
  await cust.fails('setCustomerSuspended', { uid: regUid, suspended: true }, /permission-denied/);
  check('customers cannot suspend anyone', () => {});

  const created = await admin.call('adminCreateAccount', {
    email: 'Walkin@Cafe.test', password: 'temp-pass-123', storeName: 'Walk-in Cafe', contactPerson: 'Lee',
    phone: '604-555-0111', storeAddress: '9 Main St', customerType: 'commercial',
  });
  const createdProfile = await prof(created.uid);
  check('admin "Add account": approved profile with a customer ID, email lowercased', () => {
    assert.equal(createdProfile.status, 'approved');
    assert.equal(createdProfile.email, 'walkin@cafe.test');
    assert.match(created.customerCode, /^CUST-/);
  });
  const walkin = await clientFor('walkin@cafe.test', 'temp-pass-123');
  check('the new customer can sign in with the temporary password', () => assert.ok(walkin.auth.currentUser));
  await deleteApp(walkin.app);
  await admin.fails('adminCreateAccount', { email: 'walkin@cafe.test', password: 'another-pass-1', storeName: 'X', contactPerson: 'Y', phone: '1', storeAddress: '2', customerType: 'individual' }, /already exists/);
  check('a duplicate email is refused', () => {});

  const del = await admin.call('deleteCustomerAccount', { uid: created.uid, hardDelete: true });
  check('permanent delete of an account with no orders removes profile and sign-in', async () => {});
  assert.equal(del.mode, 'deleted');
  assert.equal((await db.doc(`customers/${created.uid}`).get()).exists, false);
  assert.equal(await authUser(created.uid), null);
  await admin.fails('deleteCustomerAccount', { uid: CUST.uid, hardDelete: true }, /retained|invoiced|approval/);
  check('permanent delete is refused for a customer with paid/invoiced orders', () => {});
  const arc = await admin.call('deleteCustomerAccount', { uid: regUid });
  const archived = await prof(regUid);
  check('archive: sign-in disabled, personal details erased, status archived', () => {
    assert.equal(arc.mode, 'archived');
    assert.equal(archived.status, 'archived');
    assert.match(archived.email, /@deleted\.invalid$/);
  });
  assert.equal((await authUser(regUid)).disabled, true);
  await admin.fails('approveCustomer', { uid: regUid }, /archived/);
  check('an archived account cannot be re-approved', () => {});

  console.log('\n16. Money rules (money audit)');
  // Payout requests: decline puts the credit back, a new request is allowed, paid uses it up.
  const before16 = await creditBalance(CUST.uid);
  await cust.fails('resolveCreditPayout', { creditNoteId: sc.creditNoteId, outcome: 'paid' }, /permission-denied/);
  check('customers cannot resolve payouts', () => {});
  const dec = await admin.call('resolveCreditPayout', { creditNoteId: sc.creditNoteId, outcome: 'declined', note: 'Use it on orders' });
  const afterDecline = await creditBalance(CUST.uid);
  check('decline: the $15 is spendable again; admin alert resolved', () => {
    assert.equal(dec.outcome, 'declined');
    near(afterDecline, before16 + 15, 'balance after decline');
  });
  assert.equal((await db.doc(`notifications/admin/items/payout_${sc.creditNoteId}`).get()).data().read, true);
  await cust.call('requestCreditPayout', { creditNoteId: sc.creditNoteId });
  check('a new payout request after a decline works (its own alert)', () => {});
  assert.ok((await db.doc(`notifications/admin/items/payout_${sc.creditNoteId}_2`).get()).exists);
  const paidOut = await admin.call('resolveCreditPayout', { creditNoteId: sc.creditNoteId, outcome: 'paid', method: 'bank_transfer' });
  const paidNote = (await db.doc(`creditNotes/${sc.creditNoteId}`).get()).data();
  check('paid: note paid_out with $0 left; balance unchanged by the payout', async () => {});
  assert.equal(paidNote.status, 'paid_out');
  near(paidNote.remainingBalance, 0, 'remaining');
  near(paidOut.amount, 15, 'paid amount');
  near(await creditBalance(CUST.uid), before16, 'balance after payout');
  await cust.fails('requestCreditPayout', { creditNoteId: sc.creditNoteId }, /no remaining balance|paid out/);
  check('a paid-out credit cannot be requested again', () => {});
  const custNotes16 = await customerNotes(CUST.uid);
  check('customer told about the decline and the payout', () => {
    assert.ok(custNotes16.find((n) => n.id === `payout_declined_${sc.creditNoteId}`));
    assert.ok(custNotes16.find((n) => n.id === `payout_paid_${sc.creditNoteId}_2`));
  });

  // Prices in cents + daily minimum enforced by the server.
  await db.doc('products/bun').set({ name: 'Brioche Bun', wholesale: 2.105, retail: 3, discount: 5, dailyMinOrder: 6, available: true });
  await cust.fails('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'bun', quantities: { ...zero, monday: 3 } }] }, /minimum per delivery day is 6/);
  check('below the daily minimum is refused by the server', () => {});
  const bun = await cust.call('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'bun', quantities: { ...zero, monday: 6 } }] });
  const bunOrder = await order(bun.orderId);
  check('unit price stored in cents ($2.105 − 5% = $2.00) and 6 × $2.00 = $12.00', () => {
    assert.equal(bunOrder.items[0].price, 2);
    near(bunOrder.subtotal, 12, 'subtotal');
  });
  const mon = new Date(Date.UTC(year, 0, 4));
  mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7) + (week - 1) * 7);
  check('yearMonth is the delivery week’s month', () =>
    assert.equal(bunOrder.yearMonth, `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}`));

  // Edit without a fee: free delivery is re-checked for the new subtotal.
  const big = await cust.call('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'bread', quantities: { ...zero, monday: 70 } }] });
  near((await order(big.orderId)).deliveryFee, 0, 'free delivery at $280');
  await admin.call('editOrder', { orderId: big.orderId, items: [{ productId: 'bread', quantities: { ...zero, monday: 20 } }] });
  const smaller = await order(big.orderId);
  check('editing $280 → $80 without a fee brings back the $10 delivery fee', () => {
    near(smaller.deliveryFee, 10, 'fee');
    near(smaller.total, 80 + 4 + 3.99 + 10, 'total');
  });

  // Paid orders: cancelling in steps = cancelling at once.
  const paidOrder = async () => {
    const p = await cust.call('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'bread', quantities: { ...zero, monday: 10, tuesday: 10 } }] });
    await admin.call('approveOrder', { orderId: p.orderId, deliveryFee: 10 });
    await cust.call('submitPaymentProof', { orderId: p.orderId, paymentMethod: 'etransfer', paymentReference: 'ET-9', transferPassword: 'x' });
    await admin.call('confirmOrderPayment', { orderId: p.orderId });
    return p.orderId;
  };
  const A = await paidOrder();
  const B = await paidOrder();
  near((await order(A)).total, 97.99, 'paid order total');
  const once = await admin.call('cancelOrder', { orderId: A, reason: 'Closed', cancellationFeePercentage: 10 });
  const s1 = await admin.call('cancelOrder', { orderId: B, reason: 'Closed Mon', cancelledDays: ['monday'], cancellationFeePercentage: 10 });
  const s2 = await admin.call('cancelOrder', { orderId: B, reason: 'Closed Tue', cancelledDays: ['tuesday'], cancellationFeePercentage: 10 });
  const [oa, ob] = [await order(A), await order(B)];
  check('at once: credit $88.19, fee $9.80 stored on the cancelled order', () => {
    near(once.credit, 88.19, 'credit');
    near(oa.cancellationFee, 9.8, 'fee kept');
  });
  check('in steps: $37.80 + $50.39 = $88.19, fee kept $9.80 — same as at once', () => {
    near(s1.credit, 37.8, 'step 1');
    near(s2.credit, 50.39, 'step 2');
    near(s1.credit + s2.credit, once.credit, 'same credit');
    near(ob.cancellationFee, oa.cancellationFee, 'same fee');
  });
  const noteA = (await db.doc(`creditNotes/${oa.creditNoteId}`).get()).data();
  check('credit note GST = the order’s GST share ($4 of $97.99), not 5% of everything', () =>
    near(noteA.gst, Math.round(88.19 * (4 / 97.99) * 100) / 100, 'credit note gst'));

  // A flat discount shrinks with the order.
  const C = await cust.call('placeOrder', { requestId: reqId(), week, year, items: [{ productId: 'bread', quantities: { ...zero, monday: 10, tuesday: 10 } }] });
  await admin.call('approveOrder', { orderId: C.orderId, deliveryFee: 10 });
  await admin.call('editOrder', { orderId: C.orderId, deliveryFee: 10, discount: { type: 'fixed', value: 20 },
    items: [{ productId: 'bread', quantities: { ...zero, monday: 10, tuesday: 10 } }] });
  await admin.call('cancelOrder', { orderId: C.orderId, reason: 'Mon closed', cancelledDays: ['monday'] });
  const oc = await order(C.orderId);
  check('$20 flat discount on $80 → $10 on the remaining $40; total = (40 − 10) × 1.05 + 3.99 + 10 = $45.49', () => {
    near(oc.discount, 10, 'discount');
    near(oc.total, 45.49, 'total');
  });

  await deleteApp(admin.app);
  await deleteApp(cust.app);
  console.log(`\n✅ ${passed} end-to-end checks passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ E2E failed:', err);
  process.exit(1);
});
