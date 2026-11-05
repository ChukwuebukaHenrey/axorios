import { describe, expect, it } from "vitest";
import { buildSiteConfig, MARKET_PRESETS, type MarketPresetId } from "./presets";
import { SiteConfigSchema } from "./schema";
import { allowedImage, contrastRatio, googleFontHrefs, readableOn, safeLocale, storeCssVars } from "./theme";

const kit = {
  name: "Eko Sweet Bakes",
  tagline: "Celebration cakes, baked in Lagos",
  palette: {
    primary: "#7A1F3D",
    secondary: "#F97316",
    accent: "#FBBF24",
    neutralDark: "#1F1F1F",
    neutralLight: "#FFF6E9",
  },
  fonts: { heading: "Fraunces", body: "DM Sans" },
};

const presetIds = Object.keys(MARKET_PRESETS) as MarketPresetId[];

describe("presets", () => {
  it("offers 3 Market presets", () => {
    expect(presetIds).toEqual(["market/warm-bakery", "market/bold-grid", "market/photo-led"]);
  });

  it.each(presetIds)("%s builds a valid config from the brand kit", (id) => {
    const config = buildSiteConfig(kit, id);
    expect(SiteConfigSchema.safeParse(config).success).toBe(true);
    expect(config.tokens.palette).toEqual(kit.palette);
    expect(config.tokens.fonts).toEqual(kit.fonts);
  });

  it("presets differ in variants and tokens, not only colour", () => {
    const heroes = presetIds.map((id) => buildSiteConfig(kit, id).sections.find((s) => s.type === "hero")?.variant);
    expect(new Set(heroes).size).toBe(3);
    expect(new Set(presetIds.map((id) => buildSiteConfig(kit, id).tokens.radius)).size).toBe(3);
  });

  it("invents no reviews, FAQ answers or story", () => {
    const { sections } = buildSiteConfig(kit);
    const content = Object.fromEntries(sections.map((s) => [s.type, s.content])) as Record<string, { items?: unknown[]; body?: string }>;
    expect(content.reviews.items).toEqual([]);
    expect(content.faq.items).toEqual([]);
    expect(content.story.body).toBe("");
  });
});

describe("SiteConfig validation", () => {
  it("rejects a variant that doesn't belong to the section type", () => {
    const config = buildSiteConfig(kit);
    const broken = { ...config, sections: [{ ...config.sections[0], variant: "accordion" }] };
    expect(SiteConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects an unknown section type and a non-hex colour", () => {
    const config = buildSiteConfig(kit);
    expect(SiteConfigSchema.safeParse({ ...config, sections: [{ id: "x", type: "script", variant: "a", content: {} }] }).success).toBe(false);
    const palette = { ...config.tokens.palette, primary: "url(evil)" };
    expect(SiteConfigSchema.safeParse({ ...config, tokens: { ...config.tokens, palette } }).success).toBe(false);
  });
});

describe("theme", () => {
  it("sets the store's colours and fonts as CSS variables", () => {
    const vars = storeCssVars(buildSiteConfig(kit).tokens) as Record<string, string>;
    expect(vars["--store-primary"]).toBe("#7A1F3D");
    expect(vars["--store-font-heading"]).toContain("Fraunces");
    const other = storeCssVars(
      buildSiteConfig({ ...kit, palette: { ...kit.palette, primary: "#0B3D2E" }, fonts: { heading: "Anton", body: "Inter" } }).tokens,
    ) as Record<string, string>;
    expect(other["--store-primary"]).toBe("#0B3D2E");
    expect(other["--store-font-heading"]).toContain("Anton");
  });

  it("picks readable text on any background", () => {
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(readableOn("#ffffff")).toBe("#111111");
    expect(contrastRatio(readableOn("#F97316"), "#F97316")).toBeGreaterThanOrEqual(4.5);
  });

  it("replaces an unreadable ink colour from the model", () => {
    const tokens = buildSiteConfig({ ...kit, palette: { ...kit.palette, neutralDark: "#FFEEEE", neutralLight: "#FFFFFF" } }).tokens;
    const vars = storeCssVars(tokens) as Record<string, string>;
    expect(contrastRatio(vars["--store-ink"], "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("strips anything that could break out of a font name", () => {
    const tokens = buildSiteConfig({ ...kit, fonts: { heading: 'x"; } body { display:none', body: "Inter" } }).tokens;
    const stack = (storeCssVars(tokens) as Record<string, string>)["--store-font-heading"];
    expect(stack.endsWith(', system-ui, sans-serif')).toBe(true);
    expect(stack.slice(1, stack.indexOf('", system-ui'))).toMatch(/^[\p{L}\p{N} -]*$/u);
  });

  it("encodes font names and loads one link per distinct family", () => {
    expect(googleFontHrefs({ heading: "Playfair Display", body: "Playfair Display" })).toHaveLength(1);
    expect(googleFontHrefs({ heading: "Playfair Display", body: "Inter" })[0]).toContain("family=Playfair%20Display:");
  });

  it("only allows images next/image is configured for", () => {
    const ok = "https://abc.supabase.co/storage/v1/object/public/store-assets/a.png";
    expect(allowedImage(ok)).toBe(ok);
    expect(allowedImage("https://evil.example/a.png")).toBeNull();
    expect(allowedImage("https://abc.supabase.co/rest/v1/secret")).toBeNull();
    expect(allowedImage("not a url")).toBeNull();
    expect(allowedImage(null)).toBeNull();
  });

  it("falls back to English on an invalid language tag", () => {
    expect(safeLocale("en-NG")).toBe("en-NG");
    expect(safeLocale("not a tag!")).toBe("en");
  });
});
