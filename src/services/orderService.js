const { db } = require('../db');

const ORDER_STATUSES = ['pending', 'confirmed', 'in_progress', 'ready', 'delivered', 'cancelled'];
const ORDER_CATEGORIES_WITH_STOCK = new Set(['confirmed', 'in_progress', 'ready', 'delivered']);
const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'ready', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

function getProductsByIds(productIds) {
  const uniqueIds = [...new Set(productIds)];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
    .all(...uniqueIds);

  return new Map(rows.map((product) => [product.id, product]));
}

function prepareOrderItems(items, orderType) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createError(400, 'Order must contain at least one item');
  }

  const productMap = getProductsByIds(items.map((item) => item.product_id));
  const requestedQuantities = new Map();

  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      throw createError(404, `Product ${item.product_id} not found`);
    }

    const nextQuantity = (requestedQuantities.get(item.product_id) || 0) + item.quantity;
    requestedQuantities.set(item.product_id, nextQuantity);
  }

  for (const [productId, totalQuantity] of requestedQuantities.entries()) {
    const product = productMap.get(productId);

    if (totalQuantity > product.stock_quantity) {
      throw createError(400, `Insufficient stock for product ${product.name}`);
    }

    if (orderType === 'wholesale' && totalQuantity < product.min_wholesale_quantity) {
      throw createError(
        400,
        `Product ${product.name} requires a minimum wholesale quantity of ${product.min_wholesale_quantity}`
      );
    }
  }

  const preparedItems = items.map((item) => {
    const product = productMap.get(item.product_id);
    const unitPrice = roundCurrency(product.price);
    const subtotal = roundCurrency(unitPrice * item.quantity);

    return {
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal,
    };
  });

  const subtotalAmount = roundCurrency(
    preparedItems.reduce((sum, item) => sum + item.subtotal, 0)
  );

  return { preparedItems, subtotalAmount };
}

function getWholesaleCustomer(customerId) {
  const customer = db
    .prepare('SELECT * FROM wholesale_customers WHERE id = ?')
    .get(customerId);

  if (!customer) {
    throw createError(404, `Wholesale customer ${customerId} not found`);
  }

  return customer;
}

function getOrderItems(orderId) {
  return db
    .prepare(
      `SELECT order_items.*, products.name AS product_name, products.category AS product_category
       FROM order_items
       JOIN products ON products.id = order_items.product_id
       WHERE order_items.order_id = ?
       ORDER BY order_items.id ASC`
    )
    .all(orderId);
}

function getOrderById(orderId, orderType) {
  const order = db
    .prepare(
      `SELECT orders.*, wholesale_customers.business_name AS wholesale_business_name
       FROM orders
       LEFT JOIN wholesale_customers ON wholesale_customers.id = orders.wholesale_customer_id
       WHERE orders.id = ?`
    )
    .get(orderId);

  if (!order) {
    throw createError(404, 'Order not found');
  }

  if (orderType && order.order_type !== orderType) {
    throw createError(404, 'Order not found');
  }

  return {
    ...order,
    items: getOrderItems(orderId),
  };
}

function createOrder(orderPayload) {
  const transaction = db.transaction((payload) => {
    let discountPercentage = 0;

    if (payload.order_type === 'wholesale') {
      const wholesaleCustomer = getWholesaleCustomer(payload.wholesale_customer_id);
      discountPercentage = wholesaleCustomer.discount_percentage;
    }

    const { preparedItems, subtotalAmount } = prepareOrderItems(payload.items, payload.order_type);
    const totalAmount = roundCurrency(subtotalAmount * (1 - discountPercentage / 100));

    const orderResult = db
      .prepare(
        `INSERT INTO orders (
          customer_name,
          customer_phone,
          customer_email,
          status,
          total_amount,
          notes,
          order_type,
          wholesale_customer_id,
          discount_percentage
        ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
      )
      .run(
        payload.customer_name,
        payload.customer_phone || null,
        payload.customer_email || null,
        totalAmount,
        payload.notes || null,
        payload.order_type,
        payload.wholesale_customer_id || null,
        discountPercentage
      );

    const orderId = Number(orderResult.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
       VALUES (?, ?, ?, ?, ?)`
    );

    for (const item of preparedItems) {
      insertItem.run(orderId, item.product_id, item.quantity, item.unit_price, item.subtotal);
    }

    return getOrderById(orderId, payload.order_type);
  });

  return transaction(orderPayload);
}

function listOrders(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters.order_type) {
    clauses.push('order_type = ?');
    params.push(filters.order_type);
  }

  if (filters.wholesale_customer_id) {
    clauses.push('wholesale_customer_id = ?');
    params.push(filters.wholesale_customer_id);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC, id DESC`)
    .all(...params);
}

function ensureValidTransition(currentStatus, nextStatus) {
  if (!ORDER_STATUSES.includes(nextStatus)) {
    throw createError(400, 'Invalid order status');
  }

  if (currentStatus === nextStatus) {
    return;
  }

  const allowedStatuses = STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedStatuses.includes(nextStatus)) {
    throw createError(400, `Cannot change order status from ${currentStatus} to ${nextStatus}`);
  }
}

function adjustStockForOrderItems(orderId, operation) {
  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
  const quantitiesByProduct = new Map();

  for (const item of items) {
    quantitiesByProduct.set(
      item.product_id,
      (quantitiesByProduct.get(item.product_id) || 0) + item.quantity
    );
  }

  for (const [productId, quantity] of quantitiesByProduct.entries()) {
    if (operation === 'deduct') {
      const product = db.prepare('SELECT name, stock_quantity FROM products WHERE id = ?').get(productId);
      if (!product) {
        throw createError(404, `Product ${productId} not found`);
      }

      if (product.stock_quantity < quantity) {
        throw createError(400, `Insufficient stock for product ${product.name}`);
      }

      db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?').run(quantity, productId);
    }

    if (operation === 'restore') {
      db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(quantity, productId);
    }
  }
}

function updateOrderStatus(orderId, nextStatus, orderType) {
  const transaction = db.transaction((id, status, expectedType) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

    if (!order) {
      throw createError(404, 'Order not found');
    }

    if (expectedType && order.order_type !== expectedType) {
      throw createError(404, 'Order not found');
    }

    ensureValidTransition(order.status, status);

    const hadStockDeducted = ORDER_CATEGORIES_WITH_STOCK.has(order.status);
    const shouldDeductStock = ORDER_CATEGORIES_WITH_STOCK.has(status);

    if (!hadStockDeducted && shouldDeductStock) {
      adjustStockForOrderItems(id, 'deduct');
    }

    if (hadStockDeducted && status === 'cancelled') {
      adjustStockForOrderItems(id, 'restore');
    }

    db.prepare('UPDATE orders SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id);
    return getOrderById(id, expectedType);
  });

  return transaction(orderId, nextStatus, orderType);
}

function deleteRetailOrder(orderId) {
  const transaction = db.transaction((id) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

    if (!order || order.order_type !== 'retail') {
      throw createError(404, 'Order not found');
    }

    if (ORDER_CATEGORIES_WITH_STOCK.has(order.status)) {
      adjustStockForOrderItems(id, 'restore');
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);
      return { action: 'cancelled' };
    }

    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    return { action: 'deleted' };
  });

  return transaction(orderId);
}

module.exports = {
  ORDER_STATUSES,
  createError,
  createOrder,
  deleteRetailOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
};
