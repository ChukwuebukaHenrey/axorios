import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { getOrder, settleOrder, type Order } from "@/modules/orders";
import { getLiveStorefront, StoreFrame } from "@/modules/storefront";

export const metadata: Metadata = { title: t.order.pageTitle, robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string; id: string }> };

function statusCopy(status: Order["status"]) {
  if (status === "paid") return { title: t.order.paidTitle, body: t.order.paidBody };
  if (status === "approved") return { title: t.order.confirmingTitle, body: t.order.confirmingBody };
  if (status === "failed") return { title: t.order.failedTitle, body: t.order.failedBody };
  return { title: t.order.unpaidTitle, body: t.order.unpaidBody };
}

/** The return page. Capturing here and on the webhook means a buyer who closes either one still gets served. */
export default async function OrderPage({ params }: Props) {
  const { slug, id } = await params;
  const store = await getLiveStorefront(slug);
  if (!store) notFound();
  const found = await getOrder(store.storeId, id);
  if (!found) notFound();
  const order = await settleOrder(found);
  const copy = statusCopy(order.status);
  const converted = order.charge_currency !== order.currency;

  return (
    <StoreFrame tokens={store.config.tokens} kit={store.kit} locale={store.locale} preset={store.config.preset}>
      <main className="mx-auto w-full max-w-xl px-4 py-10 md:py-16">
        <h1 className="font-store-heading text-4xl font-bold tracking-tight text-balance">{copy.title}</h1>
        <p className="mt-3 text-lg">{copy.body}</p>

        <ul className="mt-8 divide-y divide-current/15 border-y border-current/15">
          {order.items.map((line) => (
            <li key={line.productId} className="flex justify-between gap-4 py-3">
              <span>
                {line.quantity} x {line.name}
              </span>
              <span className="shrink-0 font-semibold">{formatMinor(line.lineMinor, order.currency, store.locale)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between text-lg font-bold">
          <span>{t.cart.total}</span>
          <span>{formatMinor(order.total_minor, order.currency, store.locale)}</span>
        </p>
        {converted && (
          <p className="mt-2 flex justify-between font-semibold">
            <span>{t.order.charged}</span>
            <span>{formatMinor(order.charge_total_minor, order.charge_currency, store.locale)}</span>
          </p>
        )}
        {order.delivery_note && (
          <div className="mt-8">
            <h2 className="font-semibold">{t.order.delivery}</h2>
            <p className="mt-1 whitespace-pre-line">{order.delivery_note}</p>
          </div>
        )}
        <a href={`/s/${store.slug}`} className="mt-8 inline-block font-semibold underline underline-offset-4">
          {t.order.back}
        </a>
      </main>
    </StoreFrame>
  );
}
