import { z } from "zod";

export const CartItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const CheckoutBodySchema = z.object({
  slug: z.string().min(1).max(63),
  items: z.array(CartItemSchema).min(1).max(50),
  deliveryNote: z.string().trim().max(500).optional(),
});

export const OrderLineSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitMinor: z.number().int().nonnegative(),
  lineMinor: z.number().int().nonnegative(),
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;
export type OrderLine = z.infer<typeof OrderLineSchema>;

export type CheckoutErrorCode =
  | "store_not_found"
  | "product_unavailable"
  | "not_enough_stock"
  | "empty_total"
  | "currency_not_supported";

/** A problem the buyer can act on. The code is what reaches the browser. */
export class CheckoutError extends Error {
  constructor(public readonly code: CheckoutErrorCode) {
    super(code);
  }
}

type PricedProduct = { id: string; name: string; priceMinor: number; currency: string; stock: number };

/** The only place an order total is worked out: prices come from this store's products, never from the request. */
export function priceCart(products: PricedProduct[], items: CartItem[]) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const quantities = new Map<string, number>();
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  const lines: OrderLine[] = [];
  let totalMinor = 0;
  let currency = "";
  for (const [productId, quantity] of quantities) {
    const product = byId.get(productId);
    if (!product) throw new CheckoutError("product_unavailable");
    if (quantity > product.stock) throw new CheckoutError("not_enough_stock");
    const lineMinor = product.priceMinor * quantity;
    totalMinor += lineMinor;
    currency = product.currency;
    lines.push({ productId, name: product.name, quantity, unitMinor: product.priceMinor, lineMinor });
  }
  if (!Number.isSafeInteger(totalMinor)) throw new Error("Order total is too large");
  if (totalMinor === 0) throw new CheckoutError("empty_total");
  return { lines, totalMinor, currency };
}

/**
 * VAT on an order, in the order's minor units (spec v2, "VAT"). Inclusive: tax = total × rate / (1 + rate).
 * Exclusive: tax = total × rate, added on top. Rate is in basis points (750 = 7.5%). Not registered = 0.
 */
export function vatFor(totalMinor: number, store: { vatRegistered: boolean; vatRateBp: number; pricesIncludeTax: boolean }) {
  if (!store.vatRegistered || store.vatRateBp <= 0) return { taxMinor: 0, rateBp: 0, inclusive: store.pricesIncludeTax, grossMinor: totalMinor };
  if (store.pricesIncludeTax) {
    return { taxMinor: Math.round((totalMinor * store.vatRateBp) / (10_000 + store.vatRateBp)), rateBp: store.vatRateBp, inclusive: true, grossMinor: totalMinor };
  }
  const taxMinor = Math.round((totalMinor * store.vatRateBp) / 10_000);
  return { taxMinor, rateBp: store.vatRateBp, inclusive: false, grossMinor: totalMinor + taxMinor };
}
