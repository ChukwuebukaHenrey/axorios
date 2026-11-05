import "server-only";
import { env } from "@/lib/env";
import { twilioWhatsApp } from "./adapters/twilio-whatsapp";
import type { Channel, ChannelName } from "./types";

export type { Channel, ChannelName, OutboundMessage, ParsedInbound } from "./types";

/** Adding a vendor means one adapter file and one entry here. */
const registry: Partial<Record<ChannelName, Channel>> = {
  whatsapp: twilioWhatsApp,
};

/** WhatsApp stays off until WHATSAPP_ENABLED=true and the TWILIO_* keys are set. */
function flagOn(name: ChannelName): boolean {
  return name !== "whatsapp" || env().WHATSAPP_ENABLED === "true";
}

export function isChannelEnabled(name: ChannelName): boolean {
  return Boolean(registry[name]) && flagOn(name);
}

export function getChannel(name: ChannelName): Channel {
  const channel = registry[name];
  if (!channel || !flagOn(name)) throw new Error(`Channel is not enabled: ${name}`);
  return channel;
}
