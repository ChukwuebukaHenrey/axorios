import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AxoriSees } from "@/app/(dashboard)/_axori/provider";
import { t } from "@/lib/messages";
import { currencyDecimals, formatMinor } from "@/lib/money";
import { chargeToStore, loadRefunds } from "@/modules/analytics";
import { conversationForOrder } from "@/modules/channels";
import { getOrder, planRefund } from "@/modules/orders";
import { requireSeller } from "../../../session";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_STYLE, when } from "../labels";
import { RefundButton } from "../refund-card";

export const metadata = { title: "Order | AxoriOS" };

const o = t.app.orders;
const r = t.app.refund;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <dt className="text-sm text-stone">{label}</dt>
      <dd className="text-right text-sm text-cream [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-3 bg-panel p-5">
      <h2 className="text-sm font-medium tracking-wide text-stone uppercase">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { store } = await requireSeller();
  const { id } = await params;
  const order = await getOrder(store.id, id);
  if (!order || order.source === "test") notFound();

  const [refunds, conversationId] = await Promise.all([loadRefunds(store.id), conversationForOrder(store.id, order)]);
  const mine = refunds.filter((x) => x.order_id === order.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const plan = planRefund(order, undefined, new Date());
  const crossed = order.charge_currency !== order.currency;
  const fee = order.paypal_fee_minor;
  const short = order.id.slice(0, 8);

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <AxoriSees chip={{ kind: "order", id: order.id, label: `#${short}` }} />
      <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-sm text-stone hover:text-cream">
        <ArrowLeft className="size-4" aria-hidden="true" /> {o.back}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-[clamp(1.5rem,2.4vw,2rem)] font-semibold tracking-tight text-cream">{o.detailTitle.replace("{id}", short)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status] ?? "bg-panel-3 text-stone"}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
            {order.paid_at ? o.paidAt.replace("{time}", when(order.paid_at)) : o.placed.replace("{time}", when(order.created_at))}
          </p>
        </div>
        <RefundButton orderId={order.id} chargeCurrency={order.charge_currency} disabledReason={plan.ok ? undefined : (r.reasons as Record<string, string>)[plan.reason]} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title={o.items}>
          <ul className="divide-y divide-panel-3">
            {order.items.map((line) => (
              <li key={line.productId} className="flex justify-between gap-4 py-2.5 text-sm">
                <span className="text-cream">
                  {line.quantity} × {line.name}
                </span>
                <span className="font-mono text-cream/90 tabular-nums">{formatMinor(line.lineMinor, order.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-1 divide-y divide-panel-3 border-t border-panel-3">
            <Row label={o.storeTotal}>
              <span className="font-mono text-base font-semibold tabular-nums">{formatMinor(order.total_minor, order.currency)}</span>
            </Row>
            <Row label={o.vat}>
              {order.tax_rate_bp > 0
                ? o.vatLine
                    .replace("{amount}", formatMinor(order.tax_minor, order.currency))
                    .replace("{rate}", String(order.tax_rate_bp / 100))
                    .replace("{mode}", order.tax_inclusive ? o.vatInclusive : o.vatExclusive)
                : o.vatNone.replace("{amount}", formatMinor(0, order.currency))}
            </Row>
          </dl>
        </Card>

        <Card title={t.app.nav.money}>
          <dl className="divide-y divide-panel-3">
            <Row label={o.charged}>
              <span className="font-mono tabular-nums">{formatMinor(order.charge_total_minor, order.charge_currency)}</span>
            </Row>
            <Row label={o.rate}>
              {crossed && order.fx_rate ? (
                <>
                  <span className="font-mono tabular-nums">
                    1 {order.charge_currency} = {formatMinor(Math.round(chargeToStore(order, 10 ** currencyDecimals(order.charge_currency))), order.currency)}
                  </span>
                  {order.fx_source && <span className="block text-xs text-stone">{o.rateSource.replace("{source}", order.fx_source)}</span>}
                </>
              ) : (
                <span className="text-stone">{o.sameCurrency}</span>
              )}
            </Row>
            {fee !== null && (
              <>
                <Row label={o.fee}>
                  <span className="font-mono tabular-nums">{formatMinor(fee, order.charge_currency)}</span>
                </Row>
                <Row label={o.net}>
                  <span className="font-mono tabular-nums">{formatMinor(order.paypal_net_minor ?? order.charge_total_minor - fee, order.charge_currency)}</span>
                </Row>
              </>
            )}
            <Row label={o.capture}>{order.paypal_capture_id && (order.source === "app" || order.source === "test") ? <span className="font-mono text-xs">{order.paypal_capture_id}</span> : <span className="text-stone">{o.notInPaypal}</span>}</Row>
            {order.buyer_country && <Row label={o.buyerCountry}>{order.buyer_country}</Row>}
          </dl>
        </Card>

        <Card title={o.delivery}>
          <dl className="divide-y divide-panel-3">
            {order.delivery_country && <Row label={o.delivery}>{o.deliveryCountry.replace("{country}", order.delivery_country)}</Row>}
            {order.delivery_note && (
              <Row label={o.deliver}>
                <span className="whitespace-pre-line">{order.delivery_note}</span>
              </Row>
            )}
            <Row label={o.source}>{CHANNEL_LABEL[order.channel] ?? order.channel}</Row>
            {order.customer_ref && <Row label={o.customer}>{order.customer_ref}</Row>}
          </dl>
          {conversationId && (
            <Link href={`/dashboard/inbox?c=${conversationId}`} className="mt-3 inline-flex items-center gap-1.5 text-sm text-lime underline-offset-4 hover:underline">
              <MessageCircle className="size-4" aria-hidden="true" /> {o.conversation}
            </Link>
          )}
        </Card>

        <Card title={o.refunds}>
          {mine.length === 0 ? (
            <p className="py-2 text-sm text-stone">{o.noRefunds}</p>
          ) : (
            <ul className="divide-y divide-panel-3">
              {mine.map((x) => (
                <li key={x.id} className="py-2.5 text-sm">
                  <p className="flex justify-between gap-4">
                    <span className="font-mono text-cream tabular-nums">{formatMinor(x.amount_minor, x.currency)}</span>
                    <span className="text-stone">{x.status}</span>
                  </p>
                  <p className="text-xs text-stone">
                    {when(x.created_at)} · {o.refundBy.replace("{who}", (o.who as Record<string, string>)[x.requested_by] ?? x.requested_by)}
                    {x.vat_reversed_minor > 0 && ` · ${r.vatReversed}: ${formatMinor(x.vat_reversed_minor, order.currency)}`}
                  </p>
                  {x.reason && <p className="text-xs text-cream/70">{x.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
