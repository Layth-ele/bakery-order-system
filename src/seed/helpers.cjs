/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SEED HELPERS - Shared Utilities
 * ═══════════════════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');

// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateId(prefix = '') {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return prefix ? `${prefix}_${id}` : id;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMESTAMP UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function timestamp(daysOffset = 0, hoursOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(date.getHours() + hoursOffset);
  return admin.firestore.Timestamp.fromDate(date);
}

function dateFromDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEK/DATE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function getWeekKey(date) {
  const year = date.getFullYear();
  const firstDay = new Date(year, 0, 1);
  const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
}

function getWeekRange(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1); // Monday
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Sunday
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

function getYearMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFESSIONAL ID GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateInvoiceNumber(customerName, sequenceNumber, year = 2026) {
  // DBH-2026-JOH-001
  const prefix = customerName?.split(' ')[0]?.substring(0, 3).toUpperCase() || 'CUS';
  return `DBH-${year}-${prefix}-${String(sequenceNumber).padStart(3, '0')}`;
}

function generateCustomerId(sequenceNumber, year = 2026) {
  // CUS-2026-001
  return `CUS-${year}-${String(sequenceNumber).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RANDOM DATA GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomBool(probability = 0.5) {
  return Math.random() < probability;
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDER CALCULATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function calculateOrderTotals(items, deliveryFee = 10, serviceCharge = 3.99) {
  const subtotal = items.reduce((sum, item) => {
    const totalQty = 
      (item.monday || 0) + 
      (item.tuesday || 0) + 
      (item.wednesday || 0) + 
      (item.thursday || 0) + 
      (item.friday || 0) + 
      (item.saturday || 0) + 
      (item.sunday || 0);
    return sum + (totalQty * item.price);
  }, 0);

  const gst = subtotal * 0.05; // 5% GST
  const total = subtotal + gst + deliveryFee + serviceCharge;

  return { 
    subtotal: parseFloat(subtotal.toFixed(2)), 
    gst: parseFloat(gst.toFixed(2)), 
    deliveryFee, 
    serviceCharge, 
    total: parseFloat(total.toFixed(2))
  };
}

function createOrderItem(product, quantities) {
  const days = {
    monday: quantities[0] || 0,
    tuesday: quantities[1] || 0,
    wednesday: quantities[2] || 0,
    thursday: quantities[3] || 0,
    friday: quantities[4] || 0,
    saturday: quantities[5] || 0,
    sunday: quantities[6] || 0,
  };
  // ✅ total must equal sum of daily quantities (required by orderItem schema refine)
  const total = Object.values(days).reduce((s, q) => s + q, 0);
  return {
    productId: product.id,
    productName: product.name,
    price: product.retail,
    ...days,
    total,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH WRITING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

async function batchWrite(db, collectionName, documents, batchSize = 500) {
  console.log(`   Writing ${documents.length} documents to ${collectionName}...`);
  
  let batch = db.batch();
  let count = 0;
  let totalWritten = 0;

  for (const doc of documents) {
    const docRef = db.collection(collectionName).doc(doc.id);
    batch.set(docRef, doc);
    count++;
    totalWritten++;

    // Firestore batch limit is 500 operations
    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
      console.log(`   ✓ Written ${totalWritten}/${documents.length} documents...`);
    }
  }

  // Commit remaining
  if (count > 0) {
    await batch.commit();
  }

  console.log(`   ✅ Completed: ${totalWritten} documents written to ${collectionName}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function logSection(title) {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${title}`);
  console.log('═'.repeat(80) + '\n');
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message) {
  console.error(`❌ ${message}`);
}

function logWarning(message) {
  console.warn(`⚠️  ${message}`);
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // ID Generation
  generateId,
  generateInvoiceNumber,
  generateCustomerId,
  
  // Timestamps
  timestamp,
  dateFromDaysAgo,
  
  // Week/Date
  getWeekKey,
  getWeekNumber,
  getWeekRange,
  getYearMonth,
  
  // Random
  randomInt,
  randomFloat,
  randomChoice,
  randomBool,
  
  // Order Calculations
  calculateOrderTotals,
  createOrderItem,
  
  // Batch Operations
  batchWrite,
  
  // Logging
  logSection,
  logSuccess,
  logError,
  logWarning,
  logInfo,
};
