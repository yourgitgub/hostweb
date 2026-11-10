import { withDb, json } from "@/lib/api";
import { logoutUser } from "@/lib/auth";

export async function POST() {
  return withDb(async () => {
    await logoutUser();
    return json({ ok: true, redirect: "/" });
  });
}
