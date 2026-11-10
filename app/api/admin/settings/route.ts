import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { nowIso } from "@/lib/crypto";
import { getAdminSettings, maskSecret, setSettings } from "@/lib/settings";

export async function GET() {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return bad("Forbidden", 403);
    const s = await getAdminSettings();
    return json({
      ok: true,
      settings: {
        ...s,
        cloudflareApiToken: maskSecret(s.cloudflareApiToken),
        cloudwaysApiToken: maskSecret(s.cloudwaysApiToken),
        cloudflareApiTokenSet: Boolean(s.cloudflareApiToken),
        cloudwaysApiTokenSet: Boolean(s.cloudwaysApiToken),
      },
    });
  });
}

export async function PUT(req: Request) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return bad("Forbidden", 403);
    const body = (await req.json().catch(() => null)) as Record<string, string | number> | null;
    if (!body) return bad("Invalid body");

    const map: Record<string, string> = {};
    if (body.fxUsdtThb != null) {
      map.fx_usdt_thb = String(body.fxUsdtThb);
      map.fx_updated_at = nowIso();
    }
    if (body.receiveWallet != null) map.receive_wallet_trc20 = String(body.receiveWallet);
    if (body.packagePriceThb != null) map.package_price_thb = String(body.packagePriceThb);
    if (body.poolMinReady != null) map.pool_min_ready = String(body.poolMinReady);
    if (body.cloudflareAccountId != null) map.cloudflare_account_id = String(body.cloudflareAccountId);
    if (body.cloudflareZoneIdXgb != null) map.cloudflare_zone_id_xgb = String(body.cloudflareZoneIdXgb);
    if (body.cloudflareApiToken && !String(body.cloudflareApiToken).includes("…")) {
      map.cloudflare_api_token = String(body.cloudflareApiToken);
    }
    if (body.cloudwaysApiToken && !String(body.cloudwaysApiToken).includes("…")) {
      map.cloudways_api_token = String(body.cloudwaysApiToken);
    }
    if (body.cloudwaysInstanceType != null) map.cloudways_instance_type = String(body.cloudwaysInstanceType);

    await setSettings(map);
    return json({ ok: true });
  });
}
