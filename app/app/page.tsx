import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listPayments } from "@/lib/credits";
import { getPublicSettings } from "@/lib/settings";
import { listSites } from "@/lib/sites";
import { CreditWaitBanner } from "@/components/CreditWaitBanner";

export default async function AppHome() {
  const user = await requireUser();
  const settings = await getPublicSettings();
  const sites = await listSites(user.id);
  const payments = await listPayments(user.id, 3);
  const pending = payments.find((p) => (p as { status: string }).status === "pending") as
    | { id: string; amount_usdt: string; status: string }
    | undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">ภาพรวม</h1>
        <p className="mt-2 text-[var(--muted)]">
          แพ็กเกจ {settings.packageName} · {settings.packagePriceThb.toLocaleString("th-TH")} ฿/เดือน · อัตรา{" "}
          1 USDT = {settings.fxUsdtThb.toFixed(2)} ฿
        </p>
      </div>

      {pending ? <CreditWaitBanner paymentId={pending.id} amountUsdt={pending.amount_usdt} /> : null}

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="panel rounded-md p-5">
          <div className="text-sm text-[var(--muted)]">เครดิตคงเหลือ</div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[var(--sand)]">
            {Number(user.credit_balance_thb).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ฿
          </div>
          <Link className="btn btn-primary mt-5" href="/app/credits">
            เติม USDT
          </Link>
        </div>
        <div className="panel rounded-md p-5">
          <div className="text-sm text-[var(--muted)]">ไซต์ที่ใช้งาน</div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-4xl">{sites.length}</div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="btn btn-primary" href="/app/sites/new">
              Deploy Wordpress
            </Link>
            <Link className="btn btn-ghost" href="/app/sites">
              ดูทั้งหมด
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
