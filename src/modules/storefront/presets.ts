import en from "../../../messages/en.json";
import type { BrandKit } from "@/modules/brand";
import { SiteConfigSchema, type DesignTokens, type SiteConfig } from "./schema";

type Variants = {
  hero: "split" | "full-bleed" | "centered";
  products: "grid" | "feature" | "list";
  story: "text" | "banner";
  reviews: "cards" | "quote";
  faq: "accordion" | "columns";
  contact: "banner" | "buttons";
  footer: "simple" | "columns";
};

type Preset = {
  label: string;
  variants: Variants;
  tokens: Pick<DesignTokens, "radius" | "spacing" | "imageStyle">;
};

export const MARKET_PRESETS = {
  "market/warm-bakery": {
    label: "Warm Bakery",
    variants: {
      hero: "split",
      products: "grid",
      story: "banner",
      reviews: "cards",
      faq: "accordion",
      contact: "banner",
      footer: "simple",
    },
    tokens: { radius: "round", spacing: "comfortable", imageStyle: "square" },
  },
  "market/bold-grid": {
    label: "Bold Grid",
    variants: {
      hero: "centered",
      products: "list",
      story: "text",
      reviews: "quote",
      faq: "columns",
      contact: "buttons",
      footer: "columns",
    },
    tokens: { radius: "none", spacing: "compact", imageStyle: "wide" },
  },
  "market/photo-led": {
    label: "Photo-led",
    variants: {
      hero: "full-bleed",
      products: "feature",
      story: "text",
      reviews: "cards",
      faq: "accordion",
      contact: "banner",
      footer: "simple",
    },
    tokens: { radius: "soft", spacing: "airy", imageStyle: "portrait" },
  },
} as const satisfies Record<string, Preset>;

export type MarketPresetId = keyof typeof MARKET_PRESETS;
export const DEFAULT_PRESET: MarketPresetId = "market/warm-bakery";

/**
 * The starting site for a store. Sections with no real content yet (story, reviews, FAQ) are present but
 * empty, and render nothing until the seller provides them: no made-up testimonials or claims.
 */
export function buildSiteConfig(
  kit: Pick<BrandKit, "name" | "tagline" | "palette" | "fonts">,
  presetId: MarketPresetId = DEFAULT_PRESET,
): SiteConfig {
  const preset = MARKET_PRESETS[presetId];
  const copy = en.storefront.defaults;

  return SiteConfigSchema.parse({
    family: "market",
    preset: presetId,
    tokens: { palette: kit.palette, fonts: kit.fonts, ...preset.tokens },
    sections: [
      {
        id: "hero",
        type: "hero",
        variant: preset.variants.hero,
        content: { eyebrow: kit.name, headline: kit.tagline, ctaLabel: copy.heroCta },
      },
      {
        id: "products",
        type: "products",
        variant: preset.variants.products,
        content: { heading: copy.productsHeading },
      },
      { id: "story", type: "story", variant: preset.variants.story, content: { heading: copy.storyHeading } },
      { id: "reviews", type: "reviews", variant: preset.variants.reviews, content: { heading: copy.reviewsHeading } },
      { id: "faq", type: "faq", variant: preset.variants.faq, content: { heading: copy.faqHeading } },
      {
        id: "contact",
        type: "contact",
        variant: preset.variants.contact,
        content: { heading: copy.contactHeading, body: copy.contactBody },
      },
      { id: "footer", type: "footer", variant: preset.variants.footer, content: {} },
    ],
  });
}
