import { describe, expect, it } from "vitest";
import { signDraftToken, verifyDraftToken } from "./draft-token";
import { applyBrandToConfig, applySiteEdit } from "./edit";
import { applyPreset, buildSiteConfig, MARKET_PRESETS, type MarketPresetId } from "./presets";
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

describe("edit_site", () => {
  const config = buildSiteConfig(kit);
  const hero = (c: typeof config) => c.sections.find((s) => s.id === "hero")!;

  it("changes only what it was told to", () => {
    const next = applySiteEdit(config, { sectionId: "hero", text: { headline: "Birthdays, sorted" } });
    const content = hero(next).content as { headline: string; ctaLabel: string };
    expect(content.headline).toBe("Birthdays, sorted");
    expect(content.ctaLabel).toBe((hero(config).content as { ctaLabel: string }).ctaLabel);
    expect(next.tokens).toEqual(config.tokens);
  });

  it("does not mutate the previous version", () => {
    const before = JSON.stringify(config);
    applySiteEdit(config, { sectionId: "hero", text: { headline: "New" }, position: 2 });
    expect(JSON.stringify(config)).toBe(before);
  });

  it("switches variant, hides and shows", () => {
    expect(hero(applySiteEdit(config, { sectionId: "hero", variant: "centered" })).variant).toBe("centered");
    const hidden = applySiteEdit(config, { sectionId: "hero", hidden: true });
    expect(hero(hidden).hidden).toBe(true);
    expect(hero(applySiteEdit(hidden, { sectionId: "hero", hidden: false })).hidden).toBe(false);
  });

  it("moves a section and keeps the footer last", () => {
    const next = applySiteEdit(config, { sectionId: "contact", position: 0 });
    expect(next.sections[0].id).toBe("contact");
    expect(next.sections.at(-1)?.id).toBe("footer");
    const end = applySiteEdit(config, { sectionId: "hero", position: 20 });
    expect(end.sections.at(-1)?.id).toBe("footer");
    expect(end.sections.at(-2)?.id).toBe("hero");
  });

  it("replaces FAQ items and validates their shape", () => {
    const next = applySiteEdit(config, { sectionId: "faq", items: [{ question: "Delivery?", answer: "Lagos only." }] });
    expect((next.sections.find((s) => s.id === "faq")!.content as { items: unknown[] }).items).toHaveLength(1);
    expect(() => applySiteEdit(config, { sectionId: "faq", items: [{ quote: "Great", author: "Ada" }] })).toThrow();
  });

  it("explains what went wrong, so the agent can correct itself", () => {
    expect(() => applySiteEdit(config, { sectionId: "nope", hidden: true })).toThrow(/hero/);
    expect(() => applySiteEdit(config, { sectionId: "hero", variant: "accordion" })).toThrow();
    expect(() => applySiteEdit(config, { sectionId: "hero", text: { body: "wrong field" } })).toThrow(/Nothing changed/);
    expect(() => applySiteEdit(config, { sectionId: "hero", text: { headline: "x".repeat(500) } })).toThrow();
  });

  it("drops anything that isn't a known field", () => {
    const next = applySiteEdit(config, { sectionId: "hero", text: { headline: "Safe", script: "<script>" } as never });
    expect(JSON.stringify(next)).not.toContain("<script>");
  });
});

describe("switching template", () => {
  const edited = applySiteEdit(
    applySiteEdit(buildSiteConfig(kit), { sectionId: "hero", text: { headline: "My own words" } }),
    { sectionId: "faq", hidden: true },
  );

  it.each(presetIds)("%s keeps colours, fonts, text, hidden sections and order", (id) => {
    const next = applyPreset(edited, id);
    expect(next.preset).toBe(id);
    expect(next.tokens.palette).toEqual(kit.palette);
    expect(next.tokens.fonts).toEqual(kit.fonts);
    expect((next.sections[0].content as { headline: string }).headline).toBe("My own words");
    expect(next.sections.find((s) => s.id === "faq")?.hidden).toBe(true);
    expect(next.sections.map((s) => s.id)).toEqual(edited.sections.map((s) => s.id));
  });

  it("changes the layout and spacing", () => {
    const next = applyPreset(edited, "market/bold-grid");
    expect(next.sections[0].variant).toBe("centered");
    expect(next.tokens.radius).toBe("none");
    expect(applyPreset(next, "market/warm-bakery").sections[0].variant).toBe("split");
  });
});

describe("brand changes reach the draft", () => {
  const config = buildSiteConfig(kit);
  const changed = { ...kit, name: "New Name", tagline: "New line", palette: { ...kit.palette, primary: "#000000" }, fonts: { heading: "Anton", body: "Inter" } };

  it("updates tokens and default hero text", () => {
    const next = applyBrandToConfig(config, changed, kit);
    expect(next.tokens.palette.primary).toBe("#000000");
    expect(next.tokens.fonts.heading).toBe("Anton");
    const content = next.sections[0].content as { eyebrow: string; headline: string };
    expect(content.eyebrow).toBe("New Name");
    expect(content.headline).toBe("New line");
  });

  it("keeps hero text the seller rewrote", () => {
    const edited = applySiteEdit(config, { sectionId: "hero", text: { headline: "My own words" } });
    const next = applyBrandToConfig(edited, changed, kit);
    expect((next.sections[0].content as { headline: string }).headline).toBe("My own words");
  });
});

describe("draft preview token", () => {
  const secret = "s".repeat(44);
  const storeId = "3f8a2c1e-0000-4000-8000-000000000000";
  const now = 1_800_000_000_000;

  it("round-trips the store ID", () => {
    expect(verifyDraftToken(signDraftToken(storeId, secret, now), secret, now)).toBe(storeId);
  });

  it("lasts 24 hours and no longer", () => {
    const token = signDraftToken(storeId, secret, now);
    expect(verifyDraftToken(token, secret, now + 24 * 3_600_000 - 1)).toBe(storeId);
    expect(verifyDraftToken(token, secret, now + 24 * 3_600_000)).toBeNull();
  });

  it("rejects a forged, tampered or malformed token", () => {
    const token = signDraftToken(storeId, secret, now);
    expect(verifyDraftToken(token, "x".repeat(44), now)).toBeNull();
    const [, sig] = token.split(".");
    const otherStore = Buffer.from(`other-store.${now + 1000}`).toString("base64url");
    expect(verifyDraftToken(`${otherStore}.${sig}`, secret, now)).toBeNull();
    expect(verifyDraftToken("garbage", secret, now)).toBeNull();
    expect(verifyDraftToken("", secret, now)).toBeNull();
    expect(verifyDraftToken(`${token}.extra`, secret, now)).toBeNull();
  });
});
