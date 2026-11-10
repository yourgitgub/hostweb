"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeployForm({ priceThb }: { priceThb: number }) {
  const router = useRouter();
  const [label, setLabel] = useState("Wordpress");
  const [customDomain, setCustomDomain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          customDomain: customDomain.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Deploy ไม่สำเร็จ");
        if (res.status === 402) {
          setTimeout(() => router.push("/app/credits"), 800);
        }
        return;
      }
      router.push(`/app/sites/${data.site.id}`);
      router.refresh();
    } catch {
      setError("เครือข่ายมีปัญหา");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel max-w-lg space-y-4 rounded-md p-5">
      <p className="text-sm text-[var(--muted)]">
        หักเครดิต {priceThb.toLocaleString("th-TH")} ฿ · ได้โดเมนชั่วคราว {"{xxxxxxxx}"}.xgb.app
      </p>
      <div className="field">
        <label htmlFor="label">ชื่อไซต์</label>
        <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="domain">โดเมนกำหนดเอง (ไม่บังคับ)</label>
        <input
          id="domain"
          placeholder="example.com"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? "กำลัง assign จากพูล…" : "Deploy"}
      </button>
    </form>
  );
}
