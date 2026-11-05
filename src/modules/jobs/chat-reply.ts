import "server-only";
import { t } from "@/lib/messages";
import { markWebhookProcessed, type WebhookProvider } from "@/lib/webhook-events";
import { consumeDailyRequest, runSalesAgent } from "@/modules/agent";
import { BrandKitSchema } from "@/modules/brand";
import {
  bindCustomer,
  boundStore,
  getChannel,
  openConversation,
  recordMessage,
  type BoundStore,
  type ChannelName,
  type ParsedInbound,
} from "@/modules/channels";
import { CHAT_MESSAGE_RECEIVED, inngest } from "./client";

const WEBHOOK_PROVIDER: Partial<Record<ChannelName, WebhookProvider>> = { telegram: "telegram", whatsapp: "twilio" };

function storeName(store: BoundStore): string {
  const kit = BrandKitSchema.safeParse(store.brandKit);
  return kit.success ? kit.data.name : store.slug;
}

type Turn = { reply: string } | { agent: { store: BoundStore; conversationId: string } } | { silent: true };

/** Decides what this message needs. Only a message from a bound chat, under the daily cap, reaches the model. */
async function prepareTurn({ channel, customerRef, text, start }: ParsedInbound): Promise<Turn> {
  if (start) {
    const store = start.slug ? await bindCustomer(channel, customerRef, start.slug) : await boundStore(channel, customerRef);
    if (store) return { reply: t.chat.welcome.replace("{store}", storeName(store)) };
    return { reply: start.slug ? t.chat.storeClosed : t.chat.noStore };
  }

  const store = await boundStore(channel, customerRef);
  if (!store) return { reply: t.chat.noStore };
  if (!text?.trim()) return { reply: t.chat.textOnly };

  const { conversationId, agentPaused } = await openConversation(store.storeId, channel, customerRef);
  await recordMessage(store.storeId, conversationId, "customer", text);
  if (agentPaused) return { silent: true }; // The seller has taken over.
  if (!(await consumeDailyRequest(store.storeId))) return { reply: t.chat.busy };
  return { agent: { store, conversationId } };
}

/** Answers one customer message. One at a time per chat, so a quick second message waits for the first reply. */
export const chatReply = inngest.createFunction(
  {
    id: "chat-reply",
    retries: 2,
    concurrency: { key: "event.data.customerRef", limit: 1 },
    triggers: [{ event: CHAT_MESSAGE_RECEIVED }],
    onFailure: async ({ event }) => {
      const message = event.data.event.data as ParsedInbound;
      await getChannel(message.channel).send(message.customerRef, { text: t.chat.failed });
    },
  },
  async ({ event, step }) => {
    const message = event.data as ParsedInbound;
    const turn = await step.run("prepare", () => prepareTurn(message));

    let reply: string | undefined;
    if ("reply" in turn) reply = turn.reply;
    if ("agent" in turn) {
      const { store, conversationId } = turn.agent;
      const text = await step.run("agent", () => runSalesAgent(store, conversationId, message));
      reply = text || t.chat.failed;
      await step.run("save-reply", () => recordMessage(store.storeId, conversationId, "agent", reply!));
    }
    if (reply) {
      await step.run("send-reply", () => getChannel(message.channel).send(message.customerRef, { text: reply! }));
    }

    const provider = WEBHOOK_PROVIDER[message.channel];
    if (provider) await step.run("mark-processed", () => markWebhookProcessed(provider, message.eventId));
  },
);
