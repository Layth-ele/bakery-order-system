process.env.DATABASE_URL = ':memory:';

const request = require('supertest');
const app = require('../app');
const { resetDatabase } = require('../src/db');

describe('Products API', () => {
  beforeEach(() => {
    resetDatabase();
  });

  test('supports product CRUD and low stock filtering', async () => {
    const createResponse = await request(app).post('/api/products').send({
      name: 'Sourdough Loaf',
      description: 'Naturally leavened bread',
      price: 6.5,
      category: 'bread',
      stock_quantity: 4,
      low_stock_threshold: 5,
      min_wholesale_quantity: 3,
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      name: 'Sourdough Loaf',
      category: 'bread',
      stock_quantity: 4,
      min_wholesale_quantity: 3,
    });

    const listResponse = await request(app).get('/api/products').query({ category: 'bread' });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);

    const lowStockResponse = await request(app).get('/api/products').query({ low_stock: true });
    expect(lowStockResponse.status).toBe(200);
    expect(lowStockResponse.body).toHaveLength(1);

    const productId = createResponse.body.id;
    const getResponse = await request(app).get(`/api/products/${productId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.name).toBe('Sourdough Loaf');

    const updateResponse = await request(app).put(`/api/products/${productId}`).send({
      name: 'Sourdough Batard',
      description: 'Updated description',
      price: 7,
      category: 'bread',
      stock_quantity: 12,
      low_stock_threshold: 2,
      min_wholesale_quantity: 6,
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      name: 'Sourdough Batard',
      stock_quantity: 12,
      min_wholesale_quantity: 6,
    });

    const deleteResponse = await request(app).delete(`/api/products/${productId}`);
    expect(deleteResponse.status).toBe(204);

    const finalGet = await request(app).get(`/api/products/${productId}`);
    expect(finalGet.status).toBe(404);
  });
});
