import "server-only";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { getChannel, isChannelEnabled } from "./registry";
import type { ChannelName } from "./types";

export type InboxRole = "customer" | "agent" | "seller";

export type InboxConversation = {
  id: string;
  channel: ChannelName;
  customerRef: string;
  agentPaused: boolean;
  lastMessageAt: string;
  lastMessage: { role: InboxRole; body: string } | null;
  canReply: boolean;
};

export type InboxMessage = { id: string; role: InboxRole; body: string; createdAt: string };

/** Every chat for this store, newest activity first, with its latest message for the list preview. */
export async function listConversations(storeId: string, limit = 50): Promise<InboxConversation[]> {
  const db = serviceRoleClient();
  const { data, error } = await db
    .from("conversations")
    .select("id, channel, customer_ref, agent_paused, last_message_at")
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
    agentPaused: c.agent_paused,
    lastMessageAt: c.last_message_at,
    lastMessage: latest.get(c.id) ?? null,
    canReply: isChannelEnabled(c.channel as ChannelName),
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

/** Sends the seller's own reply on the customer's channel and records it. Only allowed after takeover. */
export async function sendSellerReply(storeId: string, conversationId: string, body: string): Promise<void> {
  const db = serviceRoleClient();
  const { data: conversation, error } = await db
    .from("conversations")
    .select("channel, customer_ref, agent_paused")
    .eq("store_id", storeId)
    .eq("id", conversationId)
    .single();
  if (error) throw new Error(`Conversation read failed: ${error.code}`);
  if (!conversation.agent_paused) throw new Error("Take over the chat before replying");

  await getChannel(conversation.channel as ChannelName).send(conversation.customer_ref, { text: body });

  const now = new Date().toISOString();
  const { error: insertError } = await db
    .from("messages")
    .insert({ store_id: storeId, conversation_id: conversationId, role: "seller", body, created_at: now });
  if (insertError) throw new Error(`Message save failed: ${insertError.code}`);
  await db.from("conversations").update({ last_message_at: now }).eq("store_id", storeId).eq("id", conversationId);
}
