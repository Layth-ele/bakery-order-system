process.env.DATABASE_URL = ':memory:';

const request = require('supertest');
const app = require('../app');
const { resetDatabase } = require('../src/db');

describe('Wholesale API', () => {
  beforeEach(() => {
    resetDatabase();
  });

  test('supports wholesale customer CRUD', async () => {
    const createResponse = await request(app).post('/api/wholesale/customers').send({
      business_name: 'Morning Cafe',
      contact_name: 'Alex Manager',
      phone: '1112223333',
      email: 'orders@morningcafe.test',
      address: '1 Market Street',
      discount_percentage: 12,
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.business_name).toBe('Morning Cafe');

    const customerId = createResponse.body.id;

    const listResponse = await request(app).get('/api/wholesale/customers');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);

    const getResponse = await request(app).get(`/api/wholesale/customers/${customerId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.orders).toEqual([]);

    const updateResponse = await request(app).put(`/api/wholesale/customers/${customerId}`).send({
      business_name: 'Morning Cafe Updated',
      contact_name: 'Alex Manager',
      phone: '1112223333',
      email: 'new@morningcafe.test',
      address: '99 Baker Lane',
      discount_percentage: 15,
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      business_name: 'Morning Cafe Updated',
      discount_percentage: 15,
    });

    const deleteResponse = await request(app).delete(`/api/wholesale/customers/${customerId}`);
    expect(deleteResponse.status).toBe(204);
  });

  test('creates wholesale orders with automatic discount and stock deduction on confirmation', async () => {
    const productResponse = await request(app).post('/api/products').send({
      name: 'Chocolate Cookie',
      description: 'Wholesale cookie batch',
      price: 5,
      category: 'cookie',
      stock_quantity: 50,
      low_stock_threshold: 10,
      min_wholesale_quantity: 5,
    });

    const customerResponse = await request(app).post('/api/wholesale/customers').send({
      business_name: 'Downtown Bistro',
      contact_name: 'Taylor Buyer',
      phone: '4445556666',
      email: 'buyer@bistro.test',
      address: '22 Center Plaza',
      discount_percentage: 10,
    });

    const orderResponse = await request(app).post('/api/wholesale/orders').send({
      wholesale_customer_id: customerResponse.body.id,
      customer_name: 'Downtown Bistro Receiving',
      customer_phone: '4445556666',
      customer_email: 'receiving@bistro.test',
      items: [{ product_id: productResponse.body.id, quantity: 5 }],
      notes: 'Deliver before 8 AM',
    });

    expect(orderResponse.status).toBe(201);
    expect(orderResponse.body).toMatchObject({
      order_type: 'wholesale',
      wholesale_customer_id: customerResponse.body.id,
      discount_percentage: 10,
      total_amount: 22.5,
    });

    const listResponse = await request(app).get('/api/wholesale/orders').query({
      customer_id: customerResponse.body.id,
    });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);

    const confirmResponse = await request(app)
      .patch(`/api/wholesale/orders/${orderResponse.body.id}/status`)
      .send({ status: 'confirmed' });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.status).toBe('confirmed');

    const updatedProduct = await request(app).get(`/api/products/${productResponse.body.id}`);
    expect(updatedProduct.body.stock_quantity).toBe(45);
  });
});
