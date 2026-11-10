import "server-only";
import { t } from "@/lib/messages";
import { markWebhookProcessed } from "@/lib/webhook-events";
import { consumeDailyRequest, runSalesAgent } from "@/modules/agent";
import { BrandKitSchema } from "@/modules/brand";
import {
  bindCustomer,
  boundStore,
  ChannelPausedError,
  deliver,
  getChannel,
  openConversation,
  recordMessage,
  type BoundStore,
  type ParsedInbound,
} from "@/modules/channels";
import { CHAT_MESSAGE_RECEIVED, inngest } from "./client";
import { shopSlugIn } from "./shop-link";

function storeName(store: BoundStore): string {
  const kit = BrandKitSchema.safeParse(store.brandKit);
  return kit.success ? kit.data.name : store.slug;
}

/** Keeps "typing…" up in the chat until the work finishes (channels without it are skipped). Never fails the reply. */
async function whileTyping<T>(message: ParsedInbound, work: () => Promise<T>): Promise<T> {
  const channel = getChannel(message.channel);
  if (!channel.typing) return work();
  const ping = () => channel.typing!(message.customerRef).catch(() => {});
  void ping();
  const timer = setInterval(ping, 4000);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

type Turn =
  | { reply: string; storeId?: string }
  | { agent: { store: BoundStore; conversationId: string } }
  | { silent: true };

/** Decides what this message needs. Only a message from a bound chat, under the daily cap, reaches the model. */
async function prepareTurn({ channel, customerRef, text, start, windowEndsAt }: ParsedInbound): Promise<Turn> {
  if (start) {
    const store = start.slug ? await bindCustomer(channel, customerRef, start.slug) : await boundStore(channel, customerRef);
    if (store) return { reply: t.chat.welcome.replace("{store}", storeName(store)), storeId: store.storeId };
    return { reply: start.slug ? t.chat.storeClosed : t.chat.noStore };
  }

  let store = await boundStore(channel, customerRef);
  // Some Telegram apps open an existing chat without sending "/start <shop>", so a pasted shop link or name also binds.
  if (!store) {
    const slug = shopSlugIn(text);
    store = slug ? await bindCustomer(channel, customerRef, slug) : null;
    if (store) return { reply: t.chat.welcome.replace("{store}", storeName(store)), storeId: store.storeId };
    return { reply: t.chat.noStore };
  }
  if (!text?.trim()) return { reply: t.chat.textOnly, storeId: store.storeId };

  const { conversationId, agentPaused } = await openConversation(store.storeId, channel, customerRef, windowEndsAt);
  await recordMessage(store.storeId, conversationId, "customer", text);
  if (agentPaused) return { silent: true }; // The seller has taken over.
  if (!(await consumeDailyRequest(store.storeId))) return { reply: t.chat.busy, storeId: store.storeId };
  return { agent: { store, conversationId } };
}

/** Answers one customer message. One at a time per chat, so a quick second message waits for the first reply. */
export const chatReply = inngest.createFunction(
  {
    id: "chat-reply",
    retries: 2,
    concurrency: { key: "event.data.customerRef", limit: 1 },
    triggers: [{ event: CHAT_MESSAGE_RECEIVED }],
    onFailure: async ({ event, error }) => {
      // Out of credits: an apology would fail the same way, so stay quiet. The Inbox already shows the pause.
      if (error.name === "ChannelPausedError") return;
      const message = event.data.event.data as ParsedInbound;
      await getChannel(message.channel).send(message.customerRef, { text: t.chat.failed });
    },
  },
  async ({ event, step }) => {
    const message = event.data as ParsedInbound;
    const turn = await step.run("prepare", () => prepareTurn(message));

    let reply: string | undefined;
    let storeId: string | undefined;
    if ("reply" in turn) ({ reply, storeId } = turn);
    if ("agent" in turn) {
      const { store, conversationId } = turn.agent;
      storeId = store.storeId;
      const text = await step.run("agent", () => whileTyping(message, () => runSalesAgent(store, conversationId, message)));
      reply = text || t.chat.failed;
      await step.run("save-reply", () => recordMessage(store.storeId, conversationId, "agent", reply!));
    }
    if (reply) {
      const sent = await step.run("send-reply", async () => {
        const out = { text: { text: reply! } };
        // Unbound chats have no store to flag, so they go straight to the adapter.
        if (!storeId) return getChannel(message.channel).send(message.customerRef, out.text).then(() => "sent");
        try {
          await deliver(storeId, message.channel, message.customerRef, out);
          return "sent";
        } catch (error) {
          if (error instanceof ChannelPausedError) return "paused"; // Logged and flagged; never retried.
          throw error;
        }
      });
      if (sent === "paused") console.warn(`[chat-reply] ${message.channel} reply not sent: provider paused`);
    }

    await step.run("mark-processed", () => markWebhookProcessed(getChannel(message.channel).webhookProvider, message.eventId));
  },
);
