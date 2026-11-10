import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/env";
import { countReadyPool, maintainPool, provisionPoolSlot, seedMockReadyPool } from "@/lib/pool";

export async function GET() {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return bad("Forbidden", 403);
    const { results } = await getDb()
      .prepare(
        `SELECT id, status, label, cloudways_server_id, region, instance_type, assigned_site_id, created_at
         FROM provider_pool ORDER BY created_at DESC LIMIT 100`,
      )
      .all();
    return json({ ok: true, ready: await countReadyPool(), pool: results ?? [] });
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return bad("Forbidden", 403);
    const body = (await req.json().catch(() => ({}))) as { action?: string; count?: number };
    if (body.action === "maintain") {
      return json({ ok: true, ...(await maintainPool()) });
    }
    if (body.action === "seed_mock") {
      const ids = await seedMockReadyPool(body.count ?? 2);
      return json({ ok: true, ids });
    }
    if (body.action === "provision") {
      const r = await provisionPoolSlot();
      return json(r);
    }
    return bad("action: maintain | provision | seed_mock");
  });
}
