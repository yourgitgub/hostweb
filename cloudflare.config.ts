import { bindings, defineConfig, defineWorker } from "cf/config";

/**
 * host2pro — Cloudflare Workers (vinext) + D1 + Queue producer.
 * Job tick: POST /api/jobs/tick (authorize with JOB_TOKEN).
 * Cloudflare/Cloudways API keys live in admin_settings (backend UI), not here.
 * SESSION_SECRET / JOB_TOKEN / bootstrap vars: override in production via CF secrets
 * or .dev.vars — values below are local placeholders only.
 */
export default defineConfig({
  worker: defineWorker({
    name: "host2pro",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-10",
    compatibilityFlags: ["nodejs_compat"],
    observability: {
      enabled: true,
      traces: { enabled: true },
    },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      DB: bindings.d1({ name: "host2pro-db" }),
      JOBS: bindings.queue({ name: "host2pro-jobs" }),
      SESSION_SECRET: bindings.text("local-dev-session-secret-change-me"),
      JOB_TOKEN: bindings.text("local-dev-job-token"),
      BOOTSTRAP_ADMIN_EMAIL: bindings.text("admin@host2pro.local"),
      BOOTSTRAP_ADMIN_PASSWORD: bindings.text("changeme-admin-8"),
    },
  }),
});
