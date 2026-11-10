-- host2pro MVP schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  credit_balance_thb REAL NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'charge', 'adjust')),
  amount_thb REAL NOT NULL,
  balance_after_thb REAL NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS usdt_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_usdt TEXT NOT NULL UNIQUE,
  amount_thb REAL NOT NULL,
  fx_rate REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  tx_hash TEXT UNIQUE,
  receive_address TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usdt_user ON usdt_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usdt_status ON usdt_payments(status, expires_at);

CREATE TABLE IF NOT EXISTS provider_pool (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'ready_in_pool', 'assigned', 'deleted', 'failed')),
  cloudways_server_id TEXT,
  cloudways_app_id TEXT,
  cloudways_app_fqdn TEXT,
  region TEXT NOT NULL DEFAULT 'singapore',
  cloud TEXT NOT NULL DEFAULT 'do',
  instance_type TEXT NOT NULL DEFAULT 'do_premium_2gb',
  label TEXT,
  assigned_site_id TEXT,
  last_operation_id TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pool_status ON provider_pool(status);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  pool_id TEXT REFERENCES provider_pool(id),
  label TEXT,
  temp_slug TEXT NOT NULL UNIQUE,
  temp_hostname TEXT NOT NULL UNIQUE,
  custom_domain TEXT,
  power_state TEXT NOT NULL DEFAULT 'running'
    CHECK (power_state IN ('running', 'stopped', 'pending', 'deleted')),
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'running', 'stopped', 'deleted')),
  expires_at TEXT NOT NULL,
  last_operation_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sites_temp ON sites(temp_slug);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'ordered'
    CHECK (status IN ('ordered', 'nameservers_set', 'active', 'attached', 'detached', 'failed')),
  site_id TEXT REFERENCES sites(id),
  registrar_order_id TEXT,
  cloudflare_zone_id TEXT,
  nameservers_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domains_user ON domains(user_id);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'cloudways',
  provider_operation_id TEXT,
  kind TEXT NOT NULL,
  site_id TEXT,
  pool_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  detail_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_status ON operations(status);

-- Seed defaults (idempotent via INSERT OR IGNORE)
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('fx_usdt_thb', '34.50', datetime('now')),
  ('fx_updated_at', datetime('now'), datetime('now')),
  ('receive_wallet_trc20', 'TMAm332oS6bBhCeDbGqHGG1vwZPTn9iRzq', datetime('now')),
  ('package_price_thb', '3000', datetime('now')),
  ('package_name', 'Wordpress', datetime('now')),
  ('pool_min_ready', '2', datetime('now')),
  ('cloudways_region', 'singapore', datetime('now')),
  ('cloudways_cloud', 'do', datetime('now')),
  ('cloudways_instance_type', 'do_premium_2gb', datetime('now')),
  ('temp_zone', 'xgb.app', datetime('now')),
  ('landing_host', 'wordpress.xgb.app', datetime('now')),
  ('cloudflare_api_token', '', datetime('now')),
  ('cloudflare_account_id', '', datetime('now')),
  ('cloudflare_zone_id_xgb', '', datetime('now')),
  ('cloudways_api_token', '', datetime('now'));
