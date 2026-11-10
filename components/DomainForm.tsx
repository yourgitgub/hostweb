"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DomainForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      setMsg(data.error || (data.ok ? "สั่งซื้อแล้ว" : "ยังซื้อไม่ได้ — stub Registrar"));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel max-w-lg space-y-4 rounded-md p-5">
      <div className="field">
        <label htmlFor="domain">ชื่อโดเมน</label>
        <input
          id="domain"
          required
          placeholder="mysite.com"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <p className="text-sm text-[var(--muted)]">
        ซื้อผ่าน Cloudflare Registrar API (check → register). ต้องตั้ง CLOUDFLARE_API_TOKEN + account id
        และมี billing/registrant ในบัญชี Cloudflare
      </p>
      {msg ? <p className="text-sm text-[var(--sand)]">{msg}</p> : null}
      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? "กำลังสั่ง…" : "สั่งซื้อโดเมน"}
      </button>
    </form>
  );
}
