import { describe, expect, it } from "vitest";
import type { Product } from "./schema";
import { searchCatalog } from "./search";

const product = (name: string, description = ""): Product => ({
  id: name,
  name,
  description,
  priceMinor: 100,
  currency: "NGN",
  imageUrl: null,
  stock: 1,
  active: true,
});
const catalog = [product("Red Velvet Cake", "Cream cheese frosting"), product("Chin Chin Jar", "Crunchy snack")];

describe("searchCatalog", () => {
  it("matches any word in the name or description, ignoring case", () => {
    expect(searchCatalog(catalog, "a birthday CAKE").products.map((p) => p.id)).toEqual(["Red Velvet Cake"]);
    expect(searchCatalog(catalog, "crunchy").products.map((p) => p.id)).toEqual(["Chin Chin Jar"]);
  });

  it("returns the whole catalog, marked unmatched, when nothing matches", () => {
    expect(searchCatalog(catalog, "laptop")).toEqual({ matched: false, products: catalog });
    expect(searchCatalog(catalog)).toEqual({ matched: false, products: catalog });
  });
});
