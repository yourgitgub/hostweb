import { withDb, json } from "@/lib/api";
import { deletedRedirectTarget } from "@/lib/cloudflare-dns";
import { isTempSlugDeleted } from "@/lib/sites";
import { LANDING_HOST } from "@/lib/constants";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug") || "";
    if (!slug) {
      return Response.redirect(`https://${LANDING_HOST}`, 301);
    }
    const deleted = await isTempSlugDeleted(slug);
    if (deleted) {
      return Response.redirect(deletedRedirectTarget(), 301);
    }
    return json({ ok: true, active: true, hostname: `${slug}.xgb.app` });
  });
}
