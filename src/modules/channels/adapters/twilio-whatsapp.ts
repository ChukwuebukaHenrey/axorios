import "server-only";
import twilio from "twilio";
import { env } from "@/lib/env";
import type { Channel, ParsedInbound } from "../types";

async function formParams(req: Request): Promise<Record<string, string>> {
  const form = new URLSearchParams(await req.clone().text());
  return Object.fromEntries(form.entries());
}

/** Read only when the channel is in use, so an unconfigured WhatsApp can't stop the app from starting. */
function twilioEnv() {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: from } = env();
  if (!sid || !token || !from?.startsWith("whatsapp:")) {
    throw new Error("WhatsApp needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and a whatsapp: TWILIO_WHATSAPP_FROM");
  }
  return { sid, token, from };
}

/** Dormant behind WHATSAPP_ENABLED: never run end to end, so nothing may claim WhatsApp works yet. */
export const twilioWhatsApp: Channel = {
  name: "whatsapp",

  async verify(req) {
    const signature = req.headers.get("x-twilio-signature");
    if (!signature) return false;
    // Twilio signs the public URL, which differs from the URL seen behind the platform proxy.
    const url = `${env().NEXT_PUBLIC_APP_URL}${new URL(req.url).pathname}`;
    return twilio.validateRequest(twilioEnv().token, signature, url, await formParams(req));
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
    const { sid, token, from } = twilioEnv();
    await twilio(sid, token).messages.create({
      from,
      to,
      body: msg.text,
      mediaUrl: msg.mediaUrl ? [msg.mediaUrl] : undefined,
    });
  },
};
