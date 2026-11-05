import "server-only";
import twilio from "twilio";
import { env } from "@/lib/env";
import type { Channel, ParsedInbound } from "../types";

async function formParams(req: Request): Promise<Record<string, string>> {
  const form = new URLSearchParams(await req.clone().text());
  return Object.fromEntries(form.entries());
}

export const twilioWhatsApp: Channel = {
  name: "whatsapp",

  async verify(req) {
    const signature = req.headers.get("x-twilio-signature");
    if (!signature) return false;
    const e = env();
    // Twilio signs the public URL, which differs from the URL seen behind the platform proxy.
    const url = `${e.NEXT_PUBLIC_APP_URL}${new URL(req.url).pathname}`;
    return twilio.validateRequest(e.TWILIO_AUTH_TOKEN, signature, url, await formParams(req));
  },

  async parseWebhook(req) {
    const p = await formParams(req);
    if (!p.MessageSid || !p.From) return [];
    const mediaCount = Number(p.NumMedia ?? 0);
    const mediaUrls = Array.from({ length: mediaCount }, (_, i) => p[`MediaUrl${i}`]).filter(Boolean);
    const message: ParsedInbound = {
      channel: "whatsapp",
      eventId: p.MessageSid,
      customerRef: p.From,
      text: p.Body || undefined,
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
      receivedAt: new Date().toISOString(),
    };
    return [message];
  },

  async send(to, msg) {
    const e = env();
    await twilio(e.TWILIO_ACCOUNT_SID, e.TWILIO_AUTH_TOKEN).messages.create({
      from: e.TWILIO_WHATSAPP_FROM,
      to,
      body: msg.text,
      mediaUrl: msg.mediaUrl ? [msg.mediaUrl] : undefined,
    });
  },
};
