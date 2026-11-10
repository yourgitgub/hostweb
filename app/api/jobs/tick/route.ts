import { withDb, bad, json } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { runJobTick } from "@/lib/jobs";
import { timingSafeEqual } from "@/lib/crypto";

export async function POST(req: Request) {
  return withDb(async () => {
    const env = getEnv();
    const expected = env.JOB_TOKEN || "";
    const got = req.headers.get("x-job-token") || "";
    if (!expected || !timingSafeEqual(got, expected)) {
      return bad("Unauthorized", 401);
    }
    const result = await runJobTick();
    // Optional queue ping for future consumers
    try {
      await env.JOBS?.send({ type: "tick", at: result.at });
    } catch {
      /* queue optional locally */
    }
    return json({ ok: true, result });
  });
}
