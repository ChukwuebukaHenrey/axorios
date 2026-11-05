import Image from "next/image";
import type { BrandKit } from "@/modules/brand";
import type { Product } from "@/modules/catalog";
import type { ContactChannels, Section, SiteConfig } from "../schema";
import { allowedImage, googleFontHrefs, storeCssVars } from "../theme";
import { Contact, Faq, Footer, Hero, Products, Reviews, Story } from "./sections";

type Props = {
  config: SiteConfig;
  kit: BrandKit;
  products: Product[];
  contact: ContactChannels;
  locale: string;
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

/** Draws any store from its config. There is no per-store page code. */
export function SiteRenderer(props: Props) {
  const { config, kit, locale } = props;
  const logo = allowedImage(kit.logoUrl);

  return (
    <div
      lang={locale}
      style={storeCssVars(config.tokens)}
      className="min-h-dvh overflow-x-clip bg-store-paper font-store-body text-store-ink"
    >
      {googleFontHrefs(config.tokens.fonts).map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="default" />
      ))}
      <header className="sticky top-0 z-20 border-b border-current/10 bg-store-paper">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-8">
          {logo && <Image src={logo} alt="" width={32} height={32} className="size-8 rounded-store object-cover" />}
          <p className="truncate font-store-heading text-lg font-bold">{kit.name}</p>
        </div>
      </header>
      <main>
        {config.sections
          .filter((section) => !section.hidden)
          .map((section) => (
            <div key={section.id} data-section-id={section.id} className="contents">
              {renderSection(section, props)}
            </div>
          ))}
      </main>
    </div>
  );
}
