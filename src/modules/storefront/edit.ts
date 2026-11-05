import { z } from "zod";
import type { BrandKit } from "@/modules/brand";
import { SiteConfigSchema, type SiteConfig } from "./schema";

/** What the agent may change on one section. There is no way to pass markup, styles or code. */
export const SiteEditSchema = z.object({
  sectionId: z.string().min(1).max(40),
  variant: z
    .string()
    .optional()
    .describe(
      "hero: split, full-bleed, centered. products: grid, feature, list. story: text, banner. reviews: cards, quote. faq: accordion, columns. contact: banner, buttons. footer: simple, columns",
    ),
  hidden: z.boolean().optional().describe("true hides the section, false shows it again"),
  position: z.number().int().min(0).max(20).optional().describe("New place in the page, 0 is first"),
  text: z
    .object({
      eyebrow: z.string().optional().describe("hero"),
      headline: z.string().optional().describe("hero"),
      subhead: z.string().optional().describe("hero"),
      ctaLabel: z.string().optional().describe("hero button"),
      heading: z.string().optional().describe("products, story, reviews, faq, contact"),
      intro: z.string().optional().describe("products"),
      body: z.string().optional().describe("story, contact"),
      note: z.string().optional().describe("footer"),
    })
    .optional(),
  items: z
    .array(
      z.object({
        quote: z.string().optional().describe("reviews"),
        author: z.string().optional().describe("reviews"),
        question: z.string().optional().describe("faq"),
        answer: z.string().optional().describe("faq"),
      }),
    )
    .optional()
    .describe("Replaces all reviews or FAQ entries"),
});

export type SiteEdit = z.infer<typeof SiteEditSchema>;

/** Returns a new config, validated whole. Throws with a message the agent can act on. */
export function applySiteEdit(config: SiteConfig, edit: SiteEdit): SiteConfig {
  const index = config.sections.findIndex((s) => s.id === edit.sectionId);
  if (index === -1) {
    const known = config.sections.map((s) => s.id).join(", ");
    throw new Error(`There is no section "${edit.sectionId}". The sections are: ${known}`);
  }

  const section = config.sections[index];
  const sections: unknown[] = [...config.sections];
  sections[index] = {
    ...section,
    variant: edit.variant ?? section.variant,
    hidden: edit.hidden ?? section.hidden,
    content: { ...section.content, ...edit.text, ...(edit.items && { items: edit.items }) },
  };

  if (edit.position !== undefined) {
    const [moved] = sections.splice(index, 1);
    sections.splice(edit.position, 0, moved);
    const footer = sections.findIndex((s) => (s as { type: string }).type === "footer");
    if (footer !== -1) sections.push(...sections.splice(footer, 1));
  }

  const next = SiteConfigSchema.parse({ ...config, sections });
  if (JSON.stringify(next) === JSON.stringify(config)) {
    throw new Error(`Nothing changed. Check that section "${edit.sectionId}" has the fields you set.`);
  }
  return next;
}

/** Carries a brand change onto the site. Hero text follows only if the seller hasn't rewritten it. */
export function applyBrandToConfig(
  config: SiteConfig,
  kit: Pick<BrandKit, "name" | "tagline" | "palette" | "fonts">,
  previous: Pick<BrandKit, "name" | "tagline"> | null,
): SiteConfig {
  return {
    ...config,
    tokens: { ...config.tokens, palette: kit.palette, fonts: kit.fonts },
    sections: config.sections.map((section) => {
      if (section.type !== "hero" || !previous) return section;
      const { eyebrow, headline } = section.content;
      return {
        ...section,
        content: {
          ...section.content,
          eyebrow: eyebrow === previous.name ? kit.name : eyebrow,
          headline: headline === previous.tagline ? kit.tagline : headline,
        },
      };
    }),
  };
}
