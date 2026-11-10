"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CREDIT_POLL_MS } from "@/lib/constants";

export function CreditWaitBanner({
  paymentId,
  amountUsdt,
}: {
  paymentId: string;
  amountUsdt: string;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch(`/api/credits/status?paymentId=${paymentId}`);
        const data = await res.json();
        if (!alive) return;
        if (typeof data.balance === "number") setBalance(data.balance);
        if (data.payment?.status === "confirmed") {
          setToast("เครดิตเข้าแล้ว");
          router.refresh();
        }
      } catch {
        /* ignore transient */
      }
    }
    tick();
    const id = setInterval(tick, CREDIT_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [paymentId, router]);

  return (
    <>
      <div className="status-bar rounded-r-md">
        <div className="flex-1">
          <div className="font-medium text-[var(--foam)]">รอตรวจรับ USDT อัตโนมัติ</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            ยอดที่ต้องโอน <span className="mono text-[var(--sand)]">{amountUsdt}</span> USDT TRC20 · เชนประมาณ
            1–3 นาที · รีเฟรชทุก 30 วินาที
            {balance != null ? (
              <>
                {" "}
                · ยอดปัจจุบัน{" "}
                <span className="mono">
                  {balance.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ฿
                </span>
              </>
            ) : null}
          </div>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => router.refresh()}>
          ตรวจสอบอีกครั้ง
        </button>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
