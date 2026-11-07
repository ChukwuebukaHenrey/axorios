import { ArrowRight, MessageCircle, Send } from "lucide-react";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import type { Product } from "@/modules/catalog";
import type { ContactChannels, Section } from "../schema";
import { allowedImage } from "../theme";
import { AddToCart } from "./cart";
import type { NavLink } from "./store-header";
import type { Sticker, TemplateArt } from "./template-art";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

const WRAP = "mx-auto w-full max-w-6xl px-4 md:px-8";
const SCRIPT = "font-[family-name:var(--store-font-script)] font-normal";
const PILL =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-store-ink px-7 font-bold transition-[transform,background-color,color] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current active:translate-y-0";

export type Tone = "paper" | "primary" | "secondary" | "accent" | "ink" | "soft";

const TONE: Record<Tone, string> = {
  paper: "bg-store-paper text-store-ink fill-store-paper",
  primary: "bg-store-primary text-store-on-primary fill-store-primary",
  secondary: "bg-store-secondary text-store-on-secondary fill-store-secondary",
  accent: "bg-store-accent text-store-on-accent fill-store-accent",
  ink: "bg-store-ink text-store-paper fill-store-ink",
  soft: "bg-store-soft text-store-ink fill-store-soft",
};

/** Tile colours for product pictures, in turn, like a flavour palette. */
const TILES = ["bg-store-soft", "bg-store-accent", "bg-store-primary", "bg-store-secondary"];

const WAVES = [
  "M0,48 C180,8 360,8 540,36 C720,64 900,72 1080,40 C1260,8 1350,16 1440,32 L1440,80 L0,80 Z",
  "M0,30 C200,70 400,72 600,44 C800,16 1000,6 1200,30 C1320,44 1400,52 1440,48 L1440,80 L0,80 Z",
];

/**
 * A full-width colour band. Its wavy top edge is drawn in its own colour over whatever sits above, so bands can
 * follow each other in any order.
 */
export function Band({
  tone,
  wave = 0,
  id,
  className = "",
  children,
}: {
  tone: Tone;
  wave?: number | false;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`relative scroll-mt-4 ${TONE[tone]} ${className}`}>
      {wave !== false && (
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-[calc(100%-1px)] block h-8 w-full sm:h-14"
        >
          <path d={WAVES[wave % WAVES.length]} />
        </svg>
      )}
      {children}
    </section>
  );
}

/** A decorative sticker. Hidden from screen readers, and it floats gently unless reduced motion is on. */
export function StickerImage({
  sticker,
  className = "",
  delay = 0,
  priority = false,
}: {
  sticker: Sticker | undefined;
  className?: string;
  delay?: number;
  priority?: boolean;
}) {
  if (!sticker) return null;
  return (
    <Image
      src={sticker.src}
      width={sticker.w}
      height={sticker.h}
      alt=""
      aria-hidden="true"
      priority={priority}
      sizes="(min-width: 768px) 20vw, 35vw"
      style={{ animationDelay: `${delay}s` } as CSSProperties}
      className={`pointer-events-none absolute h-auto drop-shadow-[0_6px_10px_rgb(0_0_0/0.18)] select-none motion-safe:animate-[sticker-float_6s_ease-in-out_infinite] ${className}`}
    />
  );
}

/** A hand-drawn underline under a headline word. */
export function Squiggle({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 16" className={`h-3 w-40 md:h-4 md:w-56 ${className}`}>
      <path d="M4,10 C40,2 70,14 104,8 C138,2 166,12 196,6" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function PlayfulHero({ section, name, art }: { section: Of<"hero">; name: string; art: TemplateArt }) {
  const { eyebrow, headline, subhead, ctaLabel, imageUrl } = section.content;
  const src = allowedImage(imageUrl);

  return (
    <Band tone="primary" className="overflow-x-clip pb-20 md:pb-28">
      <div className={`${WRAP} grid items-center gap-10 pt-8 md:grid-cols-[1.1fr_1fr] md:pt-14`}>
        <div className="relative">
          <StickerImage sticker={art.bursts[0]} className="-top-10 right-2 w-14 md:-top-6 md:right-[12%] md:w-24" />
          {eyebrow && <p className={`${SCRIPT} text-2xl md:text-3xl`}>{eyebrow}</p>}
          <h1 className="mt-2 font-store-heading text-5xl leading-[0.98] font-black tracking-tight text-balance sm:text-6xl md:text-7xl">
            {headline}
          </h1>
          <Squiggle className="mt-4 text-store-secondary" />
          {subhead && <p className="mt-5 max-w-lg text-lg md:text-xl">{subhead}</p>}
          <a href="#products" className={`${PILL} mt-8 bg-store-secondary text-store-on-secondary hover:bg-store-ink hover:text-store-paper`}>
            {ctaLabel} <ArrowRight className="size-5" aria-hidden="true" />
          </a>
        </div>

        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <div aria-hidden="true" className="absolute inset-[6%] rounded-full bg-store-soft" />
          <div aria-hidden="true" className="absolute inset-[6%] translate-x-4 translate-y-4 rounded-full border-2 border-dashed border-current opacity-40" />
          <div className="relative aspect-square">
            {src ? (
              <Image src={src} alt={name} fill priority sizes="(min-width: 768px) 45vw, 90vw" className="object-contain p-[8%]" />
            ) : (
              <StickerImage sticker={art.feature[0]} priority className="inset-[14%] !w-[72%] !animate-none" />
            )}
          </div>
          <StickerImage sticker={art.small[3]} delay={1.2} className="top-2 right-2 w-14 md:w-20" />
          <StickerImage sticker={art.small[0]} delay={0.6} className="bottom-0 -left-2 w-20 md:w-28" />
          <StickerImage sticker={art.small[2]} delay={2} className="right-0 -bottom-6 w-16 rotate-12 md:w-24" />
        </div>
      </div>
    </Band>
  );
}

function ProductCard({ product, index, locale }: { product: Product; index: number; locale: string }) {
  const src = allowedImage(product.imageUrl);
  return (
    <li className="group flex flex-col overflow-hidden rounded-[2rem] border-2 border-store-ink bg-store-paper text-store-ink transition-transform duration-300 ease-out hover:-translate-y-1.5">
      <div className={`relative aspect-square ${TILES[index % TILES.length]}`}>
        {src ? (
          <Image
            src={src}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-contain p-[9%] transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-rotate-2"
          />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-store-heading text-8xl font-black opacity-40">
            {Array.from(product.name)[0]?.toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t-2 border-store-ink p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-store-heading text-xl leading-tight font-black md:text-2xl">{product.name}</h3>
          <p className="shrink-0 rounded-full bg-store-accent px-3 py-1 text-sm font-bold text-store-on-accent">
            {formatMinor(product.priceMinor, product.currency, locale)}
          </p>
        </div>
        {product.description && <p className="line-clamp-3 opacity-80">{product.description}</p>}
        <div className="mt-auto pt-3">
          {product.stock === 0 ? (
            <span className="font-bold">{t.storefront.soldOut}</span>
          ) : (
            <AddToCart
              productId={product.id}
              className="w-full !rounded-full border-2 border-store-ink hover:!bg-store-ink hover:!text-store-paper hover:!opacity-100"
            />
          )}
        </div>
      </div>
    </li>
  );
}

export function PlayfulProducts({
  section,
  products,
  locale,
  art,
}: {
  section: Of<"products">;
  products: Product[];
  locale: string;
  art: TemplateArt;
}) {
  if (products.length === 0) return null;
  const { heading, intro } = section.content;
  const single = products.length === 1;

  return (
    <Band tone="ink" wave={1} id="products" className="pt-14 pb-24 md:pt-20 md:pb-32">
      <StickerImage sticker={art.small[1]} delay={0.8} className="-top-14 right-[6%] w-16 md:-top-20 md:w-24" />
      <div className={WRAP}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={`${SCRIPT} text-4xl md:text-6xl`}>{heading}</h2>
          {intro && <p className="mt-4 text-lg opacity-90">{intro}</p>}
          <div aria-hidden="true" className="mx-auto mt-6 flex h-5 w-56 overflow-hidden rounded-full border-2 border-store-paper">
            <span className="flex-1 bg-store-primary" />
            <span className="flex-1 bg-store-secondary" />
            <span className="flex-1 bg-store-accent" />
            <span className="flex-1 bg-store-soft" />
          </div>
        </div>
        <ul
          className={`mt-10 grid gap-6 md:mt-14 md:gap-8 ${single ? "mx-auto max-w-sm" : "sm:grid-cols-2"} ${products.length >= 3 ? "lg:grid-cols-3" : "mx-auto max-w-4xl"}`}
        >
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} locale={locale} />
          ))}
        </ul>
      </div>
    </Band>
  );
}

export function PlayfulStory({ section, name, art }: { section: Of<"story">; name: string; art: TemplateArt }) {
  const { heading, body, imageUrl } = section.content;
  if (!body) return null;
  const src = allowedImage(imageUrl);

  return (
    <Band tone="soft" wave={0} id="story" className="py-20 md:py-28">
      <div className={`${WRAP} grid items-center gap-10 ${src ? "md:grid-cols-2" : ""}`}>
        <div className={`relative ${src ? "" : "mx-auto max-w-3xl"}`}>
          <StickerImage sticker={art.small[2]} className="-top-10 -left-4 w-16 -rotate-12 md:-left-12 md:w-24" />
          <h2 className={`${SCRIPT} text-center text-4xl md:text-6xl`}>{heading}</h2>
          <div className="relative mt-8 rounded-[2rem] border-2 border-store-ink bg-store-accent p-7 text-store-on-accent md:p-10">
            <p className="text-lg leading-relaxed whitespace-pre-line md:text-xl">{body}</p>
            <StickerImage sticker={art.bursts[1]} delay={1.5} className="-right-5 -bottom-8 w-16 md:w-20" />
          </div>
        </div>
        {src && (
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border-2 border-store-ink">
            <Image src={src} alt={name} fill sizes="(min-width: 768px) 45vw, 90vw" className="object-cover" />
          </div>
        )}
      </div>
    </Band>
  );
}

export function PlayfulReviews({ section }: { section: Of<"reviews"> }) {
  const { heading, items } = section.content;
  if (items.length === 0) return null;
  return (
    <Band tone="paper" wave={1} id="reviews" className="py-20 md:py-24">
      <div className={WRAP}>
        <h2 className={`${SCRIPT} text-center text-4xl md:text-6xl`}>{heading}</h2>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {items.map((item, index) => (
            <li key={`${item.author}-${item.quote.slice(0, 20)}`}>
              <figure
                className={`flex h-full flex-col justify-between gap-4 rounded-[2rem] border-2 border-store-ink p-6 ${index % 2 ? "bg-store-soft" : "bg-store-accent text-store-on-accent"}`}
              >
                <blockquote className="text-lg leading-relaxed">{item.quote}</blockquote>
                <figcaption className="font-bold">{item.author}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </Band>
  );
}

export function PlayfulFaq({ section }: { section: Of<"faq"> }) {
  const { heading, items } = section.content;
  if (items.length === 0) return null;
  return (
    <Band tone="paper" wave={0} id="faq" className="py-20 md:py-24">
      <div className={`${WRAP} max-w-3xl`}>
        <h2 className="text-center font-store-heading text-4xl font-black tracking-tight md:text-5xl">{heading}</h2>
        <div className="mt-10 space-y-3">
          {items.map((item) => (
            <details
              key={item.question}
              className="group rounded-[1.75rem] border-2 border-store-ink bg-store-paper px-6 py-4 transition-colors open:bg-store-soft"
            >
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                {item.question}
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-store-ink text-xl text-store-paper transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Band>
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

export function hasContact(contact: ContactChannels, chatUrl: string | null) {
  return contactLinks(contact, chatUrl).length > 0;
}

function ContactPills({ contact, chatUrl }: { contact: ContactChannels; chatUrl: string | null }) {
  return (
    <>
      {contactLinks(contact, chatUrl).map(({ label, href, Icon }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`${PILL} w-full max-w-xs bg-store-paper text-store-ink hover:bg-store-ink hover:text-store-paper`}
        >
          <Icon className="size-5" aria-hidden="true" /> {label}
        </a>
      ))}
    </>
  );
}

export function PlayfulContact({
  section,
  contact,
  chatUrl,
  art,
}: {
  section: Of<"contact">;
  contact: ContactChannels;
  chatUrl: string | null;
  art: TemplateArt;
}) {
  if (!hasContact(contact, chatUrl)) return null;
  const { heading, body } = section.content;
  return (
    <Band tone="secondary" wave={1} id="contact" className="overflow-x-clip py-20 md:py-28">
      <StickerImage sticker={art.small[0]} delay={0.4} className="top-6 left-[4%] w-16 md:w-24" />
      <StickerImage sticker={art.small[3]} delay={1.4} className="right-[5%] bottom-10 w-14 md:w-20" />
      <div className={`${WRAP} flex flex-col items-center text-center`}>
        <h2 className="font-store-heading text-4xl leading-none font-black tracking-tight text-balance uppercase sm:text-5xl md:text-7xl">
          {heading}
        </h2>
        {body && <p className="mt-5 max-w-xl text-lg md:text-xl">{body}</p>}
        <div className="mt-8 flex w-full flex-col items-center gap-3">
          <ContactPills contact={contact} chatUrl={chatUrl} />
        </div>
      </div>
    </Band>
  );
}

export function PlayfulFooter({
  section,
  name,
  tagline,
  logo,
  links,
  contact,
  chatUrl,
  art,
}: {
  section: Of<"footer">;
  name: string;
  tagline: string;
  logo: string | null;
  links: NavLink[];
  contact: ContactChannels;
  chatUrl: string | null;
  art: TemplateArt;
}) {
  const { note } = section.content;
  const year = new Date().getUTCFullYear();
  return (
    <Band tone="ink" wave={0} className="pt-14 pb-10 md:pt-20">
      <StickerImage sticker={art.bursts[2]} delay={0.9} className="-top-12 left-[8%] w-14 md:-top-16 md:w-20" />
      <div className={`${WRAP} grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          {logo ? (
            <span className="inline-block rounded-3xl bg-store-paper px-5 py-3">
              <Image src={logo} alt={name} width={200} height={108} className="h-16 w-auto" />
            </span>
          ) : (
            <p className="font-store-heading text-3xl font-black">{name}</p>
          )}
          <p className={`${SCRIPT} mt-4 text-2xl`}>{tagline}</p>
        </div>
        {links.length > 0 && (
          <nav aria-label={t.storefront.footerNav}>
            <h2 className="text-sm font-bold tracking-widest uppercase opacity-70">{t.storefront.footerShop}</h2>
            <ul className="mt-4 space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="font-store-heading text-lg font-bold underline-offset-4 hover:underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {hasContact(contact, chatUrl) && (
          <div>
            <h2 className="text-sm font-bold tracking-widest uppercase opacity-70">{t.storefront.footerTalk}</h2>
            <div className="mt-4 flex flex-col gap-3">
              <ContactPills contact={contact} chatUrl={chatUrl} />
            </div>
          </div>
        )}
      </div>
      <div className={`${WRAP} mt-12 flex flex-col gap-1 border-t border-store-paper/20 pt-6 text-sm opacity-80 md:flex-row md:justify-between`}>
        <p>
          © {year} {name}
        </p>
        {note && <p>{note}</p>}
      </div>
    </Band>
  );
}
