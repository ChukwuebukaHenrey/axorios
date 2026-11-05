import "server-only";
import { NonRetriableError } from "inngest";
import { env } from "@/lib/env";
import type { Publisher } from "../types";

const MAX_CAPTION = 1024;
const MAX_TEXT = 4096;

/** Errors carry the method and Telegram's reason only: the request URL holds the bot token. */
async function callApi(method: string, body: Record<string, unknown>): Promise<{ message_id: number }> {
  const res = await fetch(`https://api.telegram.org/bot${env().TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const reply = (await res.json().catch(() => null)) as { result?: { message_id: number }; description?: string } | null;
  if (!res.ok || !reply?.result) {
    const message = `Telegram ${method} failed: HTTP ${res.status} ${reply?.description ?? ""}`.trim();
    // A bot that isn't a channel admin, or a bad channel name, won't heal by retrying.
    if (res.status === 400 || res.status === 403) throw new NonRetriableError(message);
    throw new Error(message);
  }
  return reply.result;
}

export const telegramChannel: Publisher = {
  name: "telegram_channel",

  capabilities: () => ({ images: true, schedule: true }),

  async publish({ caption, mediaUrl }) {
    const channel = env().TELEGRAM_CHANNEL_ID;
    if (!channel) throw new NonRetriableError("TELEGRAM_CHANNEL_ID is not set");
    const { message_id } = mediaUrl
      ? await callApi("sendPhoto", { chat_id: channel, photo: mediaUrl, caption: caption.slice(0, MAX_CAPTION) })
      : await callApi("sendMessage", { chat_id: channel, text: caption.slice(0, MAX_TEXT) });
    return { url: channel.startsWith("@") ? `https://t.me/${channel.slice(1)}/${message_id}` : undefined };
  },
};
