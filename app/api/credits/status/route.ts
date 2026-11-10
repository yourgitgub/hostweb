import { withDb, bad, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getPayment, listPayments } from "@/lib/credits";
import { getDb } from "@/lib/env";
import { scanPendingPayments } from "@/lib/usdt-monitor";

export async function GET(req: Request) {
  return withDb(async () => {
    const user = await getCurrentUser();
    if (!user) return bad("Unauthorized", 401);
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("paymentId");
    // Light scan on poll so dashboard auto-credits without human approve
    await scanPendingPayments();
    const fresh = await getDb()
      .prepare(`SELECT credit_balance_thb FROM users WHERE id = ?`)
      .bind(user.id)
      .first<{ credit_balance_thb: number }>();
    if (paymentId) {
      const payment = await getPayment(user.id, paymentId);
      return json({
        ok: true,
        balance: fresh?.credit_balance_thb ?? user.credit_balance_thb,
        payment,
      });
    }
    const payments = await listPayments(user.id, 5);
    return json({
      ok: true,
      balance: fresh?.credit_balance_thb ?? user.credit_balance_thb,
      payments,
    });
  });
}
