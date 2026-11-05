import type { Product } from "./schema";

/**
 * Finds a store's products by any word of the query. With no match, or no query, the whole catalog comes back,
 * so the agent can offer what the store does sell.
 */
export function searchCatalog(products: Product[], query?: string): { matched: boolean; products: Product[] } {
  const words = (query ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const hits = products.filter((p) => {
    const text = `${p.name} ${p.description}`.toLowerCase();
    return words.some((w) => text.includes(w));
  });
  return hits.length > 0 ? { matched: true, products: hits } : { matched: false, products };
}
