import "server-only";
import { markWebhookProcessed } from "@/lib/webhook-events";
import { parseToMinor } from "@/lib/money";
import { confirmRefundFromProvider, settleByProviderOrder } from "@/modules/orders";
import type { PaymentEvent } from "@/modules/payments";
import { inngest, PAYPAL_EVENT_RECEIVED } from "./client";

/** Finishes payment for a buyer who approved and closed the tab. Settling twice changes nothing. */
export const paypalEvent = inngest.createFunction(
  { id: "paypal-event", triggers: [{ event: PAYPAL_EVENT_RECEIVED }] },
  async ({ event, step }) => {
    const { eventId, providerOrderId, refund } = event.data as PaymentEvent;
    if (refund) {
      const outcome = await step.run("confirm-refund", () =>
        confirmRefundFromProvider({ ...refund, amountMinor: parseToMinor(refund.value, refund.currency) }),
      );
      await step.run("mark-processed", () => markWebhookProcessed("paypal", eventId));
      return { status: outcome };
    }
    const status = await step.run("settle-order", async () => {
      if (!providerOrderId) return "nothing-to-settle";
      const order = await settleByProviderOrder(providerOrderId);
      return order?.status ?? "unknown-order";
    });
    await step.run("mark-processed", () => markWebhookProcessed("paypal", eventId));
    return { status };
  },
);
