import { withDb, bad, json } from "@/lib/api";
import { loginUser } from "@/lib/auth";

export async function POST(req: Request) {
  return withDb(async () => {
    const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
    if (!body?.email || !body?.password) return bad("กรอกอีเมลและรหัสผ่าน");
    const result = await loginUser(body.email, body.password);
    if (!result.ok) return bad(result.error);
    return json({ ok: true, redirect: "/app" });
  });
}
