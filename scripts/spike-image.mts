// Spike 0.4 (revised): post graphic through the cloudflare-flux ImageProvider, saved to Supabase Storage.
// 1. Live: Flux paints the background, next/og draws headline, brand and a code-formatted price on top.
// 2. Forced 429: the Cloudflare call is stubbed to fail with a quota error; the provider must fall back to the template.
// Prints no credentials. Optional second argument: a folder to save both PNGs into, to check them by eye.
// Run: npx tsx --import ./scripts/no-server-only.mjs --env-file=.env.local scripts/spike-image.mts [imageFolder]
// (IMAGE_PROVIDER does not need to be cloudflare-flux; the CLOUDFLARE_* keys do need to be set.)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BrandKitSchema } from "../src/modules/brand/schema";
import { cloudflareFluxImages } from "../src/modules/creative/adapters/cloudflare-flux";
import type { ImageRequest } from "../src/modules/creative/types";
import { formatMinor } from "../src/lib/money";

const folder = process.argv[2];
if (folder) mkdirSync(folder, { recursive: true });

const brand = BrandKitSchema.parse({
  name: "Mama Cakes",
  nameOptions: [],
  tagline: "Birthdays taste better here",
  tone: "Warm and playful",
  palette: { primary: "#7A1F3D", secondary: "#F4B942", accent: "#E8704A", neutralDark: "#222222", neutralLight: "#FFF6E9" },
  fonts: { heading: "Fraunces", body: "DM Sans" },
});

const request: ImageRequest = {
  prompt: "",
  referenceImages: [],
  size: { width: 1080, height: 1080 },
  brand,
  headline: "Birthdays taste better here",
  subline: "Order today, delivered across Lagos",
  // As posts.ts does: integer minor units from the product row, formatted by code.
  priceLabel: formatMinor(4_500_000, "NGN"),
  productImageUrl: null,
  variant: 0,
};

function check(name: string, bytes: Uint8Array, want: "png" | "jpg") {
  const got = bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpg" : Buffer.from(bytes.subarray(1, 4)).toString() === "PNG" ? "png" : "?";
  if (got !== want) throw new Error(`${name}: expected ${want}, got ${got}`);
  if (folder) writeFileSync(join(folder, `${name}.${want}`), bytes);
}

// 1. Live run.
let t0 = Date.now();
let cloudflareCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input instanceof Request ? input.url : input).startsWith("https://api.cloudflare.com/")) cloudflareCalls++;
  return realFetch(input, init);
}) as typeof fetch;
const live = await cloudflareFluxImages.generate(request);
check("live", live.bytes, "jpg");
if (cloudflareCalls !== 1) throw new Error(`Expected 1 Cloudflare call, saw ${cloudflareCalls}`);
console.log(`live: ok bytes=${live.bytes.length} ms=${Date.now() - t0} price="${request.priceLabel}"`);

// 2. Forced quota failure.
t0 = Date.now();
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input instanceof Request ? input.url : input).startsWith("https://api.cloudflare.com/")) {
    return new Response(JSON.stringify({ success: false, errors: [{ code: 3036, message: "daily free allocation used" }] }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;
const fallback = await cloudflareFluxImages.generate(request);
check("fallback-429", fallback.bytes, "png");
globalThis.fetch = realFetch;
console.log(`fallback on 429: ok bytes=${fallback.bytes.length} ms=${Date.now() - t0}`);

// 3. Upload the live image to Storage and read it back publicly.
const path = `spikes/post-flux-${Date.now()}.jpg`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const res = await fetch(`${url}/storage/v1/object/store-assets/${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": live.contentType },
  body: Buffer.from(live.bytes),
});
if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
const publicUrl = `${url}/storage/v1/object/public/store-assets/${path}`;
const check2 = await fetch(publicUrl);
if (!check2.ok) throw new Error(`Public URL failed: HTTP ${check2.status}`);
console.log(`PASS url=${publicUrl}`);
// A pooled keep-alive socket would hold the process open; exit once sharp has finished closing its handles.
setTimeout(() => process.exit(0), 1000);
