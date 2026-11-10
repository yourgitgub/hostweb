import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { sitePower } from "@/lib/sites";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    const action = body?.action;
    if (action !== "start" && action !== "stop" && action !== "reboot") {
      return bad("action ต้องเป็น start | stop | reboot");
    }
    const result = await sitePower(user.id, id, action);
    if (!result.ok) return bad(result.error);
    return json({ ok: true, site: result.site, operationId: result.operationId ?? null });
  });
}
