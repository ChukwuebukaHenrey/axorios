import { recordWebhookEvent } from "@/lib/webhook-events";
import { getChannel } from "@/modules/channels";
import { CHAT_MESSAGE_RECEIVED, inngest } from "@/modules/jobs";

/** Verify, store once, hand off to a job, return. No LLM or reply work happens in this request. */
export async function POST(req: Request) {
  const channel = getChannel("telegram");
  if (!(await channel.verify(req))) return new Response("Invalid secret", { status: 403 });

  for (const message of await channel.parseWebhook(req)) {
    await recordWebhookEvent("telegram", message.eventId, message);
    // Sent on repeats too: if a send failed last time, Telegram's retry still gets the job started. The ID stops doubles.
    await inngest.send({ id: `telegram-${message.eventId}`, name: CHAT_MESSAGE_RECEIVED, data: message });
  }
  return new Response(null, { status: 200 });
}
