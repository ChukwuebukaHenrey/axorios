import { z } from "zod";
import type { ParsedInbound } from "./types";

/** `/start` alone, or `/start <payload>` from a t.me deep link. */
const START = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

const UpdateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      chat: z.object({ id: z.number().int(), type: z.string() }),
      text: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
});

/** One private-chat message in vendor-neutral form. Groups, channels, edits and anything malformed give nothing. */
export function parseTelegramUpdate(json: unknown, receivedAt: string): ParsedInbound[] {
  const update = UpdateSchema.safeParse(json);
  if (!update.success) return [];
  const { update_id: updateId, message } = update.data;
  if (!message || message.chat.type !== "private") return [];

  const text = message.text ?? message.caption;
  const start = text?.match(START)?.[1];
  const isStart = text !== undefined && START.test(text);
  return [
    {
      channel: "telegram",
      eventId: String(updateId),
      customerRef: String(message.chat.id),
      ...(isStart ? { start: { slug: start && SLUG.test(start) ? start : null } } : { text }),
      receivedAt,
    },
  ];
}
