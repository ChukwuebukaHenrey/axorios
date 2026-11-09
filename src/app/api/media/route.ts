import { z } from "zod";
import { storeChoice } from "@/lib/store-cookie";
import { createServerSupabase } from "@/lib/supabase/server";
import { getThread } from "@/modules/agent";
import { getOrCreateStore } from "@/modules/brand";
import { MAX_MEDIA_BYTES, MediaError, uploadMedia } from "@/modules/media";

const FieldsSchema = z.object({
  threadId: z.uuid().optional(),
  note: z.string().max(300).optional(),
});

const STATUS: Record<MediaError["code"], number> = { too_large: 413, bad_type: 415, empty: 400, bad_input: 400, not_found: 404, in_use: 409 };

/**
 * Upload to the media library, from Axori AI or the Design tab. The store (for product tags) comes from the thread,
 * owner-checked by RLS, or from the session; an account thread's upload belongs to no store.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (Number(req.headers.get("content-length") ?? 0) > MAX_MEDIA_BYTES + 64 * 1024)
    return Response.json({ error: "too_large", message: "Files can be up to 4 MB." }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const fields = FieldsSchema.safeParse({
    threadId: form?.get("threadId") || undefined,
    note: form?.get("note") || undefined,
  });
  if (!(file instanceof File) || !fields.success) return Response.json({ error: "bad_request" }, { status: 400 });

  let storeId: string | null;
  if (fields.data.threadId) {
    const thread = await getThread(supabase, fields.data.threadId);
    if (!thread) return Response.json({ error: "not_found" }, { status: 404 });
    storeId = thread.storeId;
  } else {
    storeId = (await getOrCreateStore(supabase, user.id, await storeChoice())).id;
  }

  try {
    const item = await uploadMedia(supabase, user.id, storeId, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      note: fields.data.note,
    });
    return Response.json(item, { status: 201 });
  } catch (e) {
    if (e instanceof MediaError) return Response.json({ error: e.code, message: e.message }, { status: STATUS[e.code] });
    console.error(e);
    return Response.json({ error: "upload_failed" }, { status: 500 });
  }
}
