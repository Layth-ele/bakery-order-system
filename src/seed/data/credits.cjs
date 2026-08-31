/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CREDITS DATA — Credit Notes & Applications
 * ✅ FIXED: Aligned with creditNote.schema.ts
 *   - status: 'active' → 'available' (schema enum)
 *   - relatedOrderId → sourceOrderId (schema field name)
 *   - creditType → type (schema field name)
 *   - Removed issuedAmount/usedAmount (not in schema)
 *   - createdAt as ISO string (schema expects isoDateStringSchema)
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { generateId, timestamp, randomChoice, randomFloat, randomInt, randomBool } = require('../helpers.cjs');

function weightedRandom(options) {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let rand = Math.random() * total;
  for (const option of options) {
    rand -= option.weight;
    if (rand <= 0) return option;
  }
  return options[options.length - 1];
}

function isoDate(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

function generateCreditNotes(customers, orders, count = 30) {
  const creditNotes = [];
  const adminEmail = 'admin@bakery.com';
  let noteCounter = 1;

  const eligibleCustomers = customers.filter(c =>
    c.status === 'approved' &&
    orders.some(o => o.customerId === c.id && o.status === 'completed')
  );

  if (!eligibleCustomers.length) {
    console.warn('⚠️  No eligible customers for credit notes');
    return [];
  }

  const creditReasons = [
    { type: 'refund',      reason: 'Damaged products on delivery',         weight: 10 },
    { type: 'refund',      reason: 'Missing items — not included',          weight: 8  },
    { type: 'refund',      reason: 'Quality issue — did not meet standards', weight: 6  },
    { type: 'adjustment',  reason: 'Order edited — quantities reduced',      weight: 6  },
    { type: 'overpayment', reason: 'Overpayment — credit issued',           weight: 4  },
    { type: 'goodwill',    reason: 'Goodwill credit — loyalty reward',       weight: 2  },
  ];

  for (let i = 0; i < count; i++) {
    const customer = randomChoice(eligibleCustomers);
    const reasonData = weightedRandom(creditReasons);

    const amount = reasonData.type === 'goodwill'
      ? randomChoice([25, 50, 75, 100])
      : parseFloat(randomFloat(10, 100).toFixed(2));

    const issuedDaysAgo = randomInt(5, 80);

    // ✅ Schema status enum: available | partially_used | fully_used | paid_out
    const statusRoll = randomChoice(['available', 'available', 'available', 'partially_used', 'fully_used']);
    let remainingBalance = amount;

    if (statusRoll === 'partially_used') {
      remainingBalance = parseFloat((amount * randomFloat(0.2, 0.8)).toFixed(2));
    } else if (statusRoll === 'fully_used') {
      remainingBalance = 0;
    }

    const finalStatus = remainingBalance > 0 ? (remainingBalance < amount ? 'partially_used' : 'available') : 'fully_used';

    // Find a related order for this customer (✅ sourceOrderId)
    const relatedOrders = orders.filter(o => o.customerId === customer.id && o.status === 'completed');
    const relatedOrder = relatedOrders.length ? randomChoice(relatedOrders) : null;

    creditNotes.push({
      id: generateId('CN'),
      customerId: customer.id,
      orderId: relatedOrder?.id || generateId('order'),  // ✅ orderId required by schema
      sourceOrderId: relatedOrder?.id,                    // ✅ alias field
      creditNoteNumber: `CN-2026-${String(noteCounter++).padStart(3, '0')}`,

      // ✅ Schema fields
      amount,                          // alias for total
      total: amount,                   // required by schema
      subtotal: parseFloat((amount / 1.05).toFixed(2)), // pre-GST
      remainingBalance,
      reason: reasonData.reason,
      type: reasonData.type,           // ✅ was creditType
      status: finalStatus,             // ✅ schema enum values

      // Who issued it
      createdBy: adminEmail,           // ✅ required by schema
      createdAt: isoDate(-issuedDaysAgo), // ✅ ISO string (schema expects isoDateStringSchema)
      updatedAt: isoDate(-(remainingBalance < amount ? randomInt(1, issuedDaysAgo - 1) : issuedDaysAgo)),
    });
  }

  return creditNotes;
}

function generateCreditApplications(creditNotes, orders, count = 50) {
  const applications = [];
  const usedCredits = creditNotes.filter(c => c.status !== 'available');

  if (!usedCredits.length) {
    console.warn('⚠️  No used credits found, cannot generate applications');
    return [];
  }

  for (let i = 0; i < count; i++) {
    const creditNote = randomChoice(usedCredits);

    const customerOrders = orders.filter(o =>
      o.customerId === creditNote.customerId &&
      o.status !== 'pending' &&
      o.status !== 'rejected' &&
      o.status !== 'cancelled'
    );
    if (!customerOrders.length) continue;

    const order = randomChoice(customerOrders);
    const maxApplicable = Math.min(creditNote.total, order.total);
    const amountApplied = parseFloat((maxApplicable * randomFloat(0.3, 1.0)).toFixed(2));

    applications.push({
      id: generateId('CA'),
      creditNoteId: creditNote.id,
      orderId: order.id,
      customerId: creditNote.customerId,
      amountApplied,
      appliedAt: isoDate(-randomInt(1, 30)),
      appliedBy: 'system',
      createdAt: isoDate(-randomInt(1, 30)),
    });
  }

  return applications;
}

module.exports = { generateCreditNotes, generateCreditApplications };
