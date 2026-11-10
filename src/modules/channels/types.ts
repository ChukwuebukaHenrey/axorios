import type { WebhookProvider } from "@/lib/webhook-events";

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
  /** WhatsApp only: free-form replies are allowed until this time. */
  windowEndsAt?: string;
};

export type OutboundMessage = { text: string; mediaUrl?: string };

export interface Channel {
  name: ChannelName;
  /** The `webhook_events.provider` this adapter's deliveries are stored under. */
  webhookProvider: WebhookProvider;
  verify(req: Request): Promise<boolean>;
  parseWebhook(req: Request): Promise<ParsedInbound[]>;
  send(to: string, msg: OutboundMessage): Promise<void>;
  /** Shows the buyer that a reply is on its way ("typing…"). Optional: not every channel has it. */
  typing?(to: string): Promise<void>;
  /** Pre-approved message, the only kind WhatsApp allows once the 24 h window has closed. */
  sendTemplate?(to: string, template: { name: string; language: string }): Promise<void>;
}
