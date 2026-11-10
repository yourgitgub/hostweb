import { AppNav } from "@/components/AppNav";
import { AdminPanel } from "@/components/AdminPanel";
import { ensureBootstrapAdmin, requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/env";
import { countReadyPool } from "@/lib/pool";
import { ensureSchema } from "@/lib/schema";
import { getAdminSettings, maskSecret } from "@/lib/settings";

export default async function AdminPage() {
  await ensureSchema();
  await ensureBootstrapAdmin();
  const user = await requireAdmin();
  const s = await getAdminSettings();
  const ready = await countReadyPool();
  const { results } = await getDb()
    .prepare(
      `SELECT id, status, label, created_at FROM provider_pool ORDER BY created_at DESC LIMIT 50`,
    )
    .all<{ id: string; status: string; label: string | null; created_at: string }>();

  return (
    <main className="atmosphere min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <AppNav user={user} />
        <div className="mt-8 space-y-6">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl">แอดมิน</h1>
            <p className="mt-2 text-[var(--muted)]">
              ตั้ง Cloudflare / Cloudways API, FX, พูล — ไม่โชว์ยอดคลังกระเป๋าให้ลูกค้า
            </p>
          </div>
          <AdminPanel
            ready={ready}
            pool={results ?? []}
            settings={{
              fxUsdtThb: s.fxUsdtThb,
              fxUpdatedAt: s.fxUpdatedAt,
              receiveWallet: s.receiveWallet,
              packagePriceThb: s.packagePriceThb,
              poolMinReady: s.poolMinReady,
              cloudflareAccountId: s.cloudflareAccountId,
              cloudflareZoneIdXgb: s.cloudflareZoneIdXgb,
              cloudflareApiToken: maskSecret(s.cloudflareApiToken),
              cloudwaysApiToken: maskSecret(s.cloudwaysApiToken),
              cloudwaysInstanceType: s.cloudwaysInstanceType,
              cloudflareApiTokenSet: Boolean(s.cloudflareApiToken),
              cloudwaysApiTokenSet: Boolean(s.cloudwaysApiToken),
            }}
          />
        </div>
      </div>
    </main>
  );
}
