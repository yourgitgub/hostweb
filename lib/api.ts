import { ensureBootstrapAdmin } from "./auth";
import { ensureSchema } from "./schema";

export async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  await ensureSchema();
  await ensureBootstrapAdmin();
  return fn();
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function bad(error: string, status = 400) {
  return json({ ok: false, error }, status);
}
