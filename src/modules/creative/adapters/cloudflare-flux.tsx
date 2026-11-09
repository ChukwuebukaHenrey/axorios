/* eslint-disable @next/next/no-img-element -- next/og renders plain img elements, not next/image */
import "server-only";
import sharp from "sharp";
import { env } from "@/lib/env";
import { allowedImage, readableOn } from "@/modules/storefront";
import { backgroundPrompt } from "../copy";
import type { ImageProvider, ImageRequest } from "../types";
import { ImageQuotaError, isQuotaFailure } from "./cloudflare-errors";
import { Footer, headlineSize, renderPng, templateImages } from "./template";

const TIMEOUT_MS = 45_000;
/** A photo posts at ~10x its size as PNG; JPEG at this quality keeps the typeset words crisp. */
const JPEG_QUALITY = 85;

/** Flux 1 takes JSON; Flux 2 models take multipart form data. Both answer `{ result: { image: base64 } }`. */
async function paintBackground(prompt: string, size: ImageRequest["size"]): Promise<string> {
  const e = env();
  if (!e.CLOUDFLARE_ACCOUNT_ID || !e.CLOUDFLARE_AI_TOKEN || !e.CLOUDFLARE_IMAGE_MODEL) {
    throw new Error("Cloudflare image provider is selected but its keys are missing");
  }
  const model = e.CLOUDFLARE_IMAGE_MODEL;
  const url = `https://api.cloudflare.com/client/v4/accounts/${e.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

  let body: BodyInit;
  const headers: Record<string, string> = { Authorization: `Bearer ${e.CLOUDFLARE_AI_TOKEN}` };
  if (/flux-2/.test(model)) {
    const form = new FormData();
    form.set("prompt", prompt);
    form.set("width", String(size.width));
    form.set("height", String(size.height));
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ prompt, steps: 8 });
  }

  const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const type = res.headers.get("content-type") ?? "";
  if (res.ok && type.startsWith("image/")) {
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  }
  const text = await res.text();
  if (!res.ok) {
    if (isQuotaFailure(res.status, text)) throw new ImageQuotaError(`Cloudflare image quota: HTTP ${res.status}`);
    // The body can echo the prompt; log the status only.
    throw new Error(`Cloudflare image generation failed: HTTP ${res.status}`);
  }
  const image = (JSON.parse(text) as { result?: { image?: string } }).result?.image;
  if (!image) throw new Error("Cloudflare image generation returned no image");
  // Flux returns a JPEG; the data URL prefix only has to be one next/og can decode.
  return image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
}

/** The painted backdrop full-bleed, a scrim for contrast, then the brand's words and database price on top. */
function overlay({ brand: kit, headline, subline, priceLabel, productImageUrl }: ImageRequest, background: string) {
  const photo = allowedImage(productImageUrl ?? null);
  const ink = "#ffffff";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: kit.fonts.body }}>
      <img src={background} alt="" width={1080} height={1080} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.55) 52%, rgba(0,0,0,0.9) 100%)",
        }}
      />
      <div style={{ position: "relative", display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: 72, color: ink }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", width: 140, height: 16, borderRadius: 8, background: kit.palette.secondary }} />
          {photo && (
            <img
              src={photo}
              alt=""
              width={300}
              height={300}
              style={{ objectFit: "cover", borderRadius: 32, border: `8px solid ${kit.palette.neutralLight}` }}
            />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", fontFamily: kit.fonts.heading, fontWeight: 700, lineHeight: 1.05, fontSize: headlineSize(headline) }}>
              {headline}
            </div>
            <div style={{ display: "flex", fontWeight: 400, lineHeight: 1.25, fontSize: 40, opacity: 0.92 }}>{subline}</div>
          </div>
          {priceLabel ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 36 }}>
              <div style={{ display: "flex", fontFamily: kit.fonts.heading, fontWeight: 700 }}>{kit.name}</div>
              <div
                style={{
                  display: "flex",
                  fontWeight: 700,
                  padding: "14px 28px",
                  borderRadius: 999,
                  background: kit.palette.primary,
                  color: readableOn(kit.palette.primary),
                }}
              >
                {priceLabel}
              </div>
            </div>
          ) : (
            <Footer kit={kit} color={ink} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Flux on Cloudflare Workers AI paints the background only; next/og typesets everything else.
 * On a 429 or a spent allocation the post falls back to the no-model template, so a campaign never stalls on quota.
 */
export const cloudflareFluxImages: ImageProvider = {
  name: "cloudflare-flux",

  async generate(request) {
    let background: string;
    try {
      background = await paintBackground(backgroundPrompt(request.brand, request), request.size);
    } catch (error) {
      if (!(error instanceof ImageQuotaError)) throw error;
      console.warn(`${error.message}; rendering the template instead`);
      return templateImages.generate(request);
    }
    const png = await renderPng(overlay(request, background), request);
    const jpeg = await sharp(png.bytes).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    return { bytes: new Uint8Array(jpeg), contentType: "image/jpeg" };
  },
};
