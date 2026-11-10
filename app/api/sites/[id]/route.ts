import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { deleteSite, getSite } from "@/lib/sites";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const { id } = await ctx.params;
    const site = await getSite(user.id, id);
    if (!site) return bad("Not found", 404);
    return json({ ok: true, site });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const { id } = await ctx.params;
    const result = await deleteSite(user.id, id);
    if (!result.ok) return bad(result.error, 404);
    return json({ ok: true });
  });
}
