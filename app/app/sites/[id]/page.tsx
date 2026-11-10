import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSite } from "@/lib/sites";
import { SiteControls } from "@/components/SiteControls";

type Props = { params: Promise<{ id: string }> };

export default async function SiteDetailPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const site = await getSite(user.id, id);
  if (!site) notFound();

  return (
    <div className="space-y-6">
      <Link href="/app/sites" className="text-sm text-[var(--muted)]">
        ← ไซต์ทั้งหมด
      </Link>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{site.label || "Wordpress"}</h1>
        <p className="mt-2 text-[var(--muted)]">
          สถานะ {site.powerState} · หมดอายุ {new Date(site.expiresAt).toLocaleDateString("th-TH")}
        </p>
      </div>
      <div className="panel rounded-md p-5">
        <div className="text-sm text-[var(--muted)]">URL ลูกค้า</div>
        <a className="mt-2 block text-xl text-[var(--sea)]" href={site.url} target="_blank" rel="noreferrer">
          {site.url}
        </a>
        {site.customDomain ? <p className="mt-2 text-[var(--mist)]">โดเมน: {site.customDomain}</p> : null}
      </div>
      <SiteControls
        siteId={site.id}
        powerState={site.powerState}
        operationPending={site.operationPending}
      />
    </div>
  );
}
