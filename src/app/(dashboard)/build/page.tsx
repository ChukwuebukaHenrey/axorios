import { env } from "@/lib/env";
import { loadSellerSession } from "@/modules/agent";
import { getBrandKit } from "@/modules/brand";
import { listProducts } from "@/modules/catalog";
import { listPosts } from "@/modules/creative";
import { shopConnection } from "@/modules/platforms";
import { draftPreviewToken, getDraftConfig, MARKET_PRESETS } from "@/modules/storefront";
import { requireSeller } from "../session";
import { BuilderChat } from "./builder-chat";

export const metadata = { title: "Build your store | AxoriOS" };

export default async function BuildPage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  const { supabase, user, store } = await requireSeller();
  const [{ prompt }, messages, kit, products, posts, shop, draft] = await Promise.all([
    searchParams,
    loadSellerSession(store.id),
    getBrandKit(store.id),
    listProducts(store.id),
    listPosts(supabase, store.id),
    shopConnection(store.id),
    getDraftConfig(store.id),
  ]);

  const drafts = posts.filter((p) => p.status === "draft");
  const scheduled = posts
    .filter((p) => p.status === "scheduled" && p.scheduled_at)
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
  const presets = Object.entries(MARKET_PRESETS).map(([id, preset]) => ({ id, label: preset.label }));
  const name = (user.user_metadata?.first_name as string | undefined) ?? user.email ?? "";

  return (
    <BuilderChat
      initialMessages={messages}
      previewUrl={`/s/${store.slug}?draft=${draftPreviewToken(store.id)}`}
      initialHasKit={kit !== null}
      presets={presets}
      storeSlug={store.slug}
      initials={name.slice(0, 2).toUpperCase()}
      initialInput={typeof prompt === "string" ? prompt.slice(0, 500) : ""}
      templateLabel={presets.find((p) => p.id === draft?.preset)?.label ?? null}
      overview={{
        kit,
        products,
        live: store.status === "live",
        liveUrl: `${env().NEXT_PUBLIC_APP_URL}/s/${store.slug}`,
        drafts: { count: drafts.length, image: drafts.find((p) => p.media_url)?.media_url ?? null },
        scheduled: { count: scheduled.length, next: scheduled[0]?.scheduled_at ?? null },
        shop: shop && { domain: shop.shopDomain, lastSyncedAt: shop.lastSyncedAt },
      }}
    />
  );
}
