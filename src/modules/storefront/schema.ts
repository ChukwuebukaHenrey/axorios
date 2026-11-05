import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const DesignTokensSchema = z.object({
  palette: z.object({
    primary: hex,
    secondary: hex,
    accent: hex,
    neutralDark: hex,
    neutralLight: hex,
  }),
  fonts: z.object({ heading: z.string().min(1).max(60), body: z.string().min(1).max(60) }),
  radius: z.enum(["none", "soft", "round"]),
  spacing: z.enum(["compact", "comfortable", "airy"]),
  imageStyle: z.enum(["square", "portrait", "wide"]),
});

const imageUrl = z.url().nullable().default(null);
const base = { id: z.string().min(1).max(40) };

const HeroSection = z.object({
  ...base,
  type: z.literal("hero"),
  variant: z.enum(["split", "full-bleed", "centered"]),
  content: z.object({
    eyebrow: z.string().max(80).default(""),
    headline: z.string().min(1).max(140),
    subhead: z.string().max(280).default(""),
    ctaLabel: z.string().min(1).max(40),
    imageUrl,
  }),
});

const ProductsSection = z.object({
  ...base,
  type: z.literal("products"),
  variant: z.enum(["grid", "feature", "list"]),
  content: z.object({
    heading: z.string().min(1).max(80),
    intro: z.string().max(280).default(""),
  }),
});

const StorySection = z.object({
  ...base,
  type: z.literal("story"),
  variant: z.enum(["text", "banner"]),
  content: z.object({
    heading: z.string().min(1).max(80),
    body: z.string().max(1200).default(""),
    imageUrl,
  }),
});

const ReviewsSection = z.object({
  ...base,
  type: z.literal("reviews"),
  variant: z.enum(["cards", "quote"]),
  content: z.object({
    heading: z.string().min(1).max(80),
    items: z
      .array(z.object({ quote: z.string().min(1).max(400), author: z.string().min(1).max(80) }))
      .max(6)
      .default([]),
  }),
});

const FaqSection = z.object({
  ...base,
  type: z.literal("faq"),
  variant: z.enum(["accordion", "columns"]),
  content: z.object({
    heading: z.string().min(1).max(80),
    items: z
      .array(z.object({ question: z.string().min(1).max(160), answer: z.string().min(1).max(600) }))
      .max(10)
      .default([]),
  }),
});

const ContactSection = z.object({
  ...base,
  type: z.literal("contact"),
  variant: z.enum(["banner", "buttons"]),
  content: z.object({
    heading: z.string().min(1).max(80),
    body: z.string().max(280).default(""),
  }),
});

const FooterSection = z.object({
  ...base,
  type: z.literal("footer"),
  variant: z.enum(["simple", "columns"]),
  content: z.object({ note: z.string().max(200).default("") }),
});

export const SectionSchema = z.discriminatedUnion("type", [
  HeroSection,
  ProductsSection,
  StorySection,
  ReviewsSection,
  FaqSection,
  ContactSection,
  FooterSection,
]);

export const SiteConfigSchema = z.object({
  family: z.enum(["market", "studio", "kiosk"]),
  preset: z.string().min(1).max(60),
  tokens: DesignTokensSchema,
  sections: z.array(SectionSchema).min(1).max(20),
});

export const ContactChannelsSchema = z.object({
  whatsapp: z.string().max(30).optional(),
  telegram: z.string().max(40).optional(),
});

export type DesignTokens = z.infer<typeof DesignTokensSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SiteConfig = z.infer<typeof SiteConfigSchema>;
export type ContactChannels = z.infer<typeof ContactChannelsSchema>;
