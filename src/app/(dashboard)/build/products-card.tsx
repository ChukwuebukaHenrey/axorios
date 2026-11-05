import { formatMinor } from "@/lib/money";
import { t } from "@/lib/messages";
import type { Product } from "@/modules/catalog";

export function ProductsCard({ products }: { products: Product[] }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <h3 className="border-b border-black/10 px-5 py-3 font-semibold">{t.productsCard.title}</h3>
      <ul className="divide-y divide-black/10">
        {products.map((product) => (
          <li key={product.id} className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm">
            <span className="min-w-0">
              <span className="block font-medium">{product.name}</span>
              {product.description && <span className="mt-0.5 block text-black/60">{product.description}</span>}
            </span>
            <span className="shrink-0 font-semibold">{formatMinor(product.priceMinor, product.currency)}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-black/10 px-5 py-3 text-xs text-black/60">{t.productsCard.editHint}</p>
    </article>
  );
}
