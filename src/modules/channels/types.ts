export type ChannelName = "whatsapp" | "telegram" | "web" | "instagram";

/** A customer message in vendor-neutral form. The store binding is resolved after parsing. */
export type ParsedInbound = {
  channel: ChannelName;
  eventId: string;
  customerRef: string; // phone, chat id, or session id
  text?: string;
  mediaUrls?: string[];
  /** The customer opened the chat. `slug` is the store whose link they used, when there is one. */
  start?: { slug: string | null };
  receivedAt: string;
};

export type OutboundMessage = { text: string; mediaUrl?: string };

export interface Channel {
  name: ChannelName;
  verify(req: Request): Promise<boolean>;
  parseWebhook(req: Request): Promise<ParsedInbound[]>;
  send(to: string, msg: OutboundMessage): Promise<void>;
}
