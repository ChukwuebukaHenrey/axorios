import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Tag,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { getBrandKit } from "@/modules/brand";
import {
  conversion,
  inRange,
  isLowStock,
  loadMetricOrders,
  loadOrderItems,
  loadProducts,
  loadVisits,
  lowStockCount,
  periodRange,
  PERIODS,
  productRanking,
  summary,
  visitsIn,
  type Period,
} from "@/modules/analytics";
import { DayBars } from "../../charts";
import { PageHeader, Panel, StatTile as Stat } from "../../page-header";
import { requireSeller } from "../../session";
import { Segmented } from "@/components/ui/segmented";
import { ContextEdit } from "./context-edit";

export const metadata = { title: "Store | AxoriOS" };

const s = t.app.store;
const periods = t.app.money.periods;
const TABS = ["overview", "products", "promotions", "context"] as const;
type Tab = (typeof TABS)[number];
const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function Trend({ change }: { change: number | null }) {
  if (change === null) return <span className="text-stone">—</span>;
  const up = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs tabular-nums ${up ? "text-lime" : "text-red-300"}`}
    >
      {up ? (
        <ArrowUpRight className="size-3" aria-hidden="true" />
      ) : (
        <ArrowDownRight className="size-3" aria-hidden="true" />
      )}
      {pct(change)}
    </span>
  );
}

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string }>;
}) {
  await connection();
  const { supabase, store } = await requireSeller();
  const sp = await searchParams;
  const wantedTab = sp.tab === "details" ? "context" : sp.tab; // old links
  const tab: Tab = (TABS as readonly string[]).includes(wantedTab ?? "")
    ? (wantedTab as Tab)
    : "overview";
  const period: Period = (PERIODS as readonly string[]).includes(
    sp.period ?? "",
  )
    ? (sp.period as Period)
    : "30d";
  const cur = store.currency;
  const money = (v: number) => formatMinor(v, cur);

  const [orders, items, products, visits, kit, details, promos] =
    await Promise.all([
      loadMetricOrders(store.id),
      loadOrderItems(store.id),
      loadProducts(store.id),
      loadVisits(store.id),
      getBrandKit(store.id),
      supabase
        .from("stores")
        .select(
          "slug, currency, settlement_currency, store_language, country, vat_registered, vat_rate_bp, prices_include_tax, business_profile",
        )
        .eq("id", store.id)
        .single(),
      supabase
        .from("promotions")
        .select("id, code, kind, value, product_ids, starts_at, ends_at")
        .eq("store_id", store.id)
        .order("starts_at", { ascending: false }),
    ]);

  const range = periodRange(period);
  const sum = summary(orders, range);
  const v = visitsIn(visits, range);
  const conv = conversion(inRange(orders, range), v);
  const ranking = productRanking(items, orders, range);
  const rankOf = new Map(
    ranking.map((r, i) => [r.productId, { ...r, rank: i + 1 }]),
  );
  const fromDay = range.from.toISOString().slice(0, 10);
  const visitDays = visits
    .filter((x) => x.day >= fromDay)
    .map((x) => ({ day: x.day, value: x.visits }));
  const productName = new Map(products.map((p) => [p.id, p.name]));

  const link = (p: { tab?: Tab; period?: Period }) => {
    const q = new URLSearchParams();
    const tb = p.tab ?? tab;
    const pr = p.period ?? period;
    if (tb !== "overview") q.set("tab", tb);
    if (pr !== "30d") q.set("period", pr);
    const qs = q.toString();
    return `/dashboard/store${qs ? `?${qs}` : ""}`;
  };
  const periodless = tab === "promotions" || tab === "context";
  const profile = (details.data?.business_profile ?? {}) as {
    audience?: string;
    niche?: string;
    deliveryZones?: string[];
    policies?: Record<string, string>;
  };
  const now = range.to.getTime();

  return (
    <main className="flex-1 overflow-y-auto px-4 pt-6 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={s.title} subtitle={s.subtitle}>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/s/${store.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" /> {s.viewLive}
            </a>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/ai?prompt=${encodeURIComponent(s.editPrompt)}`}>
              <Pencil aria-hidden="true" /> {s.edit}
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-panel-3 pb-4">
        <Segmented label={s.title} value={tab} items={TABS.map((tb) => ({ value: tb, label: s.tabs[tb], href: link({ tab: tb }) }))} />
        {!periodless && (
          <Segmented size="sm" label={t.app.money.periodLabel} value={period} items={PERIODS.map((p) => ({ value: p, label: periods[p], href: link({ period: p }) }))} />
        )}
      </div>

      {tab === "overview" && (
        <div className="mt-5 space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={s.sales} value={money(sum.sales)} />
            <Stat label={s.orders} value={sum.orders.toLocaleString("en")} />
            <Stat label={s.visits} value={v.toLocaleString("en")} />
            <Stat label={s.conversion} value={`${(conv * 100).toFixed(1)}%`} detail={s.conversionDetail} />
          </section>
          <div className="grid items-stretch gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel title={s.visitsChart}>
                <DayBars data={visitDays} format={(x) => x.toLocaleString("en")} label={s.visitsChartLabel} />
              </Panel>
            </div>
            <Panel
              title={s.preview}
              action={
                <a href={`/s/${store.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone transition-colors hover:text-cream">
                  {s.viewLive} <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              }
            >
              <div className="relative min-h-[240px] flex-1 overflow-hidden rounded-md border border-panel-3 bg-ink">
                <iframe
                  src={`/s/${store.slug}`}
                  title={s.preview}
                  loading="lazy"
                  tabIndex={-1}
                  className="pointer-events-none absolute top-0 left-0 h-[250%] w-[250%] origin-top-left scale-[0.4] border-0"
                />
              </div>
            </Panel>
          </div>
          <Panel title={s.top} note={s.topNote}>
            {ranking.length === 0 ? (
              <p className="text-sm text-stone">{s.noSales}</p>
            ) : (
              <ol className="-my-2.5 divide-y divide-panel-3">
                {ranking.slice(0, 6).map((r, i) => (
                  <li key={r.productId || r.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-right font-mono text-stone tabular-nums">{i + 1}</span>
                      <span className="truncate text-cream">{productName.get(r.productId) ?? r.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-4">
                      <span className="hidden text-stone sm:inline">
                        {r.units} {s.colUnits.toLowerCase()}
                      </span>
                      <span data-rank-sales={r.productId} className="font-mono text-cream/90 tabular-nums">
                        {money(r.sales)}
                      </span>
                      <span className="w-12 text-right">
                        <Trend change={r.change} />
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}

      {tab === "products" && (
        <div className="mt-5">
          <Panel title={s.tabs.products} note={s.lowCount.replace("{count}", String(lowStockCount(products)))}>
            <div className="-mx-5 -my-5 overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-panel-3 bg-panel-2/40 text-xs text-stone">
                    {[s.colRank, s.colProduct, s.colMode, s.colStock, s.colPrice, s.colSales, s.colUnits, s.colTrend].map((x, i) => (
                      <th key={x} scope="col" className={`px-5 py-2.5 font-medium ${i >= 3 ? "text-right" : "text-left"}`}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-panel-3">
                  {[...products]
                    .sort((a, b) => (rankOf.get(a.id)?.rank ?? 999) - (rankOf.get(b.id)?.rank ?? 999))
                    .map((p) => {
                      const r = rankOf.get(p.id);
                      const low = isLowStock(p);
                      return (
                        <tr key={p.id} data-product={p.id} data-low={low ? "1" : undefined} className={`transition-colors hover:bg-panel-2/50 ${p.active ? "" : "opacity-60"}`}>
                          <td className="px-5 py-2.5 font-mono text-stone tabular-nums">{r?.rank ?? "—"}</td>
                          <td className="px-5 py-2.5 text-cream">
                            {p.name}
                            {!p.active && <span className="ml-2 rounded bg-panel-3 px-1.5 py-0.5 text-xs text-stone">{s.inactive}</span>}
                          </td>
                          <td className="px-5 py-2.5 text-cream/80">{s.modes[p.inventory_mode as keyof typeof s.modes] ?? p.inventory_mode}</td>
                          <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                            {p.inventory_mode === "tracked" ? (
                              <span className={low ? "text-amber-200" : "text-cream/90"}>
                                {p.stock}
                                {low && <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 font-sans text-xs">{s.low}</span>}
                              </span>
                            ) : p.inventory_mode === "made_to_order" && p.daily_capacity ? (
                              <span className="text-cream/80">{s.perDay.replace("{count}", String(p.daily_capacity))}</span>
                            ) : (
                              <span className="text-stone">{s.notTracked}</span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-cream/90 tabular-nums">{formatMinor(p.price_minor, p.currency)}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-cream/90 tabular-nums">{r ? money(r.sales) : "—"}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-cream/90 tabular-nums">{r?.units ?? 0}</td>
                          <td className="px-5 py-2.5 text-right">
                            <Trend change={r?.change ?? null} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {tab === "promotions" && (
        <div className="mt-5">
          {(promos.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-panel-3 px-6 py-14 text-center">
              <span className="grid size-10 place-items-center rounded-lg border border-panel-3 bg-panel text-stone">
                <Tag className="size-4" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold text-cream">{s.noPromos}</h2>
              <p className="mt-1 max-w-sm text-sm text-stone">{s.noPromosBody}</p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-stone">{s.promoCodes.replace("{count}", String((promos.data ?? []).length))}</p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(promos.data ?? []).map((p) => {
                  const state = Date.parse(p.ends_at) < now ? "ended" : Date.parse(p.starts_at) > now ? "upcoming" : "active";
                  const stateLabel = state === "ended" ? s.promoEnded : state === "upcoming" ? s.promoUpcoming : s.promoActive;
                  return (
                    <li key={p.id} className={`rounded-xl border border-panel-3 bg-panel ${state === "ended" ? "opacity-70" : ""}`}>
                      <div className="flex items-center justify-between gap-3 border-b border-panel-3 px-4 py-3">
                        <span className="rounded-md border border-dashed border-cream/25 px-2 py-0.5 font-mono text-sm tracking-wide text-cream">{p.code}</span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs ${state === "active" ? "bg-lime/10 text-lime" : state === "upcoming" ? "bg-sky-400/10 text-sky-300" : "bg-panel-3 text-stone"}`}
                        >
                          <span className={`size-1.5 rounded-full ${state === "active" ? "bg-lime" : state === "upcoming" ? "bg-sky-300" : "bg-stone"}`} aria-hidden="true" />
                          {stateLabel}
                        </span>
                      </div>
                      <dl className="grid gap-2.5 px-4 py-3 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-stone">{s.promoValue}</dt>
                          <dd className="font-mono text-cream tabular-nums">{p.kind === "percent" ? `${p.value}%` : money(p.value)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="shrink-0 text-stone">{s.promoScope}</dt>
                          <dd className="truncate text-right text-cream/90">{p.product_ids.length ? p.product_ids.map((id) => productName.get(id) ?? "?").join(", ") : s.promoAll}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-stone">{s.promoDates}</dt>
                          <dd className="text-cream/90">
                            {day(p.starts_at)} – {day(p.ends_at)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === "context" && (
        <div className="mt-5 max-w-4xl">
          <p className="mb-4 text-sm text-stone">{s.detailsNote}</p>
          <div className="divide-y divide-panel-3 overflow-hidden rounded-xl border border-panel-3 bg-panel">
            {(
              [
                {
                  title: s.ctxBusiness,
                  note: s.ctxBusinessNote,
                  prompt: "Update my store's business context (name, niche or audience): ",
                  rows: [
                    [s.d.name, kit?.name],
                    [s.d.slug, `/s/${details.data?.slug ?? store.slug}`],
                    [s.d.niche, profile.niche],
                    [s.d.audience, profile.audience],
                  ],
                },
                {
                  title: s.ctxSelling,
                  note: s.ctxSellingNote,
                  prompt: "Update my store's currency, language or tax settings: ",
                  rows: [
                    [s.d.currency, details.data?.currency ?? cur],
                    [s.d.settlement, details.data?.settlement_currency],
                    [s.d.language, details.data?.store_language],
                    [s.d.country, details.data?.country],
                    [
                      s.d.vat,
                      details.data?.vat_registered
                        ? (details.data.prices_include_tax ? s.d.vatOn : s.d.vatOnExcl).replace("{rate}", `${(details.data.vat_rate_bp / 100).toFixed(1)}%`)
                        : s.d.vatOff,
                    ],
                  ],
                },
                {
                  title: s.ctxDelivery,
                  note: s.ctxDeliveryNote,
                  prompt: "Update my delivery areas or store policies: ",
                  rows: [
                    [s.d.delivery, profile.deliveryZones?.length ? profile.deliveryZones : undefined],
                    ...Object.entries(profile.policies ?? {}).map(([k, val]) => [`${s.d.policies} · ${k.replace(/_/g, " ")}`, val]),
                  ],
                },
              ] as { title: string; note: string; prompt: string; rows: [string, string | string[] | null | undefined][] }[]
            ).map((group) => (
              <section key={group.title} className="grid gap-4 p-5 md:grid-cols-[220px_1fr]">
                <div className="flex items-start justify-between gap-3 md:block">
                  <div>
                    <h2 className="text-sm font-semibold text-cream">{group.title}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-stone">{group.note}</p>
                  </div>
                  <div className="md:mt-3">
                    <ContextEdit label={s.ctxEdit} prompt={group.prompt} />
                  </div>
                </div>
                <dl className="divide-y divide-panel-3/70 rounded-lg border border-panel-3 bg-black/20">
                  {group.rows.map(([k, val]) => (
                    <div key={k} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[160px_1fr] sm:gap-4">
                      <dt className="text-stone first-letter:uppercase">{k}</dt>
                      <dd className="min-w-0 text-cream [overflow-wrap:anywhere]">
                        {Array.isArray(val) ? (
                          <span className="flex flex-wrap gap-1.5">
                            {val.map((z) => (
                              <span key={z} className="rounded-md bg-panel-3 px-2 py-0.5 text-xs text-cream/90">
                                {z}
                              </span>
                            ))}
                          </span>
                        ) : val ? (
                          val
                        ) : (
                          <span className="text-stone/70 italic">{s.ctxEmpty}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
