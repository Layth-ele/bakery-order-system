/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CUSTOMERS DATA — 20+ Customers
 * ✅ FIXED: Aligned with customer.schema.ts
 *   - storeName: null → removed (use empty string or omit for individuals)
 *   - Extra fields (professionalId, creditBalance, etc.) kept as Firestore ignores them
 *     but they don't break schema validation since schema uses .passthrough-like reading
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { generateId, generateCustomerId, timestamp } = require('../helpers.cjs');

function generateCustomers() {
  let custCounter = 1;

  return [
    // ── ADMIN ───────────────────────────────────────────────────────────────
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'admin@bakery.com',               // ✅ matches VITE_ADMIN_EMAIL default
      storeName: 'Delight Bakehouse Admin',
      contactPerson: 'Admin User',
      phone: '+1 (604) 555-0123',
      storeAddress: '123 Example St, City, BC V0V 0V0', // FIX R3-S3-F4: was real bakery address
      customerType: 'admin',
      status: 'approved',
      password: process.env.SEED_ADMIN_PASSWORD || 'CHANGE_ME_IN_ENV',  // FIX R3-S3-F4: was hardcoded plaintext, now from env
      createdAt: timestamp(-90),
      updatedAt: timestamp(-90),
    },

    // ── COMMERCIAL CUSTOMERS ────────────────────────────────────────────────
    {
      id: 'customer-1',                        // ✅ stable IDs match demo login
      professionalId: generateCustomerId(custCounter++),
      email: 'john@commercial.com',
      storeName: "John's Bakery",
      contactPerson: 'John Smith',
      phone: '+1 (604) 555-0201',
      storeAddress: '456 Main Street, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-80),
      updatedAt: timestamp(-2),
    },
    {
      id: 'customer-2',
      professionalId: generateCustomerId(custCounter++),
      email: 'store@cafe.com',
      storeName: 'Demo Cafe',
      contactPerson: 'Sarah Johnson',
      phone: '+1 (604) 555-0202',
      storeAddress: '789 Oak Avenue, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-75),
      updatedAt: timestamp(-1),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'mike@downtownhotel.com',
      storeName: 'Downtown Hotel',
      contactPerson: 'Mike Brown',
      phone: '+1 (604) 555-0203',
      storeAddress: '321 Hotel Drive, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-70),
      updatedAt: timestamp(-3),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'lisa@bistro.com',
      storeName: "Lisa's Bistro",
      contactPerson: 'Lisa Chen',
      phone: '+1 (604) 555-0204',
      storeAddress: '567 Bistro Lane, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-65),
      updatedAt: timestamp(-4),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'tom@catering.com',
      storeName: "Tom's Catering Services",
      contactPerson: 'Tom Wilson',
      phone: '+1 (604) 555-0205',
      storeAddress: '890 Catering Blvd, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-60),
      updatedAt: timestamp(-5),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'maria@cafe.com',
      storeName: "Maria's Cafe",
      contactPerson: 'Maria Garcia',
      phone: '+1 (604) 555-0206',
      storeAddress: '234 Cafe Street, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-55),
      updatedAt: timestamp(-6),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'robert@deli.com',
      storeName: "Robert's Deli",
      contactPerson: 'Robert Lee',
      phone: '+1 (604) 555-0207',
      storeAddress: '678 Deli Avenue, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-50),
      updatedAt: timestamp(-7),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'jennifer@bakeshop.com',
      storeName: "Jennifer's Bake Shop",
      contactPerson: 'Jennifer White',
      phone: '+1 (604) 555-0208',
      storeAddress: '345 Baker Road, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-45),
      updatedAt: timestamp(-8),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'david@teahouse.com',
      storeName: "David's Tea House",
      contactPerson: 'David Kim',
      phone: '+1 (604) 555-0209',
      storeAddress: '901 Tea Lane, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-40),
      updatedAt: timestamp(-9),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'susan@brunch.com',
      storeName: "Susan's Brunch Spot",
      contactPerson: 'Susan Taylor',
      phone: '+1 (604) 555-0210',
      storeAddress: '123 Brunch Boulevard, Vancouver, BC',
      customerType: 'commercial',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-35),
      updatedAt: timestamp(-10),
    },

    // ── INDIVIDUAL CUSTOMERS ────────────────────────────────────────────────
    {
      id: 'customer-3',                        // ✅ stable ID matches demo
      professionalId: generateCustomerId(custCounter++),
      email: 'individual@test.com',
      storeName: 'Jane Individual',            // ✅ non-null (schema rejects null)
      contactPerson: 'Jane Individual',
      phone: '+1 (604) 555-0301',
      storeAddress: '555 Residential St, Vancouver, BC',
      customerType: 'individual',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-55),
      updatedAt: timestamp(-6),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'david.wilson@email.com',
      storeName: 'David Wilson',
      contactPerson: 'David Wilson',
      phone: '+1 (604) 555-0302',
      storeAddress: '777 Home Ave, Vancouver, BC',
      customerType: 'individual',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-50),
      updatedAt: timestamp(-7),
    },
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'jennifer.m@email.com',
      storeName: 'Jennifer Martinez',
      contactPerson: 'Jennifer Martinez',
      phone: '+1 (604) 555-0303',
      storeAddress: '234 Family Road, Vancouver, BC',
      customerType: 'individual',
      status: 'approved',
      password: process.env.SEED_CUSTOMER_PASSWORD || 'CHANGE_ME_IN_ENV',
      createdAt: timestamp(-45),
      updatedAt: timestamp(-8),
    },

    // ── PENDING CUSTOMER ────────────────────────────────────────────────────
    {
      id: generateId('cust'),
      professionalId: null,
      email: 'pending@newcafe.com',
      storeName: 'New Cafe Downtown',
      contactPerson: 'Alex Martinez',
      phone: '+1 (604) 555-0501',
      storeAddress: '111 Pending St, Vancouver, BC',
      customerType: 'commercial',
      status: 'pending',
      createdAt: timestamp(-2),
      updatedAt: timestamp(-2),
    },

    // ── SUSPENDED CUSTOMER ──────────────────────────────────────────────────
    {
      id: generateId('cust'),
      professionalId: generateCustomerId(custCounter++),
      email: 'suspended@oldcafe.com',
      storeName: 'Old Cafe',
      contactPerson: 'Suspended User',
      phone: '+1 (604) 555-0401',
      storeAddress: '999 Suspended St, Vancouver, BC',
      customerType: 'commercial',
      status: 'suspended',
      createdAt: timestamp(-100),
      updatedAt: timestamp(-30),
    },
  ];
}

module.exports = { generateCustomers };
