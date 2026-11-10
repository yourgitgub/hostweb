import { env as cfEnv } from "cloudflare:workers";

export type HostEnv = {
  DB: D1Database;
  JOBS?: Queue;
  SESSION_SECRET?: string;
  JOB_TOKEN?: string;
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
  /** Prefer env / wrangler secrets over admin_settings for runtime tokens */
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID_XGB?: string;
  CLOUDWAYS_ACCESS_TOKEN?: string;
  ENVIRONMENT?: string;
};

export function getEnv(): HostEnv {
  return cfEnv as unknown as HostEnv;
}

export function getDb(): D1Database {
  const { DB } = getEnv();
  if (!DB) {
    throw new Error("D1 binding DB is not configured");
  }
  return DB;
}

export function isProduction(): boolean {
  const env = getEnv();
  return env.ENVIRONMENT === "production" || env.ENVIRONMENT === "prod";
}
