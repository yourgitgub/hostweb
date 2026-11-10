import { withDb, json } from "@/lib/api";

export async function GET() {
  return withDb(async () => json({ ok: true, service: "host2pro" }));
}
