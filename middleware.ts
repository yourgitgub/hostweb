import { NextRequest, NextResponse } from "next/server";
import { LANDING_HOST, TEMP_ZONE } from "@/lib/constants";

/**
 * Temp hostname edge behavior:
 * - Requests to {slug}.xgb.app that are marked deleted should 301 → wordpress.xgb.app
 * - Full DNS delete is handled by Cloudflare record removal; this covers app-level deleted state.
 * Note: D1 lookup in middleware may not be available on all vinext builds — we proxy via internal API.
 */
export async function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase() || "";
  if (!host.endsWith(`.${TEMP_ZONE}`) || host === LANDING_HOST) {
    return NextResponse.next();
  }
  const slug = host.slice(0, -(TEMP_ZONE.length + 1));
  if (!/^[a-f0-9]{8}$/i.test(slug) && !/^[a-z0-9-]{4,16}$/i.test(slug)) {
    return NextResponse.next();
  }

  // Avoid loops on API
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  try {
    const check = new URL(`/api/temp-redirect?slug=${encodeURIComponent(slug)}`, req.url);
    const res = await fetch(check, { redirect: "manual" });
    if (res.status === 301 || res.status === 302) {
      return NextResponse.redirect(`https://${LANDING_HOST}`, 301);
    }
  } catch {
    /* fall through */
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
