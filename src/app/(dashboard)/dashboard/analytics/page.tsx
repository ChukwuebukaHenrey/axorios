import { connection } from "next/server";
import { Suspense } from "react";
import { env } from "@/lib/env";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import {
  buildStudioRows,
  loadCampaigns,
  loadClicksByDay,
  loadContacts,
  loadExpenses,
  loadLabels,
  loadLinks,
  loadMetricOrders,
  loadOrderItems,
  loadPostMetrics,
  loadPosts,
  loadProducts,
  loadRefunds,
  loadVisits,
  periodRange,
  PERIODS,
  summary,
  type PaypalTxn,
} from "@/modules/analytics";
import { paymentProvider } from "@/modules/payments";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { CHANNEL_LABEL, STATUS_LABEL } from "../orders/labels";
import { AnalyticsStudio } from "./analytics-studio";

export const metadata = { title: "Analytics | AxoriOS" };

const a = t.app.analytics;
const periodNames = t.app.money.periods;

/** Last 31 days of PayPal Transaction Search; null when PayPal is slow or off (the grid then uses stored captures). */
async function paypalRows(now: Date): Promise<PaypalTxn[] | null> {
  const from = new Date(now.getTime() - 31 * 86_400_000 + 60_000);
  try {
    return await Promise.race([
      paymentProvider().transactions(from, now),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
  } catch {
    return null;
  }
}

export default async function AnalyticsPage() {
  await connection();
  const { store } = await requireSeller();
  const now = new Date();
  const cur = store.currency;
  const subtitle = a.subtitle.replace("{currency}", cur);

  if (env().AG_STUDIO_ENABLED !== "true") {
    const orders = await loadMetricOrders(store.id);
    return (
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-10 sm:px-6 lg:px-8">
        <PageHeader title={a.title} subtitle={subtitle} />
        <section className="mt-6 rounded-xl border border-panel-3 bg-panel p-5">
          <h2 className="text-base font-semibold text-cream">{a.basicTitle}</h2>
          <p className="mt-1 text-sm text-stone">{a.basicNote}</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-stone uppercase">
                {[a.colPeriod, a.colSales, a.colOrders, a.colAov, a.colNet].map(
                  (h) => (
                    <th key={h} className="py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-3">
              {PERIODS.map((p) => {
                const s = summary(orders, periodRange(p, now));
                return (
                  <tr key={p} data-period={p} className="text-cream/90">
                    <td className="py-2">{periodNames[p]}</td>
                    <td className="py-2 font-mono tabular-nums">
                      {formatMinor(s.sales, cur)}
                    </td>
                    <td className="py-2 font-mono tabular-nums">{s.orders}</td>
                    <td className="py-2 font-mono tabular-nums">
                      {formatMinor(s.aov, cur)}
                    </td>
                    <td className="py-2 font-mono tabular-nums">
                      {formatMinor(s.net, cur)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto px-4 pt-6 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={a.title} subtitle={subtitle} />
      {/* PayPal Transaction Search can take seconds, so the header shows at once and the report streams in. */}
      <Suspense fallback={<div className="mt-5 h-[640px] animate-pulse rounded-xl border border-panel-3 bg-panel" aria-label={a.loading} />}>
        <StudioSection storeId={store.id} currency={cur} now={now} />
      </Suspense>
    </main>
  );
}

async function StudioSection({ storeId, currency: cur, now }: { storeId: string; currency: string; now: Date }) {
  const [
    orders,
    items,
    products,
    contacts,
    labels,
    refunds,
    expenses,
    posts,
    postMetrics,
    campaigns,
    links,
    clicks,
    visits,
    paypal,
  ] = await Promise.all([
    loadMetricOrders(storeId),
    loadOrderItems(storeId),
    loadProducts(storeId),
    loadContacts(storeId),
    loadLabels(storeId),
    loadRefunds(storeId),
    loadExpenses(storeId),
    loadPosts(storeId),
    loadPostMetrics(storeId),
    loadCampaigns(storeId),
    loadLinks(storeId),
    loadClicksByDay(storeId),
    loadVisits(storeId),
    paypalRows(now),
  ]);

  const rows = buildStudioRows({
    currency: cur,
    now,
    orders,
    items,
    products,
    contacts,
    labels,
    refunds,
    expenses,
    posts,
    postMetrics,
    campaigns,
    links,
    clicks,
    visits,
    paypal,
    names: { channel: CHANNEL_LABEL, status: STATUS_LABEL, match: a.match },
  });
  const ranges = Object.fromEntries(
    PERIODS.map((p) => {
      const r = periodRange(p, now);
      return [p, { from: r.from.toISOString(), to: r.to.toISOString() }];
    }),
  ) as Record<(typeof PERIODS)[number], { from: string; to: string }>;

  return (
    <>
      {!rows.paypalLive && (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
          {a.paypalOff}
        </p>
      )}
      <div className="mt-5">
        {rows.orders.length === 0 ? (
          <p className="rounded-xl border border-panel-3 bg-panel p-6 text-stone">
            {a.empty}
          </p>
        ) : (
          <AnalyticsStudio
            rows={rows}
            licenseKey={env().AG_STUDIO || undefined}
            ranges={ranges}
            storageKey={`axorios:analytics:${storeId}:v1`}
            labels={{
              periods: periodNames,
              edit: a.edit,
              done: a.done,
              save: a.save,
              saved: a.saved,
              reset: a.reset,
              loading: a.loading,
              pages: a.pages,
              period: a.period,
              filters: a.filters,
              hideFilters: a.hideFilters,
              moreActions: a.moreActions,
              clearFilters: a.clearFilters,
            }}
          />
        )}
      </div>
    </>
  );
}
