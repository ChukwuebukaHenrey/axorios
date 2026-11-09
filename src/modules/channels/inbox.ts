import "server-only";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { deliver } from "./deliver";
import { ChannelPausedError, WindowClosedError } from "./errors";
import { isChannelEnabled } from "./registry";
import { findTemplate, windowOpen } from "./whatsapp-templates";
import type { ChannelName } from "./types";

export type InboxRole = "customer" | "agent" | "seller";

export type InboxConversation = {
  id: string;
  channel: ChannelName;
  customerRef: string;
  contactId: string | null;
  agentPaused: boolean;
  lastMessageAt: string;
  lastMessage: { role: InboxRole; body: string } | null;
  canReply: boolean;
  /** WhatsApp only: free-form replies are allowed until then; after it, only templates. */
  windowEndsAt: string | null;
};

export type ReplyResult = { ok: true } | { ok: false; reason: "credits" | "window" | "failed" };

export type InboxMessage = { id: string; role: InboxRole; body: string; createdAt: string };

/** Every chat for this store, newest activity first, with its latest message for the list preview. */
export async function listConversations(storeId: string, limit = 50): Promise<InboxConversation[]> {
  const db = serviceRoleClient();
  const { data, error } = await db
    .from("conversations")
    .select("id, channel, customer_ref, contact_id, agent_paused, last_message_at, whatsapp_window_ends_at")
    .eq("store_id", storeId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Conversation list failed: ${error.code}`);
  if (data.length === 0) return [];

  const { data: messages, error: messageError } = await db
    .from("messages")
    .select("conversation_id, role, body, created_at")
    .eq("store_id", storeId)
    .in(
      "conversation_id",
      data.map((c) => c.id),
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (messageError) throw new Error(`Message read failed: ${messageError.code}`);

  const latest = new Map<string, { role: InboxRole; body: string }>();
  for (const m of messages) {
    if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, { role: m.role as InboxRole, body: m.body });
  }

  return data.map((c) => ({
    id: c.id,
    channel: c.channel as ChannelName,
    customerRef: c.customer_ref,
    contactId: c.contact_id,
    agentPaused: c.agent_paused,
    lastMessageAt: c.last_message_at,
    lastMessage: latest.get(c.id) ?? null,
    canReply: isChannelEnabled(c.channel as ChannelName),
    windowEndsAt: c.channel === "whatsapp" ? c.whatsapp_window_ends_at : null,
  }));
}

/** Chats whose latest message is the customer's and the seller has taken over: nobody else will answer them. */
export function waitingCount(conversations: InboxConversation[]): number {
  return conversations.filter((c) => c.lastMessage?.role === "customer" && c.agentPaused).length;
}

export async function conversationMessages(storeId: string, conversationId: string, limit = 100): Promise<InboxMessage[]> {
  const { data, error } = await serviceRoleClient()
    .from("messages")
    .select("id, role, body, created_at")
    .eq("store_id", storeId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Message read failed: ${error.code}`);
  return data.reverse().map((m) => ({ id: m.id, role: m.role as InboxRole, body: m.body, createdAt: m.created_at }));
}

/** Takeover: while paused, the chat-reply job stays silent and only the seller answers. */
export async function setAgentPaused(storeId: string, conversationId: string, paused: boolean): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("conversations")
    .update({ agent_paused: paused })
    .eq("store_id", storeId)
    .eq("id", conversationId);
  if (error) throw new Error(`Takeover failed: ${error.code}`);
}

type Outgoing = { text: string } | { template: string };

/**
 * Sends the seller's own reply (text, or a WhatsApp template after the 24 h window) on the customer's channel and
 * records it. Only allowed after takeover. Never throws for delivery problems: the Inbox shows the reason.
 */
export async function sendSellerReply(storeId: string, conversationId: string, out: Outgoing): Promise<ReplyResult> {
  const db = serviceRoleClient();
  const { data: conversation, error } = await db
    .from("conversations")
    .select("channel, customer_ref, agent_paused, whatsapp_window_ends_at")
    .eq("store_id", storeId)
    .eq("id", conversationId)
    .single();
  if (error) throw new Error(`Conversation read failed: ${error.code}`);
  if (!conversation.agent_paused) throw new Error("Take over the chat before replying");

  const channel = conversation.channel as ChannelName;
  let body: string;
  try {
    if ("template" in out) {
      const template = findTemplate(out.template);
      if (channel !== "whatsapp" || !template) throw new Error("Unknown template");
      await deliver(storeId, channel, conversation.customer_ref, { template });
      body = `[${template.name}]`;
    } else {
      if (channel === "whatsapp" && !windowOpen(conversation.whatsapp_window_ends_at)) return { ok: false, reason: "window" };
      await deliver(storeId, channel, conversation.customer_ref, { text: { text: out.text } });
      body = out.text;
    }
  } catch (e) {
    if (e instanceof ChannelPausedError) return { ok: false, reason: "credits" };
    if (e instanceof WindowClosedError) return { ok: false, reason: "window" };
    console.warn(`[inbox] reply failed: ${e instanceof Error ? e.message : "unknown"}`);
    return { ok: false, reason: "failed" };
  }

  const now = new Date().toISOString();
  const { error: insertError } = await db
    .from("messages")
    .insert({ store_id: storeId, conversation_id: conversationId, role: "seller", body, created_at: now });
  if (insertError) throw new Error(`Message save failed: ${insertError.code}`);
  await db.from("conversations").update({ last_message_at: now }).eq("store_id", storeId).eq("id", conversationId);
  return { ok: true };
}

/** The conversation an order came from: the same contact, or the same chat on the same channel. */
export async function conversationForOrder(storeId: string, order: { channel: string; customer_ref: string | null; contact_id: string | null }): Promise<string | null> {
  const db = serviceRoleClient();
  if (order.contact_id) {
    const { data } = await db.from("conversations").select("id").eq("store_id", storeId).eq("contact_id", order.contact_id).order("last_message_at", { ascending: false }).limit(1);
    if (data?.[0]) return data[0].id;
  }
  if (!order.customer_ref || order.channel === "web") return null;
  const { data } = await db.from("conversations").select("id").eq("store_id", storeId).eq("channel", order.channel).eq("customer_ref", order.customer_ref).limit(1);
  return data?.[0]?.id ?? null;
}
