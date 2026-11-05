import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour");

export const PaletteSchema = z.object({
  primary: hex,
  secondary: hex,
  accent: hex,
  neutralDark: hex,
  neutralLight: hex,
});

export const FontsSchema = z.object({
  heading: z.string().min(1).max(60),
  body: z.string().min(1).max(60),
});

/** What the agent drafts. Logo and reference images are set by other flows. */
export const BrandDraftSchema = z.object({
  name: z.string().min(1).max(60),
  nameOptions: z.array(z.string().min(1).max(60)).max(5),
  tagline: z.string().min(1).max(120),
  tone: z.string().min(1).max(200),
  palette: PaletteSchema,
  fonts: FontsSchema,
});

export const BrandKitSchema = BrandDraftSchema.extend({
  logoUrl: z.url().nullable().default(null),
  referenceImageUrls: z.array(z.url()).default([]),
});

export const BrandPatchSchema = BrandDraftSchema.partial().extend({
  palette: PaletteSchema.partial().optional(),
  fonts: FontsSchema.partial().optional(),
});

export type BrandDraft = z.infer<typeof BrandDraftSchema>;
export type BrandKit = z.infer<typeof BrandKitSchema>;
export type BrandPatch = z.infer<typeof BrandPatchSchema>;

/** Applies a partial edit, keeping every field not mentioned. Throws if the result is invalid. */
export function applyBrandPatch(kit: BrandKit, patch: BrandPatch): BrandKit {
  return BrandKitSchema.parse({
    ...kit,
    ...patch,
    palette: { ...kit.palette, ...patch.palette },
    fonts: { ...kit.fonts, ...patch.fonts },
  });
}

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug.length >= 2 ? slug : "store";
}
