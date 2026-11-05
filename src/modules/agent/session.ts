import "server-only";
import type { UIMessage } from "ai";
import type { Json } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";

export async function loadSellerSession(storeId: string): Promise<UIMessage[]> {
  const { data, error } = await serviceRoleClient()
    .from("agent_sessions")
    .select("messages")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Session read failed: ${error.code}`);
  return (data?.messages as unknown as UIMessage[] | undefined) ?? [];
}

export async function saveSellerSession(storeId: string, messages: UIMessage[]): Promise<void> {
  const db = serviceRoleClient();
  const payload = messages as unknown as Json;
  const { data } = await db.from("agent_sessions").select("id").eq("store_id", storeId).limit(1).maybeSingle();
  const { error } = data
    ? await db.from("agent_sessions").update({ messages: payload }).eq("id", data.id)
    : await db.from("agent_sessions").insert({ store_id: storeId, messages: payload });
  if (error) throw new Error(`Session save failed: ${error.code}`);
}
