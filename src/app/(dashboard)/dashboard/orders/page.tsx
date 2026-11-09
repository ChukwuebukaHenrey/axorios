import { ChevronLeft, ChevronRight, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { inRange, isCounted, loadMetricOrders, periodRange, summary } from "@/modules/analytics";
import { listConversations, waitingCount } from "@/modules/channels";
import { countToFulfil, listOrdersPage, ORDER_LIST_STATUSES } from "@/modules/orders";
import { shopConnection } from "@/modules/platforms";
import { PageHeader, StatTile } from "../../page-header";
import { requireSeller } from "../../session";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_STYLE, when } from "./labels";

export const metadata = { title: "Orders | AxoriOS" };

const o = t.app.orders;
type Status = (typeof ORDER_LIST_STATUSES)[number];

function href(params: { q?: string; status?: string; page?: number }) {
  const s = new URLSearchParams();
  if (params.q) s.set("q", params.q);
  if (params.status) s.set("status", params.status);
  if (params.page && params.page > 1) s.set("page", String(params.page));
  const qs = s.toString();
  return `/dashboard/orders${qs ? `?${qs}` : ""}`;
}

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

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={o.title} subtitle={o.subtitle} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={o.sales30} value={formatMinor(month.sales, store.currency)} detail={o.sales30Detail.replace("{currency}", store.currency)} />
        <StatTile label={o.toFulfil} value={String(toFulfil)} detail={o.toFulfilDetail} />
        <StatTile label={o.refunded} value={formatMinor(refunded, store.currency)} detail={o.refundedDetail.replace("{count}", String(refundedOrders.length))} />
        <StatTile label={o.conversations} value={String(conversations.length)} detail={o.conversationsDetail.replace("{count}", String(waitingCount(conversations)))} />
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

      <nav aria-label={o.colStatus} className="mt-6 flex flex-wrap items-center gap-2">
        {[undefined, ...ORDER_LIST_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={href({ q: query, status: s })}
            aria-current={status === s ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition ${status === s ? "border-lime bg-lime/10 text-lime" : "border-panel-3 text-stone hover:text-cream"}`}
          >
            {s ? STATUS_LABEL[s] : o.all}
          </Link>
        ))}
      </nav>

      {query && (
        <p className="mt-4 flex items-center gap-3 text-cream">
          {o.results.replace("{q}", query)}
          <Link href={href({ status })} className="inline-flex items-center gap-1 rounded-lg border border-panel-3 px-2.5 py-1 text-sm text-stone hover:text-cream">
            <X className="size-3.5" aria-hidden="true" /> {o.clear}
          </Link>
        </p>
      )}

      {list.orders.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-panel-3 bg-panel p-6 text-stone">{query || status ? o.noResults : t.dashboard.empty}</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-panel-3 bg-panel">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] gap-4 border-b border-panel-3 px-5 py-3 text-xs tracking-wide text-stone uppercase md:grid">
            <span>{o.colOrder}</span>
            <span>{o.colItems}</span>
            <span>{o.colChannel}</span>
            <span>{o.colTotal}</span>
            <span>{o.colStatus}</span>
          </div>
          <ul className="divide-y divide-panel-3">
            {list.orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  className="grid gap-2 px-5 py-4 text-sm transition hover:bg-white/[0.03] focus-visible:bg-white/[0.05] focus-visible:outline-none md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] md:items-start md:gap-4"
                >
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
                  </div>
                  <div className="text-cream/90">
                    {CHANNEL_LABEL[order.channel] ?? order.channel}
                    {order.customer_ref && <p className="truncate text-xs text-stone">{order.customer_ref}</p>}
                  </div>
                  <div>
                    <p className="font-semibold text-cream tabular-nums">{formatMinor(order.total_minor, order.currency)}</p>
                    {order.charge_currency !== order.currency && (
                      <p className="text-xs text-stone">{t.dashboard.charged.replace("{amount}", formatMinor(order.charge_total_minor, order.charge_currency))}</p>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[order.status] ?? "bg-panel-3 text-stone"}`}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {list.total > 0 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-stone">
          <span>{o.page.replace("{page}", String(Math.min(list.page, list.pages))).replace("{pages}", String(list.pages)).replace("{total}", list.total.toLocaleString("en"))}</span>
          <span className="flex gap-2">
            {list.page > 1 ? (
              <Link href={href({ q: query, status, page: Math.min(list.page, list.pages + 1) - 1 })} className="inline-flex items-center gap-1 rounded-lg border border-panel-3 px-3 py-1.5 text-cream hover:bg-white/5">
                <ChevronLeft className="size-4" aria-hidden="true" /> {o.prev}
              </Link>
            ) : null}
            {list.page < list.pages ? (
              <Link href={href({ q: query, status, page: list.page + 1 })} className="inline-flex items-center gap-1 rounded-lg border border-panel-3 px-3 py-1.5 text-cream hover:bg-white/5">
                {o.next} <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </span>
        </nav>
      )}
    </main>
  );
}
