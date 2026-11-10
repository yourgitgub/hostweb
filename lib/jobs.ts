import { nowIso } from "./crypto";
import { getDb, getEnv } from "./env";
import { maintainPool, pollPoolOperations } from "./pool";
import { ensureSchema } from "./schema";
import { scanPendingPayments } from "./usdt-monitor";
import { cloudwaysConfigured, isOperationDone, isOperationFailed, pollOperation, powerServer } from "./cloudways";

export async function runJobTick() {
  await ensureSchema();
  const payments = await scanPendingPayments();
  const poolOps = await pollPoolOperations();
  const pool = await maintainPool();
  const power = await reconcileSiteOperations();
  const expiry = await stopExpiredSites();
  return { at: nowIso(), payments, poolOps, pool, power, expiry };
}

/** Enqueue a tick message when queue binding exists (cron / API can both use this). */
export async function enqueueJobTick(reason = "manual") {
  const env = getEnv();
  if (!env.JOBS) return { queued: false as const };
  await env.JOBS.send({ type: "tick", reason, at: nowIso() });
  return { queued: true as const };
}

async function reconcileSiteOperations() {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT id, last_operation_id, status FROM sites
       WHERE power_state = 'pending' AND last_operation_id IS NOT NULL AND status != 'deleted'`,
    )
    .all<{ id: string; last_operation_id: string; status: string }>();

  if (!(await cloudwaysConfigured())) {
    return { pending: results?.length ?? 0, completed: 0, skipped: "no_cloudways_token" };
  }

  let completed = 0;
  for (const row of results ?? []) {
    const polled = await pollOperation(row.last_operation_id);
    if (!polled.ok) continue;
    const op = polled.data.operation;
    if (isOperationFailed(op)) {
      await db
        .prepare(
          `UPDATE sites SET power_state = 'stopped', last_operation_id = NULL, updated_at = ? WHERE id = ?`,
        )
        .bind(nowIso(), row.id)
        .run();
      await db
        .prepare(
          `UPDATE operations SET status = 'failed', updated_at = ? WHERE provider_operation_id = ?`,
        )
        .bind(nowIso(), row.last_operation_id)
        .run();
      continue;
    }
    if (!isOperationDone(op)) continue;

    // Prefer intended state from operations.detail_json, else sites.status
    const intent = await db
      .prepare(
        `SELECT detail_json FROM operations WHERE provider_operation_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(row.last_operation_id)
      .first<{ detail_json: string | null }>();
    let next = row.status === "stopped" ? "stopped" : "running";
    try {
      const detail = intent?.detail_json ? JSON.parse(intent.detail_json) : null;
      if (detail?.intended === "stopped" || detail?.intended === "running") next = detail.intended;
    } catch {
      /* ignore */
    }

    await db
      .prepare(
        `UPDATE sites SET power_state = ?, status = ?, last_operation_id = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(next, next, nowIso(), row.id)
      .run();
    await db
      .prepare(
        `UPDATE operations SET status = 'completed', updated_at = ? WHERE provider_operation_id = ?`,
      )
      .bind(nowIso(), row.last_operation_id)
      .run();
    completed += 1;
  }
  return { pending: results?.length ?? 0, completed };
}

async function stopExpiredSites() {
  const db = getDb();
  const now = nowIso();
  const { results } = await db
    .prepare(
      `SELECT s.id, s.pool_id, p.cloudways_server_id
       FROM sites s
       LEFT JOIN provider_pool p ON p.id = s.pool_id
       WHERE s.status IN ('running', 'assigned') AND s.expires_at < ?`,
    )
    .bind(now)
    .all<{ id: string; pool_id: string | null; cloudways_server_id: string | null }>();

  let stopped = 0;
  for (const row of results ?? []) {
    await db
      .prepare(
        `UPDATE sites SET power_state = 'stopped', status = 'stopped', updated_at = ? WHERE id = ?`,
      )
      .bind(now, row.id)
      .run();
    stopped += 1;

    const sid = row.cloudways_server_id;
    if (sid && !sid.startsWith("mock-") && (await cloudwaysConfigured())) {
      const res = await powerServer("stop", sid);
      if (res.ok) {
        // fire-and-forget; reconcile will clear pending if we set it — keep customer status stopped
      }
    }
  }
  return { stopped };
}
