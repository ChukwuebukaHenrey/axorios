import { describe, expect, it } from "vitest";
import { shopSlugIn } from "./shop-link";

describe("shopSlugIn", () => {
  it("reads the slug from a pasted storefront link", () => {
    expect(shopSlugIn("https://axorios.vercel.app/s/eko-sweet-bakes")).toBe("eko-sweet-bakes");
    expect(shopSlugIn("here: axorios.vercel.app/s/Demo?ref=tg thanks")).toBe("demo");
    expect(shopSlugIn("https://axorios.vercel.app/s/demo/p/123")).toBe("demo");
  });

  it("takes a single slug-like word, and nothing from ordinary sentences", () => {
    expect(shopSlugIn("eko-sweet-bakes")).toBe("eko-sweet-bakes");
    expect(shopSlugIn("You dey sell cake")).toBeNull();
    expect(shopSlugIn("")).toBeNull();
    expect(shopSlugIn(undefined)).toBeNull();
  });
});
