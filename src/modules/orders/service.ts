import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { env } from "@/lib/env";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { BrandKitSchema } from "@/modules/brand";
import { decrementStock, listProducts } from "@/modules/catalog";
import { isChargeable, paymentProvider, quote } from "@/modules/payments";
import { CheckoutError, OrderLineSchema, priceCart, type CartItem, type OrderLine } from "./schema";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type Order = Omit<OrderRow, "items"> & { items: OrderLine[] };

function toOrder(row: OrderRow): Order {
  return { ...row, items: OrderLineSchema.array().parse(row.items) };
}

type NewOrder = {
  storeId: string;
  slug: string;
  items: CartItem[];
  channel: "web" | "telegram" | "whatsapp";
  customerRef?: string;
  deliveryNote?: string;
};

/** PayPal charges the owner's currency when it can. Otherwise the settlement currency, at a rate locked on the order. */
async function chargeFor(totalMinor: number, currency: string, settlementCurrency: string) {
  if (isChargeable(currency)) return { minor: totalMinor, currency, rate: null, source: null };
  if (!isChargeable(settlementCurrency)) throw new CheckoutError("currency_not_supported");
  const { chargeMinor, rate, source } = await quote(totalMinor, currency, settlementCurrency);
  if (chargeMinor <= 0) throw new CheckoutError("empty_total");
  return { minor: chargeMinor, currency: settlementCurrency, rate, source };
}

/** Prices the cart from the database, saves the order, then opens its PayPal checkout. */
export async function createOrder({ storeId, slug, items, channel, customerRef, deliveryNote }: NewOrder) {
  const db = serviceRoleClient();
  const { data: store, error: storeError } = await db
    .from("stores")
    .select("brand_kit, settlement_currency")
    .eq("id", storeId)
    .single();
  if (storeError) throw new Error(`Store read failed: ${storeError.code}`);

  const { lines, totalMinor, currency } = priceCart(await listProducts(storeId), items);
  const charge = await chargeFor(totalMinor, currency, store.settlement_currency);

  const { data: row, error } = await db
    .from("orders")
    .insert({
      store_id: storeId,
      items: lines as unknown as Json,
      total_minor: totalMinor,
      currency,
      charge_total_minor: charge.minor,
      charge_currency: charge.currency,
      fx_rate: charge.rate,
      fx_source: charge.source,
      channel,
      customer_ref: customerRef ?? null,
      delivery_note: deliveryNote || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Order create failed: ${error.code}`);

  const kit = BrandKitSchema.safeParse(store.brand_kit);
  const brandName = kit.success ? kit.data.name : slug;
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const session = await paymentProvider().createCheckout({
    orderId: row.id,
    amountMinor: row.charge_total_minor,
    currency: row.charge_currency,
    description: `${brandName}: ${lines.map((l) => `${l.quantity} x ${l.name}`).join(", ")}`,
    brandName,
    returnUrl: `${appUrl}/s/${slug}/order/${row.id}`,
    cancelUrl: `${appUrl}/s/${slug}`,
  });

  const { error: linkError } = await db
    .from("orders")
    .update({ paypal_order_id: session.providerOrderId })
    .eq("id", row.id)
    .eq("store_id", storeId);
  if (linkError) throw new Error(`Order update failed: ${linkError.code}`);

  return { order: toOrder({ ...row, paypal_order_id: session.providerOrderId }), approveUrl: session.approveUrl };
}

/** Starts a web checkout. Only a live store can sell. */
export async function startWebCheckout(slug: string, items: CartItem[], deliveryNote?: string) {
  const { data: store, error } = await serviceRoleClient()
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  if (!store) throw new CheckoutError("store_not_found");
  return createOrder({ storeId: store.id, slug, items, channel: "web", deliveryNote });
}

export async function getOrder(storeId: string, orderId: string): Promise<Order | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const { data, error } = await serviceRoleClient()
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(`Order read failed: ${error.code}`);
  return data && toOrder(data);
}

/**
 * Orders the seller should act on, newest first. Takes the signed-in seller's client, so row-level security applies.
 * Pending orders are left out: most are carts the buyer never paid for.
 */
export async function listSellerOrders(supabase: SupabaseClient<Database>, storeId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .in("status", ["paid", "approved", "failed"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Order list failed: ${error.code}`);
  return data.map(toOrder);
}

/** For a provider's webhook, where the store comes from our own order row. An order we don't know is ignored. */
export async function settleByProviderOrder(providerOrderId: string): Promise<Order | null> {
  const { data, error } = await serviceRoleClient()
    .from("orders")
    .select("*")
    .eq("paypal_order_id", providerOrderId)
    .maybeSingle();
  if (error) throw new Error(`Order read failed: ${error.code}`);
  return data && settleOrder(toOrder(data));
}

/** Only the first call for an order changes anything, so stock moves once however often this runs. */
async function markPaid(order: Order, captureId: string, payerEmail?: string): Promise<Order> {
  const { data, error } = await serviceRoleClient()
    .from("orders")
    .update({
      status: "paid",
      paypal_capture_id: captureId,
      paid_at: new Date().toISOString(),
      customer_ref: order.customer_ref ?? payerEmail ?? null,
    })
    .eq("id", order.id)
    .eq("store_id", order.store_id)
    .neq("status", "paid")
    .select("*");
  if (error) throw new Error(`Mark paid failed: ${error.code}`);
  const [updated] = data;
  if (!updated) return (await getOrder(order.store_id, order.id)) ?? order;
  await decrementStock(order.store_id, order.items);
  return toOrder(updated);
}

async function setStatus(order: Order, status: "approved" | "failed", captureId?: string): Promise<Order> {
  const { data, error } = await serviceRoleClient()
    .from("orders")
    .update({ status, ...(captureId && { paypal_capture_id: captureId }) })
    .eq("id", order.id)
    .eq("store_id", order.store_id)
    .neq("status", "paid")
    .select("*");
  if (error) throw new Error(`Order update failed: ${error.code}`);
  return data[0] ? toOrder(data[0]) : order;
}

/** Captures if the buyer has approved, and records the outcome. Safe to run any number of times. */
export async function settleOrder(order: Order): Promise<Order> {
  if (order.status === "paid" || !order.paypal_order_id) return order;

  const result = await paymentProvider().capture(order.paypal_order_id);
  if (result.status === "pending") return setStatus(order, "approved", result.captureId);
  if (result.status === "declined") return setStatus(order, "failed");
  if (result.status === "not_approved") return order;

  // PayPal's word on what was taken must match what this order asked for.
  if (result.amountMinor !== order.charge_total_minor || result.currency !== order.charge_currency) {
    console.error(`Capture amount mismatch on order ${order.id}`);
    return setStatus(order, "failed", result.captureId);
  }
  return markPaid(order, result.captureId, result.payerEmail);
}
