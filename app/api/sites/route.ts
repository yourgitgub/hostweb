import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { deploySite, listSites } from "@/lib/sites";

export async function GET() {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    return json({ ok: true, sites: await listSites(user.id) });
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const body = (await req.json().catch(() => null)) as {
      label?: string;
      customDomain?: string;
    } | null;
    const result = await deploySite(user.id, body?.label, body?.customDomain);
    if (!result.ok) return bad(result.error, result.needCredits ? 402 : 400);
    return json({ ok: true, site: result.site, balance: result.balance });
  });
}
