// Seeds the live demo store at /s/demo, owned by the demo seller. Safe to run again. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/seed-demo-store.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildSiteConfig } from "../src/modules/storefront/presets";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/** Uploads a local product photo and returns its public URL. Re-running overwrites the same path. */
async function uploadAsset(storeId: string, name: string, localPath: string) {
  const path = `stores/${storeId}/seed/${name}.png`;
  const { error } = await admin.storage.from("store-assets").upload(path, readFileSync(localPath), {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw error;
  return admin.storage.from("store-assets").getPublicUrl(path).data.publicUrl;
}

const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (usersError) throw usersError;
const owner = users.users.find((u) => u.email === process.env.DEMO_SELLER_EMAIL);
if (!owner) throw new Error("Run scripts/seed-demo-user.mts first");

const kit = {
  name: "Eko Sweet Bakes",
  nameOptions: [],
  tagline: "Celebration cakes, baked fresh in Lagos",
  tone: "Warm, joyful, proudly Lagos",
  // Olive, pink, butter yellow, forest green and cream, from the bakery template's references.
  palette: {
    primary: "#A6A03C",
    secondary: "#E67391",
    accent: "#F2C051",
    neutralDark: "#143D26",
    neutralLight: "#F5E8D5",
  },
  fonts: { heading: "Fraunces", body: "DM Sans" },
  logoUrl: null as string | null,
  referenceImageUrls: [],
};

// Contact buttons use this project's own channels, read from the source rather than typed in here.
const bot = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
const botBody = (await bot.json()) as { ok: boolean; result?: { username?: string } };
if (!botBody.ok || !botBody.result?.username) throw new Error(`Telegram getMe failed: HTTP ${bot.status}`);
// WhatsApp is dormant, so the demo store shows no button that nothing answers.
const whatsapp = process.env.WHATSAPP_ENABLED === "true" ? process.env.TWILIO_WHATSAPP_FROM?.replace("whatsapp:", "") : undefined;

const { data: store, error: storeError } = await admin
  .from("stores")
  .upsert(
    {
      owner_id: owner.id,
      slug: "demo",
      status: "live",
      brand_kit: kit,
      currency: "NGN",
      settlement_currency: "USD",
      store_language: "en-NG",
      contact_channels: { ...(whatsapp && { whatsapp }), telegram: botBody.result.username },
    },
    { onConflict: "slug" },
  )
  .select("id")
  .single();
if (storeError) throw storeError;

const products = [
  [
    "Red Velvet Celebration Cake",
    "Three soft layers with cream cheese frosting, 8 inch. Serves 12 to 15.",
    4_500_000,
    "Images/cakes/red_velvet_cake.png",
  ],
  [
    "Ube Coconut Cake",
    "Purple yam sponge and toasted coconut, 8 inch. Serves 12 to 15.",
    6_000_000,
    "Images/cakes/cakeAsset1.png",
  ],
] as const;

// Products without a photo (the Chin Chin Gift Jar) are left out, so the extras step below sets them inactive.
// Keeps existing product rows, because their IDs are what the Shopify sync and past orders point at.
const { data: existing, error: existingError } = await admin.from("products").select("id, name").eq("store_id", store.id);
if (existingError) throw existingError;
for (const [name, description, price_minor, localImage] of products) {
  const image_url = localImage
    ? await uploadAsset(store.id, name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), localImage)
    : null;
  const row = { store_id: store.id, name, description, price_minor, currency: "NGN", active: true, image_url };
  const found = existing.find((p) => p.name === name);
  // Stock is set only on a new row, so re-seeding doesn't undo real sales.
  const { error } = found
    ? await admin.from("products").update(row).eq("id", found.id)
    : await admin.from("products").insert({ ...row, stock: 100 });
  if (error) throw error;
}
const seeded = new Set<string>(products.map(([name]) => name));
const extras = existing.filter((p) => !seeded.has(p.name)).map((p) => p.id);
if (extras.length > 0) {
  const { error } = await admin.from("products").update({ active: false }).in("id", extras);
  if (error) throw error;
}

const heroImageUrl = await uploadAsset(store.id, "hero", "Images/cakes/hero_lavender_celebration_cake.png");
// The logo ships in the repo, so a fresh clone has it.
kit.logoUrl = await uploadAsset(store.id, "logo", "public/images/stores/bakery/logo-eko-sweet-bakes.png");
const { error: kitError } = await admin.from("stores").update({ brand_kit: kit }).eq("id", store.id);
if (kitError) throw kitError;

const config = buildSiteConfig(kit, "bakery");
for (const section of config.sections) {
  if (section.type === "hero") {
    section.content.imageUrl = heroImageUrl;
    section.content.eyebrow = "Baked fresh in Lagos";
    section.content.headline = "Celebration cakes, sent with love";
    section.content.subhead = "Order from anywhere and pay in your own currency. We bake it and deliver it in Lagos.";
  }
  if (section.type === "products") {
    section.content.heading = "Our cakes";
  }
  if (section.type === "story") {
    section.content.body =
      "Eko Sweet Bakes started in a Lagos kitchen, baking birthday cakes for neighbours. Today we bake to order for families here and for people abroad sending love home.";
  }
  if (section.type === "faq") {
    section.content.items = [
      { question: "Can I order from outside Nigeria?", answer: "Yes. Pay with PayPal in your own currency, and we deliver in Lagos." },
      { question: "How much notice do you need?", answer: "Two days for most cakes." },
      { question: "Can you write a message on the cake?", answer: "Yes. Tell us the message when you order." },
    ];
  }
}

await admin.from("site_versions").delete().eq("store_id", store.id);
const { error: versionError } = await admin.from("site_versions").insert({
  store_id: store.id,
  template_id: config.preset,
  config,
  status: "published",
  created_by: "seller",
});
if (versionError) throw versionError;

console.log(`PASS demo store live at /s/demo with ${products.length} products`);
