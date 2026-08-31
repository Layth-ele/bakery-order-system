/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTIFICATIONS DATA GENERATOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CRITICAL: App uses hierarchical Firestore paths:
 *   - Admin:    notifications/admin/items/{notifId}
 *   - Customer: notifications/user_{customerId}/items/{notifId}
 *
 * This generator produces flat objects + target metadata.
 * The seed index.js writes them to the correct subcollection paths.
 */

const { generateId, timestamp, randomBool, randomInt } = require('../helpers.cjs');

function daysUntilNow(firestoreTimestamp) {
  if (!firestoreTimestamp || !firestoreTimestamp.toDate) return 7;
  const diff = Date.now() - firestoreTimestamp.toDate().getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Returns an array of { path: [...], id, data } objects.
 * Each item targets the correct hierarchical subcollection.
 */
function generateNotifications(orders, customers) {
  const results = [];

  orders.forEach(order => {
    const customer = customers.find(c => c.id === order.customerId);
    if (!customer) return;

    const orderAgeDays = daysUntilNow(order.createdAt);
    const isOld = orderAgeDays > 3;

    // ── 1. Order placed → admin notification ──────────────────────────────
    results.push({
      path: ['notifications', 'admin', 'items'],
      id: generateId('notif'),
      data: {
        type: 'order_placed',
        customerId: customer.id,
        customerEmail: customer.email,
        orderId: order.id,
        title: 'New Order Received',
        message: `New order from ${customer.storeName || customer.contactPerson}`,
        read: isOld,
        readAt: isOld ? timestamp(-orderAgeDays + 1) : null,
        isRead: isOld,
        createdAt: order.createdAt,
        metadata: {
          orderStatus: 'pending',
          customerName: customer.storeName || customer.contactPerson,
          customerType: customer.customerType,
          orderTotal: order.total,
        },
      },
    });

    // ── 2. Order placed → customer notification ───────────────────────────
    results.push({
      path: ['notifications', `user_${customer.id}`, 'items'],
      id: generateId('notif'),
      data: {
        type: 'order_placed',
        customerId: customer.id,
        orderId: order.id,
        title: 'Order Placed Successfully',
        message: 'Your order has been submitted and is awaiting approval.',
        read: isOld,
        readAt: isOld ? timestamp(-orderAgeDays + 1) : null,
        isRead: isOld,
        createdAt: order.createdAt,
        metadata: {
          orderStatus: 'pending',
          orderTotal: order.total,
        },
      },
    });

    // ── 3. Order approved → customer notification ─────────────────────────
    if (['approved', 'in_process', 'completed'].includes(order.status)) {
      results.push({
        path: ['notifications', `user_${customer.id}`, 'items'],
        id: generateId('notif'),
        data: {
          type: 'order_approved',
          customerId: customer.id,
          orderId: order.id,
          title: 'Order Approved',
          message: `Your order has been approved! Delivery: ${order.weekRange || 'this week'}.`,
          read: true,
          readAt: timestamp(-Math.max(1, orderAgeDays - 1)),
          isRead: true,
          createdAt: timestamp(-Math.max(1, orderAgeDays - 1)),
          metadata: {
            orderStatus: 'approved',
            deliveryFee: order.deliveryFee,
            orderTotal: order.total,
          },
        },
      });
    }

    // ── 4. Payment reminder → customer notification ───────────────────────
    if (order.status === 'approved' && randomBool(0.3)) {
      results.push({
        path: ['notifications', `user_${customer.id}`, 'items'],
        id: generateId('notif'),
        data: {
          type: 'payment_reminder',
          customerId: customer.id,
          orderId: order.id,
          title: 'Payment Reminder',
          message: `Please submit payment for order ${order.invoiceNumber || order.id}.`,
          read: randomBool(0.6),
          isRead: false,
          createdAt: timestamp(-Math.max(0, orderAgeDays - 2)),
          metadata: {
            orderTotal: order.total,
            invoiceNumber: order.invoiceNumber,
          },
        },
      });
    }

    // ── 5. Order completed → customer notification ────────────────────────
    if (order.status === 'completed') {
      results.push({
        path: ['notifications', `user_${customer.id}`, 'items'],
        id: generateId('notif'),
        data: {
          type: 'order_completed',
          customerId: customer.id,
          orderId: order.id,
          title: 'Order Completed',
          message: 'Your order has been completed. Invoice is available for download.',
          read: true,
          readAt: timestamp(-1),
          isRead: true,
          createdAt: order.completedAt || timestamp(-1),
          metadata: {
            invoiceNumber: order.invoiceNumber,
            orderTotal: order.total,
          },
        },
      });
    }
  });

  return results;
}

module.exports = { generateNotifications };
