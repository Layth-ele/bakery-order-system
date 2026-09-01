const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const {
  ORDER_STATUSES,
  createOrder,
  deleteRetailOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
} = require('../services/orderService');

const router = express.Router();

const orderValidators = [
  body('customer_name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer_phone').optional({ nullable: true }).isString(),
  body('customer_email').optional({ nullable: true }).isEmail().withMessage('Valid email is required'),
  body('notes').optional({ nullable: true }).isString(),
  body('items').isArray({ min: 1 }).withMessage('Items are required'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Product id must be a positive integer'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

router.get(
  '/',
  [
    query('status').optional().isIn(ORDER_STATUSES),
    query('order_type').optional().isIn(['retail', 'wholesale']),
    validate,
  ],
  (request, response) => {
    const orders = listOrders({
      status: request.query.status,
      order_type: request.query.order_type,
    });

    response.json(orders);
  }
);

router.post('/', orderValidators, validate, (request, response, next) => {
  try {
    const order = createOrder({
      ...request.body,
      order_type: 'retail',
    });

    response.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', [param('id').isInt({ min: 1 }), validate], (request, response, next) => {
  try {
    const order = getOrderById(Number(request.params.id), 'retail');
    response.json(order);
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:id/status',
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(ORDER_STATUSES).withMessage('Invalid order status'),
    validate,
  ],
  (request, response, next) => {
    try {
      const order = updateOrderStatus(Number(request.params.id), request.body.status, 'retail');
      response.json(order);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', [param('id').isInt({ min: 1 }), validate], (request, response, next) => {
  try {
    const result = deleteRetailOrder(Number(request.params.id));

    if (result.action === 'deleted') {
      return response.status(204).send();
    }

    return response.json({ message: 'Order cancelled' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
