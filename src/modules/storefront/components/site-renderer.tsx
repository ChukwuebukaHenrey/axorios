import Image from "next/image";
import type { ReactNode } from "react";
import type { BrandKit } from "@/modules/brand";
import type { Product } from "@/modules/catalog";
import type { ContactChannels, DesignTokens, Section, SiteConfig } from "../schema";
import { t } from "@/lib/messages";
import { allowedImage, googleFontHrefs, SCRIPT_FONT, storeCssVars } from "../theme";
import { CartBar, CartProvider, type CartProduct } from "./cart";
import {
  hasContact,
  PlayfulContact,
  PlayfulFaq,
  PlayfulFooter,
  PlayfulHero,
  PlayfulProducts,
  PlayfulReviews,
  PlayfulStory,
} from "./playful";
import { Contact, Faq, Footer, Hero, Products, Reviews, Story } from "./sections";
import { StoreHeader, type NavLink } from "./store-header";
import { templateArt, type TemplateArt } from "./template-art";

type Props = {
  config: SiteConfig;
  kit: BrandKit;
  products: Product[];
  contact: ContactChannels;
  chatUrl: string | null;
  locale: string;
  /** Left out for a draft preview, which can't sell. */
  checkout?: { slug: string; paypalClientId: string };
};

function renderSection(section: Section, props: Props, art: TemplateArt | null, links: NavLink[]) {
  const { kit, products, contact, chatUrl, locale } = props;
  if (art) {
    switch (section.type) {
      case "hero":
        return <PlayfulHero section={section} name={kit.name} art={art} />;
      case "products":
        return <PlayfulProducts section={section} products={products} locale={locale} art={art} />;
      case "story":
        return <PlayfulStory section={section} name={kit.name} art={art} />;
      case "reviews":
        return <PlayfulReviews section={section} />;
      case "faq":
        return <PlayfulFaq section={section} />;
      case "contact":
        return <PlayfulContact section={section} contact={contact} chatUrl={chatUrl} art={art} />;
      case "footer":
        return (
          <PlayfulFooter
            section={section}
            name={kit.name}
            tagline={kit.tagline}
            logo={allowedImage(kit.logoUrl)}
            links={links}
            contact={contact}
            chatUrl={chatUrl}
            art={art}
          />
        );
    }
  }
  switch (section.type) {
    case "hero":
      return <Hero section={section} name={kit.name} />;
    case "products":
      return <Products section={section} products={products} locale={locale} />;
    case "story":
      return <Story section={section} name={kit.name} />;
    case "reviews":
      return <Reviews section={section} />;
    case "faq":
      return <Faq section={section} />;
    case "contact":
      return <Contact section={section} contact={contact} chatUrl={chatUrl} />;
    case "footer":
      return <Footer section={section} name={kit.name} tagline={kit.tagline} />;
  }
}

/** Menu links to the sections that actually show, so the menu never points at nothing. */
export function storeNavLinks(
  config: SiteConfig,
  { products, contact, chatUrl, base = "" }: { products: unknown[]; contact: ContactChannels; chatUrl: string | null; base?: string },
): NavLink[] {
  const links: NavLink[] = [];
  for (const section of config.sections) {
    if (section.hidden) continue;
    if (section.type === "products" && products.length > 0) links.push({ href: `${base}#products`, label: t.storefront.navShop });
    if (section.type === "story" && section.content.body) links.push({ href: `${base}#story`, label: section.content.heading });
    if (section.type === "faq" && section.content.items.length > 0) links.push({ href: `${base}#faq`, label: section.content.heading });
    if (section.type === "contact" && hasContact(contact, chatUrl)) links.push({ href: `${base}#contact`, label: section.content.heading });
  }
  return links;
}

/** The store's colours, fonts and header, shared by every page a buyer sees. */
export function StoreFrame({
  tokens,
  kit,
  locale,
  preset,
  homeHref,
  links = [],
  children,
}: {
  tokens: DesignTokens;
  kit: BrandKit;
  locale: string;
  preset: string;
  homeHref: string;
  links?: NavLink[];
  children: ReactNode;
}) {
  const logo = allowedImage(kit.logoUrl);
  const playful = templateArt(preset) !== null;

  return (
    <div
      lang={locale}
      data-preset={preset}
      style={storeCssVars(tokens)}
      className="min-h-dvh overflow-x-clip bg-store-paper font-store-body text-store-ink"
    >
      {googleFontHrefs(tokens.fonts).map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="default" />
      ))}
      {playful && (
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css?family=${SCRIPT_FONT}&display=swap`} precedence="default" />
      )}
      {playful ? (
        <StoreHeader name={kit.name} logo={logo} homeHref={homeHref} links={links} />
      ) : (
      <header className="sticky top-0 z-20 border-b border-current/10 bg-store-paper">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-8">
          {logo && <Image src={logo} alt="" width={32} height={32} className="size-8 rounded-store object-cover" />}
          <p className="truncate font-store-heading text-lg font-bold">{kit.name}</p>
        </div>
      </header>
      )}
      {children}
    </div>
  );
}

/** Draws any store from its config. There is no per-store page code. */
export function SiteRenderer(props: Props) {
  const { config, kit, locale, products, checkout, contact, chatUrl } = props;
  const art = templateArt(config.preset);
  const links = storeNavLinks(config, { products, contact, chatUrl });
  const frame = (
    <StoreFrame
      tokens={config.tokens}
      kit={kit}
      locale={locale}
      preset={config.preset}
      homeHref={checkout ? `/s/${checkout.slug}` : "#"}
      links={links}
    >
      <main>
        {config.sections
          .filter((section) => !section.hidden)
          .map((section) => (
            <div key={section.id} data-section-id={section.id} className="contents">
              {renderSection(section, props, art, links)}
            </div>
          ))}
      </main>
      {checkout && <CartBar slug={checkout.slug} paypalClientId={checkout.paypalClientId} locale={locale} />}
    </StoreFrame>
  );

  // The cart wraps the whole frame, so the header's bag can open it.
  return checkout ? (
    <CartProvider slug={checkout.slug} products={products.map(toCartProduct)}>
      {frame}
    </CartProvider>
  ) : (
    frame
  );
}

function toCartProduct({ id, name, priceMinor, currency, stock }: Product): CartProduct {
  return { id, name, priceMinor, currency, stock };
}
