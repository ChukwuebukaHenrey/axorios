// Spike 0.4 (revised): on-brand post graphic with no AI model, saved to Supabase Storage.
// Run: npx tsx --env-file=.env.local scripts/spike-image.mts
import { ImageResponse } from "next/og";
import { createElement as h } from "react";

const brand = { name: "Mama Cakes", primary: "#7A1F3D", accent: "#F4B942", cream: "#FFF6E9" };

const image = new ImageResponse(
  h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: brand.primary,
        color: brand.cream,
      },
    },
    h("div", { style: { display: "flex", fontSize: 44, color: brand.accent } }, brand.name),
    h("div", { style: { display: "flex", fontSize: 110, fontWeight: 700, lineHeight: 1.05 } }, "Birthdays taste better here"),
    h("div", { style: { display: "flex", fontSize: 40 } }, "Order today, delivered across Lagos"),
  ),
  { width: 1080, height: 1080 },
);

const png = Buffer.from(await image.arrayBuffer());
if (png.subarray(1, 4).toString() !== "PNG") throw new Error("Output is not a PNG");

const path = `spikes/post-${Date.now()}.png`;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const res = await fetch(`${url}/storage/v1/object/store-assets/${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "image/png" },
  body: png,
});
if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);

const publicUrl = `${url}/storage/v1/object/public/store-assets/${path}`;
const check = await fetch(publicUrl);
if (!check.ok) throw new Error(`Public URL failed: HTTP ${check.status}`);
console.log(`PASS bytes=${png.length} url=${publicUrl}`);
