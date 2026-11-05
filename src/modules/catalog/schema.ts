import { z } from "zod";
import { isIsoCurrency, parseToMinor } from "../../lib/money";

/** Most sellers bake or make to order, so a product with no stated stock is available rather than sold out. */
export const DEFAULT_STOCK = 100;

export const ProductDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  price: z.string().min(1).max(24).describe('The price the owner stated, as a plain number, for example "45000" or "12.50"'),
  stock: z.number().int().min(0).max(1_000_000).optional().describe("Only if the owner said how many they have"),
});

export const AddProductsSchema = z.object({
  currency: z
    .string()
    .refine(isIsoCurrency, "Use a 3-letter ISO currency code")
    .describe('ISO code of the currency the owner priced in, for example "NGN"'),
  products: z.array(ProductDraftSchema).min(1).max(50),
});

export type AddProductsInput = z.infer<typeof AddProductsSchema>;

export type Product = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  stock: number;
  active: boolean;
};

export type ProductWrite = {
  key: string;
  name: string;
  description?: string;
  priceMinor: number;
  stock?: number;
};

function productKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Validates every price before anything is written, and collapses repeats in one batch.
 * Keyed by name so saying a product again changes it instead of listing it twice.
 */
export function toProductWrites(input: AddProductsInput): ProductWrite[] {
  const writes = new Map<string, ProductWrite>();
  for (const draft of input.products) {
    const key = productKey(draft.name);
    writes.set(key, {
      key,
      name: draft.name,
      description: draft.description,
      priceMinor: parseToMinor(draft.price, input.currency),
      stock: draft.stock,
    });
  }
  return [...writes.values()];
}

/** Splits writes into updates of products this store already has and new inserts. */
export function planUpsert(writes: ProductWrite[], existing: { id: string; name: string }[]) {
  const idByKey = new Map(existing.map((p) => [productKey(p.name), p.id]));
  const updates: (ProductWrite & { id: string })[] = [];
  const inserts: ProductWrite[] = [];
  for (const write of writes) {
    const id = idByKey.get(write.key);
    if (id) updates.push({ ...write, id });
    else inserts.push(write);
  }
  return { updates, inserts };
}

/** A store has one price currency, so a cart can always be totalled without converting. */
export function assertSameCurrency(existingCurrencies: string[], currency: string): void {
  const other = existingCurrencies.find((c) => c !== currency);
  if (other) throw new Error(`This store's prices are in ${other}. Give the price in ${other}.`);
}
