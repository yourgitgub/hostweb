import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/env";
import { ensureSchema } from "@/lib/schema";
import { DomainForm } from "@/components/DomainForm";

export default async function DomainsPage() {
  const user = await requireUser();
  await ensureSchema();
  const { results } = await getDb()
    .prepare(
      `SELECT id, name, status, created_at FROM domains WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .bind(user.id)
    .all<{ id: string; name: string; status: string; created_at: string }>();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">โดเมน</h1>
        <p className="mt-2 text-[var(--muted)]">Cloudflare Registrar + DNS (stub พร้อม API)</p>
      </div>
      <DomainForm />
      <table className="table">
        <thead>
          <tr>
            <th>โดเมน</th>
            <th>สถานะ</th>
            <th>สร้างเมื่อ</th>
          </tr>
        </thead>
        <tbody>
          {(results ?? []).map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td>{d.status}</td>
              <td>{new Date(d.created_at).toLocaleString("th-TH")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
