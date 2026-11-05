// Seeds the live demo store at /s/demo, owned by the demo seller. Safe to run again. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/seed-demo-store.mts
import { createClient } from "@supabase/supabase-js";
import { buildSiteConfig } from "../src/modules/storefront/presets";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (usersError) throw usersError;
const owner = users.users.find((u) => u.email === process.env.DEMO_SELLER_EMAIL);
if (!owner) throw new Error("Run scripts/seed-demo-user.mts first");

const kit = {
  name: "Eko Sweet Bakes",
  nameOptions: [],
  tagline: "Celebration cakes, baked fresh in Lagos",
  tone: "Warm, joyful, proudly Lagos",
  palette: {
    primary: "#7A1F3D",
    secondary: "#E8590C",
    accent: "#FFC94D",
    neutralDark: "#2A1A14",
    neutralLight: "#FFF6E9",
  },
  fonts: { heading: "Fraunces", body: "DM Sans" },
  logoUrl: null,
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
  ["Red Velvet Celebration Cake", "Three soft layers with cream cheese frosting, 8 inch. Serves 12 to 15.", 4_500_000],
  ["Ube Coconut Cake", "Purple yam sponge and toasted coconut, 8 inch. Serves 12 to 15.", 6_000_000],
  ["Chin Chin Gift Jar", "Crunchy, lightly spiced chin chin in a 500 g gift jar.", 350_000],
] as const;

await admin.from("products").delete().eq("store_id", store.id);
const { error: productsError } = await admin.from("products").insert(
  products.map(([name, description, price_minor]) => ({
    store_id: store.id,
    name,
    description,
    price_minor,
    currency: "NGN",
    stock: 100,
  })),
);
if (productsError) throw productsError;

const config = buildSiteConfig(kit);
for (const section of config.sections) {
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
