"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteMedia, MediaError, setMediaTags } from "@/modules/media";
import { requireSeller } from "../../session";

export type ActionResult = { ok: true; tags?: string[] } | { ok: false; error: string; detail?: string[] };

const Id = z.uuid();
const Tags = z.array(z.string().max(64)).max(40);

/** The session's client does the work, so RLS limits every row to the signed-in owner. */
async function run(fn: (ctx: Awaited<ReturnType<typeof requireSeller>>) => Promise<string[] | void>): Promise<ActionResult> {
  const ctx = await requireSeller();
  try {
    const tags = await fn(ctx);
    revalidatePath("/dashboard/design");
    return { ok: true, ...(tags ? { tags } : {}) };
  } catch (e) {
    if (e instanceof MediaError) return { ok: false, error: e.message, detail: e.detail };
    console.error(e);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export const saveTags = async (id: string, tags: string[]) =>
  run(({ supabase }) => setMediaTags(supabase, Id.parse(id), Tags.parse(tags)));

export const removeMedia = async (id: string) => run(({ supabase, user }) => deleteMedia(supabase, user.id, Id.parse(id)));
