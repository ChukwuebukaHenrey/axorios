import sharp from "sharp";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { storeChoice } from "@/lib/store-cookie";
import { consumeDailyRequest } from "@/modules/agent";
import { env } from "@/lib/env";
import { MAX_MEDIA_BYTES, sniff } from "@/modules/media";
import { parsePhotoShortcut, photoPrompt } from "@/lib/product-photo-shortcuts";

export const maxDuration = 60;
const ImageFields = z.object({ command: z.string().trim().min(1).max(500) });

type GeminiResponse = {
  candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
  error?: { message?: string };
};

/**
 * Direct photo editing only. We never accept an earlier generated URL, media-library ID,
 * or model-selected reference. The user must select a photo from their device.
 * The source image is not replaced or stored with the generated result.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "Please sign in." }, { status: 401 });

  if (Number(req.headers.get("content-length") ?? 0) > MAX_MEDIA_BYTES + 16_384) {
    return Response.json({ message: "Upload an original photo up to 4 MB." }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const fields = ImageFields.safeParse({ command: form?.get("command") });
  const file = form?.get("photo");
  const parsed = fields.success ? parsePhotoShortcut(fields.data.command) : null;
  if (!(file instanceof File) || !parsed) return Response.json({ message: "Choose a shortcut and upload an original product photo." }, { status: 400 });
  if (parsed.shortcut === "/seasonal" && !parsed.details) return Response.json({ message: "Which season? For example: /seasonal summer." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_MEDIA_BYTES) return Response.json({ message: "Upload an original photo up to 4 MB." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const content = sniff(bytes);
  if (!content || content.kind !== "image" || !["image/jpeg", "image/png", "image/webp"].includes(content.mime)) {
    return Response.json({ message: "Use an original JPG, PNG, or WebP product photograph." }, { status: 415 });
  }
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata().catch(() => null);
  if (!metadata?.width || !metadata.height) return Response.json({ message: "That image could not be read." }, { status: 400 });

  // Existing store quota also applies to shortcut image generations.
  const store = await getOrCreateStore(supabase, user.id, await storeChoice());
  if (!(await consumeDailyRequest(store.id))) return Response.json({ message: "Today's AI request limit has been reached." }, { status: 429 });

  const { GOOGLE_GENERATIVE_AI_API_KEY: apiKey, GEMINI_IMAGE_MODEL: model } = env();
  if (!/^[a-zA-Z0-9_.-]*image[a-zA-Z0-9_.-]*$/.test(model)) {
    return Response.json({ message: "Image editing is not configured. Choose an image-capable Gemini model." }, { status: 503 });
  }

  const request = {
    contents: [{ role: "user", parts: [
      { text: photoPrompt(parsed) },
      { inlineData: { mimeType: content.mime, data: bytes.toString("base64") } },
    ] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "1:1" },
    },
  };

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(50_000),
    });
    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status === 400 ? 503 : 502;
      return Response.json({ message: response.status === 429 ? "The image model is out of quota. Try again when quota is available." : "The image model could not complete this edit. Check that the image model supports photo edits." }, { status });
    }
    const result = await response.json() as GeminiResponse;
    const part = result.candidates?.flatMap((c) => c.content?.parts ?? []).find((p) => p.inlineData?.data)?.inlineData;
    if (!part?.data || !part.mimeType?.startsWith("image/")) {
      return Response.json({ message: "The image model returned no usable image." }, { status: 502 });
    }
    const output = Buffer.from(part.data, "base64");
    if (!output.byteLength || output.byteLength > 16_000_000) return Response.json({ message: "Generated image was too large." }, { status: 502 });
    const square = await sharp(output, { limitInputPixels: 40_000_000 }).resize(1024, 1024, {
      fit: "contain", background: parsed.shortcut === "/whitebg" ? "#ffffff" : "#f5f5f3",
    }).png().toBuffer();
    return new Response(new Uint8Array(square), {
      headers: { "Content-Type": "image/png", "Content-Disposition": "inline; filename=product-photo.png", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Product image edit failed:", error instanceof Error ? error.name : "unknown");
    return Response.json({ message: "Could not generate this edit. Your original photo is unchanged." }, { status: 502 });
  }
}
