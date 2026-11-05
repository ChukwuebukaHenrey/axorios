import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { env } from "@/lib/env";
import { CREATIVE_GENERATE, inngest, POST_PUBLISH } from "@/lib/inngest";
import { formatMinor } from "@/lib/money";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { getBrandKit } from "@/modules/brand";
import { listProducts } from "@/modules/catalog";
import { composeCaption, imagePrompt, MAX_POSTS_PER_CAMPAIGN, suggestedTimes, type PostCopy } from "./copy";
import { imageProvider } from "./registry";

export type Post = Database["public"]["Tables"]["posts"]["Row"];

/** Inngest sleeps for at most 7 days on the free tier. */
export const MAX_SCHEDULE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;
const IMAGE_SIZE = { width: 1080, height: 1080 };

export class ScheduleError extends Error {
  constructor(public readonly code: "post_not_found" | "post_not_ready" | "time_in_past" | "time_too_far" | "no_targets") {
    super(code);
  }
}

/** Creates the posts as skeletons and queues the job. The seller sees them fill in as the job finishes. */
export async function queueCampaign(storeId: string, brief: string, count: number): Promise<{ campaignId: string; count: number }> {
  const total = Math.min(Math.max(count, 1), MAX_POSTS_PER_CAMPAIGN);
  const campaignId = randomUUID();
  const db = serviceRoleClient();
  const { error } = await db
    .from("posts")
    .insert(Array.from({ length: total }, () => ({ store_id: storeId, campaign_id: campaignId, status: "generating" })));
  if (error) throw new Error(`Post create failed: ${error.code}`);

  await inngest.send({ id: `creative-${campaignId}`, name: CREATIVE_GENERATE, data: { storeId, campaignId, brief } });
  return { campaignId, count: total };
}

export async function campaignPostIds(storeId: string, campaignId: string): Promise<string[]> {
  const { data, error } = await serviceRoleClient()
    .from("posts")
    .select("id")
    .eq("store_id", storeId)
    .eq("campaign_id", campaignId)
    .eq("status", "generating")
    .order("id");
  if (error) throw new Error(`Post read failed: ${error.code}`);
  return data.map((p) => p.id);
}

/** Renders one post's image, stores it, and turns the skeleton into a draft. */
export async function finishPost(storeId: string, postId: string, copy: PostCopy, index: number, total: number): Promise<void> {
  const kit = await getBrandKit(storeId);
  if (!kit) throw new Error("Store has no brand kit");

  const db = serviceRoleClient();
  const { data: store, error: storeError } = await db.from("stores").select("slug, status").eq("id", storeId).single();
  if (storeError) throw new Error(`Store read failed: ${storeError.code}`);

  // Only this store's products can be featured, and the price comes from its row, whatever the model wrote.
  const product = (await listProducts(storeId)).find((p) => p.id === copy.productId);
  const priceLabel = product && formatMinor(product.priceMinor, product.currency);

  const image = await imageProvider().generate({
    prompt: imagePrompt(kit, copy),
    referenceImages: kit.referenceImageUrls,
    size: IMAGE_SIZE,
    brand: kit,
    headline: copy.headline,
    subline: copy.subline,
    priceLabel,
    productImageUrl: product?.imageUrl,
    variant: index,
  });

  const path = `stores/${storeId}/posts/${postId}.png`;
  const { error: uploadError } = await db.storage
    .from("store-assets")
    .upload(path, image.bytes, { contentType: image.contentType, upsert: true });
  if (uploadError) throw new Error("Post image upload failed");
  const { publicUrl } = db.storage.from("store-assets").getPublicUrl(path).data;

  const link = store.status === "live" ? `${env().NEXT_PUBLIC_APP_URL}/s/${store.slug}` : "";
  const caption = composeCaption(copy.caption, [product ? `${product.name}: ${priceLabel}` : "", link]);
  const { error } = await db
    .from("posts")
    .update({
      caption,
      media_url: publicUrl,
      status: "draft",
      suggested_at: suggestedTimes(total, new Date())[index]?.toISOString(),
    })
    .eq("id", postId)
    .eq("store_id", storeId);
  if (error) throw new Error(`Post update failed: ${error.code}`);
}

export async function failGeneratingPosts(storeId: string, campaignId: string): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("posts")
    .update({ status: "failed" })
    .eq("store_id", storeId)
    .eq("campaign_id", campaignId)
    .eq("status", "generating");
  if (error) throw new Error(`Post update failed: ${error.code}`);
}

/** Uses the caller's session client, so row-level security also limits it to the signed-in owner. */
export async function listPosts(supabase: SupabaseClient<Database>, storeId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`Post list failed: ${error.code}`);
  return data;
}

/** What the seller agent needs to talk about posts. Service role, so it must be given a storeId from the session. */
export async function draftPosts(storeId: string): Promise<Post[]> {
  const { data, error } = await serviceRoleClient()
    .from("posts")
    .select("*")
    .eq("store_id", storeId)
    .in("status", ["generating", "draft", "scheduled"])
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(`Post list failed: ${error.code}`);
  return data;
}

export async function updatePostCaption(storeId: string, postId: string, caption: string): Promise<void> {
  const { data, error } = await serviceRoleClient()
    .from("posts")
    .update({ caption })
    .eq("id", postId)
    .eq("store_id", storeId)
    .in("status", ["draft", "failed", "scheduled"])
    .select("id");
  if (error) throw new Error(`Caption update failed: ${error.code}`);
  if (data.length === 0) throw new ScheduleError("post_not_ready");
}

/**
 * Runs only after the seller has approved. Schedules each post and queues its publish job.
 * A later reschedule queues another job; the earlier one wakes, sees a different time and does nothing.
 */
export async function schedulePosts(
  storeId: string,
  items: { postId: string; scheduledAt: string }[],
  targets: string[],
  now = new Date(),
): Promise<{ postId: string; scheduledAt: string }[]> {
  if (targets.length === 0) throw new ScheduleError("no_targets");
  const db = serviceRoleClient();
  const done: { postId: string; scheduledAt: string }[] = [];

  for (const { postId, scheduledAt } of items) {
    const at = new Date(scheduledAt);
    if (!(at.getTime() > now.getTime() - 30_000)) throw new ScheduleError("time_in_past");
    if (at.getTime() - now.getTime() > MAX_SCHEDULE_AHEAD_MS) throw new ScheduleError("time_too_far");

    const { data: post, error } = await db
      .from("posts")
      .select("id, status, media_url")
      .eq("id", postId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw new Error(`Post read failed: ${error.code}`);
    if (!post) throw new ScheduleError("post_not_found");
    if (!post.media_url || !["draft", "failed", "scheduled"].includes(post.status)) throw new ScheduleError("post_not_ready");

    const iso = at.toISOString();
    const { error: updateError } = await db
      .from("posts")
      .update({ status: "scheduled", scheduled_at: iso, targets, publish_results: {} })
      .eq("id", postId)
      .eq("store_id", storeId);
    if (updateError) throw new Error(`Post schedule failed: ${updateError.code}`);

    await inngest.send({
      id: `post-${postId}-${at.getTime()}`,
      name: POST_PUBLISH,
      data: { storeId, postId, scheduledAt: iso },
    });
    done.push({ postId, scheduledAt: iso });
  }
  return done;
}

/** Takes a post back to draft. Its waiting job wakes, sees the status and does nothing. */
export async function unschedulePost(storeId: string, postId: string): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("posts")
    .update({ status: "draft", scheduled_at: null })
    .eq("id", postId)
    .eq("store_id", storeId)
    .eq("status", "scheduled");
  if (error) throw new Error(`Post update failed: ${error.code}`);
}

/** The post, if it is still due at this exact time. Null means it was cancelled, rescheduled or already done. */
export async function duePost(storeId: string, postId: string, scheduledAt: string): Promise<Post | null> {
  const { data, error } = await serviceRoleClient()
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(`Post read failed: ${error.code}`);
  if (!data || data.status !== "scheduled" || !data.scheduled_at) return null;
  return new Date(data.scheduled_at).getTime() === new Date(scheduledAt).getTime() ? data : null;
}

/** Saves after each target, so a retry never posts to the same place twice. */
export async function savePublishResults(storeId: string, postId: string, results: Record<string, unknown>): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("posts")
    .update({ publish_results: results as Json })
    .eq("id", postId)
    .eq("store_id", storeId);
  if (error) throw new Error(`Post update failed: ${error.code}`);
}

export async function finishPublish(storeId: string, postId: string, status: "published" | "failed", error?: string): Promise<void> {
  const db = serviceRoleClient();
  const patch: Database["public"]["Tables"]["posts"]["Update"] = { status };
  if (error) {
    const { data } = await db.from("posts").select("publish_results").eq("id", postId).eq("store_id", storeId).maybeSingle();
    patch.publish_results = { ...(data?.publish_results as Record<string, Json> | null), error };
  }
  const { error: updateError } = await db.from("posts").update(patch).eq("id", postId).eq("store_id", storeId);
  if (updateError) throw new Error(`Post update failed: ${updateError.code}`);
}
