import { requireUser } from "@/lib/auth";
import { listLedger, listPayments } from "@/lib/credits";
import { getPublicSettings } from "@/lib/settings";
import { TopupForm } from "@/components/TopupForm";
import { CreditWaitBanner } from "@/components/CreditWaitBanner";

export default async function CreditsPage() {
  const user = await requireUser();
  const settings = await getPublicSettings();
  const ledger = await listLedger(user.id);
  const payments = await listPayments(user.id);
  const pending = payments.find((p) => (p as { status: string }).status === "pending") as
    | { id: string; amount_usdt: string }
    | undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">เครดิต</h1>
        <p className="mt-2 text-[var(--muted)]">
          คงเหลือ{" "}
          <span className="mono text-[var(--sand)]">
            {Number(user.credit_balance_thb).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ฿
          </span>
        </p>
      </div>

      {pending ? <CreditWaitBanner paymentId={pending.id} amountUsdt={pending.amount_usdt} /> : null}

      <TopupForm
        fxRate={settings.fxUsdtThb}
        fxUpdatedAt={settings.fxUpdatedAt}
        defaultWallet={settings.receiveWallet}
      />

      <section>
        <h2 className="text-lg text-[var(--foam)]">ประวัติ ledger</h2>
        <table className="table mt-3">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>ประเภท</th>
              <th>จำนวน</th>
              <th>คงเหลือ</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {(ledger as { created_at: string; kind: string; amount_thb: number; balance_after_thb: number; note: string | null }[]).map(
              (row) => (
                <tr key={`${row.created_at}-${row.kind}-${row.balance_after_thb}`}>
                  <td>{new Date(row.created_at).toLocaleString("th-TH")}</td>
                  <td>{row.kind}</td>
                  <td className="mono">{row.amount_thb}</td>
                  <td className="mono">{row.balance_after_thb}</td>
                  <td>{row.note}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
