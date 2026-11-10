"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Payment = {
  id: string;
  amountUsdt: string;
  amountThb: number;
  fxRate: number;
  fxUpdatedAt: string;
  receiveAddress: string;
  expiresAt: string;
};

export function TopupForm({
  fxRate,
  fxUpdatedAt,
  defaultWallet,
}: {
  fxRate: number;
  fxUpdatedAt: string;
  defaultWallet: string;
}) {
  const router = useRouter();
  const [amountThb, setAmountThb] = useState("3000");
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [copied, setCopied] = useState<"addr" | "amt" | "">("");
  const [loading, setLoading] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountThb: Number(amountThb) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "ไม่สำเร็จ");
        return;
      }
      setPayment(data.payment);
      router.refresh();
    } catch {
      setError("เครือข่ายมีปัญหา");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, kind: "addr" | "amt") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        อัตราแลกเปลี่ยนปัจจุบัน{" "}
        <strong className="text-[var(--foam)]">1 USDT = {fxRate.toFixed(2)} ฿</strong>
        {" · "}
        อัปเดต {new Date(fxUpdatedAt).toLocaleString("th-TH")}
      </p>

      {!payment ? (
        <form onSubmit={create} className="panel max-w-md space-y-4 rounded-md p-5">
          <div className="field">
            <label htmlFor="thb">จำนวนที่ต้องการ (บาท)</label>
            <input
              id="thb"
              type="number"
              min={1}
              step="1"
              required
              value={amountThb}
              onChange={(e) => setAmountThb(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "สร้างยอดโอน…" : "สร้างยอด USDT ไม่ซ้ำ"}
          </button>
        </form>
      ) : (
        <div className="panel max-w-xl space-y-4 rounded-md p-5">
          <div className="status-bar rounded-r-md">
            <div>
              โอนเฉพาะ <strong>USDT TRC20</strong> ตามยอดด้านล่างเท่านั้น — ระบบเครดิตอัตโนมัติจากเชน
              ไม่มีคนอนุมัติ
            </div>
          </div>
          <div className="field">
            <label>ที่อยู่รับเงิน</label>
            <div className="flex flex-wrap gap-2">
              <code className="mono flex-1 break-all rounded bg-black/30 px-3 py-2 text-sm">
                {payment.receiveAddress || defaultWallet}
              </code>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => copy(payment.receiveAddress || defaultWallet, "addr")}
              >
                {copied === "addr" ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
            </div>
          </div>
          <div className="field">
            <label>จำนวน USDT (คัดลอกอย่างเดียว — ห้ามแก้)</label>
            <div className="flex flex-wrap gap-2">
              <code className="mono flex-1 rounded bg-black/30 px-3 py-2 text-lg text-[var(--sand)]">
                {payment.amountUsdt}
              </code>
              <button className="btn btn-ghost" type="button" onClick={() => copy(payment.amountUsdt, "amt")}>
                {copied === "amt" ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
            </div>
          </div>
          <p className="text-sm text-[var(--muted)]">
            ≈ {payment.amountThb.toLocaleString("th-TH")} ฿ · หมดอายุ{" "}
            {new Date(payment.expiresAt).toLocaleString("th-TH")}
          </p>
          <button className="btn btn-primary" type="button" onClick={() => router.push("/app")}>
            ไปแดชบอร์ดรอเครดิต
          </button>
        </div>
      )}
    </div>
  );
}
