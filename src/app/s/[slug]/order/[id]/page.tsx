import { CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { getOrder, settleOrder, type Order } from "@/modules/orders";
import { getLiveStorefront, StoreFrame, WaveDivider } from "@/modules/storefront";

export const metadata: Metadata = { title: t.order.pageTitle, robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string; id: string }> };

function statusCopy(status: Order["status"]) {
  if (status === "paid") return { title: t.order.paidTitle, body: t.order.paidBody, tone: "success" as const };
  if (status === "approved") return { title: t.order.confirmingTitle, body: t.order.confirmingBody, tone: "pending" as const };
  if (status === "failed") return { title: t.order.failedTitle, body: t.order.failedBody, tone: "failed" as const };
  return { title: t.order.unpaidTitle, body: t.order.unpaidBody, tone: "pending" as const };
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
      <main className="pb-16">
        {copy.tone === "success" ? (
          <>
            <section className="bg-store-primary px-4 py-12 text-store-on-primary sm:px-8 md:py-16">
              <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="font-store-heading text-4xl leading-[1.05] font-bold tracking-tight text-balance md:text-5xl">
                    {copy.title}
                  </h1>
                  <p className="mt-3 max-w-md text-lg opacity-90">{copy.body}</p>
                </div>
                <span className="grid size-16 shrink-0 place-items-center rounded-full bg-store-secondary text-store-on-secondary">
                  <CheckCircle2 className="size-9" aria-hidden="true" />
                </span>
              </div>
            </section>
            <WaveDivider flip className="-mt-px text-store-primary" />
          </>
        ) : (
          <div className="mx-auto w-full max-w-xl px-4 pt-10 md:pt-16">
            <span
              className={`grid size-12 place-items-center rounded-full ${
                copy.tone === "failed" ? "bg-red-100 text-red-700" : "bg-store-accent text-store-on-accent"
              }`}
            >
              {copy.tone === "failed" ? (
                <TriangleAlert className="size-6" aria-hidden="true" />
              ) : (
                <Clock className="size-6" aria-hidden="true" />
              )}
            </span>
            <h1 className="mt-4 font-store-heading text-3xl font-bold tracking-tight text-balance">{copy.title}</h1>
            <p className="mt-3 text-lg opacity-80">{copy.body}</p>
          </div>
        )}

        <div className="mx-auto mt-8 w-full max-w-xl px-4">
          <div className="rounded-store border border-current/15 bg-store-paper p-5 sm:p-6">
            <ul className="divide-y divide-current/15 border-b border-current/15 pb-1">
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
              <p className="mt-1 flex justify-between text-sm opacity-70">
                <span>{t.order.charged}</span>
                <span>{formatMinor(order.charge_total_minor, order.charge_currency, store.locale)}</span>
              </p>
            )}
            {order.delivery_note && (
              <div className="mt-5 border-t border-current/15 pt-4">
                <h2 className="font-semibold">{t.order.delivery}</h2>
                <p className="mt-1 whitespace-pre-line opacity-80">{order.delivery_note}</p>
              </div>
            )}
          </div>

          <a
            href={`/s/${store.slug}`}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-store bg-store-secondary px-6 font-semibold text-store-on-secondary transition hover:opacity-90 sm:w-auto"
          >
            {t.order.back}
          </a>
        </div>
      </main>
    </StoreFrame>
  );
}
