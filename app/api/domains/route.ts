import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { purchaseDomain } from "@/lib/cloudflare-dns";
import { nowIso, randomId } from "@/lib/crypto";
import { getDb } from "@/lib/env";

export async function GET() {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const { results } = await getDb()
      .prepare(
        `SELECT id, name, status, site_id, cloudflare_zone_id, nameservers_json, created_at
         FROM domains WHERE user_id = ? ORDER BY created_at DESC`,
      )
      .bind(user.id)
      .all();
    return json({ ok: true, domains: results ?? [] });
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const body = (await req.json().catch(() => null)) as { name?: string } | null;
    const name = body?.name?.trim().toLowerCase();
    if (!name) return bad("กรอกชื่อโดเมน");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) return bad("รูปแบบโดเมนไม่ถูกต้อง");

    const purchased = await purchaseDomain(name);
    const id = randomId();
    const ts = nowIso();
    const status = purchased.ok ? purchased.status : "failed";

    await getDb()
      .prepare(
        `INSERT INTO domains
          (id, user_id, name, status, cloudflare_zone_id, nameservers_json, registrar_order_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        user.id,
        name,
        status,
        purchased.ok ? purchased.zoneId || null : null,
        purchased.ok && purchased.nameservers ? JSON.stringify(purchased.nameservers) : null,
        purchased.ok ? name : null,
        ts,
        ts,
      )
      .run();

    return json({
      ok: purchased.ok,
      domain: {
        id,
        name,
        status,
        zoneId: purchased.ok ? purchased.zoneId : undefined,
        nameservers: purchased.ok ? purchased.nameservers : undefined,
      },
      error: purchased.ok ? undefined : purchased.error,
      stub: !purchased.ok && "stub" in purchased ? purchased.stub : false,
    });
  });
}
