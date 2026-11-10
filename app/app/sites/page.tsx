import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSites } from "@/lib/sites";

export default async function SitesPage() {
  const user = await requireUser();
  const sites = await listSites(user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">ไซต์</h1>
          <p className="mt-2 text-[var(--muted)]">ไม่แสดง IP จริงหรือ cloudwaysapps ในหน้าลูกค้า</p>
        </div>
        <Link className="btn btn-primary" href="/app/sites/new">
          Deploy ใหม่
        </Link>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>ชื่อ</th>
            <th>URL</th>
            <th>สถานะ</th>
            <th>หมดอายุ</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/app/sites/${s.id}`}>{s.label || "Wordpress"}</Link>
              </td>
              <td>
                <a className="text-[var(--sea)]" href={s.url} target="_blank" rel="noreferrer">
                  {s.url.replace("https://", "")}
                </a>
              </td>
              <td>
                {s.powerState}
                {s.operationPending ? " (กำลังดำเนินการ)" : ""}
              </td>
              <td>{new Date(s.expiresAt).toLocaleDateString("th-TH")}</td>
            </tr>
          ))}
          {!sites.length ? (
            <tr>
              <td colSpan={4} className="text-[var(--muted)]">
                ยังไม่มีไซต์ —{" "}
                <Link href="/app/sites/new" className="text-[var(--sand)]">
                  Deploy Wordpress
                </Link>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
