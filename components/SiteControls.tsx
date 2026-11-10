"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SiteControls({
  siteId,
  powerState,
  operationPending,
}: {
  siteId: string;
  powerState: string;
  operationPending: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function power(action: "start" | "stop" | "reboot") {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "ไม่สำเร็จ");
        return;
      }
      router.refresh();
    } catch {
      setError("เครือข่ายมีปัญหา");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("ยืนยันลบไซต์? temp URL จะ 301 ไป wordpress.xgb.app")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "ลบไม่สำเร็จ");
        return;
      }
      router.push("/app/sites");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || operationPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" disabled={disabled || powerState === "running"} type="button" onClick={() => power("start")}>
          Start
        </button>
        <button className="btn btn-ghost" disabled={disabled || powerState === "stopped"} type="button" onClick={() => power("stop")}>
          Stop
        </button>
        <button className="btn btn-ghost" disabled={disabled} type="button" onClick={() => power("reboot")}>
          Reboot
        </button>
        <button className="btn btn-danger" disabled={busy} type="button" onClick={remove}>
          ลบไซต์
        </button>
      </div>
      {operationPending ? <p className="text-sm text-[var(--sand)]">กำลังดำเนินการ…</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
