import { ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { listConversations, waitingCount } from "@/modules/channels";
import { listPosts } from "@/modules/creative";
import { listSellerOrders, type Order } from "@/modules/orders";
import { shopConnection } from "@/modules/platforms";
import { PageHeader, StatTile } from "../page-header";
import { requireSeller } from "../session";

export const metadata = { title: "Orders | AxoriOS" };

const o = t.app.orders;
const STATUS_LABEL: Record<string, string> = { paid: t.dashboard.statusPaid, approved: t.dashboard.statusConfirming, failed: t.dashboard.statusFailed };
const STATUS_STYLE: Record<string, string> = { paid: "bg-lime/15 text-lime", approved: "bg-accent/15 text-accent", failed: "bg-red-500/15 text-red-300" };
const CHANNEL_LABEL: Record<string, string> = {
  web: t.dashboard.channelWeb,
  telegram: t.dashboard.channelTelegram,
  whatsapp: t.dashboard.channelWhatsApp,
  instagram: t.dashboard.channelInstagram,
};
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

function matches(order: Order, q: string) {
  const haystack = [order.id, order.customer_ref, order.delivery_note, CHANNEL_LABEL[order.channel], ...order.items.map((i) => i.name)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

/** Revenue in the store's own currency, from paid orders only. Orders are priced in one currency per store. */
function revenue(orders: Order[]) {
  const paid = orders.filter((order) => order.status === "paid");
  const currency = paid[0]?.currency ?? orders[0]?.currency ?? "USD";
  const total = paid.filter((order) => order.currency === currency).reduce((sum, order) => sum + order.total_minor, 0);
  return { total, currency };
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, store } = await requireSeller();
  const [{ q }, orders, conversations, posts, shop] = await Promise.all([
    searchParams,
    listSellerOrders(supabase, store.id),
    listConversations(store.id),
    listPosts(supabase, store.id),
    shopConnection(store.id),
  ]);

  const query = typeof q === "string" ? q.trim() : "";
  const shown = query ? orders.filter((order) => matches(order, query)) : orders;
  const { total, currency } = revenue(orders);
  const scheduled = posts.filter((p) => p.status === "scheduled" && p.scheduled_at).sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={o.title} subtitle={o.subtitle} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={o.revenue} value={formatMinor(total, currency)} detail={o.revenueDetail.replace("{currency}", currency)} />
        <StatTile
          label={o.orders}
          value={String(orders.length)}
          detail={o.ordersDetail
            .replace("{paid}", String(orders.filter((x) => x.status === "paid").length))
            .replace("{waiting}", String(orders.filter((x) => x.status === "approved").length))}
        />
        <StatTile
          label={o.conversations}
          value={String(conversations.length)}
          detail={o.conversationsDetail.replace("{count}", String(waitingCount(conversations)))}
        />
        <StatTile
          label={o.scheduled}
          value={String(scheduled.length)}
          detail={scheduled[0]?.scheduled_at ? o.scheduledNext.replace("{time}", when(scheduled[0].scheduled_at)) : o.scheduledNone}
        />
      </section>

      <section className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-panel-3 bg-panel p-4 text-sm">
        <ShoppingBag className="size-5 text-lime" aria-hidden="true" />
        <span className="font-medium text-cream">{t.shopifyCard.statusTitle}</span>
        <span className="text-stone">
          {!shop
            ? t.shopifyCard.statusNone
            : shop.lastSyncedAt
              ? t.shopifyCard.statusSynced.replace("{domain}", shop.shopDomain).replace("{time}", when(shop.lastSyncedAt))
              : t.shopifyCard.statusNever.replace("{domain}", shop.shopDomain)}
        </span>
        {shop?.lastResult?.error && <span className="text-red-300">{t.shopifyCard.failed}</span>}
      </section>

      {query && (
        <p className="mt-6 flex items-center gap-3 text-cream">
          {o.results.replace("{q}", query)}
          <Link href="/dashboard" className="inline-flex items-center gap-1 rounded-lg border border-panel-3 px-2.5 py-1 text-sm text-stone hover:text-cream">
            <X className="size-3.5" aria-hidden="true" /> {o.clear}
          </Link>
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-panel-3 bg-panel p-6 text-stone">{query ? o.noResults : t.dashboard.empty}</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-panel-3 bg-panel">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4 border-b border-panel-3 px-5 py-3 text-xs tracking-wide text-stone uppercase md:grid">
            <span>{o.colOrder}</span>
            <span>{o.colItems}</span>
            <span>{o.colChannel}</span>
            <span>{o.colTotal}</span>
            <span>{o.colStatus}</span>
          </div>
          <ul className="divide-y divide-panel-3">
            {shown.map((order) => (
              <li key={order.id} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] md:items-start md:gap-4">
                <div>
                  <p className="font-mono text-cream">#{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-stone">{when(order.paid_at ?? order.created_at)}</p>
                </div>
                <div className="text-cream/90">
                  {order.items.map((line) => (
                    <p key={line.productId}>
                      {line.quantity} × {line.name}
                    </p>
                  ))}
                  {order.delivery_note && (
                    <p className="mt-1 text-xs whitespace-pre-line text-stone">
                      {o.deliver}: {order.delivery_note}
                    </p>
                  )}
                </div>
                <div className="text-cream/90">
                  {CHANNEL_LABEL[order.channel] ?? order.channel}
                  {order.customer_ref && <p className="truncate text-xs text-stone">{order.customer_ref}</p>}
                </div>
                <div>
                  <p className="font-semibold text-cream">{formatMinor(order.total_minor, order.currency)}</p>
                  {order.charge_currency !== order.currency && (
                    <p className="text-xs text-stone">
                      {t.dashboard.charged.replace("{amount}", formatMinor(order.charge_total_minor, order.charge_currency))}
                    </p>
                  )}
                </div>
                <div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[order.status] ?? "bg-panel-3 text-stone"}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
