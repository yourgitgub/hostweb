import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { purchaseDomainStub } from "@/lib/cloudflare-dns";
import { nowIso, randomId } from "@/lib/crypto";
import { getDb } from "@/lib/env";

export async function GET() {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const { results } = await getDb()
      .prepare(
        `SELECT id, name, status, site_id, created_at FROM domains WHERE user_id = ? ORDER BY created_at DESC`,
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

    const purchased = await purchaseDomainStub(name);
    const id = randomId();
    const ts = nowIso();
    await getDb()
      .prepare(
        `INSERT INTO domains (id, user_id, name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, user.id, name, purchased.ok ? "ordered" : "failed", ts, ts)
      .run();

    return json({
      ok: purchased.ok,
      domain: { id, name, status: purchased.ok ? "ordered" : "failed" },
      error: purchased.ok ? undefined : purchased.error,
      stub: "stub" in purchased ? purchased.stub : true,
    });
  });
}
