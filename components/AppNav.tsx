import Link from "next/link";
import type { UserRow } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export function AppNav({ user }: { user: UserRow }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
      <div className="flex items-center gap-6">
        <Link href="/app" className="brand-mark text-xl text-[var(--foam)]">
          host2pro
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
          <Link href="/app">ภาพรวม</Link>
          <Link href="/app/credits">เครดิต</Link>
          <Link href="/app/sites">ไซต์</Link>
          <Link href="/app/domains">โดเมน</Link>
          {user.role === "admin" ? <Link href="/admin">แอดมิน</Link> : null}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[var(--mist)]">{user.email}</span>
        <span className="mono text-[var(--sand)]">
          {Number(user.credit_balance_thb).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ฿
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
