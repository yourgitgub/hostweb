import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createTopup } from "@/lib/credits";

export async function POST(req: Request) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const body = (await req.json().catch(() => null)) as { amountThb?: number } | null;
    const result = await createTopup(user.id, Number(body?.amountThb));
    if (!result.ok) return bad(result.error);
    return json({ ok: true, payment: result.payment });
  });
}
