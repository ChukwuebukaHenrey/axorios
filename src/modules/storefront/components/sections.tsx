import { MessageCircle, Send } from "lucide-react";
import Image from "next/image";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import type { Product } from "@/modules/catalog";
import type { ContactChannels, Section } from "../schema";
import { allowedImage } from "../theme";
import { HeroArt, ProductArt } from "./art";
import { AddToCart } from "./cart";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

const WRAP = "mx-auto w-full max-w-6xl px-4 md:px-8";
const SPACED = "py-[var(--store-section)]";
const HEADING = "font-store-heading text-3xl font-bold tracking-tight md:text-4xl";
const BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-store px-6 font-semibold transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

export function Hero({ section, name }: { section: Of<"hero">; name: string }) {
  const { eyebrow, headline, subhead, ctaLabel, imageUrl } = section.content;
  const cta = (
    <a href="#products" className={`${BUTTON} bg-store-secondary text-store-on-secondary`}>
      {ctaLabel}
    </a>
  );

  if (section.variant === "full-bleed") {
    const src = allowedImage(imageUrl);
    return (
      <section className="relative isolate flex min-h-[75svh] items-end bg-store-primary text-store-on-primary">
        {src && (
          <>
            <Image src={src} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
            <div className="absolute inset-0 -z-10 bg-black/50" />
          </>
        )}
        <div className={`${WRAP} ${src ? "text-white" : ""} py-12 md:py-20`}>
          <p className="font-semibold">{eyebrow}</p>
          <h1 className="mt-3 max-w-4xl font-store-heading text-5xl leading-[1.05] font-bold tracking-tight text-balance md:text-7xl">
            {headline}
          </h1>
          {subhead && <p className="mt-5 max-w-xl text-lg">{subhead}</p>}
          <div className="mt-8">{cta}</div>
        </div>
      </section>
    );
  }

  if (section.variant === "centered") {
    return (
      <section className={`${WRAP} ${SPACED} text-center`}>
        <p className="font-semibold">{eyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-4xl font-store-heading text-5xl leading-[1.05] font-bold tracking-tight text-balance md:text-7xl">
          {headline}
        </h1>
        <div aria-hidden="true" className="mx-auto mt-6 h-2 w-24 bg-store-accent" />
        {subhead && <p className="mx-auto mt-6 max-w-xl text-lg">{subhead}</p>}
        <div className="mt-8">{cta}</div>
      </section>
    );
  }

  return (
    <section className={`${WRAP} grid items-center gap-8 py-8 md:grid-cols-2 md:gap-12 md:py-16`}>
      <div>
        <p className="font-semibold">{eyebrow}</p>
        <h1 className="mt-3 font-store-heading text-5xl leading-[1.05] font-bold tracking-tight text-balance md:text-6xl">
          {headline}
        </h1>
        {subhead && <p className="mt-5 max-w-xl text-lg">{subhead}</p>}
        <div className="mt-8">{cta}</div>
      </div>
      <HeroArt name={name} imageUrl={imageUrl} />
    </section>
  );
}

function Buy({ product }: { product: Product }) {
  if (product.stock === 0) return <span className="text-sm font-semibold">{t.storefront.soldOut}</span>;
  return <AddToCart productId={product.id} className="mt-3" />;
}

function ProductCard({ product, index, locale }: { product: Product; index: number; locale: string }) {
  return (
    <li>
      <ProductArt
        name={product.name}
        imageUrl={product.imageUrl}
        index={index}
        sizes="(min-width: 768px) 33vw, 50vw"
      />
      <h3 className="mt-3 font-store-heading text-lg leading-snug font-semibold">{product.name}</h3>
      {product.description && <p className="mt-1 line-clamp-3 text-sm opacity-80">{product.description}</p>}
      <p className="mt-2 font-semibold">{formatMinor(product.priceMinor, product.currency, locale)}</p>
      <Buy product={product} />
    </li>
  );
}

export function Products({
  section,
  products,
  locale,
}: {
  section: Of<"products">;
  products: Product[];
  locale: string;
}) {
  const { heading, intro } = section.content;
  if (products.length === 0) return null;

  let body;
  if (section.variant === "list") {
    body = (
      <ul className="mt-8 divide-y divide-current/15 border-y border-current/15">
        {products.map((product, index) => (
          <li key={product.id} className="grid grid-cols-[6rem_1fr_auto] items-center gap-4 py-4 md:grid-cols-[9rem_1fr_auto] md:gap-8">
            <ProductArt name={product.name} imageUrl={product.imageUrl} index={index} sizes="9rem" />
            <div className="min-w-0">
              <h3 className="font-store-heading text-lg font-bold md:text-2xl">{product.name}</h3>
              {product.description && <p className="mt-1 line-clamp-2 text-sm opacity-80 md:text-base">{product.description}</p>}
              <Buy product={product} />
            </div>
            <p className="font-store-heading font-bold md:text-xl">
              {formatMinor(product.priceMinor, product.currency, locale)}
            </p>
          </li>
        ))}
      </ul>
    );
  } else if (section.variant === "feature") {
    const [first, ...rest] = products;
    body = (
      <>
        <div className="mt-8 grid items-center gap-6 md:grid-cols-2 md:gap-12">
          <ProductArt name={first.name} imageUrl={first.imageUrl} index={0} sizes="(min-width: 768px) 50vw, 100vw" />
          <div>
            <h3 className="font-store-heading text-3xl font-bold md:text-4xl">{first.name}</h3>
            {first.description && <p className="mt-3 text-lg opacity-80">{first.description}</p>}
            <p className="mt-4 text-xl font-semibold">{formatMinor(first.priceMinor, first.currency, locale)}</p>
            <Buy product={first} />
          </div>
        </div>
        {rest.length > 0 && (
          <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-8">
            {rest.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index + 1} locale={locale} />
            ))}
          </ul>
        )}
      </>
    );
  } else {
    body = (
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-8">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} index={index} locale={locale} />
        ))}
      </ul>
    );
  }

  return (
    <section id="products" className={`${WRAP} ${SPACED} scroll-mt-16`}>
      <h2 className={HEADING}>{heading}</h2>
      {intro && <p className="mt-3 max-w-2xl text-lg opacity-80">{intro}</p>}
      {body}
    </section>
  );
}

export function Story({ section, name }: { section: Of<"story">; name: string }) {
  const { heading, body, imageUrl } = section.content;
  if (!body) return null;
  const src = allowedImage(imageUrl);

  if (section.variant === "banner") {
    return (
      <section className={`bg-store-primary text-store-on-primary ${SPACED}`}>
        <div className={`${WRAP} max-w-3xl text-center`}>
          <h2 className={HEADING}>{heading}</h2>
          <p className="mt-5 text-lg leading-relaxed whitespace-pre-line md:text-xl">{body}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${WRAP} ${SPACED} grid items-center gap-8 md:grid-cols-2 md:gap-12`}>
      <div>
        <h2 className={HEADING}>{heading}</h2>
        <p className="mt-5 text-lg leading-relaxed whitespace-pre-line">{body}</p>
      </div>
      {src ? (
        <div className="relative aspect-[var(--store-image-aspect)] overflow-hidden rounded-store">
          <Image src={src} alt={name} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
      ) : (
        <div aria-hidden="true" className="hidden h-2 w-24 bg-store-accent md:block" />
      )}
    </section>
  );
}

export function Reviews({ section }: { section: Of<"reviews"> }) {
  const { heading, items } = section.content;
  if (items.length === 0) return null;

  if (section.variant === "quote") {
    const [first] = items;
    return (
      <section className={`${WRAP} ${SPACED}`}>
        <h2 className="text-sm font-semibold tracking-wide uppercase">{heading}</h2>
        <figure className="mt-4">
          <blockquote className="max-w-4xl font-store-heading text-3xl leading-tight font-bold text-balance md:text-5xl">
            {first.quote}
          </blockquote>
          <figcaption className="mt-4 font-semibold">{first.author}</figcaption>
        </figure>
      </section>
    );
  }

  return (
    <section className={`${WRAP} ${SPACED}`}>
      <h2 className={HEADING}>{heading}</h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
        {items.map((item) => (
          <li key={`${item.author}-${item.quote.slice(0, 20)}`}>
            <figure className="flex h-full flex-col justify-between gap-4 rounded-store bg-store-accent p-6 text-store-on-accent">
              <blockquote className="leading-relaxed">{item.quote}</blockquote>
              <figcaption className="font-semibold">{item.author}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Faq({ section }: { section: Of<"faq"> }) {
  const { heading, items } = section.content;
  if (items.length === 0) return null;

  if (section.variant === "columns") {
    return (
      <section className={`${WRAP} ${SPACED}`}>
        <h2 className={HEADING}>{heading}</h2>
        <dl className="mt-8 grid gap-8 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.question}>
              <dt className="font-store-heading text-lg font-bold">{item.question}</dt>
              <dd className="mt-2 leading-relaxed opacity-80">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <section className={`${WRAP} ${SPACED} max-w-3xl`}>
      <h2 className={HEADING}>{heading}</h2>
      <div className="mt-8 divide-y divide-current/15 border-y border-current/15">
        {items.map((item) => (
          <details key={item.question} className="group py-4">
            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {item.question}
              <span aria-hidden="true" className="text-xl transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-2 leading-relaxed opacity-80">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function contactLinks(contact: ContactChannels, chatUrl: string | null) {
  const links = [];
  const digits = contact.whatsapp?.replace(/\D/g, "");
  if (digits) links.push({ label: t.storefront.whatsapp, href: `https://wa.me/${digits}`, Icon: MessageCircle });
  // One bot serves every store: this link is what tells it which store the customer came from.
  if (chatUrl) links.push({ label: t.storefront.telegram, href: chatUrl, Icon: Send });
  return links;
}

export function Contact({
  section,
  contact,
  chatUrl,
}: {
  section: Of<"contact">;
  contact: ContactChannels;
  chatUrl: string | null;
}) {
  const links = contactLinks(contact, chatUrl);
  if (links.length === 0) return null;
  const { heading, body } = section.content;
  const banner = section.variant === "banner";

  return (
    <section className={banner ? `bg-store-secondary text-store-on-secondary ${SPACED}` : `${WRAP} ${SPACED}`}>
      <div className={banner ? `${WRAP} text-center` : ""}>
        <h2 className={HEADING}>{heading}</h2>
        {body && <p className={`mt-3 max-w-xl text-lg ${banner ? "mx-auto" : ""}`}>{body}</p>}
        <div className={`mt-6 flex flex-wrap gap-3 ${banner ? "justify-center" : ""}`}>
          {links.map(({ label, href, Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className={`${BUTTON} ${banner ? "bg-store-paper text-store-ink" : "bg-store-primary text-store-on-primary"}`}
            >
              <Icon className="size-5" aria-hidden="true" /> {label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer({ section, name, tagline }: { section: Of<"footer">; name: string; tagline: string }) {
  const { note } = section.content;
  const year = new Date().getUTCFullYear();
  const copyright = `© ${year} ${name}`;

  if (section.variant === "columns") {
    return (
      <footer className="bg-store-primary text-store-on-primary">
        <div className={`${WRAP} grid gap-6 py-10 md:grid-cols-2`}>
          <div>
            <p className="font-store-heading text-2xl font-bold">{name}</p>
            <p className="mt-2 opacity-90">{tagline}</p>
          </div>
          <div className="text-sm opacity-90 md:text-right">
            {note && <p>{note}</p>}
            <p className={note ? "mt-2" : ""}>{copyright}</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-current/15">
      <div className={`${WRAP} flex flex-col gap-1 py-8 text-sm md:flex-row md:justify-between`}>
        <p>{copyright}</p>
        {note && <p>{note}</p>}
      </div>
    </footer>
  );
}
