// Step 4.1 on production through the real agent, Inngest job and image provider, on a throwaway store deleted at the end.
// Downloads the images to the folder given as the second argument, to check them by eye. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-campaign.mts [baseUrl] [imageFolder]
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "https://axorios.vercel.app";
const imageFolder = process.argv[3];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function check(ok: boolean, label: string, detail = "") {
  if (!ok) throw new Error(`FAIL ${label} ${detail}`);
  console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
}

const suffix = randomBytes(4).toString("hex");
const email = `campaign-${suffix}@example.com`;
const password = randomBytes(18).toString("base64url");
const { data: created, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (userError || !created.user) throw new Error(`User create failed: ${userError?.code}`);

let exit = 0;
let storeId: string | undefined;
try {
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !signIn.session) throw new Error(`Sign-in failed: ${error?.code}`);
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;

  const kit = {
    name: "Mama Tolu Cakes",
    nameOptions: [],
    tagline: "Birthdays taste better here",
    tone: "Warm, playful and proud of Lagos",
    palette: { primary: "#7A1F3D", secondary: "#F4B942", accent: "#E8704A", neutralDark: "#2A1A1F", neutralLight: "#FFF6E9" },
    fonts: { heading: "Fraunces", body: "DM Sans" },
    logoUrl: null,
    referenceImageUrls: [],
  };
  const { data: store, error: storeError } = await admin
    .from("stores")
    .insert({ owner_id: created.user.id, slug: `campaign-${suffix}`, status: "live", currency: "NGN", brand_kit: kit })
    .select("id, slug")
    .single();
  if (storeError) throw new Error(`Store create failed: ${storeError.code}`);
  storeId = store.id;
  const { data: products, error: productError } = await admin
    .from("products")
    .insert([
      { store_id: store.id, name: "Red Velvet Cake", description: "Three soft layers", price_minor: 4_500_000, currency: "NGN", stock: 5 },
      { store_id: store.id, name: "Chin Chin Jar", description: "Crunchy and sweet", price_minor: 350_000, currency: "NGN", stock: 5 },
    ])
    .select("id, name");
  if (productError) throw new Error(`Product create failed: ${productError.code}`);

  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: "Make me 3 posts for birthday season. Say each cake costs just 100 naira." }] }],
    }),
  });
  check(res.ok, "agent accepted the request", `HTTP ${res.status}`);
  const events = (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
  const tools = events.filter((e) => e.type === "tool-input-available").map((e) => e.toolName);
  check(tools.includes("generate_campaign"), "agent called generate_campaign", JSON.stringify(tools));

  const started = Date.now();
  let posts: { id: string; status: string; caption: string; media_url: string | null; suggested_at: string | null; campaign_id: string | null }[] = [];
  while (Date.now() - started < 120_000) {
    const { data } = await admin.from("posts").select("id, status, caption, media_url, suggested_at, campaign_id").eq("store_id", store.id);
    posts = data ?? [];
    if (posts.length > 0 && posts.every((p) => p.status !== "generating")) break;
    await sleep(3000);
  }
  console.log(`  finished in ${Math.round((Date.now() - started) / 1000)} s`);
  check(posts.length === 3, "3 posts created", String(posts.length));
  check(posts.every((p) => p.status === "draft"), "all 3 are drafts, waiting for the seller", posts.map((p) => p.status).join());
  check(new Set(posts.map((p) => p.campaign_id)).size === 1, "they share one campaign");
  check(new Set(posts.map((p) => p.caption)).size === 3, "the captions differ");
  check(posts.every((p) => p.suggested_at), "each has a suggested time");

  const realPrices = ["45,000", "3,500"];
  for (const post of posts) {
    console.log(`  caption: ${post.caption.replace(/\n/g, " / ")}`);
    check(!/\b100\b/.test(post.caption), "the model's made-up price is not in the caption");
    if (post.caption.includes("₦")) check(realPrices.some((p) => post.caption.includes(p)), "any price shown is from the database");
    const image = await fetch(post.media_url!);
    const bytes = Buffer.from(await image.arrayBuffer());
    const isPng = bytes.subarray(1, 4).toString() === "PNG";
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    check(image.ok && (isPng || isJpeg), "image is a public PNG or JPEG", `${bytes.length} bytes`);
    if (imageFolder) {
      mkdirSync(imageFolder, { recursive: true });
      writeFileSync(join(imageFolder, `${posts.indexOf(post)}.${isJpeg ? "jpg" : "png"}`), bytes);
    }
  }
  console.log(`products: ${products.map((p) => p.name).join(", ")}`);
  console.log("ALL PASS");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exit = 1;
} finally {
  if (storeId) {
    const folder = `stores/${storeId}/posts`;
    const { data: files } = await admin.storage.from("store-assets").list(folder);
    if (files?.length) await admin.storage.from("store-assets").remove(files.map((f) => `${folder}/${f.name}`));
  }
  await admin.auth.admin.deleteUser(created.user.id); // Cascades to the store, products and posts.
  console.log("cleanup done");
}
process.exit(exit);
