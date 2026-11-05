import type { UIMessage } from "ai";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { consumeDailyRequest, runSellerAgent } from "@/modules/agent";
import { getOrCreateStore } from "@/modules/brand";

export const maxDuration = 60;

const BodySchema = z.object({ messages: z.array(z.custom<UIMessage>()).min(1).max(200) });

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = BodySchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const store = await getOrCreateStore(supabase, user.id);
  if (!(await consumeDailyRequest(store.id))) return Response.json({ error: "daily_limit" }, { status: 429 });

  return runSellerAgent(store.id, body.data.messages);
}
