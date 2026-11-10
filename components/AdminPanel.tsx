"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  fxUsdtThb: number;
  fxUpdatedAt: string;
  receiveWallet: string;
  packagePriceThb: number;
  poolMinReady: number;
  cloudflareAccountId: string;
  cloudflareZoneIdXgb: string;
  cloudflareApiToken: string;
  cloudwaysApiToken: string;
  cloudwaysInstanceType: string;
  cloudflareApiTokenSet: boolean;
  cloudwaysApiTokenSet: boolean;
};

export function AdminPanel({
  settings,
  ready,
  pool,
}: {
  settings: Settings;
  ready: number;
  pool: { id: string; status: string; label: string | null; created_at: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    fxUsdtThb: String(settings.fxUsdtThb),
    receiveWallet: settings.receiveWallet,
    packagePriceThb: String(settings.packagePriceThb),
    poolMinReady: String(settings.poolMinReady),
    cloudflareAccountId: settings.cloudflareAccountId,
    cloudflareZoneIdXgb: settings.cloudflareZoneIdXgb,
    cloudflareApiToken: "",
    cloudwaysApiToken: "",
    cloudwaysInstanceType: settings.cloudwaysInstanceType,
  });
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fxUsdtThb: Number(form.fxUsdtThb),
        receiveWallet: form.receiveWallet,
        packagePriceThb: Number(form.packagePriceThb),
        poolMinReady: Number(form.poolMinReady),
        cloudflareAccountId: form.cloudflareAccountId,
        cloudflareZoneIdXgb: form.cloudflareZoneIdXgb,
        cloudflareApiToken: form.cloudflareApiToken || undefined,
        cloudwaysApiToken: form.cloudwaysApiToken || undefined,
        cloudwaysInstanceType: form.cloudwaysInstanceType,
      }),
    });
    const data = await res.json();
    setMsg(data.ok ? "บันทึกแล้ว" : data.error || "ไม่สำเร็จ");
    router.refresh();
  }

  async function poolAction(action: string) {
    const res = await fetch("/api/admin/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, count: 2 }),
    });
    const data = await res.json();
    setMsg(JSON.stringify(data));
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <form onSubmit={save} className="panel space-y-4 rounded-md p-5">
        <h2 className="text-lg text-[var(--foam)]">ตั้งค่า</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label>FX USDT→THB (อัปเดตรายสัปดาห์)</label>
            <input
              value={form.fxUsdtThb}
              onChange={(e) => setForm({ ...form, fxUsdtThb: e.target.value })}
            />
            <span className="text-xs text-[var(--muted)]">
              อัปเดตล่าสุด {new Date(settings.fxUpdatedAt).toLocaleString("th-TH")}
            </span>
          </div>
          <div className="field">
            <label>กระเป๋ารับ USDT TRC20</label>
            <input
              value={form.receiveWallet}
              onChange={(e) => setForm({ ...form, receiveWallet: e.target.value })}
            />
          </div>
          <div className="field">
            <label>ราคาแพ็กเกจ (บาท)</label>
            <input
              value={form.packagePriceThb}
              onChange={(e) => setForm({ ...form, packagePriceThb: e.target.value })}
            />
          </div>
          <div className="field">
            <label>ขนาดพูลขั้นต่ำ (ready)</label>
            <input
              value={form.poolMinReady}
              onChange={(e) => setForm({ ...form, poolMinReady: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Cloudflare Account ID</label>
            <input
              value={form.cloudflareAccountId}
              onChange={(e) => setForm({ ...form, cloudflareAccountId: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Cloudflare Zone ID (xgb.app)</label>
            <input
              value={form.cloudflareZoneIdXgb}
              onChange={(e) => setForm({ ...form, cloudflareZoneIdXgb: e.target.value })}
            />
          </div>
          <div className="field">
            <label>
              Cloudflare API token {settings.cloudflareApiTokenSet ? `(ตั้งแล้ว: ${settings.cloudflareApiToken})` : ""}
            </label>
            <input
              type="password"
              placeholder="วางโทเคนใหม่เพื่อแทนที่"
              value={form.cloudflareApiToken}
              onChange={(e) => setForm({ ...form, cloudflareApiToken: e.target.value })}
            />
          </div>
          <div className="field">
            <label>
              Cloudways API v2 Bearer {settings.cloudwaysApiTokenSet ? `(ตั้งแล้ว: ${settings.cloudwaysApiToken})` : ""}
            </label>
            <input
              type="password"
              placeholder="วางโทเคนใหม่เพื่อแทนที่"
              value={form.cloudwaysApiToken}
              onChange={(e) => setForm({ ...form, cloudwaysApiToken: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Cloudways instance type</label>
            <input
              value={form.cloudwaysInstanceType}
              onChange={(e) => setForm({ ...form, cloudwaysInstanceType: e.target.value })}
            />
          </div>
        </div>
        <button className="btn btn-primary" type="submit">
          บันทึก
        </button>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg text-[var(--foam)]">พูลเซิร์ฟเวอร์ (ready: {ready})</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => poolAction("maintain")}>
              Maintain pool
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => poolAction("provision")}>
              Provision 1
            </button>
            <button className="btn btn-primary" type="button" onClick={() => poolAction("seed_mock")}>
              Seed mock ready
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {pool.map((p) => (
              <tr key={p.id}>
                <td>{p.label}</td>
                <td>{p.status}</td>
                <td>{new Date(p.created_at).toLocaleString("th-TH")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {msg ? <pre className="panel overflow-auto rounded-md p-4 text-xs text-[var(--mist)]">{msg}</pre> : null}
    </div>
  );
}
