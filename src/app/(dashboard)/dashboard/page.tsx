import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
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
import { countToFulfil } from "@/modules/orders";
import { Sparkline } from "../charts";
import { PageHeader } from "../page-header";
import { requireSeller } from "../session";

export const metadata = { title: "Home | AxoriOS" };

const h = t.app.home;
const periods = t.app.money.periods;
const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

function Tile({
  href,
  label,
  value,
  detail,
  page,
  children,
  wide = false,
}: {
  href: string;
  label: string;
  value: string;
  detail: ReactNode;
  page: string;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}. ${h.open.replace("{page}", page)}`}
      className={`group rounded-2xl border border-panel-3 bg-panel p-5 transition-colors hover:border-lime/40 focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none ${wide ? "sm:col-span-2" : ""}`}
    >
      <p className="text-sm text-stone">{label}</p>
      <p
        data-tile={label}
        className="mt-2 text-3xl font-semibold tracking-tight text-cream tabular-nums"
      >
        {value}
      </p>
      <div className="mt-1 text-sm text-stone">{detail}</div>
      {children}
    </Link>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await connection();
  const { supabase, user, store } = await requireSeller();
  const sp = await searchParams;
  const period: Period = (PERIODS as readonly string[]).includes(
    sp.period ?? "",
  )
    ? (sp.period as Period)
    : "30d";
  const cur = store.currency;
  const name = (user.user_metadata?.first_name as string | undefined) ?? "";

  const [
    orders,
    products,
    visits,
    posts,
    clicks,
    toFulfil,
    conversations,
    threads,
    storeRow,
  ] = await Promise.all([
    loadMetricOrders(store.id),
    loadProducts(store.id),
    loadVisits(store.id),
    loadPosts(store.id),
    loadClicksByDay(store.id),
    countToFulfil(store.id),
    listConversations(store.id),
    listThreads(supabase, user.id, store.id),
    supabase.from("stores").select("created_at").eq("id", store.id).single(),
  ]);

  const range = periodRange(period);
  const s = summary(orders, range);
  const opened = openedAt(
    storeRow.data?.created_at ?? new Date().toISOString(),
    orders,
  );
  const young = opened > range.from;
  const spark = dailySales(orders, range).map((d) => d.sales);
  const v = visitsIn(visits, range);
  const share = conversion(inRange(orders, range), v);
  const waiting = threads.reduce((n, x) => n + x.waiting, 0);
  const lastPost = posts
    .filter((p) => p.status === "published")
    .sort((a, b) =>
      (b.scheduled_at ?? b.created_at) > (a.scheduled_at ?? a.created_at)
        ? 1
        : -1,
    )[0];
  const postClicks = lastPost?.link_id
    ? clicks
        .filter((c) => c.link_id === lastPost.link_id)
        .reduce((n, c) => n + c.clicks, 0)
    : 0;
  const postOrders = lastPost?.link_id
    ? postConversions(orders, lastPost.link_id)
    : 0;

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader
        title={name ? h.greeting.replace("{name}", name) : h.title}
        subtitle={h.subtitle}
      />
      {waiting > 0 && (
        <p className="mt-3 text-sm text-stone">
          <Link
            href="/dashboard/ai"
            className="underline-offset-4 hover:text-cream hover:underline"
          >
            {waiting === 1
              ? h.waitingOne
              : h.waiting.replace("{count}", String(waiting))}
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-panel-3 bg-panel p-5 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone">{h.sales}</p>
            <nav
              aria-label={t.app.money.periodLabel}
              className="flex rounded-lg border border-panel-3 p-0.5"
            >
              {PERIODS.map((p) => (
                <Link
                  key={p}
                  href={p === "30d" ? "/dashboard" : `/dashboard?period=${p}`}
                  aria-current={p === period ? "page" : undefined}
                  scroll={false}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${p === period ? "bg-lime font-semibold text-ink" : "text-stone hover:text-cream"}`}
                >
                  {periods[p]}
                </Link>
              ))}
            </nav>
          </div>
          <Link
            href={`/dashboard/money?period=${period}`}
            className="mt-2 block rounded-lg focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none"
          >
            <p
              data-tile="Sales"
              className="text-4xl font-semibold tracking-tight text-cream tabular-nums"
            >
              {formatMinor(s.sales, cur)}
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
                      {s.salesChange >= 0 ? (
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="size-3" aria-hidden="true" />
                      )}
                      {pct(s.salesChange)}
                    </span>
                    <span>{h.vsPrev.replace("{period}", periods[period])}</span>
                  </>
                )
              )}
              <span>· {h.salesDetail}</span>
            </p>
            <Sparkline values={spark} className="mt-3" />
          </Link>
        </div>

        <Tile
          href="/dashboard/orders?status=paid"
          page={t.app.nav.orders}
          label={h.toFulfil}
          value={String(toFulfil)}
          detail={h.toFulfilDetail}
        />
        <Tile
          href="/dashboard/inbox"
          page={t.app.nav.inbox}
          label={h.chats}
          value={String(waitingCount(conversations))}
          detail={h.chatsDetail}
        />
        <Tile
          href="/dashboard/store"
          page={t.app.store.title}
          label={h.visits}
          value={v.toLocaleString("en")}
          detail={h.visitsDetail.replace(
            "{share}",
            `${(share * 100).toFixed(1)}%`,
          )}
        />
        <Tile
          href="/dashboard/store?tab=products"
          page={t.app.store.title}
          label={h.lowStock}
          value={String(lowStockCount(products))}
          detail={h.lowStockDetail}
        />
        <Tile
          href="/dashboard/campaigns"
          page={t.app.nav.campaigns}
          wide
          label={h.lastPost}
          value={
            lastPost
              ? h.lastPostDetail
                  .replace("{clicks}", postClicks.toLocaleString("en"))
                  .replace("{orders}", String(postOrders))
              : h.noPost
          }
          detail={
            lastPost ? (
              <span className="line-clamp-1">{lastPost.caption}</span>
            ) : null
          }
        />
      </div>
    </main>
  );
}
