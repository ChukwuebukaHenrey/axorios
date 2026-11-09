import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { loadExpenses, loadMetricOrders, loadRefunds, loadWithdrawals, monthStatement } from "@/modules/analytics";
import { getBrandKit } from "@/modules/brand";
import { requireSeller } from "../../(dashboard)/session";
import { PrintButton } from "./print-button";

export const metadata = { title: "Statement | AxoriOS", robots: { index: false } };

const m = t.app.money;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid-page">
      <h2 className="border-b border-black/20 pb-1 text-sm font-semibold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** A printable monthly statement; the browser's "Save as PDF" makes the PDF. Light paper styling on purpose. */
export default async function StatementPage({ params }: { params: Promise<{ month: string }> }) {
  const { store } = await requireSeller();
  const { month } = await params;
  const [orders, refunds, expenses, withdrawals, kit] = await Promise.all([loadMetricOrders(store.id), loadRefunds(store.id), loadExpenses(store.id), loadWithdrawals(store.id), getBrandKit(store.id)]);
  const s = monthStatement(month, { orders, refunds, expenses, withdrawals });
  if (!s) notFound();
  const cur = store.currency;
  const money = (v: number) => formatMinor(v, cur);
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const totals: [string, number][] = [
    [m.sales, s.totals.sales],
    [m.fees, s.totals.fees],
    [m.net, s.totals.net],
    [t.app.money.colOwed, s.totals.vatOwed],
    [m.outLines.refunds, s.totals.out.refunds],
    [m.outLines.expenses, s.totals.out.expenses],
    [m.outLines.fx, s.totals.out.fxLoss],
    [m.left, s.totals.left],
  ];
  const th = "py-1.5 pr-3 text-left font-medium";
  const td = "py-1 pr-3";
  const num = "py-1 pr-3 text-right font-mono tabular-nums";

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-black print:p-0">
      <div className="mx-auto max-w-4xl text-[13px]">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{m.statementTitle.replace("{month}", label)}</h1>
            <p className="mt-1 text-black/70">{m.statementFor.replace("{store}", kit?.name ?? store.slug).replace("{currency}", cur)}</p>
            <p className="text-xs text-black/50">{m.generated.replace("{time}", new Date().toUTCString())}</p>
          </div>
          <PrintButton label={m.print} />
        </header>

        <Section title={m.totals}>
          <dl className="mt-2 grid grid-cols-2 gap-x-8 sm:grid-cols-4">
            {totals.map(([k, v]) => (
              <div key={k} className="py-1.5">
                <dt className="text-xs text-black/60">{k}</dt>
                <dd className="font-mono text-base tabular-nums">{money(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-xs text-black/60">{m.profitNote}</p>
        </Section>

        <Section title={`${m.tabs.in} (${s.orders.length})`}>
          <table className="mt-2 w-full">
            <thead>
              <tr className="border-b border-black/10 text-xs text-black/60">
                <th className={th}>{m.colDay}</th>
                <th className={th}>{m.colOrder}</th>
                <th className={th}>{m.colChannel}</th>
                <th className={`${th} text-right`}>{m.colAmount}</th>
                <th className={`${th} text-right`}>{t.app.orders.vat}</th>
                <th className={`${th} text-right`}>{m.colFees}</th>
                <th className={`${th} text-right`}>{t.app.orders.charged}</th>
              </tr>
            </thead>
            <tbody>
              {s.orders.map((o) => (
                <tr key={o.id} className="border-b border-black/5">
                  <td className={td}>{o.paidAt.slice(0, 10)}</td>
                  <td className={`${td} font-mono`}>{o.id.slice(0, 8)}</td>
                  <td className={td}>{o.channel}</td>
                  <td className={num}>
                    {money(o.total)}
                    {o.refunded > 0 && <span className="block text-[11px] text-black/50">−{money(o.refunded)}</span>}
                  </td>
                  <td className={num}>{money(o.vat)}</td>
                  <td className={num}>{money(o.fee)}</td>
                  <td className={num}>{formatMinor(o.charged, o.chargeCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {s.refunds.length > 0 && (
          <Section title={m.outLines.refunds}>
            <table className="mt-2 w-full">
              <tbody>
                {s.refunds.map((r, i) => (
                  <tr key={i} className="border-b border-black/5">
                    <td className={td}>{r.created_at.slice(0, 10)}</td>
                    <td className={`${td} font-mono`}>{r.order_id.slice(0, 8)}</td>
                    <td className={num}>{formatMinor(r.amount_minor, r.currency)}</td>
                    <td className={num}>{money(r.store_amount_minor)}</td>
                    <td className={num}>
                      {m.colVatReversed} {money(r.vat_reversed_minor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {s.expenses.length > 0 && (
          <Section title={m.tabs.expenses}>
            <table className="mt-2 w-full">
              <tbody>
                {s.expenses.map((e, i) => (
                  <tr key={i} className="border-b border-black/5">
                    <td className={td}>{e.day}</td>
                    <td className={td}>{e.category}</td>
                    <td className={td}>{e.note}</td>
                    <td className={num}>{money(e.amount_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {s.withdrawals.length > 0 && (
          <Section title={m.tabs.withdrawals}>
            <table className="mt-2 w-full">
              <tbody>
                {s.withdrawals.map((w, i) => (
                  <tr key={i} className="border-b border-black/5">
                    <td className={td}>{w.day}</td>
                    <td className={`${td} font-mono`}>{w.reference}</td>
                    <td className={num}>{formatMinor(w.usd_minor, "USD")}</td>
                    <td className={num}>{money(w.ngn_minor)}</td>
                    <td className={num}>{w.rate.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>
    </main>
  );
}
