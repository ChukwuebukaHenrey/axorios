import Link from "next/link";
import { t } from "@/lib/messages";
import { listPosts } from "@/modules/creative";
import { publishTargets } from "@/modules/publishers";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { CampaignBoard } from "./campaign-board";

export const metadata = { title: "Campaigns | AxoriOS" };

export default async function CampaignsPage() {
  const { supabase, store } = await requireSeller();
  const [posts, targets] = await Promise.all([listPosts(supabase, store.id), publishTargets(store.id)]);

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={t.app.nav.campaigns} subtitle={t.app.campaignsSubtitle}>
        <Link
          href={`/build?prompt=${encodeURIComponent(t.app.cards.makePostsPrompt)}`}
          className="inline-flex h-11 items-center rounded-lg bg-lime px-4 text-sm font-semibold text-black transition hover:bg-lime/85"
        >
          {t.app.cards.makePosts}
        </Link>
      </PageHeader>
      <div className="mt-6">
        <CampaignBoard posts={posts} canPublish={targets.length > 0} />
      </div>
    </main>
  );
}
