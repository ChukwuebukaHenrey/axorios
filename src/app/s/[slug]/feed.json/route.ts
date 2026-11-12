import { minorToDecimal } from "@/lib/money";
import { getLiveStorefront } from "@/modules/storefront";

/**
 * Machine-readable catalog for a live store, so shopping assistants can read it without scraping.
 * Read-only: prices come from the database, and only live stores are served (row-level security).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getLiveStorefront(slug);
  if (!store) return Response.json({ error: "not_found" }, { status: 404 });

  const origin = new URL(req.url).origin;
  const base = `${origin}/s/${store.slug}`;
  return Response.json(
    {
      store: { name: store.kit.name, url: base, language: store.locale },
      checkout: "PayPal",
      products: store.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: minorToDecimal(p.priceMinor, p.currency),
        currency: p.currency,
        availability: p.stock > 0 ? "in_stock" : "out_of_stock",
        image: p.imageUrl,
        url: `${base}/p/${p.id}`,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
