import { recordWebhookEvent } from "@/lib/webhook-events";
import { getChannel } from "@/modules/channels";
import { CHAT_MESSAGE_RECEIVED, inngest } from "@/modules/jobs";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/** Verify, store once, hand off to a job, return. No LLM or reply work happens in this request. */
export async function POST(req: Request) {
  const channel = getChannel("whatsapp");
  if (!(await channel.verify(req))) return new Response("Invalid signature", { status: 403 });

  for (const message of await channel.parseWebhook(req)) {
    const isNew = await recordWebhookEvent("twilio", message.eventId, message);
    if (isNew) await inngest.send({ name: CHAT_MESSAGE_RECEIVED, data: message });
  }

  return new Response(EMPTY_TWIML, { headers: { "Content-Type": "text/xml" } });
}
