import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Segmented } from "@/components/ui/segmented";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { listThreads } from "@/modules/agent";
import {
  conversion,
  dailySales,
  inRange,
  loadClicksByDay,
  loadMetricOrders,
  loadPosts,
  loadProducts,
  loadVisits,
  lowStockCount,
  openedAt,
  periodRange,
  PERIODS,
  postConversions,
  summary,
  visitsIn,
  type Period,
} from "@/modules/analytics";
import { listConversations, waitingCount } from "@/modules/channels";
import { countToFulfil, listOrdersPage } from "@/modules/orders";
import { DayBars } from "../charts";
import { PageHeader, Panel } from "../page-header";
import { requireSeller } from "../session";
import { STATUS_LABEL, STATUS_STYLE, when } from "./orders/labels";

export const metadata = { title: "Home | AxoriOS" };

const h = t.app.home;
const periods = t.app.money.periods;
const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

function ViewAll({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-xs text-stone transition-colors hover:text-cream">
      {h.viewAll} <ChevronRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

/** One "needs you" row: label and help on the left, count on the right; the whole row opens the page. */
function NeedRow({ href, label, detail, count }: { href: string; label: string; detail: string; count: number }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-panel-2/50 focus-visible:bg-panel-2/60 focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="block text-sm text-cream">{label}</span>
          <span className="block truncate text-xs text-stone">{detail}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            data-tile={label}
            className={`min-w-7 rounded-md px-1.5 py-0.5 text-center font-mono text-sm tabular-nums ${count > 0 ? "bg-lime/15 text-lime" : "bg-panel-2 text-stone"}`}
          >
            {count}
          </span>
          <ChevronRight className="size-4 text-stone transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await connection();
  const { supabase, user, store } = await requireSeller();
  const sp = await searchParams;
  const period: Period = (PERIODS as readonly string[]).includes(sp.period ?? "") ? (sp.period as Period) : "30d";
  const cur = store.currency;
  const money = (v: number) => formatMinor(v, cur);
  const name = (user.user_metadata?.first_name as string | undefined) ?? "";

  const [orders, products, visits, posts, clicks, toFulfil, conversations, threads, storeRow, recent] = await Promise.all([
    loadMetricOrders(store.id),
    loadProducts(store.id),
    loadVisits(store.id),
    loadPosts(store.id),
    loadClicksByDay(store.id),
    countToFulfil(store.id),
    listConversations(store.id),
    listThreads(supabase, user.id, store.id),
    supabase.from("stores").select("created_at").eq("id", store.id).single(),
    listOrdersPage(supabase, store.id, { page: 1 }),
  ]);

  const range = periodRange(period);
  const s = summary(orders, range);
  const opened = openedAt(storeRow.data?.created_at ?? new Date().toISOString(), orders);
  const young = opened > range.from;
  const days = dailySales(orders, range).map((d) => ({ day: d.day, value: d.sales }));
  const v = visitsIn(visits, range);
  const share = conversion(inRange(orders, range), v);
  const waiting = threads.reduce((n, x) => n + x.waiting, 0);
  const chats = waitingCount(conversations);
  const low = lowStockCount(products);
  const lastPost = posts
    .filter((p) => p.status === "published")
    .sort((a, b) => ((b.scheduled_at ?? b.created_at) > (a.scheduled_at ?? a.created_at) ? 1 : -1))[0];
  const postClicks = lastPost?.link_id ? clicks.filter((c) => c.link_id === lastPost.link_id).reduce((n, c) => n + c.clicks, 0) : 0;
  const postOrders = lastPost?.link_id ? postConversions(orders, lastPost.link_id) : 0;
  const recentOrders = recent.orders.slice(0, 5);

  return (
    <main className="flex-1 overflow-y-auto px-4 pt-6 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={name ? h.greeting.replace("{name}", name) : h.title} subtitle={h.subtitle} />

      <div className="mt-6 grid items-start gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel
            title={h.sales}
            note={h.salesDetail}
            action={
              <Segmented
                size="sm"
                label={t.app.money.periodLabel}
                value={period}
                items={PERIODS.map((p) => ({ value: p, label: periods[p], href: p === "30d" ? "/dashboard" : `/dashboard?period=${p}` }))}
              />
            }
          >
            <Link href={`/dashboard/money?period=${period}`} className="-m-1 block rounded-md p-1 focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none">
              <p data-tile="Sales" className="text-3xl font-semibold tracking-tight text-cream tabular-nums">
                {money(s.sales)}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone">
                {young ? (
                  <span>{h.sinceOpened}</span>
                ) : (
                  s.salesChange !== null && (
                    <>
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${s.salesChange >= 0 ? "bg-lime/15 text-lime" : "bg-red-500/15 text-red-300"}`}
                      >
                        {s.salesChange >= 0 ? <ArrowUpRight className="size-3" aria-hidden="true" /> : <ArrowDownRight className="size-3" aria-hidden="true" />}
                        {pct(s.salesChange)}
                      </span>
                      <span>{h.vsPrev.replace("{period}", periods[period])}</span>
                    </>
                  )
                )}
              </p>
            </Link>
            <div className="mt-4">
              <DayBars data={days} format={money} label={h.salesChartLabel} />
            </div>
          </Panel>

          <Panel title={h.recent} note={h.recentNote} action={<ViewAll href="/dashboard/orders" />} flush>
            {recentOrders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-stone">{h.noOrders}</p>
            ) : (
              <ul className="divide-y divide-panel-3">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/dashboard/orders/${o.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-5 py-2.5 text-sm transition-colors hover:bg-panel-2/50 focus-visible:bg-panel-2/60 focus-visible:outline-none sm:grid-cols-[6rem_minmax(0,1fr)_auto_7rem]"
                    >
                      <span className="font-mono text-cream">#{o.id.slice(0, 8)}</span>
                      <span className="col-span-2 truncate text-cream/85 sm:col-span-1">
                        {o.items.map((l) => `${l.quantity} × ${l.name}`).join(", ")}
                        <span className="ml-2 text-xs text-stone">{when(o.paid_at ?? o.created_at)}</span>
                      </span>
                      <span className="font-mono text-cream tabular-nums sm:text-right">{formatMinor(o.total_minor, o.currency)}</span>
                      <span className="justify-self-end">
                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status] ?? "bg-panel-3 text-stone"}`}>
                          <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={h.needs} note={h.needsNote} flush>
            <ul className="divide-y divide-panel-3">
              <NeedRow href="/dashboard/orders?status=paid" label={h.toFulfil} detail={h.toFulfilDetail} count={toFulfil} />
              <NeedRow href="/dashboard/inbox" label={h.chats} detail={h.chatsDetail} count={chats} />
              <NeedRow href="/dashboard/ai" label={h.axori} detail={h.axoriDetail} count={waiting} />
              <NeedRow href="/dashboard/store?tab=products" label={h.lowStock} detail={h.lowStockDetail} count={low} />
            </ul>
          </Panel>

          <Panel title={h.storeCard} action={<ViewAll href="/dashboard/store" />}>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-stone">{h.visits}</dt>
                <dd data-tile={h.visits} className="mt-1 text-xl font-semibold text-cream tabular-nums">
                  {v.toLocaleString("en")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-stone">{t.app.store.conversion}</dt>
                <dd className="mt-1 text-xl font-semibold text-cream tabular-nums">{`${(share * 100).toFixed(1)}%`}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-stone">{h.visitsDetail.replace("{share}", `${(share * 100).toFixed(1)}%`)}</p>
          </Panel>

          <Panel title={h.lastPost} action={<ViewAll href="/dashboard/campaigns" />}>
            {lastPost ? (
              <>
                <p className="line-clamp-2 text-sm text-cream/90">{lastPost.caption}</p>
                <p data-tile={h.lastPost} className="mt-2 font-mono text-xs text-stone tabular-nums">
                  {h.lastPostDetail.replace("{clicks}", postClicks.toLocaleString("en")).replace("{orders}", String(postOrders))}
                </p>
              </>
            ) : (
              <p className="text-sm text-stone">{h.noPost}</p>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}
