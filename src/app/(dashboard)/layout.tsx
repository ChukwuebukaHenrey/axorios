import type { ReactNode } from "react";
import { t } from "@/lib/messages";
import { listThreads } from "@/modules/agent";
import { getBrandKit, listOwnerStores } from "@/modules/brand";
import { listConversations, waitingCount } from "@/modules/channels";
import { countToFulfil } from "@/modules/orders";
import { draftPreviewToken } from "@/modules/storefront";
import { AppShell } from "./app-shell";
import { requireSeller } from "./session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { supabase, user, store } = await requireSeller();
  const [kit, stores, toFulfil, conversations, threads] = await Promise.all([
    getBrandKit(store.id),
    listOwnerStores(supabase, user.id),
    countToFulfil(store.id),
    listConversations(store.id),
    listThreads(supabase, user.id, store.id),
  ]);

  return (
    <AppShell
      store={{
        id: store.id,
        name: kit?.name ?? null,
        slug: store.slug,
        live: store.status === "live",
        draftUrl: kit ? `/s/${store.slug}?draft=${draftPreviewToken(store.id)}` : null,
      }}
      stores={stores.map((s) => ({ id: s.id, name: s.name ?? s.slug, live: s.status === "live", currency: s.currency }))}
      account={{ email: user.email ?? "", name: (user.user_metadata?.first_name as string | undefined) ?? null }}
      counts={{ orders: toFulfil, inbox: waitingCount(conversations) }}
      approvals={threads.filter((x) => x.waiting > 0).map((x) => ({ threadId: x.id, title: x.title, count: x.waiting }))}
      pageLabels={t.app.axori.pages}
    >
      {children}
    </AppShell>
  );
}
