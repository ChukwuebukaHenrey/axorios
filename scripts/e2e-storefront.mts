// End-to-end check of step 1.3 against a running app. Needs scripts/seed-demo-store.mts first.
// Creates a second live store with another brand, compares the two, then deletes it.
// Run: npx tsx --env-file=.env.local scripts/e2e-storefront.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";
import { buildSiteConfig } from "../src/modules/storefront/presets";

const base = process.argv[2] ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

function metaContent(html: string, property: string): string | null {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]*>`))?.[0];
  return tag?.match(/content="([^"]*)"/)?.[1]?.replace(/&amp;/g, "&") ?? null;
}

async function load(slug: string) {
  const res = await fetch(`${base}/s/${slug}`);
  if (res.status !== 200) throw new Error(`/s/${slug} returned ${res.status}`);
  return res.text();
}

const demo = await load("demo");
for (const text of ["Eko Sweet Bakes", "Red Velvet Celebration Cake", "₦45,000", "--store-primary:#7A1F3D", "Fraunces"]) {
  if (!demo.includes(text)) throw new Error(`/s/demo is missing ${text}`);
}
console.log("PASS /s/demo renders the kit, products and naira prices");

const { data: demoStore, error: demoError } = await admin.from("stores").select("owner_id").eq("slug", "demo").single();
if (demoError) throw demoError;

const kit = {
  name: "Harbour Coffee",
  nameOptions: [],
  tagline: "Small-batch roasts from Accra",
  tone: "Plain and confident",
  palette: { primary: "#0B3D2E", secondary: "#1D4ED8", accent: "#A3E635", neutralDark: "#0F172A", neutralLight: "#F1F5F9" },
  fonts: { heading: "Anton", body: "Inter" },
  logoUrl: null,
  referenceImageUrls: [],
};
const slug = "e2e-second-store";
await admin.from("stores").delete().eq("slug", slug);
const { data: second, error: secondError } = await admin
  .from("stores")
  .insert({ owner_id: demoStore.owner_id, slug, status: "live", brand_kit: kit, currency: "GHS", store_language: "en" })
  .select("id")
  .single();
if (secondError) throw secondError;

try {
  await admin.from("products").insert({ store_id: second.id, name: "House Roast", price_minor: 8500, currency: "GHS", stock: 5 });
  await admin.from("site_versions").insert({
    store_id: second.id,
    template_id: "market/bold-grid",
    config: buildSiteConfig(kit, "market/bold-grid"),
    status: "published",
    created_by: "seller",
  });

  const other = await load(slug);
  for (const text of ["--store-primary:#0B3D2E", "Anton", "Harbour Coffee", "GH₵85", "House Roast"]) {
    if (!other.includes(text)) throw new Error(`Second store is missing ${text}`);
  }
  if (other.includes("#7A1F3D") || other.includes("Red Velvet")) throw new Error("First store's data leaked into the second");
  if (demo.includes("#0B3D2E") || demo.includes("House Roast")) throw new Error("Second store's data leaked into the first");
  console.log("PASS same components, different colours, fonts, currency and products per store");

  const { error: draftError } = await admin.from("stores").update({ status: "draft" }).eq("id", second.id);
  if (draftError) throw draftError;
  const hidden = await fetch(`${base}/s/${slug}`);
  if (hidden.status !== 404) throw new Error(`Draft store returned ${hidden.status}`);
  console.log("PASS a draft store is not public (404)");
} finally {
  await admin.from("stores").delete().eq("id", second.id);
}

const title = metaContent(demo, "og:title");
const description = metaContent(demo, "og:description");
const image = metaContent(demo, "og:image");
console.log(`  og:title=${title}\n  og:description=${description}\n  og:image=${image}`);
if (title !== "Eko Sweet Bakes" || !description || !image) throw new Error("Link preview tags are incomplete");

const imagePath = new URL(image).pathname + new URL(image).search;
const png = await fetch(`${base}${imagePath}`);
const bytes = (await png.arrayBuffer()).byteLength;
console.log(`  image: ${png.status} ${png.headers.get("content-type")} ${bytes} bytes`);
if (png.status !== 200 || !png.headers.get("content-type")?.startsWith("image/png")) throw new Error("Preview image failed");
if (bytes > 600_000) throw new Error("Preview image is too large for WhatsApp");
console.log("PASS link preview has the name, tagline and an image under WhatsApp's size limit");
