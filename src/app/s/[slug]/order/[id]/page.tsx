import { ArrowRight, CheckCircle2, Clock, MapPin, TriangleAlert } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { getOrder, settleOrder, type Order } from "@/modules/orders";
import { customerChatUrl } from "@/modules/channels";
import {
  allowedImage,
  Band,
  getLiveStorefront,
  Squiggle,
  StickerImage,
  StoreFrame,
  storeNavLinks,
  templateArt,
  WaveDivider,
  type Storefront,
  type TemplateArt,
} from "@/modules/storefront";

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
  const art = templateArt(store.config.preset);
  const frame = {
    tokens: store.config.tokens,
    kit: store.kit,
    locale: store.locale,
    preset: store.config.preset,
    homeHref: `/s/${store.slug}`,
  };

  if (art) {
    const links = storeNavLinks(store.config, {
      products: store.products,
      contact: store.contact,
      chatUrl: customerChatUrl(store.slug),
      base: `/s/${store.slug}`,
    });
    return (
      <StoreFrame {...frame} links={links}>
        <PlayfulOrder store={store} order={order} copy={copy} converted={converted} art={art} />
      </StoreFrame>
    );
  }

  return (
    <StoreFrame {...frame}>
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

const TILES = ["bg-store-soft", "bg-store-accent", "bg-store-primary"];

/** The order page for the playful templates: a wavy thank-you band, a rounded receipt card and a sticker band. */
function PlayfulOrder({
  store,
  order,
  copy,
  converted,
  art,
}: {
  store: Storefront;
  order: Order;
  copy: ReturnType<typeof statusCopy>;
  converted: boolean;
  art: TemplateArt;
}) {
  const paid = copy.tone === "success";
  const images = new Map(store.products.map((product) => [product.id, allowedImage(product.imageUrl)]));

  return (
    <main>
      <Band tone="primary" className="overflow-x-clip pb-24 md:pb-32">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-6 px-4 pt-10 md:grid-cols-[1.5fr_1fr] md:px-8 md:pt-16">
          <div className="relative">
            <StickerImage sticker={art.bursts[0]} className="-top-12 -left-3 w-12 md:-top-14 md:-left-20 md:w-20" />
            {paid ? (
              <>
                <h1 className="font-store-heading text-6xl leading-none font-black tracking-tight whitespace-nowrap md:text-7xl lg:text-8xl">
                  {t.order.paidThanks}
                </h1>
                <Squiggle className="mt-2 text-store-secondary" />
                <p className="mt-4 font-store-heading text-3xl leading-tight font-black md:text-5xl">{t.order.paidHeadline}</p>
              </>
            ) : (
              <h1 className="flex items-start gap-3 font-store-heading text-4xl leading-tight font-black tracking-tight text-balance md:text-6xl">
                {copy.tone === "failed" ? (
                  <TriangleAlert className="mt-2 size-9 shrink-0" aria-hidden="true" />
                ) : (
                  <Clock className="mt-2 size-9 shrink-0" aria-hidden="true" />
                )}
                {copy.title}
              </h1>
            )}
            <p className="mt-5 max-w-md text-lg md:text-xl">{copy.body}</p>
          </div>
          <div className="relative mx-auto aspect-[8/7] w-56 md:w-full md:max-w-sm">
            <StickerImage
              sticker={paid ? art.feature[0] : art.small[3]}
              priority
              className={paid ? "inset-0 w-full rotate-[-6deg]" : "inset-[15%] w-[70%]"}
            />
            <StickerImage sticker={art.bursts[1]} delay={1} className="-top-6 -right-2 w-16 md:w-24" />
          </div>
        </div>
      </Band>

      <Band tone="paper" wave={1} className="pb-20 md:pb-28">
        <div className="relative mx-auto w-full max-w-xl px-4 pt-6">
          <div className="rounded-[2rem] border-2 border-store-ink bg-store-paper p-5 sm:p-8">
            <ul className="space-y-4 border-b-2 border-store-ink/15 pb-5">
              {order.items.map((line, index) => {
                const src = images.get(line.productId);
                return (
                  <li key={line.productId} className="flex items-center gap-4">
                    <span className={`relative size-20 shrink-0 overflow-hidden rounded-2xl sm:size-24 ${TILES[index % TILES.length]}`}>
                      {src && <Image src={src} alt="" fill sizes="96px" className="object-contain p-1.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-store-heading text-lg leading-tight font-black sm:text-xl">{line.name}</span>
                      <span className="mt-1 block opacity-80">{t.order.quantity.replace("{count}", String(line.quantity))}</span>
                    </span>
                    <span className="shrink-0 font-store-heading text-lg font-black">
                      {formatMinor(line.lineMinor, order.currency, store.locale)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 flex items-baseline justify-between gap-4 font-store-heading text-2xl font-black">
              <span>{t.cart.total}</span>
              <span>{formatMinor(order.total_minor, order.currency, store.locale)}</span>
            </p>
            {converted && (
              <p className="mt-2 flex justify-between gap-4 text-lg">
                <span>{t.order.charged}</span>
                <span className="font-semibold">{formatMinor(order.charge_total_minor, order.charge_currency, store.locale)}</span>
              </p>
            )}
            {order.delivery_note && (
              <div className="mt-5 flex gap-3 border-t-2 border-store-ink/15 pt-5">
                <MapPin className="mt-0.5 size-6 shrink-0 text-store-secondary" aria-hidden="true" />
                <div>
                  <h2 className="font-store-heading text-lg font-black">{t.order.delivery}</h2>
                  <p className="mt-1 whitespace-pre-line opacity-80">{order.delivery_note}</p>
                </div>
              </div>
            )}
            <a
              href={`/s/${store.slug}`}
              className="mt-7 flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-store-ink bg-store-secondary px-6 text-lg font-bold text-store-on-secondary transition-[transform,background-color,color] duration-200 hover:-translate-y-0.5 hover:bg-store-ink hover:text-store-paper"
            >
              {t.order.back} <ArrowRight className="size-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </Band>

      <Band tone="secondary" wave={0} className="h-40 overflow-x-clip md:h-56">
        <StickerImage sticker={art.feature[1]} delay={0.5} className="-top-10 left-[4%] w-36 -rotate-6 md:-top-14 md:left-[10%] md:w-56" />
        <StickerImage sticker={art.bursts[2]} delay={1.1} className="top-6 left-[46%] w-14 md:w-20" />
        <StickerImage sticker={art.feature[2]} delay={1.7} className="-top-8 right-[4%] w-36 rotate-6 md:-top-12 md:right-[10%] md:w-56" />
      </Band>
    </main>
  );
}
