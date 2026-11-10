import {
  DEFAULT_FX_USDT_THB,
  PACKAGE_PRICE_THB,
  RECEIVE_WALLET_TRC20,
  TEMP_ZONE,
  LANDING_HOST,
} from "./constants";
import { getDb, getEnv } from "./env";
import { nowIso } from "./crypto";

export type PublicSettings = {
  fxUsdtThb: number;
  fxUpdatedAt: string;
  receiveWallet: string;
  packagePriceThb: number;
  packageName: string;
  tempZone: string;
  landingHost: string;
};

export type AdminSettings = PublicSettings & {
  poolMinReady: number;
  cloudwaysRegion: string;
  cloudwaysCloud: string;
  cloudwaysInstanceType: string;
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  cloudflareZoneIdXgb: string;
  cloudwaysApiToken: string;
};

async function getMap(): Promise<Record<string, string>> {
  const db = getDb();
  const { results } = await db.prepare("SELECT key, value FROM admin_settings").all<{
    key: string;
    value: string;
  }>();
  const map: Record<string, string> = {};
  for (const row of results ?? []) map[row.key] = row.value;
  return map;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const m = await getMap();
  return {
    fxUsdtThb: Number(m.fx_usdt_thb ?? DEFAULT_FX_USDT_THB),
    fxUpdatedAt: m.fx_updated_at ?? nowIso(),
    receiveWallet: m.receive_wallet_trc20 || RECEIVE_WALLET_TRC20,
    packagePriceThb: Number(m.package_price_thb ?? PACKAGE_PRICE_THB),
    packageName: m.package_name || "Wordpress",
    tempZone: m.temp_zone || TEMP_ZONE,
    landingHost: m.landing_host || LANDING_HOST,
  };
}

/**
 * Credentials resolution order (never invent secrets):
 * 1) Worker env / wrangler secrets (CLOUDFLARE_API_TOKEN, CLOUDWAYS_ACCESS_TOKEN, …)
 * 2) admin_settings values set in backend UI
 */
export async function getAdminSettings(): Promise<AdminSettings> {
  const m = await getMap();
  const pub = await getPublicSettings();
  const env = getEnv();
  return {
    ...pub,
    poolMinReady: Number(m.pool_min_ready ?? 2),
    cloudwaysRegion: m.cloudways_region || "singapore",
    cloudwaysCloud: m.cloudways_cloud || "do",
    cloudwaysInstanceType: m.cloudways_instance_type || "do_premium_2gb",
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN || m.cloudflare_api_token || "",
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID || m.cloudflare_account_id || "",
    cloudflareZoneIdXgb: env.CLOUDFLARE_ZONE_ID_XGB || m.cloudflare_zone_id_xgb || "",
    cloudwaysApiToken: env.CLOUDWAYS_ACCESS_TOKEN || m.cloudways_api_token || "",
  };
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  const db = getDb();
  const ts = nowIso();
  const stmts = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(key, value, ts),
  );
  if (stmts.length) await db.batch(stmts);
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export async function hasCloudflareDns(): Promise<boolean> {
  const s = await getAdminSettings();
  return Boolean(s.cloudflareApiToken && s.cloudflareZoneIdXgb);
}

export async function hasCloudways(): Promise<boolean> {
  const s = await getAdminSettings();
  return Boolean(s.cloudwaysApiToken);
}
