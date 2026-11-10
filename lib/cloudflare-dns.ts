import { LANDING_HOST } from "./constants";
import { getAdminSettings } from "./settings";

const CF_API = "https://api.cloudflare.com/client/v4";

async function cf(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const s = await getAdminSettings();
  if (!s.cloudflareApiToken) {
    return { ok: false, error: "Cloudflare API token not configured in admin settings" };
  }
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.cloudflareApiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json()) as { success?: boolean; errors?: { message: string }[]; result?: unknown };
  if (!res.ok || !data.success) {
    return { ok: false, error: data.errors?.[0]?.message || `Cloudflare API ${res.status}` };
  }
  return { ok: true, data: data.result };
}

/** Point temp hostname at Cloudways app FQDN via proxied CNAME (hides origin IP). */
export async function upsertTempCname(hostname: string, targetFqdn: string) {
  const s = await getAdminSettings();
  if (!s.cloudflareZoneIdXgb) {
    return { ok: false as const, error: "cloudflare_zone_id_xgb not set", stub: true as const };
  }
  const name = hostname.replace(`.${s.tempZone}`, "");
  // List existing
  const listed = await cf(
    `/zones/${s.cloudflareZoneIdXgb}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
  );
  if (!listed.ok) return { ok: false as const, error: listed.error, stub: false as const };
  const records = listed.data as { id: string }[];
  const body = {
    type: "CNAME",
    name,
    content: targetFqdn,
    proxied: true,
    ttl: 1,
  };
  if (records?.[0]?.id) {
    return cf(`/zones/${s.cloudflareZoneIdXgb}/dns_records/${records[0].id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }
  return cf(`/zones/${s.cloudflareZoneIdXgb}/dns_records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Remove temp record; Worker edge also 301s deleted slugs to landing. */
export async function deleteTempHostname(hostname: string) {
  const s = await getAdminSettings();
  if (!s.cloudflareZoneIdXgb) {
    return { ok: false as const, error: "zone not configured", stub: true as const };
  }
  const listed = await cf(
    `/zones/${s.cloudflareZoneIdXgb}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
  );
  if (!listed.ok) return listed;
  const records = listed.data as { id: string }[];
  for (const r of records ?? []) {
    await cf(`/zones/${s.cloudflareZoneIdXgb}/dns_records/${r.id}`, { method: "DELETE" });
  }
  return { ok: true as const };
}

/** Registrar purchase stub — wire Cloudflare Registrar when account ready. */
export async function purchaseDomainStub(domain: string) {
  const s = await getAdminSettings();
  if (!s.cloudflareApiToken || !s.cloudflareAccountId) {
    return {
      ok: false as const,
      error: "Configure Cloudflare account + API token in admin to enable Registrar purchases",
      stub: true as const,
    };
  }
  // Official Registrar endpoints vary by account; keep explicit stub until keys verified.
  return {
    ok: false as const,
    error: `Registrar purchase for ${domain} is stubbed — API wiring pending verified CF Registrar access`,
    stub: true as const,
  };
}

export function deletedRedirectTarget(): string {
  return `https://${LANDING_HOST}`;
}
