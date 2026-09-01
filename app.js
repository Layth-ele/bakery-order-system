const express = require('express');
const productsRouter = require('./src/routes/products');
const ordersRouter = require('./src/routes/orders');
const wholesaleRouter = require('./src/routes/wholesale');
const { initializeDatabase } = require('./src/db');

initializeDatabase();

const app = express();

app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/wholesale', wholesaleRouter);

app.use((request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  response.status(status).json({
    error: error.message || 'Internal server error',
  });
});

module.exports = app;
