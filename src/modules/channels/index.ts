import "server-only";
import { twilioWhatsApp } from "./adapters/twilio-whatsapp";
import type { Channel, ChannelName } from "./types";

export type { Channel, ChannelName, OutboundMessage, ParsedInbound } from "./types";

/** Adding a vendor means one adapter file and one entry here. */
const registry: Partial<Record<ChannelName, Channel>> = {
  whatsapp: twilioWhatsApp,
};

export function getChannel(name: ChannelName): Channel {
  const channel = registry[name];
  if (!channel) throw new Error(`No adapter registered for channel: ${name}`);
  return channel;
}
