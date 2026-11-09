import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ParsedInbound } from "./types";

/** WhatsApp's customer-service window: free-form replies are allowed for 24 h after the customer's last message. */
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export const KAPSO_MESSAGE_RECEIVED = "whatsapp.message.received";

/** `start <slug>` (or `/start <slug>`) from the store's WhatsApp link binds the chat, like Telegram's deep link. */
const START = /^\/?start(?:\s+(\S+))?\s*$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Kapso signs the raw body with HMAC-SHA256 and sends the hex digest in `X-Webhook-Signature`. */
export function verifyKapsoSignature(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature.trim().replace(/^sha256=/, ""), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const MessageEvent = z.object({
  message: z.object({
    id: z.string().min(1),
    timestamp: z.string().optional(),
    type: z.string(),
    from: z.string().optional(),
    from_user_id: z.string().optional(),
    text: z.object({ body: z.string() }).optional(),
    kapso: z.object({ direction: z.string().optional(), content: z.string().optional() }).optional(),
  }),
  conversation: z.object({ phone_number: z.string().optional(), business_scoped_user_id: z.string().optional() }).optional(),
});

/** Prefer the phone number; some payloads carry only a business-scoped user ID, which Kapso sends to as `recipient`. */
function customerRef(e: z.infer<typeof MessageEvent>): string | null {
  const phone = e.message.from ?? e.conversation?.phone_number;
  if (phone) return phone.replace(/^\+/, "");
  const bsuid = e.message.from_user_id ?? e.conversation?.business_scoped_user_id;
  return bsuid ? `bsuid:${bsuid}` : null;
}

function toInbound(item: unknown, receivedAt: string): ParsedInbound | null {
  const parsed = MessageEvent.safeParse(item);
  if (!parsed.success) return null;
  const e = parsed.data;
  if (e.message.kapso?.direction && e.message.kapso.direction !== "inbound") return null;
  const ref = customerRef(e);
  if (!ref) return null;

  const seconds = Number(e.message.timestamp);
  const sentAt = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : receivedAt;
  const text = e.message.type === "text" ? e.message.text?.body : undefined;
  const start = text?.trim().match(START);
  return {
    channel: "whatsapp",
    eventId: e.message.id,
    customerRef: ref,
    ...(start ? { start: { slug: start[1] && SLUG.test(start[1].toLowerCase()) ? start[1].toLowerCase() : null } } : { text }),
    receivedAt,
    windowEndsAt: new Date(new Date(sentAt).getTime() + WHATSAPP_WINDOW_MS).toISOString(),
  };
}

/** Inbound customer messages from one delivery, buffered (`batch: true`) or not. Other events and junk give nothing. */
export function parseKapsoWebhook(json: unknown, event: string | null, receivedAt: string): ParsedInbound[] {
  if (event !== KAPSO_MESSAGE_RECEIVED || !json || typeof json !== "object") return [];
  const body = json as { batch?: unknown; data?: unknown };
  const items = body.batch === true && Array.isArray(body.data) ? body.data : [json];
  return items.map((item) => toInbound(item, receivedAt)).filter((m): m is ParsedInbound => m !== null);
}

export type KapsoFailure = "credits" | "window" | "other";

/** Kapso's 402 means the project can't pay Meta's fee; 422 with 131047 means the 24 h window has closed. */
export function classifyKapsoFailure(status: number, body: unknown): KapsoFailure {
  if (status === 402) return "credits";
  const error = (body as { error?: unknown } | null)?.error;
  const code = typeof error === "object" && error ? (error as { code?: unknown }).code : (body as { code?: unknown } | null)?.code;
  if (status === 422 && code === 131047) return "window";
  return "other";
}
