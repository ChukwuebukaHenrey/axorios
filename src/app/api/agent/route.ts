import type { UIMessage } from "ai";
import { z } from "zod";
import { storeChoice } from "@/lib/store-cookie";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  consumeDailyRequest,
  createThread,
  ContextChipsSchema,
  describeContext,
  getThread,
  hasSellerMessage,
  runAccountAgent,
  runSellerAgent,
  saveThread,
  voiceNotesFit,
} from "@/modules/agent";
import { getOrCreateStore } from "@/modules/brand";

export const maxDuration = 60;

const BodySchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1).max(200),
  selectedSectionId: z.string().max(40).optional(),
  /** An Axori AI thread. Without one, the store's older single builder session is used. */
  threadId: z.uuid().optional(),
  /**
   * Set by a chat that started as an unsaved draft: if `threadId` has no row yet, it is created here with the
   * seller's first message. Without it, an unknown thread id is a 404.
   */
  newThread: z.enum(["store", "account"]).optional(),
  context: ContextChipsSchema.optional(),
});

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = BodySchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!voiceNotesFit(body.data.messages)) return Response.json({ error: "voice_note_too_long" }, { status: 413 });
  const { messages, threadId, newThread, context = [], selectedSectionId } = body.data;

  // RLS on ai_threads: a thread id from another owner reads as nothing.
  let thread = threadId ? await getThread(supabase, threadId) : null;
  if (threadId && !thread && !newThread) return Response.json({ error: "not_found" }, { status: 404 });
  // A draft's first message must be the seller's own; nothing is saved for an empty chat.
  if (threadId && !thread && !hasSellerMessage(messages)) return Response.json({ error: "bad_request" }, { status: 400 });

  // The store comes from the thread (owner-checked) or the session's selected store, never from the model.
  const store = thread?.storeId ? { id: thread.storeId } : await getOrCreateStore(supabase, user.id, await storeChoice());
  if (!(await consumeDailyRequest(store.id))) return Response.json({ error: "daily_limit" }, { status: 429 });

  if (threadId && !thread) {
    thread = await createThread(supabase, user.id, newThread === "account" ? null : store.id, { id: threadId, messages });
    if (!thread) return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (thread) {
    const save = (finished: UIMessage[]) => saveThread(thread.id, user.id, finished);
    if (thread.storeId === null) return runAccountAgent(user.id, messages, save);
    return runSellerAgent(store.id, messages, { pageContext: await describeContext(store.id, context), save });
  }
  return runSellerAgent(store.id, messages, { selectedSectionId });
}
