"use server";

import { storeChoice } from "@/lib/store-cookie";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { listPosts, ScheduleError, schedulePosts, unschedulePost, updatePostCaption } from "@/modules/creative";
import { publishTargets } from "@/modules/publishers";

/** The store comes from the session, never from the browser. */
async function sessionStore() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, store: await getOrCreateStore(supabase, user.id, await storeChoice()) };
}

const PostId = z.uuid();
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveCaption(postId: string, caption: string): Promise<ActionResult> {
  const { store } = await sessionStore();
  const text = z.string().trim().min(1).max(1024).safeParse(caption);
  if (!text.success) return { ok: false, error: "invalid_caption" };
  try {
    await updatePostCaption(store.id, PostId.parse(postId), text.data);
  } catch (error) {
    if (error instanceof ScheduleError) return { ok: false, error: error.code };
    throw error;
  }
  revalidatePath("/dashboard/campaigns");
  return { ok: true };
}

/** The seller pressing this button is the approval. */
export async function approveAndSchedule(postId: string, scheduledAt: string): Promise<ActionResult> {
  const { store } = await sessionStore();
  const at = z.iso.datetime().safeParse(scheduledAt);
  if (!at.success) return { ok: false, error: "time_in_past" };
  try {
    await schedulePosts(store.id, [{ postId: PostId.parse(postId), scheduledAt: at.data }], await publishTargets(store.id));
  } catch (error) {
    if (error instanceof ScheduleError) return { ok: false, error: error.code };
    throw error;
  }
  revalidatePath("/dashboard/campaigns");
  return { ok: true };
}

export async function cancelSchedule(postId: string): Promise<void> {
  const { store } = await sessionStore();
  await unschedulePost(store.id, PostId.parse(postId));
  revalidatePath("/dashboard/campaigns");
}

/** For the chat's card, which fills in as the job finishes. */
export async function campaignStatus(campaignId: string) {
  const { supabase, store } = await sessionStore();
  const id = PostId.parse(campaignId);
  return (await listPosts(supabase, store.id))
    .filter((p) => p.campaign_id === id)
    .map((p) => ({ id: p.id, status: p.status, mediaUrl: p.media_url }));
}
