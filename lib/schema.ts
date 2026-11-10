import { getDb } from "./env";

let migrated = false;

/** Apply embedded MVP schema once per isolate (local/dev + first request). */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  const db = getDb();
  // Split statements carefully — D1 exec supports multi-statement in many runtimes
  const sql = SCHEMA_SQL;
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await db.prepare(stmt).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore "already exists" style races
      if (!/already exists|duplicate/i.test(msg)) {
        console.error("schema stmt failed", msg, stmt.slice(0, 80));
      }
    }
  }
  migrated = true;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  credit_balance_thb REAL NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_thb REAL NOT NULL,
  balance_after_thb REAL NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usdt_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_usdt TEXT NOT NULL UNIQUE,
  amount_thb REAL NOT NULL,
  fx_rate REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT UNIQUE,
  receive_address TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_pool (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'provisioning',
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
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pool_id TEXT,
  label TEXT,
  temp_slug TEXT NOT NULL UNIQUE,
  temp_hostname TEXT NOT NULL UNIQUE,
  custom_domain TEXT,
  power_state TEXT NOT NULL DEFAULT 'running',
  status TEXT NOT NULL DEFAULT 'assigned',
  expires_at TEXT NOT NULL,
  last_operation_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'ordered',
  site_id TEXT,
  registrar_order_id TEXT,
  cloudflare_zone_id TEXT,
  nameservers_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
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
  status TEXT NOT NULL DEFAULT 'queued',
  detail_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('fx_usdt_thb', '34.50', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('fx_updated_at', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('receive_wallet_trc20', 'TMAm332oS6bBhCeDbGqHGG1vwZPTn9iRzq', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('package_price_thb', '3000', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('package_name', 'Wordpress', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('pool_min_ready', '2', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('cloudways_region', 'singapore', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('cloudways_cloud', 'do', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('cloudways_instance_type', 'do_premium_2gb', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('temp_zone', 'xgb.app', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('landing_host', 'wordpress.xgb.app', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('cloudflare_api_token', '', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('cloudflare_account_id', '', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('cloudflare_zone_id_xgb', '', datetime('now'));
INSERT OR IGNORE INTO admin_settings (key, value, updated_at) VALUES
  ('cloudways_api_token', '', datetime('now'));
`;
