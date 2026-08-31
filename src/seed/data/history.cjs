/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HISTORY DATA — Edit History & Snapshots
 * ✅ FIXED: Snapshots use subcollection path objects
 *   - Snapshots are written to orders/{orderId}/snapshots/{snapId}
 *     NOT to top-level 'snapshots' collection
 *   - generateSnapshots returns { path, id, data } objects
 *     same pattern as notifications
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { generateId, timestamp, randomChoice, randomInt, randomBool } = require('../helpers.cjs');

function daysUntilNow(firestoreTimestamp) {
  if (!firestoreTimestamp || !firestoreTimestamp.toDate) return 7;
  const diff = Date.now() - firestoreTimestamp.toDate().getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function generateEditHistory(orders, count = 40) {
  const editHistory = [];
  const adminEmail = 'admin@bakery.com';

  const editableOrders = orders.filter(o =>
    o.status === 'completed' || o.status === 'in_process'
  );

  if (!editableOrders.length) {
    console.warn('⚠️  No editable orders for history');
    return [];
  }

  for (let i = 0; i < count; i++) {
    const order = randomChoice(editableOrders);
    const daysAgo = daysUntilNow(order.createdAt);
    const editDaysAgo = randomInt(0, Math.max(1, daysAgo - 1));

    const originalTotal = order.total;
    const reductionPct = randomInt(5, 30) / 100;
    const newTotal = parseFloat((originalTotal * (1 - reductionPct)).toFixed(2));
    const creditIssued = parseFloat((originalTotal - newTotal).toFixed(2));

    editHistory.push({
      id: generateId('edit'),
      orderId: order.id,
      editedBy: adminEmail,
      editedAt: timestamp(-editDaysAgo).toDate().toISOString(),
      reason: randomChoice([
        'Customer requested quantity reduction',
        'Item unavailable — removed from order',
        'Pricing correction applied',
        'Quality issue — partial refund',
      ]),
      changesSummary: `Order total reduced from $${originalTotal} to $${newTotal}`,
      originalTotal,
      newTotal,
      creditIssued,
      itemsChanged: [],
    });
  }

  return editHistory;
}

/**
 * ✅ FIXED: Returns subcollection path objects
 * Format: { path: ['orders', orderId, 'snapshots'], id, data }
 * Written by seedHistory() in index.js using same pattern as notifications
 */
function generateSnapshots(orders) {
  const snapshots = [];

  const completedOrders = orders.filter(o => o.status === 'completed' && o.completedAt);

  completedOrders.forEach(order => {
    snapshots.push({
      // ✅ Subcollection path: orders/{orderId}/snapshots/{snapId}
      path: ['orders', order.id, 'snapshots'],
      id: generateId('snap'),
      data: {
        id: generateId('snap'),  // also stored inside document
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        trigger: 'complete',

        // Frozen pricing at completion time
        status: order.status,
        subtotal: order.subtotal,
        gst: order.gst,
        deliveryFee: order.deliveryFee,
        serviceCharge: order.serviceCharge,
        total: order.total,

        // Metadata
        weekKey: order.weekKey,
        year: order.year,

        createdAt: order.completedAt,
        createdBy: 'system',
      },
    });
  });

  return snapshots;
}

module.exports = { generateEditHistory, generateSnapshots };
