import { recordWebhookEvent } from "@/lib/webhook-events";
import { inngest, PAYPAL_EVENT_RECEIVED } from "@/modules/jobs";
import { paymentProvider } from "@/modules/payments";

/** Verify, store once, hand off to a job, return. The capture happens in the job. */
export async function POST(req: Request) {
  const event = await paymentProvider().verifyWebhook(req);
  if (!event) return new Response("Invalid signature", { status: 403 });

  await recordWebhookEvent("paypal", event.eventId, event);
  // Sent on repeats too: if a send failed last time, PayPal's retry still gets the job started. The ID stops doubles.
  await inngest.send({ id: `paypal-${event.eventId}`, name: PAYPAL_EVENT_RECEIVED, data: event });
  return new Response(null, { status: 200 });
}
