#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPREHENSIVE FIREBASE SEED - Main Orchestrator
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Production-grade seed system for Bakery Order Management
 * Seeds ALL Firebase collections with deep nested data (10+ layers)
 * 
 * USAGE:
 *   node seed/index.js                    # Seed everything
 *   node seed/index.js --only=products    # Seed specific collections
 *   node seed/index.js --skip=notifications  # Skip specific collections
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');
const path = require('path');
const { logSection, logSuccess, logError, logInfo } = require('./helpers.cjs');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // ⚠️ IMPORTANT: Update this with your Firebase Storage bucket
  storageBucket: 'your-project-id.appspot.com',
  
  // Service account key path
  serviceAccountPath: path.join(__dirname, 'serviceAccountKey.json'),
  
  // Data volume configuration
  ordersPerWeek: 7,        // Average orders per week
  weeksOfData: 12,         // 12 weeks = 3 months
  notificationsPerOrder: 2, // Average notifications per order
  creditNoteCount: 30,
  creditApplicationCount: 50,
  orderEditCount: 40,
};

// ═══════════════════════════════════════════════════════════════════════════
// PARSE COMMAND LINE ARGUMENTS
// ═══════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const onlyCollections = args.find(arg => arg.startsWith('--only='))?.split('=')[1]?.split(',');
const skipCollections = args.find(arg => arg.startsWith('--skip='))?.split('=')[1]?.split(',');

function shouldSeed(collectionName) {
  if (onlyCollections) {
    return onlyCollections.includes(collectionName);
  }
  if (skipCollections) {
    return !skipCollections.includes(collectionName);
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZE FIREBASE ADMIN
// ═══════════════════════════════════════════════════════════════════════════

let db;

try {
  const serviceAccount = require(CONFIG.serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: CONFIG.storageBucket
  });
  
  db = admin.firestore();
  logSuccess('Firebase Admin SDK initialized');
} catch (error) {
  logError(`Failed to initialize Firebase: ${error.message}`);
  logInfo(`Make sure ${CONFIG.serviceAccountPath} exists`);
  logInfo('Download it from: Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

const SETTINGS_DATA = require('./data/settings.cjs');
const { generateCategories } = require('./data/categories.cjs');
const { generateProducts } = require('./data/products.cjs');
const { generateCustomers } = require('./data/customers.cjs');

// ═══════════════════════════════════════════════════════════════════════════
// SEEDING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const { batchWrite } = require('./helpers.cjs');

async function seedSettings() {
  logInfo('Seeding settings...');
  await db.collection('settings').doc('system').set(SETTINGS_DATA);
  logSuccess('Settings seeded: 1 document');
  return SETTINGS_DATA;
}

async function seedCategories() {
  logInfo('Seeding categories...');
  const categories = generateCategories();
  await batchWrite(db, 'categories', categories);
  logSuccess(`Categories seeded: ${categories.length} documents`);
  return categories;
}

async function seedProducts(categories) {
  logInfo('Seeding products...');
  const products = generateProducts(categories);
  await batchWrite(db, 'products', products);
  logSuccess(`Products seeded: ${products.length} documents`);
  return products;
}

async function seedCustomers() {
  logInfo('Seeding customers...');
  const customers = generateCustomers();
  await batchWrite(db, 'customers', customers);
  logSuccess(`Customers seeded: ${customers.length} documents`);
  return customers;
}

async function seedOrders(customers, products) {
  logInfo('Seeding orders (this may take a moment)...');
  
  // Import order generator
  const { generateOrders } = require('./data/orders.cjs');
  const orders = generateOrders(customers, products, CONFIG.weeksOfData, CONFIG.ordersPerWeek);
  
  await batchWrite(db, 'orders', orders);
  logSuccess(`Orders seeded: ${orders.length} documents`);
  return orders;
}

async function seedNotifications(orders, customers) {
  if (!shouldSeed('notifications')) {
    logInfo('Skipping notifications (--skip flag)');
    return [];
  }
  
  logInfo('Seeding notifications (hierarchical paths)...');
  
  const { generateNotifications } = require('./data/notifications.cjs');
  const notifItems = generateNotifications(orders, customers);
  
  // Write each notification to its correct subcollection path
  // paths are like: ['notifications', 'admin', 'items'] or ['notifications', 'user_X', 'items']
  let batch = db.batch();
  let count = 0;
  let total = 0;
  
  for (const item of notifItems) {
    const [col, doc, subcol] = item.path;
    const ref = db.collection(col).doc(doc).collection(subcol).doc(item.id);
    batch.set(ref, { ...item.data, id: item.id });
    count++;
    total++;
    
    if (count >= 499) {
      await batch.commit();
      batch = db.batch();
      count = 0;
      logInfo(`  Written ${total}/${notifItems.length} notifications...`);
    }
  }
  if (count > 0) await batch.commit();
  
  logSuccess(`Notifications seeded: ${total} documents (hierarchical paths)`);
  return notifItems;
}

async function seedCredits(customers, orders) {
  logInfo('Seeding credit system...');
  
  // Import credit generator
  const { generateCreditNotes, generateCreditApplications } = require('./data/credits.cjs');
  
  const creditNotes = generateCreditNotes(customers, orders, CONFIG.creditNoteCount);
  await batchWrite(db, 'creditNotes', creditNotes);
  logSuccess(`Credit notes seeded: ${creditNotes.length} documents`);
  
  const creditApplications = generateCreditApplications(creditNotes, orders, CONFIG.creditApplicationCount);
  await batchWrite(db, 'creditApplicationHistory', creditApplications);
  logSuccess(`Credit applications seeded: ${creditApplications.length} documents`);
  
  return { creditNotes, creditApplications };
}

async function seedHistory(orders) {
  logInfo('Seeding order history...');
  
  const { generateEditHistory, generateSnapshots } = require('./data/history.cjs');
  
  const editHistory = generateEditHistory(orders, CONFIG.orderEditCount);
  await batchWrite(db, 'orderEditHistory', editHistory);
  logSuccess(`Edit history seeded: ${editHistory.length} documents`);
  
  // FIXED: Snapshots live at orders/{orderId}/snapshots/{snapId} subcollection
  const snapshotItems = generateSnapshots(orders);
  let batch = db.batch();
  let count = 0;
  let total = 0;
  for (const item of snapshotItems) {
    const [col, docId, subcol] = item.path;
    const ref = db.collection(col).doc(docId).collection(subcol).doc(item.id);
    batch.set(ref, { ...item.data, id: item.id });
    count++; total++;
    if (count >= 499) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count > 0) await batch.commit();
  logSuccess(`Invoice snapshots seeded: ${total} documents (orders/{id}/snapshots)`);
  
  return { editHistory, snapshots: snapshotItems };
}

async function seedCounters(customers, orders) {
  logInfo('Seeding ID counters...');
  
  const approvedOrders = orders.filter(o => o.status !== 'pending');
  
  const counters = {
    orders: {
      lastSequence: orders.length,
      lastYear: 2026,
      yearlyCounters: { "2026": orders.length }
    },
    customers: {
      lastSequence: customers.length,
      lastYear: 2026,
      yearlyCounters: { "2026": customers.length }
    },
    invoices: {
      lastSequence: approvedOrders.length,
      lastYear: 2026,
      yearlyCounters: { "2026": approvedOrders.length }
    }
  };
  
  const batch = db.batch();
  Object.entries(counters).forEach(([collection, data]) => {
    const docRef = db.collection('idCounters').doc(collection);
    batch.set(docRef, data);
  });
  await batch.commit();
  
  logSuccess('ID counters seeded: 3 documents');
  return counters;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n');
  logSection('🌱 COMPREHENSIVE FIREBASE SEED - Bakery Order Management System');
  
  logInfo(`Configuration:`);
  logInfo(`  ├─ Weeks of data: ${CONFIG.weeksOfData}`);
  logInfo(`  ├─ Orders per week: ${CONFIG.ordersPerWeek}`);
  logInfo(`  ├─ Credit notes: ${CONFIG.creditNoteCount}`);
  logInfo(`  └─ Order edits: ${CONFIG.orderEditCount}`);
  console.log('');
  
  try {
    const startTime = Date.now();
    
    // Layer 1: Settings & Categories
    logSection('Layer 1: System Configuration');
    const settings = shouldSeed('settings') ? await seedSettings() : null;
    const categories = shouldSeed('categories') ? await seedCategories() : [];
    
    // Layer 2: Products
    logSection('Layer 2: Products');
    const products = shouldSeed('products') ? await seedProducts(categories) : [];
    
    // Layer 3: Customers
    logSection('Layer 3: Customers');
    const customers = shouldSeed('customers') ? await seedCustomers() : [];
    
    // Layer 4-5: Orders (with items)
    logSection('Layer 4-5: Orders & Order Items');
    const orders = shouldSeed('orders') ? await seedOrders(customers, products) : [];
    
    // Layer 6-8: Credits System
    logSection('Layer 6-8: Credit System');
    const credits = shouldSeed('creditNotes') || shouldSeed('creditApplicationHistory') 
      ? await seedCredits(customers, orders) 
      : { creditNotes: [], creditApplications: [] };
    
    // Layer 9: History & Snapshots
    logSection('Layer 9: Order History & Snapshots');
    const history = shouldSeed('orderEditHistory') || shouldSeed('snapshots')
      ? await seedHistory(orders)
      : { editHistory: [], snapshots: [] };
    
    // Layer 10: Notifications
    logSection('Layer 10: Notifications');
    const notifications = await seedNotifications(orders, customers);
    
    // ID Counters
    logSection('ID Generation Counters');
    const counters = shouldSeed('idCounters') ? await seedCounters(customers, orders) : null;
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n');
    logSection('✅ SEED COMPLETED SUCCESSFULLY');
    
    console.log('📊 Summary:\n');
    console.log(`   Settings:                  1 document`);
    console.log(`   Categories:                ${categories.length} documents`);
    console.log(`   Products:                  ${products.length} documents`);
    console.log(`   Customers:                 ${customers.length} documents`);
    console.log(`   Orders:                    ${orders.length} documents`);
    console.log(`   Notifications:             ${Array.isArray(notifications) ? notifications.length : 0} documents`);
    console.log(`   Credit Notes:              ${credits.creditNotes.length} documents`);
    console.log(`   Credit Applications:       ${credits.creditApplications.length} documents`);
    console.log(`   Order Edit History:        ${history.editHistory.length} documents`);
    console.log(`   Invoice Snapshots:         ${history.snapshots.length} documents`);
    console.log(`   ID Counters:               3 documents`);
    console.log('');
    console.log(`   📦 Total Documents:         ${
      1 + categories.length + products.length + customers.length + orders.length + 
      notifications.length + credits.creditNotes.length + credits.creditApplications.length + 
      history.editHistory.length + history.snapshots.length + 3
    }`);
    console.log('');
    console.log(`   ⏱️  Time taken:              ${duration}s`);
    console.log('');
    
    logSuccess('🎉 Your Firebase database is ready with production-quality data!');
    console.log('');
    
  } catch (error) {
    console.log('\n');
    logSection('❌ SEED FAILED');
    logError(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the seed
main();
