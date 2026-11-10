import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

/**
 * host2pro — Cloudflare Workers (vinext) + D1 + Queue + Cron.
 *
 * Secrets (set via `npx wrangler secret put` / dashboard / `.dev.vars` — never commit):
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID_XGB,
 *   CLOUDWAYS_ACCESS_TOKEN, SESSION_SECRET, JOB_TOKEN
 *
 * Custom domains: wordpress.xgb.app (+ optional *.xgb.app Worker route for deleted 301 fallback).
 * Job tick also available at POST /api/jobs/tick with header x-job-token.
 */
export default defineConfig({
  worker: defineWorker({
    name: "host2pro",
    entrypoint: "./worker/index.ts",
    compatibilityDate: "2026-11-10",
    compatibilityFlags: ["nodejs_compat"],
    workersDev: true,
    previewUrls: true,
    observability: {
      enabled: true,
      traces: { enabled: true },
    },
    // Custom domain on zone account John.kelerman.007; wildcard route for temp {slug}.xgb.app 301s
    domains: ["wordpress.xgb.app"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    triggers: [
      triggers.queue({ name: "host2pro-jobs", maxBatchSize: 5, maxBatchTimeout: 5 }),
      // Every minute: USDT poll (~30s product cadence approximated), pool refill, expiry
      triggers.scheduled({ schedule: "* * * * *" }),
      // Optional deleted-temp fallback (needs proxied * DNS on xgb.app)
      triggers.fetch({ pattern: "*.xgb.app/*", zone: "xgb.app" }),
    ],
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      DB: bindings.d1({ name: "host2pro-db" }),
      JOBS: bindings.queue({ name: "host2pro-jobs" }),
      // Production defaults — SESSION_SECRET / JOB_TOKEN set via `wrangler secret put`
      ENVIRONMENT: bindings.text("production"),
      SESSION_SECRET: bindings.secret(),
      JOB_TOKEN: bindings.secret(),
      BOOTSTRAP_ADMIN_EMAIL: bindings.text("admin@host2pro.local"),
      BOOTSTRAP_ADMIN_PASSWORD: bindings.text("changeme-admin-8"),
      // Account/zone for live CF DNS paths (API token still via secret / Admin UI)
      CLOUDFLARE_API_TOKEN: bindings.text(""),
      CLOUDFLARE_ACCOUNT_ID: bindings.text("aac35693fe24cf2038e63802554144e6"),
      CLOUDFLARE_ZONE_ID_XGB: bindings.text("7c110c5185ab879333ce045d9b4705a6"),
      CLOUDWAYS_ACCESS_TOKEN: bindings.text(""),
    },
  }),
});
