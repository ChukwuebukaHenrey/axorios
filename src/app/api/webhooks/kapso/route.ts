import { recordWebhookEvent } from "@/lib/webhook-events";
import { kapsoChannel } from "@/modules/channels";
import { CHAT_MESSAGE_RECEIVED, inngest } from "@/modules/jobs";
import { env } from "@/lib/env";

/** Verify Kapso's signature, store once, hand off to a job, return. No LLM or reply work happens in this request. */
export async function POST(req: Request) {
  // Without KAPSO_WEBHOOK_SECRET nothing verifies, so every delivery gets 403.
  if (!(await kapsoChannel.verify(req))) return new Response("Invalid signature", { status: 403 });
  // Signed but WhatsApp is switched to another provider: acknowledge so Kapso stops retrying, and do nothing.
  if (env().WHATSAPP_PROVIDER !== "kapso") return new Response(null, { status: 200 });

  for (const message of await kapsoChannel.parseWebhook(req)) {
    await recordWebhookEvent("kapso", message.eventId, message);
    // Sent on repeats too, like Telegram: the event ID stops a second job.
    await inngest.send({ id: `kapso-${message.eventId}`, name: CHAT_MESSAGE_RECEIVED, data: message });
  }
  return new Response(null, { status: 200 });
}
