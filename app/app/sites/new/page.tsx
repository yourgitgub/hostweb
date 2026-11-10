import { requireUser } from "@/lib/auth";
import { getPublicSettings } from "@/lib/settings";
import { DeployForm } from "@/components/DeployForm";

export default async function NewSitePage() {
  await requireUser();
  const settings = await getPublicSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Deploy Wordpress</h1>
        <p className="mt-2 text-[var(--muted)]">
          Assign จากพูลพรีโปรวิชั่น · Cloudways DO Singapore · ซ่อน origin IP
        </p>
      </div>
      <DeployForm priceThb={settings.packagePriceThb} />
    </div>
  );
}
