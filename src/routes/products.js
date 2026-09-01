const express = require('express');
const { body, param, query } = require('express-validator');
const { db } = require('../db');
const validate = require('../middleware/validate');

const router = express.Router();
const categories = ['bread', 'pastry', 'cake', 'cookie', 'beverage', 'other'];

const productValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').optional({ nullable: true }).isString(),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
  body('category').isIn(categories).withMessage('Invalid category'),
  body('stock_quantity').isInt({ min: 0 }).withMessage('Stock quantity must be 0 or greater'),
  body('low_stock_threshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Low stock threshold must be 0 or greater'),
  body('min_wholesale_quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum wholesale quantity must be at least 1'),
];

router.get(
  '/',
  [
    query('category').optional().isIn(categories),
    query('low_stock').optional().isBoolean(),
    validate,
  ],
  (request, response) => {
    const conditions = [];
    const params = [];

    if (request.query.category) {
      conditions.push('category = ?');
      params.push(request.query.category);
    }

    if (request.query.low_stock === 'true') {
      conditions.push('stock_quantity < low_stock_threshold');
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const products = db
      .prepare(`SELECT * FROM products ${whereClause} ORDER BY id ASC`)
      .all(...params);

    response.json(products);
  }
);

router.post('/', productValidators, validate, (request, response) => {
  const {
    name,
    description,
    price,
    category,
    stock_quantity,
    low_stock_threshold = 10,
    min_wholesale_quantity = 1,
  } = request.body;

  const result = db
    .prepare(
      `INSERT INTO products (
        name,
        description,
        price,
        category,
        stock_quantity,
        low_stock_threshold,
        min_wholesale_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      description || null,
      price,
      category,
      stock_quantity,
      low_stock_threshold,
      min_wholesale_quantity
    );

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(result.lastInsertRowid));
  response.status(201).json(product);
});

router.get('/:id', [param('id').isInt({ min: 1 }), validate], (request, response) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(request.params.id));

  if (!product) {
    return response.status(404).json({ error: 'Product not found' });
  }

  return response.json(product);
});

router.put('/:id', [param('id').isInt({ min: 1 }), ...productValidators, validate], (request, response) => {
  const productId = Number(request.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);

  if (!existing) {
    return response.status(404).json({ error: 'Product not found' });
  }

  const {
    name,
    description,
    price,
    category,
    stock_quantity,
    low_stock_threshold = 10,
    min_wholesale_quantity = 1,
  } = request.body;

  db.prepare(
    `UPDATE products
     SET name = ?, description = ?, price = ?, category = ?, stock_quantity = ?,
         low_stock_threshold = ?, min_wholesale_quantity = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name,
    description || null,
    price,
    category,
    stock_quantity,
    low_stock_threshold,
    min_wholesale_quantity,
    productId
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  response.json(updated);
});

router.delete('/:id', [param('id').isInt({ min: 1 }), validate], (request, response) => {
  const productId = Number(request.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);

  if (!existing) {
    return response.status(404).json({ error: 'Product not found' });
  }

  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    return response.status(204).send();
  } catch (error) {
    return response.status(409).json({ error: 'Product cannot be deleted because it is linked to existing orders' });
  }
});

module.exports = router;
