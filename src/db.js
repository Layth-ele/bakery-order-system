const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.join(process.cwd(), 'bakery.sqlite');

let db;

function getDatabasePath() {
  return process.env.DATABASE_URL || DEFAULT_DB_PATH;
}

function createConnection() {
  const connection = new Database(getDatabasePath());
  connection.pragma('foreign_keys = ON');
  return connection;
}

function createUpdatedAtTrigger(tableName) {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS ${tableName}_updated_at
    AFTER UPDATE ON ${tableName}
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE ${tableName}
      SET updated_at = datetime('now')
      WHERE id = OLD.id;
    END;
  `);
}

function initializeDatabase() {
  if (!db) {
    db = createConnection();
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS wholesale_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      discount_percentage REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      min_wholesale_quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      order_type TEXT NOT NULL DEFAULT 'retail',
      wholesale_customer_id INTEGER REFERENCES wholesale_customers(id),
      discount_percentage REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );
  `);

  const productColumns = db.prepare("PRAGMA table_info(products)").all();
  if (!productColumns.some((column) => column.name === 'min_wholesale_quantity')) {
    db.exec("ALTER TABLE products ADD COLUMN min_wholesale_quantity INTEGER NOT NULL DEFAULT 1");
  }

  createUpdatedAtTrigger('products');
  createUpdatedAtTrigger('orders');
  createUpdatedAtTrigger('wholesale_customers');

  return db;
}

function resetDatabase() {
  const connection = initializeDatabase();
  connection.exec(`
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS wholesale_customers;
    DROP TRIGGER IF EXISTS products_updated_at;
    DROP TRIGGER IF EXISTS orders_updated_at;
    DROP TRIGGER IF EXISTS wholesale_customers_updated_at;
  `);

  initializeDatabase();
}

module.exports = {
  db: initializeDatabase(),
  initializeDatabase,
  resetDatabase,
};
