import "server-only";
import { env } from "@/lib/env";
import { kapsoWhatsApp } from "./adapters/kapso-whatsapp";
import { telegram } from "./adapters/telegram";
import { twilioWhatsApp } from "./adapters/twilio-whatsapp";
import type { Channel, ChannelName } from "./types";

/** WhatsApp's vendor comes from WHATSAPP_PROVIDER; the older WHATSAPP_ENABLED=true still means Twilio. */
function whatsapp(): Channel | undefined {
  const { WHATSAPP_PROVIDER: provider, WHATSAPP_ENABLED: legacy } = env();
  if (provider === "kapso") return kapsoWhatsApp;
  if (provider === "twilio" || legacy === "true") return twilioWhatsApp;
  return undefined;
}

/** Adding a vendor means one adapter file and one entry here. */
function lookup(name: ChannelName): Channel | undefined {
  if (name === "telegram") return telegram;
  if (name === "whatsapp") return whatsapp();
  return undefined;
}

export function isChannelEnabled(name: ChannelName): boolean {
  return Boolean(lookup(name));
}

export function getChannel(name: ChannelName): Channel {
  const channel = lookup(name);
  if (!channel) throw new Error(`Channel is not enabled: ${name}`);
  return channel;
}

/** The Kapso adapter, whatever the active provider: its webhook verifies against its own secret. */
export const kapsoChannel = kapsoWhatsApp;
