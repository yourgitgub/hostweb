import { CLOUDWAYS_API_BASE } from "./constants";
import { getAdminSettings, hasCloudways } from "./settings";

export type CwOperation = {
  id?: string | number;
  operation_id?: string | number;
  status?: string;
};

export type CwServerPayload = {
  id?: number;
  server?: {
    id: number;
    public_ip?: string;
    status?: string;
    apps?: CwApp[];
  };
  apps?: CwApp[];
  operations?: CwOperation[];
  operation_id?: string | number;
};

export type CwApp = {
  id: number | string;
  app_fqdn?: string;
  label?: string;
  application?: string;
};

export async function cloudwaysConfigured(): Promise<boolean> {
  return hasCloudways();
}

async function token(): Promise<string | null> {
  const s = await getAdminSettings();
  return s.cloudwaysApiToken || null;
}

export async function cwFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const t = await token();
  if (!t) return { ok: false, status: 0, error: "Cloudways API token not configured (admin UI or CLOUDWAYS_ACCESS_TOKEN)" };
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

/** Launch DO Singapore WordPress (1 server = 1 WP, Premium ~2GB ≤$30). */
export async function createWordpressServer(label: string) {
  const s = await getAdminSettings();
  return cwFetch<CwServerPayload>("/server", {
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
  });
}

export async function getServer(serverId: string) {
  // Prefer plural v2 path; fall back to legacy /server/{id} shape if needed
  const modern = await cwFetch<CwServerPayload>(`/servers/${serverId}`);
  if (modern.ok) return modern;
  return cwFetch<CwServerPayload>(`/server/${serverId}`);
}

export async function powerServer(action: "start" | "stop" | "restart", serverId: string) {
  return cwFetch<{ operation_id?: string | number; operations?: CwOperation[] }>(`/server/${action}`, {
    method: "POST",
    body: JSON.stringify({ server_id: Number(serverId) }),
  });
}

export async function pollOperation(operationId: string) {
  return cwFetch<{
    operation?: {
      id: string | number;
      is_completed?: number | boolean;
      status?: string;
      message?: string;
    };
  }>(`/operation/${operationId}`);
}

export function isOperationDone(op?: {
  is_completed?: number | boolean;
  status?: string;
} | null): boolean {
  if (!op) return false;
  if (op.is_completed === 1 || op.is_completed === true) return true;
  const s = String(op.status || "").toLowerCase();
  return s === "completed" || s === "complete" || s === "success";
}

export function isOperationFailed(op?: { status?: string; is_completed?: number | boolean } | null): boolean {
  if (!op) return false;
  const s = String(op.status || "").toLowerCase();
  return s === "failed" || s === "error" || s === "cancelled";
}

/** Poll until completed/failed or attempts exhausted. */
export async function waitForOperation(operationId: string, attempts = 30, delayMs = 5000) {
  for (let i = 0; i < attempts; i++) {
    const polled = await pollOperation(operationId);
    if (!polled.ok) {
      await sleep(delayMs);
      continue;
    }
    if (isOperationDone(polled.data.operation)) return { ok: true as const, operation: polled.data.operation };
    if (isOperationFailed(polled.data.operation)) {
      return { ok: false as const, error: polled.data.operation?.status || "operation_failed" };
    }
    await sleep(delayMs);
  }
  return { ok: false as const, error: "operation_timeout" };
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

export async function setAppAliases(serverId: string, appId: string, aliases: string[]) {
  return cwFetch("/app/manage/aliases", {
    method: "POST",
    body: JSON.stringify({
      server_id: Number(serverId),
      app_id: Number(appId),
      aliases,
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

export function extractAppFromServer(data: CwServerPayload): { appId: string; appFqdn: string } | null {
  const apps = data.server?.apps || data.apps || [];
  const app = apps[0];
  if (!app) return null;
  return {
    appId: String(app.id),
    appFqdn: app.app_fqdn || "",
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
