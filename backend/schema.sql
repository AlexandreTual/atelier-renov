-- Atelier Rénov — D1 Schema
-- Apply with: wrangler d1 execute atelier-renov --file=schema.sql
-- For local dev:  wrangler d1 execute atelier-renov --local --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    onboarding_done INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    purchase_price REAL DEFAULT 0,
    target_resale_price REAL DEFAULT 0,
    actual_resale_price REAL DEFAULT 0,
    status TEXT DEFAULT 'to_be_cleaned',
    purchase_date TEXT,
    sale_date TEXT,
    fees REAL DEFAULT 0,
    material_costs REAL DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    notes TEXT,
    purchase_source TEXT,
    is_donation INTEGER DEFAULT 0,
    item_type TEXT DEFAULT 'Sac',
    listing_url TEXT,
    user_id INTEGER NOT NULL DEFAULT 1,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bag_id INTEGER,
    url TEXT NOT NULL,
    public_id TEXT,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bag_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bag_id INTEGER,
    action TEXT NOT NULL,
    date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bag_consumables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bag_id INTEGER,
    consumable_id INTEGER,
    used_percentage REAL DEFAULT 0,
    cost_at_time REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS consumables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    purchase_price REAL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    unit TEXT DEFAULT 'unité',
    remaining_percentage INTEGER DEFAULT 100,
    notes TEXT,
    user_id INTEGER NOT NULL DEFAULT 1,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL DEFAULT 0,
    category TEXT DEFAULT 'other',
    date TEXT,
    user_id INTEGER NOT NULL DEFAULT 1,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, user_id)
);

CREATE TABLE IF NOT EXISTS item_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, user_id)
);

CREATE TABLE IF NOT EXISTS dashboard_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filters TEXT,
    order_index INTEGER DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    onboarding_enabled INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO app_config (id, onboarding_enabled) VALUES (1, 1);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_images_bag_id ON images(bag_id);
CREATE INDEX IF NOT EXISTS idx_bag_logs_bag_id ON bag_logs(bag_id);
CREATE INDEX IF NOT EXISTS idx_bag_consumables_bag_id ON bag_consumables(bag_id);
CREATE INDEX IF NOT EXISTS idx_bag_consumables_consumable_id ON bag_consumables(consumable_id);
CREATE INDEX IF NOT EXISTS idx_bags_status ON bags(status);
CREATE INDEX IF NOT EXISTS idx_bags_brand ON bags(brand);
CREATE INDEX IF NOT EXISTS idx_bags_created_at ON bags(created_at);
CREATE INDEX IF NOT EXISTS idx_bags_user_id ON bags(user_id);
