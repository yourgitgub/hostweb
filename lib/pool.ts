import { createWordpressServer, extractOperationId, pollOperation } from "./cloudways";
import { nowIso, randomId } from "./crypto";
import { getDb } from "./env";
import { getAdminSettings } from "./settings";

export async function countReadyPool(): Promise<number> {
  const row = await getDb()
    .prepare(`SELECT COUNT(*) as c FROM provider_pool WHERE status = 'ready_in_pool'`)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

export async function provisionPoolSlot(label?: string) {
  const db = getDb();
  const id = randomId();
  const ts = nowIso();
  const lbl = label || `h2p-pool-${id.slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO provider_pool
        (id, status, region, cloud, instance_type, label, created_at, updated_at)
       VALUES (?, 'provisioning', 'singapore', 'do', 'do_premium_2gb', ?, ?, ?)`,
    )
    .bind(id, lbl, ts, ts)
    .run();

  const created = await createWordpressServer(lbl);
  if (!created.ok) {
    await db
      .prepare(
        `UPDATE provider_pool SET status = 'failed', meta_json = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(JSON.stringify({ error: created.error }), nowIso(), id)
      .run();
    return { ok: false as const, id, error: created.error };
  }

  const opId = extractOperationId(created.data);
  const serverId = created.data.server?.id != null ? String(created.data.server.id) : null;
  await db
    .prepare(
      `UPDATE provider_pool SET cloudways_server_id = ?, last_operation_id = ?, meta_json = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(serverId, opId, JSON.stringify(created.data), nowIso(), id)
    .run();

  // If API returned immediately without op, mark ready (local/stub friendly)
  if (!opId && serverId) {
    await db
      .prepare(`UPDATE provider_pool SET status = 'ready_in_pool', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), id)
      .run();
  }

  return { ok: true as const, id, operationId: opId, serverId };
}

export async function maintainPool() {
  const settings = await getAdminSettings();
  const ready = await countReadyPool();
  const need = Math.max(0, settings.poolMinReady - ready);
  const created: string[] = [];
  for (let i = 0; i < need; i++) {
    const r = await provisionPoolSlot();
    if (r.ok) created.push(r.id);
  }
  return { ready, need, created };
}

export async function pollPoolOperations() {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT id, last_operation_id, cloudways_server_id, meta_json
       FROM provider_pool WHERE status = 'provisioning' AND last_operation_id IS NOT NULL`,
    )
    .all<{
      id: string;
      last_operation_id: string;
      cloudways_server_id: string | null;
      meta_json: string | null;
    }>();

  for (const row of results ?? []) {
    const polled = await pollOperation(row.last_operation_id);
    if (!polled.ok) continue;
    const op = polled.data.operation;
    const done =
      op?.is_completed === 1 ||
      op?.status === "completed" ||
      String(op?.status || "").toLowerCase() === "complete";
    if (done) {
      await db
        .prepare(`UPDATE provider_pool SET status = 'ready_in_pool', updated_at = ? WHERE id = ?`)
        .bind(nowIso(), row.id)
        .run();
    }
  }
}

export async function assignReadyPool(siteId: string) {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT id, cloudways_server_id, cloudways_app_id, cloudways_app_fqdn
       FROM provider_pool WHERE status = 'ready_in_pool' ORDER BY created_at ASC LIMIT 1`,
    )
    .first<{
      id: string;
      cloudways_server_id: string | null;
      cloudways_app_id: string | null;
      cloudways_app_fqdn: string | null;
    }>();
  if (!row) return null;
  await db
    .prepare(
      `UPDATE provider_pool SET status = 'assigned', assigned_site_id = ?, updated_at = ? WHERE id = ? AND status = 'ready_in_pool'`,
    )
    .bind(siteId, nowIso(), row.id)
    .run();
  return row;
}

/** Dev/demo helper: insert a ready pool row without Cloudways. */
export async function seedMockReadyPool(count = 1) {
  const db = getDb();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = randomId();
    const ts = nowIso();
    await db
      .prepare(
        `INSERT INTO provider_pool
          (id, status, cloudways_server_id, cloudways_app_id, cloudways_app_fqdn, region, cloud, instance_type, label, created_at, updated_at)
         VALUES (?, 'ready_in_pool', ?, ?, ?, 'singapore', 'do', 'do_premium_2gb', ?, ?, ?)`,
      )
      .bind(
        id,
        // Leave Cloudways IDs null so power controls use local mock path until real API is configured
        null,
        null,
        null,
        `mock-${id.slice(0, 6)}`,
        ts,
        ts,
      )
      .run();
    ids.push(id);
  }
  return ids;
}
