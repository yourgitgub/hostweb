import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { attachDomainToSite } from "@/lib/sites";

export async function POST(req: Request) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const body = (await req.json().catch(() => null)) as { domainId?: string; siteId?: string } | null;
    if (!body?.domainId || !body?.siteId) return bad("ต้องระบุ domainId และ siteId");
    const result = await attachDomainToSite(user.id, body.siteId, body.domainId);
    if (!result.ok) return bad(result.error);
    return json({ ok: true, stub: "stub" in result ? result.stub : false });
  });
}
