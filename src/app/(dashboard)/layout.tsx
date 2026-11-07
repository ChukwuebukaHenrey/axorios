import type { ReactNode } from "react";
import { getBrandKit } from "@/modules/brand";
import { listConversations, waitingCount } from "@/modules/channels";
import { listPosts } from "@/modules/creative";
import { listSellerOrders } from "@/modules/orders";
import { draftPreviewToken } from "@/modules/storefront";
import { AppShell } from "./app-shell";
import { requireSeller } from "./session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { supabase, user, store } = await requireSeller();
  const [kit, orders, conversations, posts] = await Promise.all([
    getBrandKit(store.id),
    listSellerOrders(supabase, store.id),
    listConversations(store.id),
    listPosts(supabase, store.id),
  ]);

  return (
    <AppShell
      store={{
        name: kit?.name ?? null,
        slug: store.slug,
        live: store.status === "live",
        draftUrl: kit ? `/s/${store.slug}?draft=${draftPreviewToken(store.id)}` : null,
      }}
      account={{ email: user.email ?? "", name: (user.user_metadata?.first_name as string | undefined) ?? null }}
      counts={{
        orders: orders.length,
        inbox: waitingCount(conversations),
        campaigns: posts.filter((p) => p.status === "draft").length,
      }}
    >
      {children}
    </AppShell>
  );
}
