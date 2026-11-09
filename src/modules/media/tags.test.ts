import { describe, expect, it } from "vitest";
import { autoTag, baseName, MAX_TAGS, normalizeTags, sniff } from "./tags";

const products = [
  { id: "p1", name: "Red Velvet Cake", category: "Cakes" },
  { id: "p2", name: "Ube Coconut Cake", category: null },
  { id: "p3", name: "Chocolate Berry Cake", category: "Cakes" },
  { id: "p4", name: "Fudge Brownie Box", category: "Treats" },
];

describe("sniff", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  it("reads the type from the bytes, not the name", () => {
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(sniff(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))?.mime).toBe("image/webp");
    expect(sniff(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))?.kind).toBe("document");
  });
  it("refuses SVG, HTML and anything unknown", () => {
    expect(sniff(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniff(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniff(new Uint8Array())).toBeNull();
  });
});

describe("autoTag", () => {
  it("tags a product photo by its file name", () => {
    const r = autoTag("C:\\Users\\me\\red-velvet_slice.JPG", "", "image", products);
    expect(r.tags).toEqual(["photo", "red velvet cake", "cakes"]);
    expect(r.productIds).toEqual(["p1"]);
  });
  it("uses the seller's note and ignores generic words", () => {
    const r = autoTag("IMG_2041.jpg", "the new brownie box for weekend", "image", products);
    expect(r.productIds).toEqual(["p4"]);
    expect(autoTag("cake.jpg", "", "image", products).productIds).toEqual([]);
  });
  it("gives a type tag from the name or note", () => {
    expect(autoTag("eko-logo-final.png", "", "image", products).tags[0]).toBe("logo");
    expect(autoTag("scan.pdf", "flour receipt", "document", products).tags[0]).toBe("receipt");
    expect(autoTag("Screenshot 2026-11-09.png", "", "image", products).tags[0]).toBe("screenshot");
    expect(autoTag("price-list.pdf", "", "document", products).tags[0]).toBe("graphic");
    expect(autoTag("notes.pdf", "", "document", products).tags[0]).toBe("document");
  });
  it("matches more than one product", () => {
    expect(autoTag("ube-coconut-and-chocolate-berry.png", "", "image", products).productIds).toEqual(["p2", "p3"]);
  });
});

describe("normalizeTags", () => {
  it("lower-cases, trims, dedupes and caps", () => {
    expect(normalizeTags(["  Red  Velvet ", "red velvet", "", "Birthday!!"])).toEqual(["red velvet", "birthday"]);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(MAX_TAGS);
    expect(normalizeTags(["x".repeat(80)])[0]).toHaveLength(32);
  });
  it("baseName strips folders and extension", () => {
    expect(baseName("a/b/c/Cake Photo.webp")).toBe("Cake Photo");
  });
});
