/**
 * Custom Worker entrypoint wrapping vinext fetch + cron + queue consumers.
 * Cron / queue both run the host2pro job tick (USDT poll, pool refill, op poll, expiry stop).
 */
import vinextApp from "vinext/server/fetch-handler";
import { runJobTick } from "../lib/jobs";
import { ensureSchema } from "../lib/schema";

type Env = {
  DB: D1Database;
  JOBS?: Queue;
  JOB_TOKEN?: string;
  SESSION_SECRET?: string;
  ENVIRONMENT?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID_XGB?: string;
  CLOUDWAYS_ACCESS_TOKEN?: string;
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
};

function resolveFetch(
  mod: unknown,
): (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response {
  const m = mod as {
    fetch?: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;
    default?: unknown;
  };
  if (typeof mod === "function") {
    return mod as (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;
  }
  if (typeof m.fetch === "function") return m.fetch.bind(m);
  const d = m.default as typeof m | ((request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>);
  if (typeof d === "function") return d;
  if (d && typeof (d as { fetch?: unknown }).fetch === "function") {
    return (d as { fetch: typeof m.fetch }).fetch!.bind(d);
  }
  throw new Error("vinext fetch handler not found");
}

const vinextFetch = resolveFetch(vinextApp);

async function runJobs(_env: Env) {
  await ensureSchema();
  return runJobTick();
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return vinextFetch(request, env, ctx);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runJobs(env).then((result) => {
        console.log(JSON.stringify({ job: "scheduled", result }));
      }),
    );
  },

  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        for (const msg of batch.messages) {
          try {
            const result = await runJobs(env);
            console.log(JSON.stringify({ job: "queue", body: msg.body, result }));
            msg.ack();
          } catch (err) {
            console.error("queue job failed", err);
            msg.retry();
          }
        }
      })(),
    );
  },
};
