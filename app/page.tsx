import Link from "next/link";
import { PACKAGE_PRICE_THB } from "@/lib/constants";

export default function Home() {
  return (
    <main className="atmosphere min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-16 pt-8">
        <header className="flex items-center justify-between gap-4">
          <div className="brand-mark text-2xl text-[var(--foam)] sm:text-3xl">host2pro</div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link className="btn btn-ghost" href="/login">
              เข้าสู่ระบบ
            </Link>
            <Link className="btn btn-primary" href="/register">
              สมัคร
            </Link>
          </nav>
        </header>

        <section className="relative flex flex-1 flex-col justify-center py-16 sm:py-20">
          <p className="rise brand-mark text-5xl leading-none text-[var(--foam)] sm:text-7xl md:text-8xl">
            host2pro
          </p>
          <span className="brand-underline rise-delay" />
          <h1 className="rise-delay mt-8 max-w-3xl font-[family-name:var(--font-display)] text-3xl font-medium leading-tight text-[var(--text)] sm:text-5xl">
            Wordpress พร้อมใช้ — {PACKAGE_PRICE_THB.toLocaleString("th-TH")} บาท/เดือน/ไซต์
          </h1>
          <p className="rise-delay-2 mt-5 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            สมัคร เติม USDT TRC20 แล้ว deploy ได้ทันที โดเมนชั่วคราวบน xgb.app ซ่อน IP จริง
            พร้อม Start / Stop / Reboot จากแดชบอร์ด
          </p>
          <div className="rise-delay-2 mt-10 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/register">
              เริ่มต้นใช้งาน
            </Link>
            <Link className="btn btn-ghost" href="/login">
              มีบัญชีแล้ว
            </Link>
          </div>
        </section>

        <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-6 text-sm text-[var(--mist)]">
          <div>
            <div className="text-[var(--foam)]">wordpress.xgb.app</div>
            <div>DigitalOcean Singapore · 1 server = 1 WP</div>
          </div>
          <div className="text-right">แพ็กเกจ Wordpress · เครดิตอัตโนมัติจากเชน</div>
        </footer>
      </div>
    </main>
  );
}
