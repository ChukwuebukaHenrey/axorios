import "server-only";
import type { Database } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import {
  assertSameCurrency,
  DEFAULT_STOCK,
  planUpsert,
  toProductWrites,
  type AddProductsInput,
  type Product,
} from "./schema";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceMinor: row.price_minor,
    currency: row.currency,
    imageUrl: row.image_url,
    stock: row.stock,
    active: row.active,
  };
}

export async function listProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await serviceRoleClient()
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .eq("active", true)
    .order("created_at");
  if (error) throw new Error(`Product list failed: ${error.code}`);
  return data.map(toProduct);
}

/** Takes paid quantities out of stock, stopping at zero. */
export async function decrementStock(storeId: string, lines: { productId: string; quantity: number }[]): Promise<void> {
  const db = serviceRoleClient();
  for (const { productId, quantity } of lines) {
    const { data, error } = await db
      .from("products")
      .select("stock")
      .eq("id", productId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw new Error(`Stock read failed: ${error.code}`);
    if (!data) continue; // Removed since the order was placed.
    const { error: updateError } = await db
      .from("products")
      .update({ stock: Math.max(0, data.stock - quantity) })
      .eq("id", productId)
      .eq("store_id", storeId);
    if (updateError) throw new Error(`Stock update failed: ${updateError.code}`);
  }
}

/** Returns the store's full active catalog. The first products priced set the store's currency. */
export async function addProducts(storeId: string, input: AddProductsInput): Promise<Product[]> {
  const writes = toProductWrites(input);
  const db = serviceRoleClient();

  const { data: existing, error: readError } = await db
    .from("products")
    .select("id, name, currency")
    .eq("store_id", storeId)
    .eq("active", true);
  if (readError) throw new Error(`Product read failed: ${readError.code}`);
  assertSameCurrency(
    existing.map((p) => p.currency),
    input.currency,
  );

  if (existing.length === 0) {
    const { error } = await db.from("stores").update({ currency: input.currency }).eq("id", storeId);
    if (error) throw new Error(`Store currency update failed: ${error.code}`);
  }

  const { updates, inserts } = planUpsert(writes, existing);

  for (const { id, name, description, priceMinor, stock } of updates) {
    const { error } = await db
      .from("products")
      .update({
        name,
        price_minor: priceMinor,
        ...(description !== undefined && { description }),
        ...(stock !== undefined && { stock }),
      })
      .eq("id", id)
      .eq("store_id", storeId);
    if (error) throw new Error(`Product update failed: ${error.code}`);
  }

  if (inserts.length > 0) {
    const { error } = await db.from("products").insert(
      inserts.map(({ name, description, priceMinor, stock }) => ({
        store_id: storeId,
        name,
        description: description ?? "",
        price_minor: priceMinor,
        currency: input.currency,
        stock: stock ?? DEFAULT_STOCK,
      })),
    );
    if (error) throw new Error(`Product insert failed: ${error.code}`);
  }

  return listProducts(storeId);
}
