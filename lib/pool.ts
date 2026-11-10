import {
  cloudwaysConfigured,
  createWordpressServer,
  extractAppFromServer,
  extractOperationId,
  getServer,
  isOperationDone,
  isOperationFailed,
  pollOperation,
} from "./cloudways";
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
  if (!(await cloudwaysConfigured())) {
    return {
      ok: false as const,
      id: "",
      error: "Cloudways token missing — use Seed mock ready, or set CLOUDWAYS_ACCESS_TOKEN / admin token",
      mockOnly: true as const,
    };
  }

  const id = randomId();
  const ts = nowIso();
  const settings = await getAdminSettings();
  const lbl = label || `h2p-pool-${id.slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO provider_pool
        (id, status, region, cloud, instance_type, label, created_at, updated_at)
       VALUES (?, 'provisioning', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      settings.cloudwaysRegion || "singapore",
      settings.cloudwaysCloud || "do",
      settings.cloudwaysInstanceType || "do_premium_2gb",
      lbl,
      ts,
      ts,
    )
    .run();

  const created = await createWordpressServer(lbl);
  if (!created.ok) {
    await db
      .prepare(`UPDATE provider_pool SET status = 'failed', meta_json = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify({ error: created.error }), nowIso(), id)
      .run();
    return { ok: false as const, id, error: created.error };
  }

  const opId = extractOperationId(created.data);
  const serverId =
    created.data.server?.id != null
      ? String(created.data.server.id)
      : created.data.id != null
        ? String(created.data.id)
        : null;

  let app = extractAppFromServer(created.data);

  await db
    .prepare(
      `UPDATE provider_pool
       SET cloudways_server_id = ?, cloudways_app_id = ?, cloudways_app_fqdn = ?,
           last_operation_id = ?, meta_json = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      serverId,
      app?.appId ?? null,
      app?.appFqdn || null,
      opId,
      JSON.stringify(created.data),
      nowIso(),
      id,
    )
    .run();

  if (!opId && serverId) {
    if (!app && serverId) {
      const details = await getServer(serverId);
      if (details.ok) app = extractAppFromServer(details.data);
    }
    await db
      .prepare(
        `UPDATE provider_pool
         SET status = 'ready_in_pool', cloudways_app_id = COALESCE(?, cloudways_app_id),
             cloudways_app_fqdn = COALESCE(?, cloudways_app_fqdn), updated_at = ?
         WHERE id = ?`,
      )
      .bind(app?.appId ?? null, app?.appFqdn || null, nowIso(), id)
      .run();
  }

  return { ok: true as const, id, operationId: opId, serverId };
}

export async function maintainPool() {
  const settings = await getAdminSettings();
  const ready = await countReadyPool();
  if (!(await cloudwaysConfigured())) {
    return { ready, need: 0, created: [] as string[], skipped: "no_cloudways_token" as const };
  }
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
  if (!(await cloudwaysConfigured())) return { polled: 0, ready: 0 };

  const { results } = await db
    .prepare(
      `SELECT id, last_operation_id, cloudways_server_id
       FROM provider_pool WHERE status = 'provisioning' AND last_operation_id IS NOT NULL`,
    )
    .all<{
      id: string;
      last_operation_id: string;
      cloudways_server_id: string | null;
    }>();

  let ready = 0;
  for (const row of results ?? []) {
    const polled = await pollOperation(row.last_operation_id);
    if (!polled.ok) continue;
    const op = polled.data.operation;
    if (isOperationFailed(op)) {
      await db
        .prepare(`UPDATE provider_pool SET status = 'failed', meta_json = ?, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify({ operation: op }), nowIso(), row.id)
        .run();
      continue;
    }
    if (!isOperationDone(op)) continue;

    let appId: string | null = null;
    let appFqdn: string | null = null;
    if (row.cloudways_server_id) {
      const details = await getServer(row.cloudways_server_id);
      if (details.ok) {
        const app = extractAppFromServer(details.data);
        if (app) {
          appId = app.appId;
          appFqdn = app.appFqdn || null;
        }
      }
    }

    await db
      .prepare(
        `UPDATE provider_pool
         SET status = 'ready_in_pool', cloudways_app_id = COALESCE(?, cloudways_app_id),
             cloudways_app_fqdn = COALESCE(?, cloudways_app_fqdn),
             last_operation_id = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .bind(appId, appFqdn, nowIso(), row.id)
      .run();
    ready += 1;
  }
  return { polled: results?.length ?? 0, ready };
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
  const res = await db
    .prepare(
      `UPDATE provider_pool SET status = 'assigned', assigned_site_id = ?, updated_at = ?
       WHERE id = ? AND status = 'ready_in_pool'`,
    )
    .bind(siteId, nowIso(), row.id)
    .run();
  if (!res.meta?.changes) return null;
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
      .bind(id, null, null, null, `mock-${id.slice(0, 6)}`, ts, ts)
      .run();
    ids.push(id);
  }
  return ids;
}
