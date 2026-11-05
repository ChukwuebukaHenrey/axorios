import { Inngest } from "inngest";

/** Lives in lib so a module can queue work without importing the jobs that import it. */
export const inngest = new Inngest({ id: "axorios" });

export const CHAT_MESSAGE_RECEIVED = "chat/message.received";
export const PAYPAL_EVENT_RECEIVED = "payments/paypal.event.received";
export const CREATIVE_GENERATE = "creative/campaign.generate";
export const POST_PUBLISH = "publishers/post.publish";
