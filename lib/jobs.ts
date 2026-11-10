import { nowIso } from "./crypto";
import { getDb } from "./env";
import { maintainPool, pollPoolOperations } from "./pool";
import { ensureSchema } from "./schema";
import { scanPendingPayments } from "./usdt-monitor";
import { pollOperation } from "./cloudways";

export async function runJobTick() {
  await ensureSchema();
  const payments = await scanPendingPayments();
  await pollPoolOperations();
  const pool = await maintainPool();
  const power = await reconcileSiteOperations();
  const expiry = await stopExpiredSites();
  return { at: nowIso(), payments, pool, power, expiry };
}

async function reconcileSiteOperations() {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT id, last_operation_id FROM sites
       WHERE power_state = 'pending' AND last_operation_id IS NOT NULL AND status != 'deleted'`,
    )
    .all<{ id: string; last_operation_id: string }>();
  let completed = 0;
  for (const row of results ?? []) {
    const polled = await pollOperation(row.last_operation_id);
    if (!polled.ok) continue;
    const op = polled.data.operation;
    const done =
      op?.is_completed === 1 ||
      op?.status === "completed" ||
      String(op?.status || "").toLowerCase() === "complete";
    if (!done) continue;
    // Infer next state from prior intent is imperfect; default to running after completed ops
    await db
      .prepare(
        `UPDATE sites SET power_state = 'running', status = 'running', last_operation_id = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(nowIso(), row.id)
      .run();
    completed += 1;
  }
  return { pending: results?.length ?? 0, completed };
}

async function stopExpiredSites() {
  const db = getDb();
  const now = nowIso();
  const res = await db
    .prepare(
      `UPDATE sites SET power_state = 'stopped', status = 'stopped', updated_at = ?
       WHERE status IN ('running', 'assigned', 'stopped') AND expires_at < ? AND status != 'deleted'`,
    )
    .bind(now, now)
    .run();
  return { stopped: res.meta?.changes ?? 0 };
}
