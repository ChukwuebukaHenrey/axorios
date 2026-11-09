import type { UIMessage } from "ai";
import { z } from "zod";
import { storeChoice } from "@/lib/store-cookie";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  consumeDailyRequest,
  ContextChipsSchema,
  describeContext,
  getThread,
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
  /** An Axori AI thread. Without one, the storefront editor's session is used. */
  threadId: z.uuid().optional(),
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
  const { messages, threadId, context = [], selectedSectionId } = body.data;

  // RLS on ai_threads: a thread id from another owner reads as nothing.
  const thread = threadId ? await getThread(supabase, threadId) : null;
  if (threadId && !thread) return Response.json({ error: "not_found" }, { status: 404 });

  // The store comes from the thread (owner-checked) or the session's selected store, never from the model.
  const store = thread?.storeId ? { id: thread.storeId } : await getOrCreateStore(supabase, user.id, await storeChoice());
  if (!(await consumeDailyRequest(store.id))) return Response.json({ error: "daily_limit" }, { status: 429 });

  if (thread) {
    const save = (finished: UIMessage[]) => saveThread(thread.id, user.id, finished);
    if (thread.storeId === null) return runAccountAgent(user.id, messages, save);
    return runSellerAgent(store.id, messages, { pageContext: await describeContext(store.id, context), save });
  }
  return runSellerAgent(store.id, messages, { selectedSectionId });
}
