"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "ไม่สำเร็จ");
        return;
      }
      router.push(data.redirect || "/app");
      router.refresh();
    } catch {
      setError("เครือข่ายมีปัญหา");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="atmosphere min-h-screen px-6 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/" className="brand-mark text-2xl text-[var(--foam)]">
          host2pro
        </Link>
        <h1 className="mt-10 font-[family-name:var(--font-display)] text-3xl">
          {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          {mode === "login" ? "ยินดีต้อนรับกลับ" : "สร้างบัญชีด้วยอีเมลและรหัสผ่าน"}
        </p>
        <form onSubmit={onSubmit} className="panel mt-8 space-y-4 rounded-md p-6">
          <div className="field">
            <label htmlFor="email">อีเมล</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">รหัสผ่าน</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <button className="btn btn-primary w-full" disabled={loading} type="submit">
            {loading ? "กำลังดำเนินการ…" : mode === "login" ? "เข้าสู่ระบบ" : "สมัคร"}
          </button>
        </form>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {mode === "login" ? (
            <>
              ยังไม่มีบัญชี? <Link href="/register">สมัคร</Link>
            </>
          ) : (
            <>
              มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
