import { z } from "zod";

const PayPalEventSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  resource: z
    .object({
      id: z.string().optional(),
      supplementary_data: z.object({ related_ids: z.object({ order_id: z.string().optional() }).optional() }).optional(),
    })
    .optional(),
});

export type PaymentEvent = {
  eventId: string;
  type: string;
  /** Set when this event means an order may now be capturable or paid. */
  providerOrderId: string | null;
};

/** Both events lead to the same action: ask PayPal where the order stands, then settle it. */
export function parsePayPalEvent(raw: string): PaymentEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = PayPalEventSchema.safeParse(json);
  if (!parsed.success) return null;

  const { id, event_type: type, resource } = parsed.data;
  let providerOrderId: string | null = null;
  if (type === "CHECKOUT.ORDER.APPROVED") providerOrderId = resource?.id ?? null;
  if (type === "PAYMENT.CAPTURE.COMPLETED") providerOrderId = resource?.supplementary_data?.related_ids?.order_id ?? null;
  return { eventId: id, type, providerOrderId };
}
