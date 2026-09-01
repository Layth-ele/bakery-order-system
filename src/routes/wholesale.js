const express = require('express');
const { body, param, query } = require('express-validator');
const { db } = require('../db');
const validate = require('../middleware/validate');
const { ORDER_STATUSES, createOrder, getOrderById, listOrders, updateOrderStatus } = require('../services/orderService');

const router = express.Router();

const customerValidators = [
  body('business_name').trim().notEmpty().withMessage('Business name is required'),
  body('contact_name').trim().notEmpty().withMessage('Contact name is required'),
  body('phone').optional({ nullable: true }).isString(),
  body('email').optional({ nullable: true }).isEmail().withMessage('Valid email is required'),
  body('address').optional({ nullable: true }).isString(),
  body('discount_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount percentage must be between 0 and 100'),
];

const wholesaleOrderValidators = [
  body('wholesale_customer_id').isInt({ min: 1 }).withMessage('Wholesale customer id is required'),
  body('customer_name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer_phone').optional({ nullable: true }).isString(),
  body('customer_email').optional({ nullable: true }).isEmail().withMessage('Valid email is required'),
  body('notes').optional({ nullable: true }).isString(),
  body('items').isArray({ min: 1 }).withMessage('Items are required'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Product id must be a positive integer'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

router.get('/customers', (_request, response) => {
  const customers = db.prepare('SELECT * FROM wholesale_customers ORDER BY id ASC').all();
  response.json(customers);
});

router.post('/customers', customerValidators, validate, (request, response) => {
  const {
    business_name,
    contact_name,
    phone,
    email,
    address,
    discount_percentage = 0,
  } = request.body;

  const result = db
    .prepare(
      `INSERT INTO wholesale_customers (
        business_name,
        contact_name,
        phone,
        email,
        address,
        discount_percentage
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      business_name,
      contact_name,
      phone || null,
      email || null,
      address || null,
      discount_percentage
    );

  const customer = db
    .prepare('SELECT * FROM wholesale_customers WHERE id = ?')
    .get(Number(result.lastInsertRowid));

  response.status(201).json(customer);
});

router.get('/customers/:id', [param('id').isInt({ min: 1 }), validate], (request, response) => {
  const customerId = Number(request.params.id);
  const customer = db.prepare('SELECT * FROM wholesale_customers WHERE id = ?').get(customerId);

  if (!customer) {
    return response.status(404).json({ error: 'Wholesale customer not found' });
  }

  const orders = db
    .prepare(
      `SELECT * FROM orders
       WHERE wholesale_customer_id = ?
       ORDER BY created_at DESC, id DESC`
    )
    .all(customerId);

  return response.json({
    ...customer,
    orders,
  });
});

router.put('/customers/:id', [param('id').isInt({ min: 1 }), ...customerValidators, validate], (request, response) => {
  const customerId = Number(request.params.id);
  const existing = db.prepare('SELECT * FROM wholesale_customers WHERE id = ?').get(customerId);

  if (!existing) {
    return response.status(404).json({ error: 'Wholesale customer not found' });
  }

  const {
    business_name,
    contact_name,
    phone,
    email,
    address,
    discount_percentage = 0,
  } = request.body;

  db.prepare(
    `UPDATE wholesale_customers
     SET business_name = ?, contact_name = ?, phone = ?, email = ?, address = ?,
         discount_percentage = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    business_name,
    contact_name,
    phone || null,
    email || null,
    address || null,
    discount_percentage,
    customerId
  );

  const updated = db.prepare('SELECT * FROM wholesale_customers WHERE id = ?').get(customerId);
  response.json(updated);
});

router.delete('/customers/:id', [param('id').isInt({ min: 1 }), validate], (request, response) => {
  const customerId = Number(request.params.id);
  const existing = db.prepare('SELECT * FROM wholesale_customers WHERE id = ?').get(customerId);

  if (!existing) {
    return response.status(404).json({ error: 'Wholesale customer not found' });
  }

  try {
    db.prepare('DELETE FROM wholesale_customers WHERE id = ?').run(customerId);
    return response.status(204).send();
  } catch (error) {
    return response.status(409).json({ error: 'Wholesale customer cannot be deleted because they have linked orders' });
  }
});

router.post('/orders', wholesaleOrderValidators, validate, (request, response, next) => {
  try {
    const order = createOrder({
      ...request.body,
      order_type: 'wholesale',
    });

    response.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/orders',
  [
    query('customer_id').optional().isInt({ min: 1 }),
    query('status').optional().isIn(ORDER_STATUSES),
    validate,
  ],
  (request, response) => {
    const orders = listOrders({
      order_type: 'wholesale',
      status: request.query.status,
      wholesale_customer_id: request.query.customer_id,
    });

    response.json(orders);
  }
);

router.get('/orders/:id', [param('id').isInt({ min: 1 }), validate], (request, response, next) => {
  try {
    const order = getOrderById(Number(request.params.id), 'wholesale');
    response.json(order);
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/orders/:id/status',
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(ORDER_STATUSES).withMessage('Invalid order status'),
    validate,
  ],
  (request, response, next) => {
    try {
      const order = updateOrderStatus(Number(request.params.id), request.body.status, 'wholesale');
      response.json(order);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
