import { describe, expect, it } from "vitest";
import { applyBrandPatch, BrandKitSchema, slugify } from "./schema";

const kit = BrandKitSchema.parse({
  name: "Mama Cakes",
  nameOptions: ["Sweet Lagos"],
  tagline: "Celebration cakes in Lagos",
  tone: "Warm",
  palette: {
    primary: "#7A1F3D",
    secondary: "#F97316",
    accent: "#FBBF24",
    neutralDark: "#1F1F1F",
    neutralLight: "#FFF6E9",
  },
  fonts: { heading: "Fraunces", body: "DM Sans" },
});

describe("brand kit", () => {
  it("defaults logo and references", () => {
    expect(kit.logoUrl).toBeNull();
    expect(kit.referenceImageUrls).toEqual([]);
  });

  it("changes only the patched fields", () => {
    const next = applyBrandPatch(kit, { palette: { primary: "#000000" }, tagline: "New" });
    expect(next.palette.primary).toBe("#000000");
    expect(next.palette.accent).toBe("#FBBF24");
    expect(next.tagline).toBe("New");
    expect(next.name).toBe("Mama Cakes");
  });

  it("rejects a bad colour", () => {
    expect(() => applyBrandPatch(kit, { palette: { primary: "red" } })).toThrow();
  });

  it("makes URL-safe slugs", () => {
    expect(slugify("Mama's Cakés & Co!")).toBe("mama-s-cakes-co");
    expect(slugify("蛋糕")).toBe("store");
  });
});
