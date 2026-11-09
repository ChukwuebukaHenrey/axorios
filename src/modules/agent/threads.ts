import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import type { Database, Json } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { loadSellerSession } from "./session";

export type ThreadSummary = { id: string; title: string; storeId: string | null; updatedAt: string; waiting: number };
export type Thread = ThreadSummary & { messages: UIMessage[] };

const NEW_TITLE = "New chat";
const LEGACY_TITLE = "Store setup";

/** Tool parts the seller still has to answer: what the top bar's Approvals badge counts. */
export function waitingApprovals(messages: UIMessage[]): number {
  return messages.flatMap((m) => m.parts).filter((p) => (p as { state?: string }).state === "approval-requested").length;
}

/** First words of the seller's first message, as the thread's topic. */
export function titleFrom(messages: UIMessage[]): string | null {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts.find((p) => p.type === "text") as { text?: string } | undefined;
  const clean = text?.text?.replace(/\s+/g, " ").trim();
  if (!clean) return first ? "Voice note" : null;
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

function summary(row: { id: string; title: string; store_id: string | null; updated_at: string; messages: Json }): Thread {
  const messages = (row.messages as unknown as UIMessage[]) ?? [];
  return { id: row.id, title: row.title, storeId: row.store_id, updatedAt: row.updated_at, waiting: waitingApprovals(messages), messages };
}

/**
 * The account's threads plus the selected store's, newest first. Session client: RLS limits rows to the owner.
 * The store's old single builder session becomes its first thread, once.
 */
export async function listThreads(supabase: SupabaseClient<Database>, ownerId: string, storeId: string): Promise<ThreadSummary[]> {
  const read = () =>
    supabase
      .from("ai_threads")
      .select("id, title, store_id, updated_at, messages")
      .eq("owner_id", ownerId)
      .or(`store_id.is.null,store_id.eq.${storeId}`)
      .order("updated_at", { ascending: false })
      .limit(40);
  let { data, error } = await read();
  if (error || !data) throw new Error(`Thread list failed: ${error?.code}`);

  if (!data.some((t) => t.store_id === storeId)) {
    const legacy = await loadSellerSession(storeId);
    if (legacy.length > 0) {
      await supabase.from("ai_threads").insert({ owner_id: ownerId, store_id: storeId, title: LEGACY_TITLE, messages: legacy as unknown as Json });
      ({ data, error } = await read());
      if (error || !data) throw new Error(`Thread list failed: ${error?.code}`);
    }
  }
  return data.map((row) => {
    const { id, title, storeId, updatedAt, waiting } = summary(row);
    return { id, title, storeId, updatedAt, waiting };
  });
}

export async function getThread(supabase: SupabaseClient<Database>, threadId: string): Promise<Thread | null> {
  const { data, error } = await supabase.from("ai_threads").select("id, title, store_id, updated_at, messages").eq("id", threadId).maybeSingle();
  if (error) throw new Error(`Thread read failed: ${error.code}`);
  return data ? summary(data) : null;
}

/** storeId null = an account thread, for ideas before a store exists. */
export async function createThread(supabase: SupabaseClient<Database>, ownerId: string, storeId: string | null): Promise<string> {
  const { data, error } = await supabase.from("ai_threads").insert({ owner_id: ownerId, store_id: storeId, title: NEW_TITLE }).select("id").single();
  if (error) throw new Error(`Thread create failed: ${error.code}`);
  return data.id;
}

export async function deleteThread(supabase: SupabaseClient<Database>, threadId: string): Promise<void> {
  const { error } = await supabase.from("ai_threads").delete().eq("id", threadId);
  if (error) throw new Error(`Thread delete failed: ${error.code}`);
}

/** Runs after the stream ends, outside the request's cookies, so it uses the service role, pinned to the owner. */
export async function saveThread(threadId: string, ownerId: string, all: UIMessage[]): Promise<void> {
  // A turn the seller left mid-stream ends as an assistant message with nothing in it; don't keep those.
  const messages = all.filter((m) => m.role !== "assistant" || m.parts.length > 0);
  const db = serviceRoleClient();
  const { data } = await db.from("ai_threads").select("title").eq("id", threadId).eq("owner_id", ownerId).maybeSingle();
  if (!data) return;
  const title = data.title === NEW_TITLE ? (titleFrom(messages) ?? NEW_TITLE) : data.title;
  const { error } = await db
    .from("ai_threads")
    .update({ messages: messages as unknown as Json, title })
    .eq("id", threadId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(`Thread save failed: ${error.code}`);
}
