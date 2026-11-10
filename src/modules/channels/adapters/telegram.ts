import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NonRetriableError } from "inngest";
import { env } from "@/lib/env";
import { parseTelegramUpdate } from "../telegram-update";
import type { Channel } from "../types";

const MAX_TEXT = 4096;
const MAX_CAPTION = 1024;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Errors carry the method and status only: the request URL holds the bot token. */
async function callApi(method: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${env().TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const failure = (await res.json().catch(() => null)) as { description?: string } | null;
    const message = `Telegram ${method} failed: HTTP ${res.status} ${failure?.description ?? ""}`.trim();
    // A blocked bot or an unknown chat won't heal, and retrying would hold up this chat's next message.
    if (res.status === 400 || res.status === 403) throw new NonRetriableError(message);
    throw new Error(message);
  }
}

export const telegram: Channel = {
  name: "telegram",
  webhookProvider: "telegram",

  async verify(req) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    return Boolean(header) && timingSafeEqual(digest(header!), digest(env().TELEGRAM_WEBHOOK_SECRET));
  },

  async parseWebhook(req) {
    return parseTelegramUpdate(await req.json().catch(() => null), new Date().toISOString());
  },

  async send(to, msg) {
    if (msg.mediaUrl) {
      await callApi("sendPhoto", { chat_id: to, photo: msg.mediaUrl, caption: msg.text.slice(0, MAX_CAPTION) });
      return;
    }
    await callApi("sendMessage", { chat_id: to, text: msg.text.slice(0, MAX_TEXT) });
  },

  // Telegram shows "typing…" for about 5 s per call, so a caller repeats it while the agent works.
  async typing(to) {
    await callApi("sendChatAction", { chat_id: to, action: "typing" });
  },
};
