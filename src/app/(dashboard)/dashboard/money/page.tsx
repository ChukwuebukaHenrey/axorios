import { ArrowDownRight, ArrowUpRight, Download, ExternalLink, Printer } from "lucide-react";
import { connection } from "next/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import {
  change,
  dailyMoneyIn,
  inRange,
  loadExpenses,
  loadMetricOrders,
  loadRefunds,
  loadWithdrawals,
  moneyOverview,
  periodRange,
  PERIODS,
  previousRange,
  statementMonths,
  vatByMonth,
  type Period,
} from "@/modules/analytics";
import { paymentProvider } from "@/modules/payments";
import { DayBars, RankBars, Sparkline } from "../../charts";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { CHANNEL_LABEL, when } from "../orders/labels";
import { AskButton } from "./ask-button";

export const metadata = { title: "Money | AxoriOS" };

const m = t.app.money;
const TABS = ["overview", "in", "out", "expenses", "withdrawals", "vat", "statements"] as const;
type Tab = (typeof TABS)[number];
const PAGA_URL = "https://www.mypaga.com/home/pagapaypal";

const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const monthName = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" });

function Tile({ label, value, detail, delta, tone = "plain", downIsGood = false, children }: { label: string; value: string; detail: string; delta?: number | null; tone?: "plain" | "lime"; downIsGood?: boolean; children?: ReactNode }) {
  const lime = tone === "lime";
  const good = delta !== undefined && delta !== null && (downIsGood ? delta <= 0 : delta >= 0);
  return (
    <div className={`rounded-2xl border p-5 ${lime ? "border-lime/40 bg-lime text-ink" : "border-panel-3 bg-panel"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm ${lime ? "text-ink/75" : "text-stone"}`}>{label}</p>
        {delta !== undefined && delta !== null && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${
              lime ? "bg-ink/10 text-ink" : good ? "bg-lime/15 text-lime" : "bg-red-500/15 text-red-300"
            }`}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" aria-hidden="true" /> : <ArrowDownRight className="size-3" aria-hidden="true" />}
            {pct(delta)}
          </span>
        )}
      </div>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${lime ? "text-ink" : "text-cream"}`}>{value}</p>
      <p className={`mt-1 text-sm ${lime ? "text-ink/75" : "text-stone"}`}>{detail}</p>
      {children}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-3 bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-cream">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Table({ head, rows, align = [] }: { head: string[]; rows: ReactNode[][]; align?: ("left" | "right")[] }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b border-panel-3 text-xs tracking-wide text-stone uppercase">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`px-5 py-2 font-medium ${align[i] === "right" ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-panel-3">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`px-5 py-2.5 ${align[j] === "right" ? "text-right font-mono tabular-nums" : "text-left"} text-cream/90`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function paypalBalance(): Promise<{ minor: number; currency: string } | null> {
  try {
    const balances = await paymentProvider().balances();
    const b = balances.find((x) => x.currency === "USD") ?? balances[0];
    return b ? { minor: b.availableMinor, currency: b.currency } : null;
  } catch {
    return null;
  }
}

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string }> }) {
  await connection();
  const { supabase, store } = await requireSeller();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const period: Period = (PERIODS as readonly string[]).includes(sp.period ?? "") ? (sp.period as Period) : "30d";
  const cur = store.currency;
  const money = (v: number) => formatMinor(v, cur);

  const [orders, expenses, withdrawals, refunds, settings, balance] = await Promise.all([
    loadMetricOrders(store.id),
    loadExpenses(store.id),
    loadWithdrawals(store.id),
    loadRefunds(store.id),
    supabase.from("stores").select("vat_registered, vat_rate_bp, prices_include_tax").eq("id", store.id).single(),
    tab === "overview" ? paypalBalance() : Promise.resolve(null),
  ]);

  const range = periodRange(period);
  const o = moneyOverview(orders, expenses, withdrawals, range);
  const prev = moneyOverview(orders, expenses, withdrawals, previousRange(range));
  const days = dailyMoneyIn(orders, range);
  const link = (p: { tab?: Tab; period?: Period }) => {
    const s = new URLSearchParams();
    const tb = p.tab ?? tab;
    const pr = p.period ?? period;
    if (tb !== "overview") s.set("tab", tb);
    if (pr !== "30d") s.set("period", pr);
    const qs = s.toString();
    return `/dashboard/money${qs ? `?${qs}` : ""}`;
  };
  const periodless = tab === "vat" || tab === "statements";

  const periodOrders = new Set(inRange(orders, range).map((x) => x.id));
  const periodRefunds = refunds.filter((x) => periodOrders.has(x.order_id)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={m.title} subtitle={m.subtitle.replace("{currency}", cur)} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={m.title} className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
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
        {!periodless && (
          <nav aria-label={m.periodLabel} className="flex rounded-lg border border-panel-3 p-0.5">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={link({ period: p })}
                aria-current={period === p ? "true" : undefined}
                className={`rounded-md px-2.5 py-1 text-xs transition ${period === p ? "bg-lime font-semibold text-ink" : "text-stone hover:text-cream"}`}
              >
                {m.periods[p]}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {tab === "overview" && (
        <div className="mt-5 space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              label={m.balance}
              value={balance ? formatMinor(balance.minor, balance.currency) : m.balanceUnknown}
              detail={balance ? m.balanceWhole : m.balanceUnknownDetail}
            />
            <Tile label={m.moneyIn} value={money(o.moneyIn.gross)} detail={m.moneyInDetail.replace("{orders}", o.moneyIn.orders.toLocaleString("en"))} delta={change(o.moneyIn.gross, prev.moneyIn.gross)}>
              <Sparkline values={days.map((d) => d.gross)} className="mt-3" />
            </Tile>
            <Tile label={m.moneyOut} value={money(o.moneyOut.total)} detail={m.moneyOutDetail} delta={change(o.moneyOut.total, prev.moneyOut.total)} downIsGood />
            <Tile label={m.left} value={money(o.left)} detail={m.leftDetail} delta={change(o.left, prev.left)} tone="lime" />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title={m.dailyIn}>
              <DayBars data={days.map((d) => ({ day: d.day, value: d.gross }))} format={money} label={m.dailyInLabel} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {[
                  [m.sales, o.moneyIn.sales],
                  [m.fees, o.moneyIn.fees],
                  [m.net, o.moneyIn.net],
                  [m.vat, o.moneyIn.vat],
                ].map(([label, v]) => (
                  <div key={label as string}>
                    <dt className="text-stone">{label}</dt>
                    <dd className="font-mono text-cream tabular-nums">{money(v as number)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title={m.moneyOut}>
              <OutLines o={o} money={money} />
            </Panel>
          </div>
        </div>
      )}

      {tab === "in" && (
        <div className="mt-5 space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label={m.sales} value={money(o.moneyIn.sales)} detail={m.salesDetail} delta={change(o.moneyIn.sales, prev.moneyIn.sales)} />
            <Tile label={m.fees} value={money(o.moneyIn.fees)} detail={m.outLines.fees} />
            <Tile label={m.net} value={money(o.moneyIn.net)} detail={m.netDetail} delta={change(o.moneyIn.net, prev.moneyIn.net)} />
            <Tile label={m.vat} value={money(o.moneyIn.vat)} detail={m.tabs.vat} />
          </section>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title={m.dailyIn}>
              <DayBars data={days.map((d) => ({ day: d.day, value: d.gross }))} format={money} label={m.dailyInLabel} />
            </Panel>
            <Panel title={m.byChannel}>
              <RankBars rows={o.moneyIn.byChannel.map((c) => ({ label: CHANNEL_LABEL[c.channel] ?? c.channel, value: c.sales, note: `${c.orders}` }))} format={money} />
            </Panel>
          </div>
          <Panel title={m.tabs.in}>
            <Table
              head={[m.colDay, m.colOrders, m.colGross, m.colFees, m.colNet]}
              align={["left", "right", "right", "right", "right"]}
              rows={[...days]
                .reverse()
                .filter((d) => d.orders > 0)
                .map((d) => [dayName(d.day), String(d.orders), money(d.gross), money(d.fees), money(d.net)])}
            />
          </Panel>
        </div>
      )}

      {tab === "out" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Panel title={m.moneyOut}>
            <OutLines o={o} money={money} />
          </Panel>
          <Panel title={m.recentRefunds}>
            {periodRefunds.length === 0 ? (
              <p className="text-sm text-stone">{m.noRefunds}</p>
            ) : (
              <Table
                head={[m.colDay, m.colOrder, m.colAmount, m.colVatReversed, m.colStatus]}
                align={["left", "left", "right", "right", "left"]}
                rows={periodRefunds.slice(0, 50).map((x) => [
                  when(x.created_at),
                  <Link key="o" href={`/dashboard/orders/${x.order_id}`} className="font-mono text-lime hover:underline">
                    #{x.order_id.slice(0, 8)}
                  </Link>,
                  <span key="a">
                    {formatMinor(x.amount_minor, x.currency)}
                    {x.currency !== cur && <span className="block text-xs text-stone">{money(x.store_amount_minor)}</span>}
                  </span>,
                  money(x.vat_reversed_minor),
                  x.status,
                ])}
              />
            )}
          </Panel>
        </div>
      )}

      {tab === "expenses" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Panel title={m.expensesTitle}>
            <p className="mb-4 text-3xl font-semibold tracking-tight text-cream tabular-nums">{money(o.expenses.total)}</p>
            {o.expenses.byCategory.length === 0 ? <p className="text-sm text-stone">{m.expensesEmpty}</p> : <RankBars rows={o.expenses.byCategory.map((c) => ({ label: c.category, value: c.amount }))} format={money} />}
            <p className="mt-4 text-xs text-stone">{m.profitNote}</p>
          </Panel>
          <Panel title={m.tabs.expenses} action={<AskButton label={m.logExpense} prompt={m.logExpensePrompt} />}>
            {o.expenses.rows.length === 0 ? (
              <p className="text-sm text-stone">{m.expensesEmpty}</p>
            ) : (
              <Table
                head={[m.colDay, m.colCategory, m.colNote, m.colSource, m.colAmount]}
                align={["left", "left", "left", "left", "right"]}
                rows={o.expenses.rows.slice(0, 100).map((e) => [dayName(e.day), e.category, e.note ?? "", (m.expenseSources as Record<string, string>)[e.source] ?? e.source, formatMinor(e.amount_minor, e.currency)])}
              />
            )}
          </Panel>
        </div>
      )}

      {tab === "withdrawals" && (
        <div className="mt-5 space-y-4">
          <Panel
            title={m.withdrawTitle}
            action={
              <a href={PAGA_URL} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md bg-lime px-4 text-sm font-medium text-ink hover:bg-lime/90">
                {m.withdrawCta} <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            }
          >
            <p className="max-w-2xl text-sm text-stone">{m.withdrawIntro}</p>
            {o.fx.quoteRate === null ? (
              <p className="mt-4 text-sm text-stone">{m.noFx}</p>
            ) : (
              <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  [m.withdrawnUsd, formatMinor(o.fx.withdrawnUsd, "USD")],
                  [m.received, money(o.fx.received)],
                  [m.atQuote, money(o.fx.atQuote)],
                  [m.fxDiff, money(o.fx.difference)],
                ].map(([label, v]) => (
                  <div key={label} className="rounded-xl border border-panel-3 p-3">
                    <dt className="text-xs text-stone">{label}</dt>
                    <dd className="mt-1 font-mono text-lg text-cream tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {o.fx.quoteRate !== null && <p className="mt-2 text-xs text-stone">{m.quoteRate.replace("{rate}", o.fx.quoteRate.toFixed(2))}</p>}
          </Panel>
          <Panel title={m.tabs.withdrawals}>
            {o.fx.rows.length === 0 ? (
              <p className="text-sm text-stone">{m.noWithdrawals}</p>
            ) : (
              <Table
                head={[m.colDay, m.colUsd, m.colNgn, m.colRate, m.colRef]}
                align={["left", "right", "right", "right", "left"]}
                rows={o.fx.rows.map((w) => [
                  dayName(w.day),
                  formatMinor(w.usd_minor, "USD"),
                  formatMinor(w.ngn_minor, cur),
                  w.rate.toFixed(2),
                  <span key="r" className="font-mono text-xs">
                    {w.reference ?? ""}
                  </span>,
                ])}
              />
            )}
          </Panel>
        </div>
      )}

      {tab === "vat" && (
        <div className="mt-5">
          <Panel title={m.vatTitle}>
            <p className="mb-4 max-w-2xl text-sm text-stone">
              {settings.data?.vat_registered
                ? m.vatIntro.replace("{rate}", String((settings.data.vat_rate_bp ?? 0) / 100)).replace("{mode}", settings.data.prices_include_tax ? t.app.orders.vatInclusive : t.app.orders.vatExclusive)
                : m.vatNotRegistered}
            </p>
            <Table
              head={[m.colMonth, m.sales, m.colCharged, m.colCredits, m.colOwed]}
              align={["left", "right", "right", "right", "right"]}
              rows={vatByMonth(orders).map((v) => [
                monthName(v.month),
                money(v.sales),
                money(v.charged),
                <span key="c">
                  {money(v.credits)}
                  {v.creditNotes > 0 && <span className="block text-xs text-stone">{m.creditCount.replace("{count}", String(v.creditNotes))}</span>}
                </span>,
                <strong key="o" className="text-cream">
                  {money(v.owed)}
                </strong>,
              ])}
            />
          </Panel>
        </div>
      )}

      {tab === "statements" && (
        <div className="mt-5">
          <Panel title={m.statementsTitle}>
            <p className="mb-4 text-sm text-stone">{m.statementsIntro}</p>
            <ul className="divide-y divide-panel-3">
              {statementMonths(orders).map((key) => (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-cream">{monthName(key)}</span>
                  <span className="flex gap-2">
                    <a href={`/dashboard/money/statements/${key}/csv`} className="inline-flex items-center gap-1.5 rounded-lg border border-panel-3 px-3 py-1.5 text-sm text-cream hover:bg-white/5">
                      <Download className="size-4" aria-hidden="true" /> {m.csv}
                    </a>
                    <Link href={`/statements/${key}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-panel-3 px-3 py-1.5 text-sm text-cream hover:bg-white/5">
                      <Printer className="size-4" aria-hidden="true" /> {m.pdf}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </main>
  );
}

function OutLines({ o, money }: { o: ReturnType<typeof moneyOverview>; money: (v: number) => string }) {
  const lines: [string, number, string?][] = [
    [m.outLines.fees, o.moneyOut.fees],
    [m.outLines.refunds, o.moneyOut.refunds, m.refundsNote],
    [m.outLines.expenses, o.moneyOut.expenses],
    [m.outLines.fx, o.moneyOut.fxLoss, m.fxNote],
    [m.outLines.plan, o.moneyOut.plan, m.planNote],
  ];
  return (
    <dl className="divide-y divide-panel-3 text-sm">
      {lines.map(([label, v, note]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-stone">
            {label}
            {note && <span className="block text-xs text-stone/70">{note}</span>}
          </dt>
          <dd className="font-mono text-cream tabular-nums">{money(v)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 pt-3 font-semibold">
        <dt className="text-cream">{m.moneyOut}</dt>
        <dd className="font-mono text-cream tabular-nums">{money(o.moneyOut.total)}</dd>
      </div>
    </dl>
  );
}
