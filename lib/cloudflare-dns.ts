import { LANDING_HOST } from "./constants";
import { getAdminSettings, hasCloudflareDns } from "./settings";

const CF_API = "https://api.cloudflare.com/client/v4";

type CfResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number; stub?: boolean };

async function cf<T = unknown>(path: string, init?: RequestInit): Promise<CfResult<T>> {
  const s = await getAdminSettings();
  if (!s.cloudflareApiToken) {
    return { ok: false, error: "Cloudflare API token not configured (admin UI or CLOUDFLARE_API_TOKEN)", status: 0, stub: true };
  }
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.cloudflareApiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: { message: string }[];
    result?: T;
  };
  if (!res.ok || data.success === false) {
    return {
      ok: false,
      status: res.status,
      error: data.errors?.[0]?.message || `Cloudflare API ${res.status}`,
    };
  }
  return { ok: true, data: data.result as T, status: res.status };
}

async function listCname(zoneId: string, hostname: string) {
  return cf<{ id: string; name: string; content: string }[]>(
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
  );
}

/** Point temp hostname at Cloudways app FQDN via proxied CNAME (hides origin IP). */
export async function upsertTempCname(hostname: string, targetFqdn: string) {
  const s = await getAdminSettings();
  if (!(await hasCloudflareDns())) {
    return { ok: false as const, error: "Cloudflare DNS not configured (token + zone id)", stub: true as const };
  }
  const listed = await listCname(s.cloudflareZoneIdXgb, hostname);
  if (!listed.ok) return { ok: false as const, error: listed.error, stub: Boolean(listed.stub) };

  const recordName = hostname; // FQDN is accepted by CF API
  const body = {
    type: "CNAME",
    name: recordName,
    content: targetFqdn.replace(/\.$/, ""),
    proxied: true,
    ttl: 1,
  };
  if (listed.data?.[0]?.id) {
    const updated = await cf(`/zones/${s.cloudflareZoneIdXgb}/dns_records/${listed.data[0].id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return updated.ok
      ? { ok: true as const, action: "updated" as const }
      : { ok: false as const, error: updated.error, stub: false as const };
  }
  const created = await cf(`/zones/${s.cloudflareZoneIdXgb}/dns_records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return created.ok
    ? { ok: true as const, action: "created" as const }
    : { ok: false as const, error: created.error, stub: false as const };
}

/**
 * On site delete: remove origin CNAME and install a Dynamic Redirect 301 → wordpress.xgb.app.
 * Fallback: CNAME the slug to landing host (proxied) so traffic still hits CF edge.
 */
export async function retireTempHostname(hostname: string) {
  const s = await getAdminSettings();
  if (!(await hasCloudflareDns())) {
    return { ok: false as const, error: "Cloudflare DNS not configured", stub: true as const };
  }

  // Remove existing CNAMEs first
  const listed = await listCname(s.cloudflareZoneIdXgb, hostname);
  if (listed.ok) {
    for (const r of listed.data ?? []) {
      await cf(`/zones/${s.cloudflareZoneIdXgb}/dns_records/${r.id}`, { method: "DELETE" });
    }
  }

  const redirect = await upsertHostRedirect(hostname, `https://${LANDING_HOST}/`);
  if (redirect.ok) return redirect;

  // Fallback: point hostname at landing so Worker/middleware can 301 if routed
  const cname = await upsertTempCname(hostname, LANDING_HOST);
  if (cname.ok) return { ok: true as const, via: "cname_fallback" as const };
  return { ok: false as const, error: redirect.error || cname.error, stub: false as const };
}

export async function deleteTempHostname(hostname: string) {
  return retireTempHostname(hostname);
}

/** Zone Dynamic Redirect rule for a single hostname → absolute URL (301). */
async function upsertHostRedirect(hostname: string, targetUrl: string) {
  const s = await getAdminSettings();
  const zoneId = s.cloudflareZoneIdXgb;
  const description = `host2pro-deleted:${hostname}`;

  // Read current dynamic redirect entrypoint ruleset
  const entry = await cf<{ id?: string; rules?: { id?: string; description?: string; action?: string; expression?: string; action_parameters?: unknown }[] }>(
    `/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`,
  );

  const rule = {
    description,
    expression: `(http.host eq "${hostname}")`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { value: targetUrl },
        preserve_query_string: true,
      },
    },
  };

  if (!entry.ok) {
    // Phase may be empty — create entrypoint with our rule
    const created = await cf(`/zones/${zoneId}/rulesets`, {
      method: "POST",
      body: JSON.stringify({
        name: "host2pro dynamic redirects",
        kind: "zone",
        phase: "http_request_dynamic_redirect",
        rules: [rule],
      }),
    });
    return created.ok
      ? { ok: true as const, via: "ruleset_create" as const }
      : { ok: false as const, error: created.error };
  }

  const rules = [...(entry.data.rules || [])];
  const idx = rules.findIndex((r) => r.description === description);
  if (idx >= 0) rules[idx] = { ...rules[idx], ...rule };
  else rules.push(rule);

  const updated = await cf(`/zones/${zoneId}/rulesets/${entry.data.id}`, {
    method: "PUT",
    body: JSON.stringify({ rules }),
  });
  return updated.ok
    ? { ok: true as const, via: "ruleset_update" as const }
    : { ok: false as const, error: updated.error };
}

export type PurchaseResult =
  | {
      ok: true;
      domain: string;
      status: "ordered" | "nameservers_set" | "active";
      zoneId?: string;
      nameservers?: string[];
      registration?: unknown;
      stub?: false;
    }
  | { ok: false; error: string; stub?: boolean };

/** Check + register via Cloudflare Registrar API (graceful if token/account missing). */
export async function purchaseDomain(domain: string): Promise<PurchaseResult> {
  const s = await getAdminSettings();
  if (!s.cloudflareApiToken || !s.cloudflareAccountId) {
    return {
      ok: false,
      error: "Configure Cloudflare account + API token (admin UI or CLOUDFLARE_* env) to enable Registrar",
      stub: true,
    };
  }

  const check = await cf<{ domains: { name: string; registrable: boolean; reason?: string; pricing?: unknown }[] }>(
    `/accounts/${s.cloudflareAccountId}/registrar/domain-check`,
    { method: "POST", body: JSON.stringify({ domains: [domain] }) },
  );
  if (!check.ok) return { ok: false, error: check.error, stub: check.stub };

  const info = check.data.domains?.[0];
  if (!info?.registrable) {
    return { ok: false, error: info?.reason || "domain not registrable via Cloudflare Registrar API" };
  }

  const reg = await cf<{
    domain_name: string;
    state: string;
    completed: boolean;
    context?: { registration?: { status?: string } };
    links?: { self?: string };
  }>(`/accounts/${s.cloudflareAccountId}/registrar/registrations`, {
    method: "POST",
    body: JSON.stringify({ domain_name: domain }),
  });
  if (!reg.ok) return { ok: false, error: reg.error };

  // Poll briefly if async
  let state = reg.data.state;
  let completed = reg.data.completed;
  if (!completed && state === "in_progress") {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await cf<{ state: string; completed: boolean; context?: { registration?: { status?: string } } }>(
        `/accounts/${s.cloudflareAccountId}/registrar/registrations/${encodeURIComponent(domain)}/registration-status`,
      );
      if (!st.ok) break;
      state = st.data.state;
      completed = st.data.completed;
      if (completed || state === "failed" || state === "action_required" || state === "blocked") break;
    }
  }

  if (state === "failed" || state === "blocked" || state === "action_required") {
    return { ok: false, error: `Registrar workflow ${state}` };
  }

  // Ensure zone exists / fetch nameservers
  const zones = await cf<{ id: string; name_servers?: string[]; status?: string }[]>(
    `/zones?name=${encodeURIComponent(domain)}&account.id=${encodeURIComponent(s.cloudflareAccountId)}`,
  );
  let zoneId: string | undefined;
  let nameservers: string[] | undefined;
  if (zones.ok && zones.data?.[0]) {
    zoneId = zones.data[0].id;
    nameservers = zones.data[0].name_servers;
  }

  return {
    ok: true,
    domain,
    status: completed || state === "succeeded" ? "active" : "ordered",
    zoneId,
    nameservers,
    registration: reg.data,
  };
}

/** Attach customer domain to a site: proxied CNAME → Cloudways FQDN + Cloudways Host acceptance. */
export async function attachDomainDns(domain: string, targetFqdn: string, zoneId?: string) {
  const s = await getAdminSettings();
  if (!s.cloudflareApiToken) {
    return { ok: false as const, error: "Cloudflare API token missing", stub: true as const };
  }

  let zid = zoneId;
  if (!zid) {
    const zones = await cf<{ id: string }[]>(
      `/zones?name=${encodeURIComponent(domain)}${s.cloudflareAccountId ? `&account.id=${encodeURIComponent(s.cloudflareAccountId)}` : ""}`,
    );
    if (!zones.ok || !zones.data?.[0]?.id) {
      return { ok: false as const, error: zones.ok ? "Zone not found for domain" : zones.error };
    }
    zid = zones.data[0].id;
  }

  const listed = await cf<{ id: string }[]>(
    `/zones/${zid}/dns_records?type=CNAME&name=${encodeURIComponent(domain)}`,
  );
  if (!listed.ok) return { ok: false as const, error: listed.error };

  const body = {
    type: "CNAME",
    name: domain,
    content: targetFqdn.replace(/\.$/, ""),
    proxied: true,
    ttl: 1,
  };
  if (listed.data?.[0]?.id) {
    const u = await cf(`/zones/${zid}/dns_records/${listed.data[0].id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return u.ok ? { ok: true as const, zoneId: zid } : { ok: false as const, error: u.error };
  }
  const c = await cf(`/zones/${zid}/dns_records`, { method: "POST", body: JSON.stringify(body) });
  return c.ok ? { ok: true as const, zoneId: zid } : { ok: false as const, error: c.error };
}

/** @deprecated use purchaseDomain */
export async function purchaseDomainStub(domain: string) {
  return purchaseDomain(domain);
}

export function deletedRedirectTarget(): string {
  return `https://${LANDING_HOST}`;
}
