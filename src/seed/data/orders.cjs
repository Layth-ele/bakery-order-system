/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORDERS DATA GENERATOR — 100+ Orders
 * ✅ FIXED: Field names aligned with order.schema.ts
 *   - weekNumber → week
 *   - customerContactPerson added (required)
 *   - removed customerType (not in order schema)
 *   - removed deliveryFeeWaived (not in order schema)
 *   - serviceChargeWaived uses correct field name
 * ═══════════════════════════════════════════════════════════════════════════
 */

const {
  generateId,
  generateInvoiceNumber,
  timestamp,
  dateFromDaysAgo,
  getWeekKey,
  getWeekNumber,
  getWeekRange,
  getYearMonth,
  randomInt,
  randomChoice,
  randomBool,
  calculateOrderTotals,
  createOrderItem,
} = require('../helpers.cjs');

function weightedRandom(options) {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let rand = Math.random() * total;
  for (const option of options) {
    rand -= option.weight;
    if (rand <= 0) return option;
  }
  return options[options.length - 1];
}

function generateCustomerNote(customerType) {
  const commercial = [
    'Please deliver before 7am',
    'Leave at back entrance',
    'Call upon arrival',
    'No substitutions please',
    '',
  ];
  const individual = [
    'Please ring doorbell',
    'Leave at front door',
    '',
    '',
  ];
  return randomChoice(customerType === 'commercial' ? commercial : individual);
}

function generateInternalNote(status) {
  const notes = [
    'Customer confirmed receipt',
    'Delivered on time',
    'Driver noted no issues',
    'Quality checked before dispatch',
    '',
  ];
  return randomChoice(notes);
}

function generateOrders(customers, products, weeksOfData = 12, ordersPerWeek = 7) {
  const commercialCustomers = customers.filter(c => c.customerType === 'commercial' && c.status === 'approved');
  const individualCustomers = customers.filter(c => c.customerType === 'individual' && c.status === 'approved');

  if (!commercialCustomers.length && !individualCustomers.length) {
    console.warn('⚠️  No approved customers found, cannot generate orders');
    return [];
  }

  const orders = [];
  let invoiceCounter = 1;

  const statusDistribution = [
    { status: 'completed', weight: 50 },
    { status: 'in_process', weight: 10 },
    { status: 'approved', weight: 15 },
    { status: 'pending', weight: 20 },
    { status: 'cancelled', weight: 3 },
    { status: 'rejected', weight: 2 },
  ];

  for (let weekAgo = 0; weekAgo < weeksOfData; weekAgo++) {
    const daysAgo = weekAgo * 7;
    const weekDate = dateFromDaysAgo(daysAgo);
    const ordersThisWeek = randomInt(ordersPerWeek - 2, ordersPerWeek + 3);

    for (let i = 0; i < ordersThisWeek; i++) {
      const useCommercial = commercialCustomers.length > 0 &&
        (individualCustomers.length === 0 || randomBool(0.7));
      const customer = useCommercial
        ? randomChoice(commercialCustomers)
        : randomChoice(individualCustomers);
      if (!customer) continue;

      const statusPick = weightedRandom(statusDistribution);
      let finalStatus = statusPick.status;

      if (weekAgo === 0 && finalStatus === 'completed') {
        finalStatus = randomChoice(['pending', 'approved', 'in_process']);
      } else if (weekAgo >= weeksOfData - 2 && finalStatus !== 'cancelled' && finalStatus !== 'rejected') {
        finalStatus = randomChoice(['completed', 'completed', 'completed', finalStatus]);
      }

      const needsInvoice = finalStatus !== 'pending';
      const invoiceNumber = needsInvoice
        ? generateInvoiceNumber(customer.contactPerson || customer.storeName, invoiceCounter++, 2026)
        : null;

      const numProducts = randomInt(2, 5);
      const items = [];
      const selectedProducts = [];

      for (let j = 0; j < numProducts; j++) {
        const product = randomChoice(products);
        if (!product || selectedProducts.includes(product.id)) continue;
        selectedProducts.push(product.id);

        const baseQty = customer.customerType === 'commercial' ? randomInt(5, 15) : randomInt(1, 3);
        const quantities = [
          randomBool(0.8) ? baseQty : 0,
          randomBool(0.8) ? baseQty : 0,
          randomBool(0.8) ? baseQty : 0,
          randomBool(0.7) ? baseQty : 0,
          randomBool(0.7) ? baseQty : 0,
          randomBool(0.5) ? baseQty : 0,
          0,
        ];
        const item = createOrderItem(product, quantities);
        // Compute total from quantities (required by schema refine)
        item.total = quantities.reduce((s, q) => s + q, 0);
        items.push(item);
      }

      if (!items.length) continue;

      const serviceCharge = randomBool(0.8) ? 3.99 : 0;
      const deliveryFee = randomBool(0.9) ? 10.00 : 0;
      const totals = calculateOrderTotals(items, deliveryFee, serviceCharge);

      let paymentReceived = false;
      let paymentSubmitted = false;
      let paidAt = null;

      if (finalStatus === 'completed') {
        paymentReceived = true;
        paymentSubmitted = true;
        paidAt = timestamp(-(daysAgo + randomInt(2, 5)));
      } else if (finalStatus === 'in_process') {
        paymentReceived = true;
        paymentSubmitted = true;
        paidAt = timestamp(-(daysAgo + randomInt(1, 3)));
      } else if (finalStatus === 'approved' && randomBool(0.3)) {
        paymentSubmitted = true;
      }

      // ✅ SCHEMA-ALIGNED: use `week` not `weekNumber`, include `customerContactPerson`
      const order = {
        id: generateId('order'),
        customerId: customer.id,
        customerName: customer.storeName || customer.contactPerson || 'Unknown',
        customerEmail: customer.email,
        customerPhone: customer.phone || '',
        customerAddress: customer.storeAddress || 'Address on file',  // nonEmptyString required
        customerContactPerson: customer.contactPerson || customer.storeName || 'Unknown', // ✅ required

        // Invoice & week info — ✅ use `week` (schema field name)
        invoiceNumber,
        weekRange: getWeekRange(weekDate),
        week: getWeekNumber(weekDate),           // ✅ was weekNumber
        year: 2026,
        weekKey: getWeekKey(weekDate),
        yearMonth: getYearMonth(weekDate),
        deliveryDate: timestamp(-(daysAgo - randomInt(1, 3))),

        // Items and pricing
        items,
        ...totals,
        discount: 0,

        // Status
        status: finalStatus,
        paymentReceived,
        paymentSubmitted,
        ...(paidAt && { paidAt }),

        // Timestamps
        createdAt: timestamp(-(daysAgo + randomInt(5, 7))),
        updatedAt: timestamp(-(daysAgo + randomInt(0, 2))),

        // Notes
        note: generateCustomerNote(customer.customerType),
        ...(finalStatus !== 'pending' && { internalNote: generateInternalNote(finalStatus) }),

        // ✅ Only serviceChargeWaived is in schema (no deliveryFeeWaived)
        serviceChargeWaived: serviceCharge === 0,
        locked: finalStatus === 'completed',
      };

      if (finalStatus === 'cancelled') {
        order.cancelledAt = timestamp(-(daysAgo + randomInt(1, 3)));
        order.cancellationReason = randomChoice([
          'Customer requested cancellation',
          'Unable to fulfill order in time',
          'Customer changed order requirements',
        ]);
      } else if (finalStatus === 'rejected') {
        order.rejectedAt = timestamp(-(daysAgo + randomInt(1, 3)));
        order.rejectionReason = randomChoice([
          'Unable to meet minimum order requirements',
          'Delivery address out of range',
          'Customer payment history issues',
        ]);
      } else if (finalStatus === 'completed') {
        order.completedAt = timestamp(-(daysAgo + randomInt(0, 1)));
      }

      orders.push(order);
    }
  }

  return orders;
}

module.exports = { generateOrders };
