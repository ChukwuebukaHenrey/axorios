import { z } from "zod";
import type { ParsedInbound } from "./types";

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
  return [
    {
      channel: "telegram",
      eventId: String(updateId),
      customerRef: String(message.chat.id),
      text: message.text ?? message.caption,
      receivedAt,
    },
  ];
}
