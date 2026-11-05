import "server-only";
import { getChannel, type ParsedInbound } from "@/modules/channels";
import { CHAT_MESSAGE_RECEIVED, inngest } from "./client";

/** Spike 0.3: echoes the message. Step 3.1 replaces the echo with the sales agent. */
export const chatReply = inngest.createFunction(
  { id: "chat-reply", triggers: [{ event: CHAT_MESSAGE_RECEIVED }] },
  async ({ event, step }) => {
    const message = event.data as ParsedInbound;
    await step.run("send-reply", () =>
      getChannel(message.channel).send(message.customerRef, { text: `Echo: ${message.text ?? "(no text)"}` }),
    );
  },
);
