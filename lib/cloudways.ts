import { CLOUDWAYS_API_BASE } from "./constants";
import { getAdminSettings } from "./settings";

export type CwOperation = {
  id?: string | number;
  operation_id?: string | number;
  status?: string;
};

async function token(): Promise<string | null> {
  const s = await getAdminSettings();
  return s.cloudwaysApiToken || null;
}

export async function cwFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const t = await token();
  if (!t) return { ok: false, status: 0, error: "Cloudways API token not configured in admin settings" };
  const res = await fetch(`${CLOUDWAYS_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: typeof data === "object" ? JSON.stringify(data) : text };
  }
  return { ok: true, data: data as T };
}

export async function createWordpressServer(label: string) {
  const s = await getAdminSettings();
  // DO Singapore Premium ~2GB — keep under $30 COGS constraint
  return cwFetch<{ server?: { id: number }; operations?: CwOperation[]; operation_id?: string | number }>(
    "/server",
    {
      method: "POST",
      body: JSON.stringify({
        cloud: s.cloudwaysCloud || "do",
        region: s.cloudwaysRegion || "singapore",
        instance_type: s.cloudwaysInstanceType || "do_premium_2gb",
        application: "wordpress",
        app_version: "latest",
        server_label: label,
        app_label: label,
      }),
    },
  );
}

export async function powerServer(action: "start" | "stop" | "restart", serverId: string) {
  return cwFetch<{ operation_id?: string | number; operations?: CwOperation[] }>(`/server/${action}`, {
    method: "POST",
    body: JSON.stringify({ server_id: Number(serverId) }),
  });
}

export async function pollOperation(operationId: string) {
  return cwFetch<{ operation?: { id: string | number; is_completed?: number; status?: string } }>(
    `/operation/${operationId}`,
  );
}

export async function setAppCname(serverId: string, appId: string, hostname: string) {
  return cwFetch("/app/manage/cname", {
    method: "POST",
    body: JSON.stringify({
      server_id: Number(serverId),
      app_id: Number(appId),
      cname: hostname,
    }),
  });
}

export function extractOperationId(payload: {
  operation_id?: string | number;
  operations?: CwOperation[];
}): string | null {
  if (payload.operation_id != null) return String(payload.operation_id);
  const first = payload.operations?.[0];
  if (!first) return null;
  if (first.operation_id != null) return String(first.operation_id);
  if (first.id != null) return String(first.id);
  return null;
}
