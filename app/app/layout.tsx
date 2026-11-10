import { AppNav } from "@/components/AppNav";
import { requireUser } from "@/lib/auth";
import { ensureBootstrapAdmin } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  await ensureBootstrapAdmin();
  const user = await requireUser();
  return (
    <main className="atmosphere min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <AppNav user={user} />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
