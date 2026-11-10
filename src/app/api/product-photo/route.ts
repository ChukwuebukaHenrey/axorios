import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { env } from "@/lib/env";
import { storeChoice } from "@/lib/store-cookie";
import { createServerSupabase } from "@/lib/supabase/server";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { consumeDailyRequest } from "@/modules/agent";
import { getOrCreateStore } from "@/modules/brand";
import { buildPhotoPrompt, parsePhotoShortcut } from "@/modules/creative/photo-shortcuts";
import { MAX_MEDIA_BYTES, sniff } from "@/modules/media";

export const maxDuration = 60;
const Body = z.object({ mediaId: z.uuid(), command: z.string().trim().min(2).max(550) });

const reply = (message: string, status: number) => Response.json({ message }, { status });

/**
 * Changes the setting of an ORIGINAL photo uploaded to the account's media library.
 * Generated results are returned to the browser only, never saved as reusable source media.
 * All ownership and provenance checks happen again on the server.
 */
export async function POST(request: Request) {
  if (process.env.PHOTO_SHORTCUTS_ENABLED !== "true") {
    return reply("Product photography is not enabled yet. Enable PHOTO_SHORTCUTS_ENABLED once the image model's billing and quota are configured.", 503);
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply("Sign in to generate product photos.", 401);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply("Select a photo shortcut and an original uploaded product image.", 400);
  const instruction = parsePhotoShortcut(parsed.data.command);
  if (!instruction) return reply("Choose /whitebg, /flatlay, /inuse, /billboard or /seasonal.", 400);

  let prompt: string;
  try {
    prompt = buildPhotoPrompt(instruction);
  } catch (error) {
    return reply(error instanceof Error ? error.message : "Invalid shortcut.", 400);
  }

  // RLS plus owner_id prevents referencing another account's uploads.
  const { data: media, error: lookupError } = await supabase
    .from("media")
    .select("id, url, owner_id, store_id, source, kind")
    .eq("id", parsed.data.mediaId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (lookupError) return reply("Unable to verify the source photo.", 500);
  if (!media || media.kind !== "image" || media.source !== "upload") {
    return reply("Upload the original product photograph. Generated images cannot be reused as the source.", 400);
  }

  // Resolve the known storage location, never fetch an arbitrary URL from request or database.
  const marker = "/object/public/store-assets/";
  const path = decodeURIComponent(media.url.split(marker)[1] ?? "");
  if (!path.startsWith(`owners/${user.id}/media/${media.id}--`) || path.includes("..")) {
    return reply("That photo does not belong to an original account upload.", 400);
  }

  const { data: file, error: downloadError } = await serviceRoleClient().storage.from("store-assets").download(path);
  if (downloadError || !file) return reply("Original photo could not be loaded.", 404);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length || bytes.byteLength > MAX_MEDIA_BYTES) return reply("Original photo must be under 4 MB.", 413);
  const format = sniff(bytes);
  if (!format || !["image/jpeg", "image/png", "image/webp"].includes(format.mime)) {
    return reply("Upload a JPG, PNG or WebP original product photo.", 415);
  }

  // Reuse the store's existing daily request cap before spending image-model quota.
  const storeId = media.store_id ?? (await getOrCreateStore(supabase, user.id, await storeChoice())).id;
  if (!(await consumeDailyRequest(storeId))) return reply("Today's AI request limit has been reached.", 429);

  const e = env();
  const model = encodeURIComponent(e.GEMINI_IMAGE_MODEL);
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": e.GOOGLE_GENERATIVE_AI_API_KEY },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: prompt }, {
            inline_data: { mime_type: format.mime, data: Buffer.from(bytes).toString("base64") },
          }],
        }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          responseFormat: { image: { aspectRatio: "1:1", imageSize: "1K" } },
        },
      }),
      signal: AbortSignal.timeout(52_000),
      cache: "no-store",
    });
  } catch {
    return reply("The image service did not respond. Please try again.", 504);
  }
  if (!response.ok) {
    // Never echo provider errors: they may contain account or prompt data.
    if (response.status === 429) return reply("Image generation quota reached. Try again later.", 429);
    if ([400, 403, 404].includes(response.status)) return reply("The configured Gemini image model is unavailable. Check GEMINI_IMAGE_MODEL and billing.", 503);
    return reply("The image model could not create this image.", 502);
  }

  const generated = await response.json().catch(() => null) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[];
  } | null;
  const parts = generated?.candidates?.[0]?.content?.parts ?? [];
  const encoded = parts.map((part) => part.inlineData?.data ?? part.inline_data?.data).find(Boolean);
  if (!encoded) return reply("No image was returned by the model. Try a different scene.", 502);

  try {
    const raw = Buffer.from(encoded, "base64");
    if (raw.byteLength > 15 * 1024 * 1024) return reply("Generated image is too large.", 502);
    // Square, full composition, no crop. PNG avoids further lossy changes to any printed text.
    const png = await sharp(raw, { limitInputPixels: 20_000_000 })
      .resize(1024, 1024, { fit: "contain", background: "#ffffff" })
      .png()
      .toBuffer();
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="product-photo.png"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return reply("The image response could not be processed.", 502);
  }
}
