import "server-only";
import { env } from "@/lib/env";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import type { ChannelName } from "./types";

export type BoundStore = { storeId: string; slug: string; brandKit: unknown; storeLanguage: string };

const STORE_COLUMNS = "id, slug, brand_kit, store_language";

type StoreRow = { id: string; slug: string; brand_kit: unknown; store_language: string };

const toBound = (s: StoreRow): BoundStore => ({
  storeId: s.id,
  slug: s.slug,
  brandKit: s.brand_kit,
  storeLanguage: s.store_language,
});

/** The link a store's chat button opens. Null when no bot is configured, and the store then shows no button. */
export function customerChatUrl(slug: string): string | null {
  const bot = env().TELEGRAM_BOT_USERNAME;
  return bot ? `https://t.me/${bot}?start=${encodeURIComponent(slug)}` : null;
}

/** Ties this chat to the live store the customer came from. Null when no live store has that slug. */
export async function bindCustomer(channel: ChannelName, customerRef: string, slug: string): Promise<BoundStore | null> {
  const db = serviceRoleClient();
  const { data: store, error } = await db.from("stores").select(STORE_COLUMNS).eq("slug", slug).eq("status", "live").maybeSingle();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  if (!store) return null;

  const { error: bindError } = await db
    .from("channel_bindings")
    .upsert(
      { channel, customer_ref: customerRef, store_id: store.id, bound_at: new Date().toISOString() },
      { onConflict: "channel,customer_ref" },
    );
  if (bindError) throw new Error(`Binding failed: ${bindError.code}`);
  return toBound(store);
}

/** The store this chat is bound to, if it is still live. This is the only way a chat learns its store. */
export async function boundStore(channel: ChannelName, customerRef: string): Promise<BoundStore | null> {
  const db = serviceRoleClient();
  const { data: binding, error } = await db
    .from("channel_bindings")
    .select("store_id")
    .eq("channel", channel)
    .eq("customer_ref", customerRef)
    .maybeSingle();
  if (error) throw new Error(`Binding read failed: ${error.code}`);
  if (!binding) return null;

  const { data: store, error: storeError } = await db
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("id", binding.store_id)
    .eq("status", "live")
    .maybeSingle();
  if (storeError) throw new Error(`Store read failed: ${storeError.code}`);
  return store && toBound(store);
}

export async function openConversation(storeId: string, channel: ChannelName, customerRef: string) {
  const { data, error } = await serviceRoleClient()
    .from("conversations")
    .upsert(
      { store_id: storeId, channel, customer_ref: customerRef, last_message_at: new Date().toISOString() },
      { onConflict: "store_id,channel,customer_ref" },
    )
    .select("id, agent_paused")
    .single();
  if (error) throw new Error(`Conversation open failed: ${error.code}`);
  return { conversationId: data.id, agentPaused: data.agent_paused };
}

export async function recordMessage(
  storeId: string,
  conversationId: string,
  role: "customer" | "agent" | "seller",
  body: string,
): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("messages")
    .insert({ store_id: storeId, conversation_id: conversationId, role, body });
  if (error) throw new Error(`Message save failed: ${error.code}`);
}

/** The latest messages, oldest first. */
export async function recentMessages(storeId: string, conversationId: string, limit = 20) {
  const { data, error } = await serviceRoleClient()
    .from("messages")
    .select("role, body")
    .eq("store_id", storeId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Message read failed: ${error.code}`);
  return data.reverse() as { role: "customer" | "agent" | "seller"; body: string }[];
}
