import { SITE_TTL_DAYS } from "./constants";
import { deleteTempHostname, upsertTempCname } from "./cloudflare-dns";
import { extractOperationId, powerServer, setAppCname } from "./cloudways";
import { chargeCredits } from "./credits";
import { addDaysIso, nowIso, randomId, randomSlug } from "./crypto";
import { getDb } from "./env";
import { assignReadyPool } from "./pool";
import { getPublicSettings } from "./settings";

export type SiteRow = {
  id: string;
  user_id: string;
  pool_id: string | null;
  label: string | null;
  temp_slug: string;
  temp_hostname: string;
  custom_domain: string | null;
  power_state: string;
  status: string;
  expires_at: string;
  last_operation_id: string | null;
  created_at: string;
};

export function publicSiteView(site: SiteRow) {
  return {
    id: site.id,
    label: site.label,
    url: `https://${site.temp_hostname}`,
    customDomain: site.custom_domain,
    powerState: site.power_state,
    status: site.status,
    expiresAt: site.expires_at,
    createdAt: site.created_at,
    operationPending: Boolean(site.last_operation_id) && site.power_state === "pending",
  };
}

export async function listSites(userId: string) {
  const { results } = await getDb()
    .prepare(
      `SELECT * FROM sites WHERE user_id = ? AND status != 'deleted' ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<SiteRow>();
  return (results ?? []).map(publicSiteView);
}

export async function getSite(userId: string, id: string) {
  const site = await getDb()
    .prepare(`SELECT * FROM sites WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<SiteRow>();
  return site ? publicSiteView(site) : null;
}

export async function deploySite(userId: string, label?: string, customDomain?: string) {
  const settings = await getPublicSettings();
  const price = settings.packagePriceThb;
  const db = getDb();
  const user = await db
    .prepare(`SELECT credit_balance_thb FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ credit_balance_thb: number }>();
  if (!user || user.credit_balance_thb < price) {
    return { ok: false as const, error: "เครดิตไม่พอ กรุณาเติมเงินก่อน deploy", needCredits: true };
  }

  if (customDomain) {
    const ok = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(customDomain.trim());
    if (!ok) return { ok: false as const, error: "รูปแบบโดเมนไม่ถูกต้อง" };
  }

  const siteId = randomId();
  const pool = await assignReadyPool(siteId);
  if (!pool) {
    return {
      ok: false as const,
      error: "พูลเซิร์ฟเวอร์ว่างชั่วคราว ระบบกำลังเติมพูล กรุณารอสักครู่",
      poolEmpty: true,
    };
  }

  const charged = await chargeCredits(userId, price, "site", siteId, `Deploy ${settings.packageName}`);
  if (!charged.ok) {
    await db
      .prepare(
        `UPDATE provider_pool SET status = 'ready_in_pool', assigned_site_id = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(nowIso(), pool.id)
      .run();
    return { ok: false as const, error: charged.error };
  }

  const slug = randomSlug(4);
  const hostname = `${slug}.${settings.tempZone}`;
  const ts = nowIso();
  const expires = addDaysIso(SITE_TTL_DAYS);

  await db
    .prepare(
      `INSERT INTO sites
        (id, user_id, pool_id, label, temp_slug, temp_hostname, custom_domain, power_state, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'running', 'running', ?, ?, ?)`,
    )
    .bind(
      siteId,
      userId,
      pool.id,
      label || settings.packageName,
      slug,
      hostname,
      customDomain?.trim().toLowerCase() || null,
      expires,
      ts,
      ts,
    )
    .run();

  // DNS + Cloudways Host acceptance (best-effort; never expose origin to customer)
  if (pool.cloudways_app_fqdn) {
    await upsertTempCname(hostname, pool.cloudways_app_fqdn);
    if (pool.cloudways_server_id && pool.cloudways_app_id) {
      await setAppCname(pool.cloudways_server_id, pool.cloudways_app_id, hostname);
    }
  }

  const site = await getSite(userId, siteId);
  return { ok: true as const, site, balance: charged.balance };
}

export async function sitePower(userId: string, siteId: string, action: "start" | "stop" | "reboot") {
  const db = getDb();
  const site = await db
    .prepare(`SELECT * FROM sites WHERE id = ? AND user_id = ? AND status != 'deleted'`)
    .bind(siteId, userId)
    .first<SiteRow & { pool_id: string }>();
  if (!site) return { ok: false as const, error: "ไม่พบไซต์" };
  if (site.power_state === "pending" && site.last_operation_id) {
    return { ok: false as const, error: "กำลังดำเนินการ กรุณารอ" };
  }

  const pool = await db
    .prepare(`SELECT cloudways_server_id FROM provider_pool WHERE id = ?`)
    .bind(site.pool_id)
    .first<{ cloudways_server_id: string | null }>();

  const serverId = pool?.cloudways_server_id;
  const isMock = !serverId || serverId.startsWith("mock-");
  if (isMock) {
    // Local/mock path: flip state immediately (no Cloudways call)
    const next =
      action === "stop" ? "stopped" : action === "start" || action === "reboot" ? "running" : site.power_state;
    await db
      .prepare(
        `UPDATE sites SET power_state = ?, status = ?, last_operation_id = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(next, next, nowIso(), siteId)
      .run();
    return { ok: true as const, site: await getSite(userId, siteId) };
  }

  const cwAction = action === "reboot" ? "restart" : action;
  const res = await powerServer(cwAction, serverId);
  if (!res.ok) return { ok: false as const, error: res.error };
  const opId = extractOperationId(res.data);
  await db
    .prepare(
      `UPDATE sites SET power_state = 'pending', last_operation_id = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(opId, nowIso(), siteId)
    .run();
  return { ok: true as const, site: await getSite(userId, siteId), operationId: opId };
}

export async function deleteSite(userId: string, siteId: string) {
  const db = getDb();
  const site = await db
    .prepare(`SELECT * FROM sites WHERE id = ? AND user_id = ? AND status != 'deleted'`)
    .bind(siteId, userId)
    .first<SiteRow>();
  if (!site) return { ok: false as const, error: "ไม่พบไซต์" };
  const ts = nowIso();
  await db
    .prepare(
      `UPDATE sites SET status = 'deleted', power_state = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(ts, ts, siteId)
    .run();
  await deleteTempHostname(site.temp_hostname);
  return { ok: true as const };
}

/** Edge helper: if temp slug deleted, callers should 301 to landing. */
export async function isTempSlugDeleted(slug: string): Promise<boolean> {
  const row = await getDb()
    .prepare(`SELECT status FROM sites WHERE temp_slug = ?`)
    .bind(slug)
    .first<{ status: string }>();
  return !row || row.status === "deleted";
}
