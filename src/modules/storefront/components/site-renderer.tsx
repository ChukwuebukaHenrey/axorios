import Image from "next/image";
import type { ReactNode } from "react";
import type { BrandKit } from "@/modules/brand";
import type { Product } from "@/modules/catalog";
import type { ContactChannels, DesignTokens, Section, SiteConfig } from "../schema";
import { allowedImage, googleFontHrefs, storeCssVars } from "../theme";
import { CartBar, CartProvider, type CartProduct } from "./cart";
import { Contact, Faq, Footer, Hero, Products, Reviews, Story } from "./sections";

type Props = {
  config: SiteConfig;
  kit: BrandKit;
  products: Product[];
  contact: ContactChannels;
  locale: string;
  /** Left out for a draft preview, which can't sell. */
  checkout?: { slug: string; paypalClientId: string };
};

function renderSection(section: Section, { kit, products, contact, locale }: Props) {
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
      return <Contact section={section} contact={contact} />;
    case "footer":
      return <Footer section={section} name={kit.name} tagline={kit.tagline} />;
  }
}

/** The store's colours, fonts and header, shared by every page a buyer sees. */
export function StoreFrame({
  tokens,
  kit,
  locale,
  preset,
  children,
}: {
  tokens: DesignTokens;
  kit: BrandKit;
  locale: string;
  preset: string;
  children: ReactNode;
}) {
  const logo = allowedImage(kit.logoUrl);

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
      <header className="sticky top-0 z-20 border-b border-current/10 bg-store-paper">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-8">
          {logo && <Image src={logo} alt="" width={32} height={32} className="size-8 rounded-store object-cover" />}
          <p className="truncate font-store-heading text-lg font-bold">{kit.name}</p>
        </div>
      </header>
      {children}
    </div>
  );
}

/** Draws any store from its config. There is no per-store page code. */
export function SiteRenderer(props: Props) {
  const { config, kit, locale, products, checkout } = props;
  const main = (
    <main>
      {config.sections
        .filter((section) => !section.hidden)
        .map((section) => (
          <div key={section.id} data-section-id={section.id} className="contents">
            {renderSection(section, props)}
          </div>
        ))}
    </main>
  );

  return (
    <StoreFrame tokens={config.tokens} kit={kit} locale={locale} preset={config.preset}>
      {checkout ? (
        <CartProvider slug={checkout.slug} products={products.map(toCartProduct)}>
          {main}
          <CartBar slug={checkout.slug} paypalClientId={checkout.paypalClientId} locale={locale} />
        </CartProvider>
      ) : (
        main
      )}
    </StoreFrame>
  );
}

function toCartProduct({ id, name, priceMinor, currency, stock }: Product): CartProduct {
  return { id, name, priceMinor, currency, stock };
}
