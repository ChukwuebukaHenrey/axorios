import { ChevronLeft, ChevronRight, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { Segmented } from "@/components/ui/segmented";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { inRange, isCounted, loadMetricOrders, periodRange, summary } from "@/modules/analytics";
import { listConversations, waitingCount } from "@/modules/channels";
import { countToFulfil, listOrdersPage, ORDER_LIST_STATUSES } from "@/modules/orders";
import { shopConnection } from "@/modules/platforms";
import { EmptyState, PageHeader, StatTile } from "../../page-header";
import { requireSeller } from "../../session";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_STYLE, when } from "./labels";

export const metadata = { title: "Orders | AxoriOS" };

const o = t.app.orders;
type Status = (typeof ORDER_LIST_STATUSES)[number];
const COLS = "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)]";

function href(params: { q?: string; status?: string; page?: number }) {
  const s = new URLSearchParams();
  if (params.q) s.set("q", params.q);
  if (params.status) s.set("status", params.status);
  if (params.page && params.page > 1) s.set("page", String(params.page));
  const qs = s.toString();
  return `/dashboard/orders${qs ? `?${qs}` : ""}`;
}

const pageBtn = "inline-flex h-8 items-center gap-1 rounded-md border border-panel-3 bg-panel px-2.5 text-cream transition-colors hover:bg-panel-2";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const { supabase, store } = await requireSeller();
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = (ORDER_LIST_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as Status) : undefined;
  const pageNo = Number.parseInt(sp.page ?? "1", 10) || 1;

  const [list, metricOrders, toFulfil, conversations, shop] = await Promise.all([
    listOrdersPage(supabase, store.id, { page: pageNo, q: query, status }),
    loadMetricOrders(store.id),
    countToFulfil(store.id),
    listConversations(store.id),
    shopConnection(store.id),
  ]);

  const range = periodRange("30d");
  const month = summary(metricOrders, range);
  const refundedOrders = inRange(metricOrders, range).filter((x) => isCounted(x) && x.refunded_minor > 0);
  const refunded = refundedOrders.reduce((s, x) => s + x.refunded_minor, 0);

  const shopLine = !shop
    ? t.shopifyCard.statusNone
    : shop.lastSyncedAt
      ? t.shopifyCard.statusSynced.replace("{domain}", shop.shopDomain).replace("{time}", when(shop.lastSyncedAt))
      : t.shopifyCard.statusNever.replace("{domain}", shop.shopDomain);

  return (
    <main className="flex-1 overflow-y-auto px-4 pt-6 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={o.title} subtitle={o.subtitle} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={o.sales30} value={formatMinor(month.sales, store.currency)} detail={o.sales30Detail.replace("{currency}", store.currency)} />
        <StatTile label={o.toFulfil} value={String(toFulfil)} detail={o.toFulfilDetail} />
        <StatTile label={o.refunded} value={formatMinor(refunded, store.currency)} detail={o.refundedDetail.replace("{count}", String(refundedOrders.length))} />
        <StatTile label={o.conversations} value={String(conversations.length)} detail={o.conversationsDetail.replace("{count}", String(waitingCount(conversations)))} />
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-panel-3 pb-4">
        <Segmented
          label={o.colStatus}
          value={status ?? "all"}
          items={[
            { value: "all", label: o.all, href: href({ q: query }) },
            ...ORDER_LIST_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s, href: href({ q: query, status: s }) })),
          ]}
        />
        <form action="/dashboard/orders" role="search" className="relative w-full sm:w-72">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-stone" aria-hidden="true" />
          <input
            name="q"
            type="search"
            defaultValue={query}
            aria-label={o.search}
            placeholder={o.searchPlaceholder}
            className="h-8 w-full rounded-md border border-panel-3 bg-panel pr-3 pl-8 text-sm text-cream outline-none placeholder:text-stone/80 focus-visible:border-lime/50 focus-visible:ring-2 focus-visible:ring-lime/20"
          />
        </form>
      </div>

      {query && (
        <p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-cream">
          {o.results.replace("{q}", query)}
          <Link href={href({ status })} className="inline-flex h-7 items-center gap-1 rounded-md border border-panel-3 px-2 text-xs text-stone transition-colors hover:bg-panel-2 hover:text-cream">
            <X className="size-3.5" aria-hidden="true" /> {o.clear}
          </Link>
        </p>
      )}

      <div className="mt-4">
        {list.orders.length === 0 ? (
          <EmptyState icon={<ShoppingBag />} title={query || status ? o.noResults : t.dashboard.empty} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-panel-3 bg-panel">
            <div className={`hidden gap-4 border-b border-panel-3 bg-panel-2/40 px-5 py-2.5 text-xs font-medium text-stone md:grid ${COLS}`}>
              <span>{o.colOrder}</span>
              <span>{o.colItems}</span>
              <span>{o.colChannel}</span>
              <span className="text-right">{o.colTotal}</span>
              <span>{o.colStatus}</span>
            </div>
            <ul className="divide-y divide-panel-3">
              {list.orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className={`grid gap-2 px-5 py-3 text-sm transition-colors hover:bg-panel-2/50 focus-visible:bg-panel-2/60 focus-visible:outline-none md:items-center md:gap-4 ${COLS}`}
                  >
                    <div>
                      <p className="font-mono text-cream">#{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-stone">{when(order.paid_at ?? order.created_at)}</p>
                    </div>
                    <div className="min-w-0 text-cream/90">
                      {order.items.map((line) => (
                        <p key={line.productId} className="truncate">
                          <span className="text-stone tabular-nums">{line.quantity} ×</span> {line.name}
                        </p>
                      ))}
                    </div>
                    <div className="min-w-0 text-cream/90">
                      {CHANNEL_LABEL[order.channel] ?? order.channel}
                      {order.customer_ref && <p className="truncate text-xs text-stone">{order.customer_ref}</p>}
                    </div>
                    <div className="md:text-right">
                      <p className="font-mono font-medium text-cream tabular-nums">{formatMinor(order.total_minor, order.currency)}</p>
                      {order.charge_currency !== order.currency && (
                        <p className="text-xs text-stone">{t.dashboard.charged.replace("{amount}", formatMinor(order.charge_total_minor, order.charge_currency))}</p>
                      )}
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status] ?? "bg-panel-3 text-stone"}`}>
                        <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-panel-3 px-5 py-2.5 text-xs text-stone">
              <span className="inline-flex min-w-0 items-center gap-2">
                <ShoppingBag className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{shopLine}</span>
                {shop?.lastResult?.error && <span className="text-red-300">{t.shopifyCard.failed}</span>}
              </span>
              {list.total > 0 && (
                <nav aria-label="Pages" className="flex items-center gap-3">
                  <span className="tabular-nums">
                    {o.page.replace("{page}", String(Math.min(list.page, list.pages))).replace("{pages}", String(list.pages)).replace("{total}", list.total.toLocaleString("en"))}
                  </span>
                  <span className="flex gap-1.5">
                    {list.page > 1 && (
                      <Link href={href({ q: query, status, page: Math.min(list.page, list.pages + 1) - 1 })} className={pageBtn}>
                        <ChevronLeft className="size-4" aria-hidden="true" /> {o.prev}
                      </Link>
                    )}
                    {list.page < list.pages && (
                      <Link href={href({ q: query, status, page: list.page + 1 })} className={pageBtn}>
                        {o.next} <ChevronRight className="size-4" aria-hidden="true" />
                      </Link>
                    )}
                  </span>
                </nav>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
