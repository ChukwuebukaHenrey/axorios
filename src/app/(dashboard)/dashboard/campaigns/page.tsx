import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import {
  breakdown,
  BREAKDOWNS,
  campaignPerformance,
  loadCampaigns,
  loadClicksByDay,
  loadMetricOrders,
  loadPostMetrics,
  loadPosts,
  loadProducts,
  periodRange,
  PERIODS,
  postPerformance,
  rate,
  storeTimeZone,
  totals,
  type BreakdownBy,
  type Period,
  type PostPerf,
} from "@/modules/analytics";
import { listPosts } from "@/modules/creative";
import { publishTargets } from "@/modules/publishers";
import { DayBars, RankBars } from "../../charts";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { CHANNEL_LABEL } from "../orders/labels";
import { CampaignBoard } from "./campaign-board";

export const metadata = { title: "Marketing | AxoriOS" };

const m = t.app.marketing;
const TABS = ["posts", "campaigns", "performance"] as const;
type Tab = (typeof TABS)[number];
const SORTS = ["latest", "orders", "revenue", "clicks"] as const;
type Sort = (typeof SORTS)[number];
const PER_POST_ROWS = 25;
const pick = <T extends string>(all: readonly T[], v: string | undefined, fallback: T): T => ((all as readonly string[]).includes(v ?? "") ? (v as T) : fallback);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number) => v.toLocaleString("en");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
/** Publisher names are not channel names: the Telegram channel publisher posts to Telegram. */
const tracked = (c: { sources: string; posts: number }) => c.sources === "orders" || c.posts > 0;
const channelLabel = (c: string) => CHANNEL_LABEL[c === "telegram_channel" ? "telegram" : c] ?? c;

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-panel-3 bg-panel p-5">
      <p className="text-sm text-stone">{label}</p>
      <p data-stat={label} className="mt-2 text-3xl font-semibold tracking-tight text-cream tabular-nums">
        {value}
      </p>
      {detail && <p className="mt-1 text-sm text-stone">{detail}</p>}
    </div>
  );
}

function Panel({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-3 bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-cream">{title}</h2>
          {note && <p className="mt-0.5 text-sm text-stone">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Pills<T extends string>({ items, current, href, label, names }: { items: readonly T[]; current: T; href: (v: T) => string; label: string; names: Record<T, string> }) {
  return (
    <nav aria-label={label} className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
      {items.map((v) => (
        <Link
          key={v}
          href={href(v)}
          aria-current={current === v ? "true" : undefined}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition ${current === v ? "bg-panel-3 font-medium text-cream" : "text-stone hover:text-cream"}`}
        >
          {names[v]}
        </Link>
      ))}
    </nav>
  );
}

const th = "px-3 py-2 text-left text-xs font-medium text-stone";
const thNum = "px-3 py-2 text-right text-xs font-medium text-stone";
const td = "px-3 py-2.5 text-cream/90";
const tdNum = "px-3 py-2.5 text-right font-mono text-cream/90 tabular-nums";

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string; by?: string; sort?: string }> }) {
  await connection();
  const { supabase, store } = await requireSeller();
  const sp = await searchParams;
  const tab = pick(TABS, sp.tab, "posts");
  const period: Period = pick(PERIODS, sp.period, "30d");
  const by: BreakdownBy = pick(BREAKDOWNS, sp.by, "channel");
  const sort: Sort = pick(SORTS, sp.sort, "latest");
  const money = (v: number) => formatMinor(v, store.currency);

  const link = (p: { tab?: Tab; period?: Period; by?: BreakdownBy; sort?: Sort }) => {
    const q = new URLSearchParams();
    const tb = p.tab ?? tab;
    if (tb !== "posts") q.set("tab", tb);
    if ((p.period ?? period) !== "30d") q.set("period", p.period ?? period);
    if (tb === "performance" && (p.by ?? by) !== "channel") q.set("by", p.by ?? by);
    if (tb === "performance" && (p.sort ?? sort) !== "latest") q.set("sort", p.sort ?? sort);
    const qs = q.toString();
    return `/dashboard/campaigns${qs ? `?${qs}` : ""}`;
  };

  const header = (
    <PageHeader title={t.app.nav.marketing} subtitle={t.app.campaignsSubtitle}>
      <Link
        href={`/build?prompt=${encodeURIComponent(t.app.cards.makePostsPrompt)}`}
        className="inline-flex h-11 items-center rounded-lg bg-lime px-4 text-sm font-semibold text-black transition hover:bg-lime/85"
      >
        {t.app.cards.makePosts}
      </Link>
    </PageHeader>
  );
  const tabs = (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label={t.app.nav.marketing} className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
        {TABS.map((tb) => (
          <Link
            key={tb}
            href={link({ tab: tb })}
            aria-current={tab === tb ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${tab === tb ? "bg-panel-3 font-medium text-cream" : "text-stone hover:text-cream"}`}
          >
            {m.tabs[tb]}
          </Link>
        ))}
      </nav>
      {tab !== "posts" && (
        <nav aria-label={t.app.money.periodLabel} className="flex rounded-lg border border-panel-3 p-0.5">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={link({ period: p })}
              aria-current={period === p ? "true" : undefined}
              className={`rounded-md px-2.5 py-1 text-xs transition ${period === p ? "bg-lime font-semibold text-ink" : "text-stone hover:text-cream"}`}
            >
              {t.app.money.periods[p]}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );

  if (tab === "posts") {
    const [posts, targets] = await Promise.all([listPosts(supabase, store.id), publishTargets(store.id)]);
    return (
      <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
        {header}
        {tabs}
        <div className="mt-5">
          <CampaignBoard posts={posts} canPublish={targets.length > 0} />
        </div>
      </main>
    );
  }

  const range = periodRange(period);
  const [posts, metrics, clicks, orders, campaigns, products, country] = await Promise.all([
    loadPosts(store.id),
    loadPostMetrics(store.id),
    loadClicksByDay(store.id),
    loadMetricOrders(store.id),
    loadCampaigns(store.id),
    loadProducts(store.id),
    supabase.from("stores").select("country").eq("id", store.id).single(),
  ]);
  const rows = postPerformance({ posts, metrics, clicks, orders, range });
  const productName = new Map(products.map((p) => [p.id, p.name]));

  if (tab === "campaigns") {
    const inRange = campaigns.filter((c) => {
      const at = Date.parse(c.scheduled_at ?? c.created_at);
      return at >= range.from.getTime() && at < range.to.getTime();
    });
    // Campaign posts keep their lifetime numbers whatever the period, like posts.
    const camp = campaignPerformance(inRange, postPerformance({ posts, metrics, clicks, orders }), orders);
    return (
      <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
        {header}
        {tabs}
        <div className="mt-5">
          <Panel title={m.tabs.campaigns} note={m.campaignsNote}>
            {camp.length === 0 ? (
              <p className="text-sm text-stone">{m.noCampaigns}</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm" data-table="campaigns">
                  <thead className="border-b border-panel-3">
                    <tr>
                      <th className={th}>{m.colCampaign}</th>
                      <th className={th}>{m.colDate}</th>
                      <th className={th}>{m.colStatus}</th>
                      <th className={thNum}>{m.colSends}</th>
                      <th className={thNum}>{m.posts}</th>
                      <th className={thNum}>{m.clicks}</th>
                      <th className={thNum}>{m.orders}</th>
                      <th className={thNum}>{m.revenue}</th>
                      <th className={thNum}>{m.newContacts}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-3">
                    {camp.map((c) => (
                      <tr key={c.id} data-campaign={c.id}>
                        <td className={td}>
                          <span className="font-medium text-cream">{c.name}</span>
                          <span className="block text-xs text-stone">
                            {(m.kind as Record<string, string>)[c.kind] ?? c.kind}
                            {c.channels.length > 0 && ` · ${c.channels.map(channelLabel).join(", ")}`}
                          </span>
                        </td>
                        <td className={`${td} whitespace-nowrap`}>{day(c.scheduled_at ?? c.created_at)}</td>
                        <td className={td}>{(m.status as Record<string, string>)[c.status] ?? c.status}</td>
                        <td className={tdNum}>{c.sends > 0 ? `${num(c.sent)}/${num(c.sends)}` : "—"}</td>
                        <td className={tdNum}>{num(c.posts)}</td>
                        {/* Nothing to attribute (a broadcast with no posts and no orders of its own): show a dash, not zeros. */}
                        <td className={tdNum}>{tracked(c) ? num(c.clicks) : "—"}</td>
                        <td className={tdNum}>{tracked(c) ? num(c.orders) : "—"}</td>
                        <td className={tdNum}>{tracked(c) ? money(c.revenue) : "—"}</td>
                        <td className={tdNum}>{tracked(c) ? num(c.newContacts) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </main>
    );
  }

  // Performance
  const sum = totals(rows);
  const zone = storeTimeZone(country.data?.country);
  const groups = breakdown(rows, by, zone);
  const keyLabel = (key: string): string => {
    if (key === "") return m.none;
    if (by === "channel") return channelLabel(key);
    if (by === "contentType") return (m.contentType as Record<string, string>)[key] ?? key;
    if (by === "length") return m.length[key as keyof typeof m.length] ?? key;
    if (by === "product") return productName.get(key) ?? key;
    if (by === "weekday") return m.weekday[Number(key)] ?? key;
    return m.daypart[key as keyof typeof m.daypart] ?? key;
  };
  const postLinks = new Set(rows.map((r) => r.linkId).filter(Boolean));
  // Clicks on links of posts that went out in this period, per day (same posts as the totals above).
  const fromDay = range.from.toISOString().slice(0, 10);
  const perDay = new Map<string, number>();
  for (let d = Date.parse(`${fromDay}T00:00:00Z`); d < range.to.getTime(); d += 86_400_000) perDay.set(new Date(d).toISOString().slice(0, 10), 0);
  for (const c of clicks) if (postLinks.has(c.link_id) && perDay.has(c.day)) perDay.set(c.day, (perDay.get(c.day) ?? 0) + c.clicks);
  const sorted = [...rows].sort((a, b) => (sort === "latest" ? 0 : (b[sort] as number) - (a[sort] as number)));
  const shown = sorted.slice(0, PER_POST_ROWS);
  const byNote = by === "product" ? m.productNote : by === "weekday" || by === "daypart" ? m.timesIn.replace("{zone}", zone) : undefined;

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      {header}
      {tabs}
      <div className="mt-5 space-y-4">
        <p className="text-sm text-stone">{m.periodNote}</p>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label={m.posts} value={num(sum.posts)} detail={`${m.reach}: ${num(sum.reach)}`} />
          <Stat label={m.clicks} value={num(sum.clicks)} detail={m.clickRate.replace("{rate}", pct(rate(sum.clicks, sum.reach)))} />
          <Stat label={m.orders} value={num(sum.orders)} detail={m.orderRate.replace("{rate}", pct(rate(sum.orders, sum.clicks)))} />
          <Stat label={m.revenue} value={money(sum.revenue)} detail={m.ordersDetail} />
          <Stat label={m.engagements} value={num(sum.engagements)} detail={pct(rate(sum.engagements, sum.reach))} />
          <Stat label={m.newContacts} value={num(sum.newContacts)} detail={m.newContactsDetail} />
        </section>

        <Panel title={m.clicksChart}>
          <DayBars data={[...perDay].map(([d, value]) => ({ day: d, value }))} format={(v) => num(v)} label={m.clicksChartLabel} />
        </Panel>

        <Panel title={m.breakdown} note={byNote ?? m.breakdownNote} action={<Pills items={BREAKDOWNS} current={by} href={(v) => link({ by: v })} label={m.breakdown} names={m.by} />}>
          {groups.length === 0 ? (
            <p className="text-sm text-stone">{m.noPosts}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <RankBars rows={groups.slice(0, 8).map((g) => ({ label: keyLabel(g.key), value: g.orders, note: money(g.revenue) }))} format={num} />
              </div>
              <div className="-mx-5 overflow-x-auto lg:col-span-3 lg:mx-0">
                <table className="w-full min-w-[520px] text-sm" data-table="breakdown">
                  <thead className="border-b border-panel-3">
                    <tr>
                      <th className={th}>{m.by[by]}</th>
                      <th className={thNum}>{m.posts}</th>
                      <th className={thNum}>{m.reach}</th>
                      <th className={thNum}>{m.clicks}</th>
                      <th className={thNum}>{m.orders}</th>
                      <th className={thNum}>{m.revenue}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-3">
                    {groups.map((g) => (
                      <tr key={g.key} data-group={g.key}>
                        <td className={td}>{keyLabel(g.key)}</td>
                        <td className={tdNum}>{num(g.posts)}</td>
                        <td className={tdNum}>{num(g.reach)}</td>
                        <td className={tdNum}>{num(g.clicks)}</td>
                        <td className={tdNum}>{num(g.orders)}</td>
                        <td className={tdNum}>{money(g.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title={m.perPost}
          note={`${m.perPostNote} ${m.showing.replace("{shown}", num(shown.length)).replace("{total}", num(rows.length))}`}
          action={<Pills items={SORTS} current={sort} href={(v) => link({ sort: v })} label={m.perPost} names={m.sort} />}
        >
          {rows.length === 0 ? <p className="text-sm text-stone">{m.noPosts}</p> : <PostTable rows={shown} money={money} productName={productName} />}
        </Panel>
        <p className="text-xs text-stone">{m.demoNote}</p>
      </div>
    </main>
  );
}

function PostTable({ rows, money, productName }: { rows: PostPerf[]; money: (v: number) => string; productName: Map<string, string> }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm" data-table="posts">
        <thead className="border-b border-panel-3">
          <tr>
            <th className={th}>{m.colDate}</th>
            <th className={th}>{m.colChannel}</th>
            <th className={th}>{m.colPost}</th>
            <th className={thNum}>{m.reach}</th>
            <th className={thNum}>{m.clicks}</th>
            <th className={thNum}>{m.orders}</th>
            <th className={thNum}>{m.revenue}</th>
            <th className={thNum}>{m.newContacts}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-panel-3">
          {rows.map((r) => (
            <tr key={r.id} data-post={r.id} data-orders={r.orders}>
              <td className={`${td} whitespace-nowrap`}>{day(r.at)}</td>
              <td className={td}>
                {channelLabel(r.channel)}
                <span className="block text-xs text-stone">{(m.contentType as Record<string, string>)[r.contentType] ?? r.contentType}</span>
              </td>
              <td className={`${td} max-w-xs`}>
                <span className="line-clamp-2">{r.caption}</span>
                {r.productIds.length > 0 && <span className="block truncate text-xs text-stone">{r.productIds.map((id) => productName.get(id) ?? "").filter(Boolean).join(", ")}</span>}
              </td>
              <td className={tdNum}>{num(r.reach)}</td>
              <td className={tdNum}>{num(r.clicks)}</td>
              <td className={tdNum}>{num(r.orders)}</td>
              <td className={tdNum}>{money(r.revenue)}</td>
              <td className={tdNum}>{num(r.newContacts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
