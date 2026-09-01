process.env.DATABASE_URL = ':memory:';

const request = require('supertest');
const app = require('../app');
const { resetDatabase } = require('../src/db');

describe('Retail Orders API', () => {
  beforeEach(() => {
    resetDatabase();
  });

  test('creates retail orders, confirms them, and restores stock on cancellation', async () => {
    const productResponse = await request(app).post('/api/products').send({
      name: 'Croissant',
      description: 'Butter croissant',
      price: 3.5,
      category: 'pastry',
      stock_quantity: 20,
      low_stock_threshold: 5,
    });

    const productId = productResponse.body.id;

    const orderResponse = await request(app).post('/api/orders').send({
      customer_name: 'Jane Doe',
      customer_phone: '1234567890',
      customer_email: 'jane@example.com',
      notes: 'Pickup at noon',
      items: [{ product_id: productId, quantity: 3 }],
    });

    expect(orderResponse.status).toBe(201);
    expect(orderResponse.body).toMatchObject({
      customer_name: 'Jane Doe',
      status: 'pending',
      order_type: 'retail',
      total_amount: 10.5,
    });
    expect(orderResponse.body.items).toHaveLength(1);
    expect(orderResponse.body.items[0]).toMatchObject({
      product_id: productId,
      quantity: 3,
      unit_price: 3.5,
      subtotal: 10.5,
    });

    const confirmResponse = await request(app)
      .patch(`/api/orders/${orderResponse.body.id}/status`)
      .send({ status: 'confirmed' });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.status).toBe('confirmed');

    const stockAfterConfirm = await request(app).get(`/api/products/${productId}`);
    expect(stockAfterConfirm.body.stock_quantity).toBe(17);

    const cancelResponse = await request(app)
      .patch(`/api/orders/${orderResponse.body.id}/status`)
      .send({ status: 'cancelled' });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.status).toBe('cancelled');

    const stockAfterCancel = await request(app).get(`/api/products/${productId}`);
    expect(stockAfterCancel.body.stock_quantity).toBe(20);
  });
});
