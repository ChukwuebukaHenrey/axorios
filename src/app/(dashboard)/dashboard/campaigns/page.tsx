import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { listPosts } from "@/modules/creative";
import { publishTargets } from "@/modules/publishers";
import { CampaignBoard } from "./campaign-board";

export const metadata = { title: "Marketing | AxoriOS" };

export default async function CampaignsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const store = await getOrCreateStore(supabase, user.id);
  const [posts, targets] = await Promise.all([listPosts(supabase, store.id), publishTargets(store.id)]);

  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-2 bg-primary px-4 py-3 text-white">
        <Logo className="size-6" />
        <h1 className="font-semibold">{t.campaigns.title}</h1>
        <Link href="/dashboard" className="ml-auto inline-flex min-h-11 items-center px-2 text-sm font-semibold underline">
          {t.dashboard.title}
        </Link>
        <Link href="/build" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline">
          {t.dashboard.toBuilder}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <CampaignBoard posts={posts} canPublish={targets.length > 0} />
      </main>
    </div>
  );
}
