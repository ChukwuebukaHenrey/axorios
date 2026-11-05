import { CheckoutBodySchema, CheckoutError, startWebCheckout } from "@/modules/orders";

export const maxDuration = 30;

/** Opens a checkout. Takes product IDs and quantities only: every amount comes from the server. */
export async function POST(req: Request) {
  const body = CheckoutBodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const { slug, items, deliveryNote } = body.data;
    const { order } = await startWebCheckout(slug, items, deliveryNote);
    return Response.json({
      orderId: order.id,
      paypalOrderId: order.paypal_order_id,
      totalMinor: order.total_minor,
      currency: order.currency,
      chargeMinor: order.charge_total_minor,
      chargeCurrency: order.charge_currency,
    });
  } catch (error) {
    if (error instanceof CheckoutError) return Response.json({ error: error.code }, { status: 400 });
    console.error("Checkout failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "checkout_failed" }, { status: 502 });
  }
}
