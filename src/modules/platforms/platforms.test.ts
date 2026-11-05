import { describe, expect, it } from "vitest";
import { escapeHtml, isShopDomain, pagesFromStore, productHandle } from "./content";

const brand = { name: "Mama Cakes", tagline: "Birthdays taste better here" };

describe("pagesFromStore", () => {
  it("makes an About page from the tagline and story", () => {
    const pages = pagesFromStore(brand, [{ type: "story", content: { body: "We bake.\n\nWe deliver." } }]);
    expect(pages).toEqual([
      { key: "about", title: "About Mama Cakes", bodyHtml: "<p>Birthdays taste better here</p><p>We bake.</p><p>We deliver.</p>" },
    ]);
  });

  it("makes an FAQ page only from answers the store really has", () => {
    expect(pagesFromStore(brand, [{ type: "faq", content: { items: [] } }]).map((p) => p.key)).toEqual(["about"]);
    const pages = pagesFromStore(brand, [{ type: "faq", content: { items: [{ question: "Do you deliver?", answer: "In Lagos." }] } }]);
    expect(pages.map((p) => p.key)).toEqual(["about", "faq"]);
    expect(pages[1].bodyHtml).toBe("<h3>Do you deliver?</h3><p>In Lagos.</p>");
  });

  it("never invents a delivery or policy page", () => {
    expect(pagesFromStore(brand, []).map((p) => p.key)).toEqual(["about"]);
  });

  it("leaves out a section the seller hid", () => {
    const pages = pagesFromStore(brand, [{ type: "faq", hidden: true, content: { items: [{ question: "Q", answer: "A" }] } }]);
    expect(pages.map((p) => p.key)).toEqual(["about"]);
  });

  it("escapes HTML in store text", () => {
    const pages = pagesFromStore({ name: "A", tagline: "<script>x</script>" }, []);
    expect(pages[0].bodyHtml).toBe("<p>&lt;script&gt;x&lt;/script&gt;</p>");
    expect(escapeHtml('"a"&')).toBe("&quot;a&quot;&amp;");
  });
});

describe("productHandle", () => {
  it("stays the same for a product, so a retry can't duplicate it", () => {
    const id = "6f1c2d3e-0000-4000-8000-000000000000";
    expect(productHandle("Demo", id)).toBe("demo-6f1c2d3e");
    expect(productHandle("Demo", id)).toBe(productHandle("Demo", id));
  });
});

describe("isShopDomain", () => {
  it("accepts only a myshopify.com host, so a seller's input can't send a token elsewhere", () => {
    expect(isShopDomain("my-store.myshopify.com")).toBe(true);
    for (const bad of ["evil.com", "x.myshopify.com.evil.com", "https://x.myshopify.com", "a/b.myshopify.com", ""]) {
      expect(isShopDomain(bad)).toBe(false);
    }
  });
});
