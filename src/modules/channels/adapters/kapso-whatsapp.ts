import "server-only";
import { NonRetriableError } from "inngest";
import { env } from "@/lib/env";
import { ChannelPausedError, WindowClosedError } from "../errors";
import { classifyKapsoFailure, parseKapsoWebhook, verifyKapsoSignature } from "../kapso-webhook";
import type { Channel } from "../types";

const API = "https://api.kapso.ai/meta/whatsapp/v24.0";
const MAX_TEXT = 4096;

/** Read only when the channel is in use, so an unconfigured WhatsApp can't stop the app from starting. */
function kapsoEnv() {
  const { KAPSO_API_KEY: key, KAPSO_PHONE_NUMBER_ID: phoneNumberId } = env();
  if (!key || !phoneNumberId) throw new Error("WhatsApp needs KAPSO_API_KEY and KAPSO_PHONE_NUMBER_ID");
  return { key, phoneNumberId };
}

/** `bsuid:` refs have no phone number; Kapso takes those as `recipient`. */
const addressee = (to: string) => (to.startsWith("bsuid:") ? { recipient: to.slice(6) } : { to });

/** Errors carry the status and Kapso's code only: never the key or the customer's message. */
async function sendMessage(body: Record<string, unknown>): Promise<void> {
  const { key, phoneNumberId } = kapsoEnv();
  const res = await fetch(`${API}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
  });
  if (res.ok) return;

  const failure = await res.json().catch(() => null);
  const code = (failure as { code?: unknown; error?: { code?: unknown } } | null)?.code ?? (failure as { error?: { code?: unknown } } | null)?.error?.code;
  const message = `Kapso send failed: HTTP ${res.status}${code ? ` ${String(code)}` : ""}`;
  const kind = classifyKapsoFailure(res.status, failure);
  if (kind === "credits") throw new ChannelPausedError(message);
  if (kind === "window") throw new WindowClosedError(message);
  // Bad input, a wrong key or an unknown number won't heal on retry; rate limits and 5xx might.
  if (res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429) throw new NonRetriableError(message);
  throw new Error(message);
}

export const kapsoWhatsApp: Channel = {
  name: "whatsapp",
  webhookProvider: "kapso",

  async verify(req) {
    return verifyKapsoSignature(await req.clone().text(), req.headers.get("x-webhook-signature"), env().KAPSO_WEBHOOK_SECRET);
  },

  async parseWebhook(req) {
    const json = await req.json().catch(() => null);
    return parseKapsoWebhook(json, req.headers.get("x-webhook-event"), new Date().toISOString());
  },

  async send(to, msg) {
    if (msg.mediaUrl) {
      await sendMessage({ ...addressee(to), type: "image", image: { link: msg.mediaUrl, caption: msg.text.slice(0, 1024) } });
      return;
    }
    await sendMessage({ ...addressee(to), type: "text", text: { body: msg.text.slice(0, MAX_TEXT) } });
  },

  async sendTemplate(to, template) {
    await sendMessage({ ...addressee(to), type: "template", template: { name: template.name, language: { code: template.language } } });
  },
};
