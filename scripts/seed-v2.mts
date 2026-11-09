/**
 * Spec v2 demo account: two stores that look like they've been trading since 9 May 2026.
 * Deterministic: a fixed seed (SEED, default 20261109) and fixed calendar events, so a rerun on the same day
 * gives the same counts. History ends yesterday (UTC); real sandbox orders (source 'app') fill today and are kept.
 *
 * Orders, contacts and refunds are written as CSV to data/demo/<slug>/ and loaded through the import module
 * (source 'import'). Marketing, metrics, visits, expenses, withdrawals, FX and insights go in directly (source 'seed').
 * Every run first deletes the demo stores' import and seed rows, so this is also the reset.
 *
 * Run: npx tsx --import ./scripts/no-server-only.mjs --env-file=.env.local scripts/seed-v2.mts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { toCsv } from "../src/modules/imports/csv";
import { importContactsCsv, importOrdersCsv, importRefundsCsv } from "../src/modules/imports/service";
import { convertMinor, lockRate } from "../src/modules/payments/convert";
import { buildSiteConfig } from "../src/modules/storefront/presets";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// ─── deterministic randomness ───
const SEED = Number(process.env.SEED || 20261109);
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(SEED);
const between = (a: number, b: number) => a + (b - a) * rand();
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const chance = (p: number) => rand() < p;
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
function weighted<T>(pairs: [T, number][]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
}
function poisson(l: number) {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}
function normal() {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

// ─── calendar ───
const DAY = 86_400_000;
const START = Date.UTC(2026, 4, 9); // 9 May
const today = new Date();
const END = Math.max(Date.UTC(2026, 10, 8), Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - DAY); // last full day
const days: number[] = [];
for (let t = START; t <= END; t += DAY) days.push(t);
const iso = (t: number) => new Date(t).toISOString();
const ymd = (t: number) => iso(t).slice(0, 10);
const md = (t: number) => ymd(t).slice(5);
const at = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const inWindow = (t: number, a: number, b: number) => t >= a && t <= b;
/** A time on day t in Lagos business hours (UTC+1), busier at lunch and evening. */
const lagosTime = (t: number) => t + (weighted([[8, 1], [10, 2], [12, 3], [14, 2], [16, 2], [18, 3], [20, 2]] as [number, number][]) - 1 + rand() * 2) * 3_600_000 + int(0, 59) * 60_000;

// ─── names ───
const FIRST = ["Ada", "Chidi", "Ngozi", "Emeka", "Tolu", "Funmi", "Bola", "Kemi", "Yemi", "Segun", "Ifeoma", "Obinna", "Amaka", "Tunde", "Bisi", "Zainab", "Musa", "Aisha", "Ibrahim", "Halima", "Chioma", "Uche", "Nkem", "Femi", "Dayo", "Lola", "Kunle", "Sade", "Ebuka", "Ify", "Tobi", "Wale", "Yinka", "Nneka", "Kelechi", "Adaeze", "Fatima", "Sani", "Bukola", "Temi"];
const LAST = ["Okafor", "Adeyemi", "Okeke", "Balogun", "Eze", "Ogunleye", "Nwosu", "Bello", "Adebayo", "Obi", "Ibrahim", "Afolabi", "Chukwu", "Lawal", "Okonkwo", "Oladipo", "Nnamdi", "Abubakar", "Ojo", "Ekwueme", "Danjuma", "Akinola", "Uzor", "Bakare"];

// ─── stores ───
const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
const owner = users!.users.find((u) => u.email === process.env.DEMO_SELLER_EMAIL);
if (!owner) throw new Error("Run scripts/seed-demo-user.mts first");
const { data: demoRow } = await admin.from("stores").select("id, brand_kit").eq("slug", "demo").single();
if (!demoRow) throw new Error("Run scripts/seed-demo-store.mts first");
const demo = demoRow;

/** Product photos go up as ~1200 px JPEGs: smaller pages, and Node 26 fetch here resets uploads over ~1 MB. */
async function uploadAsset(storeId: string, name: string, localPath: string) {
  const path = `stores/${storeId}/seed/${name}.jpg`;
  const body = await sharp(readFileSync(localPath)).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 84 }).toBuffer();
  const { error } = await admin.storage.from("store-assets").upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return admin.storage.from("store-assets").getPublicUrl(path).data.publicUrl;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as NonNullable<T>;
}

async function insertAll(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + 1000));
    if (error) throw new Error(`${table} insert: ${error.message}`);
  }
}

await must(
  admin
    .from("stores")
    .update({
      is_demo: true,
      country: "NG",
      vat_registered: true,
      vat_rate_bp: 750,
      prices_include_tax: true,
      business_profile: {
        idea: "Celebration cakes baked to order in Lagos, ordered by families at home and abroad",
        niche: "Celebration cakes and gift treats",
        audience: "Lagos families, offices, and Nigerians abroad sending cakes home",
        location: "Lekki, Lagos",
        deliveryZones: ["Lagos Island", "Lekki", "Victoria Island", "Ikeja", "Surulere", "Yaba"],
        policies: { refunds: "Full refund if we can't deliver on the day; partial refunds for damaged cakes.", notice: "Two days for most cakes." },
      },
    })
    .eq("id", demo.id),
  "demo store",
);

// Products: keep existing IDs (Shopify + past orders point at them); add two by name if missing.
async function ensureProduct(storeId: string, p: Record<string, unknown> & { name: string }) {
  const { data: found } = await admin.from("products").select("id").eq("store_id", storeId).eq("name", p.name).maybeSingle();
  if (found) {
    await must(admin.from("products").update(p).eq("id", found.id), `product ${p.name}`);
    return found.id as string;
  }
  return (await must(admin.from("products").insert({ store_id: storeId, ...p }).select("id").single(), `product ${p.name}`)).id as string;
}
const P = {
  red: await ensureProduct(demo.id, { name: "Red Velvet Celebration Cake", inventory_mode: "made_to_order", daily_capacity: 14, stock: 100, category: "Cakes" }),
  ube: await ensureProduct(demo.id, { name: "Ube Coconut Cake", inventory_mode: "made_to_order", daily_capacity: 10, stock: 100, category: "Cakes" }),
  chin: await ensureProduct(demo.id, { name: "Chin Chin Gift Jar", inventory_mode: "tracked", stock: 0, low_stock_threshold: 10, category: "Gifts", active: false }),
  brownie: await ensureProduct(demo.id, {
    name: "Fudge Brownie Box (6)",
    description: "Six dense chocolate fudge brownies in a gift box.",
    price_minor: 1_200_000,
    currency: "NGN",
    inventory_mode: "tracked",
    stock: 7,
    low_stock_threshold: 10,
    category: "Treats",
    active: true,
    image_url: await uploadAsset(demo.id, "fudge-brownie-box", "Images/cakes/cakeAsset4.png"),
  }),
  choc: await ensureProduct(demo.id, {
    name: "Chocolate Berry Cake",
    description: "Chocolate sponge, ganache drip and fresh berries, 8 inch. Serves 12 to 15.",
    price_minor: 5_000_000,
    currency: "NGN",
    inventory_mode: "made_to_order",
    daily_capacity: 8,
    stock: 100,
    category: "Cakes",
    active: true,
    image_url: await uploadAsset(demo.id, "chocolate-berry-cake", "Images/cakes/chocolate_berry_cake.png"),
  }),
};
const demoProducts = await must(admin.from("products").select("id, name, price_minor, image_url").eq("store_id", demo.id), "products");
const prod = new Map(demoProducts.map((p) => [p.id, p]));

// UK store: GBP, charged in GBP, UK delivery only, not VAT-registered.
const ukKit = { ...(demo.brand_kit as Record<string, unknown>), name: "Eko Sweet Kitchen UK", tagline: "Lagos cake kits, baked at home in the UK" };
const uk = await must(
  admin
    .from("stores")
    .upsert(
      {
        owner_id: owner.id,
        slug: "eko-sweet-kitchen-uk",
        status: "live",
        brand_kit: ukKit,
        currency: "GBP",
        settlement_currency: "GBP",
        store_language: "en-GB",
        country: "GB",
        is_demo: true,
        vat_registered: false,
        vat_rate_bp: 0,
        prices_include_tax: true,
        business_profile: { idea: "Cake kits with Lagos flavours for the UK diaspora", niche: "Baking kits", audience: "Nigerians in the UK", location: "London", deliveryZones: ["United Kingdom"] },
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single(),
  "uk store",
);
const UK = {
  red: await ensureProduct(uk.id, { name: "Red Velvet Cake Kit", description: "Everything for a two-layer red velvet cake, plus frosting.", price_minor: 2400, currency: "GBP", inventory_mode: "tracked", stock: 60, low_stock_threshold: 8, category: "Kits", active: true, image_url: await uploadAsset(uk.id, "red-velvet-kit", "Images/cakes/cakeAsset3.png") }),
  lemon: await ensureProduct(uk.id, { name: "Lemon Drizzle Cake Kit", description: "Zesty sponge mix, drizzle and candied lemon.", price_minor: 2200, currency: "GBP", inventory_mode: "tracked", stock: 45, low_stock_threshold: 8, category: "Kits", active: true, image_url: await uploadAsset(uk.id, "lemon-kit", "Images/cakes/cakeAsset2.png") }),
  coco: await ensureProduct(uk.id, { name: "Coconut Cream Cake Kit", description: "Coconut sponge mix with toasted flakes and cream frosting.", price_minor: 2600, currency: "GBP", inventory_mode: "tracked", stock: 38, low_stock_threshold: 8, category: "Kits", active: true, image_url: await uploadAsset(uk.id, "coconut-kit", "Images/cakes/cakeAsset.jpg") }),
};
const ukProducts = await must(admin.from("products").select("id, name, price_minor, image_url").eq("store_id", uk.id), "uk products");
const ukProd = new Map(ukProducts.map((p) => [p.id, p]));
if (!(await must(admin.from("site_versions").select("id").eq("store_id", uk.id).eq("status", "published"), "uk site")).length) {
  const config = buildSiteConfig(ukKit as never, "bakery");
  for (const s of config.sections) {
    if (s.type === "hero") {
      s.content.imageUrl = ukProducts[0].image_url ?? undefined;
      s.content.headline = "Lagos cake kits, baked at home";
      s.content.subhead = "Everything you need for a celebration cake, delivered across the UK.";
    }
  }
  await must(admin.from("site_versions").insert({ store_id: uk.id, template_id: config.preset, config, status: "published", created_by: "seller" }), "uk site");
}

// ─── clear previous seed/import rows (this is what makes reset-demo one command) ───
const STORES = [demo.id, uk.id];
for (const id of STORES) {
  await must(admin.from("orders").delete().eq("store_id", id).in("source", ["import", "seed"]), "clear orders");
  await must(admin.from("contacts").delete().eq("store_id", id).in("source", ["import", "seed"]), "clear contacts");
  await must(admin.from("labels").delete().eq("store_id", id), "clear labels");
  await must(admin.from("campaigns").delete().eq("store_id", id).eq("source", "seed"), "clear campaigns");
  await must(admin.from("posts").delete().eq("store_id", id).eq("source", "seed"), "clear posts");
  await must(admin.from("tracked_links").delete().eq("store_id", id).eq("source", "seed"), "clear links");
  await must(admin.from("promotions").delete().eq("store_id", id).eq("source", "seed"), "clear promos");
  await must(admin.from("store_visits").delete().eq("store_id", id), "clear visits");
  await must(admin.from("expenses").delete().eq("store_id", id).eq("source", "seed"), "clear expenses");
  await must(admin.from("insights").delete().eq("store_id", id).eq("source", "seed"), "clear insights");
  await must(admin.from("conversations").delete().eq("store_id", id).eq("source", "seed"), "clear conversations");
}
await must(admin.from("withdrawals").delete().eq("owner_id", owner.id).eq("source", "seed"), "clear withdrawals");
await must(admin.from("media").delete().eq("owner_id", owner.id).eq("source", "seed"), "clear media");
await must(admin.from("fx_rates").delete().eq("source", "seed"), "clear fx");

// ─── FX: NGN per USD, a Brownian bridge from 1,520 to the live 1,346 ───
rand = mulberry32(SEED + 1);
const fx = new Map<string, number>();
{
  const n = days.length;
  const walk: number[] = [0];
  for (let i = 1; i < n; i++) walk.push(walk[i - 1] + normal() * 5);
  days.forEach((t, i) => {
    const bridge = walk[i] - (i / (n - 1)) * walk[n - 1];
    fx.set(ymd(t), Math.round((1520 + ((1346 - 1520) * i) / (n - 1) + bridge) * 100) / 100);
  });
}
await insertAll("fx_rates", days.map((t) => ({ base: "USD", quote: "NGN", day: ymd(t), rate: fx.get(ymd(t)), source: "seed" })));

// ─── marketing first: orders link to posts ───
rand = mulberry32(SEED + 2);
type Post = { idx: number; t: number; channel: string; productId: string; code: string; contentType: string; caption: string };
const CHANNEL_REACH: Record<string, { reach: number; er: number; ctr: number }> = {
  instagram: { reach: 2600, er: 0.06, ctr: 0.012 },
  facebook: { reach: 1900, er: 0.04, ctr: 0.01 },
  tiktok: { reach: 7500, er: 0.08, ctr: 0.006 },
  telegram: { reach: 650, er: 0.1, ctr: 0.035 },
  google: { reach: 320, er: 0.03, ctr: 0.05 },
};
const CAPTIONS: Record<"red" | "ube" | "choc" | "brownie" | "chin", string[]> = {
  red: ["Red velvet that makes the room go quiet. Order for Saturday.", "Birthday this weekend? Our Red Velvet serves 15.", "Soft layers, cream cheese frosting, Lagos delivery."],
  ube: ["NEW: Ube Coconut Cake. Purple, nutty, unforgettable.", "The cake everyone is asking about. Ube Coconut, baked to order.", "Ube season is every season now."],
  choc: ["Chocolate Berry: ganache drip, fresh berries, pure joy.", "For the chocolate lovers. Order two days ahead."],
  brownie: ["Six fudge brownies in a gift box. Office treat sorted.", "Brownie boxes are back in stock!"],
  chin: ["Chin chin gift jars for every visit.", "Crunchy, sweet, made this morning."],
};
const posts: Post[] = [];
{
  let t = START + DAY;
  let idx = 0;
  while (t <= END) {
    const channel = weighted<string>([["instagram", 0.3], ["facebook", 0.25], ["telegram", t >= at(2026, 6, 1) ? 0.2 : 0], ["tiktok", 0.15], ["google", 0.1]]);
    const key = weighted<keyof typeof CAPTIONS>([["red", 0.35], ["ube", t >= at(2026, 8, 3) ? 0.45 : 0], ["choc", 0.2], ["brownie", t >= at(2026, 9, 2) && t <= at(2026, 9, 6) ? 0 : 0.15], ["chin", t < at(2026, 11, 7) ? 0.1 : 0]]);
    const caption = pick(CAPTIONS[key]);
    posts.push({ idx, t: lagosTime(t), channel, productId: P[key], code: `p${SEED % 1000}${(idx++).toString(36)}`, contentType: channel === "google" ? "text" : weighted([["image", 0.6], ["carousel", 0.4]]), caption });
    t += Math.round(between(1, 2)) * DAY;
  }
}
const links = await must(
  admin
    .from("tracked_links")
    .insert(posts.map((p) => ({ store_id: demo.id, code: p.code, target: `/s/demo?utm=${p.code}`, channel: p.channel, source: "seed", created_at: iso(p.t) })))
    .select("id, code"),
  "links",
);
const linkByCode = new Map(links.map((l) => [l.code, l.id]));
const postRows = await must(
  admin
    .from("posts")
    .insert(
      posts.map((p) => ({
        store_id: demo.id,
        caption: p.caption,
        media_url: prod.get(p.productId)?.image_url ?? null,
        targets: [p.channel],
        channel: p.channel,
        scheduled_at: iso(p.t),
        status: "published",
        publish_results: { [p.channel]: { ok: true, permalink: `/s/demo/p/${p.code}`, demo: p.channel !== "telegram" } },
        content_type: p.contentType,
        caption_length: p.caption.length,
        product_ids: [p.productId],
        link_id: linkByCode.get(p.code),
        source: "seed",
        created_at: iso(p.t - 3_600_000),
      })),
    )
    .select("id"),
  "posts",
);
await must(
  admin.from("tracked_links").upsert(posts.map((p, i) => ({ id: linkByCode.get(p.code)!, store_id: demo.id, code: p.code, target: `/s/demo?utm=${p.code}`, channel: p.channel, source: "seed", post_id: postRows[i].id }))),
  "link posts",
);
const metrics: Record<string, unknown>[] = [];
const clicks: Record<string, unknown>[] = [];
for (const [i, p] of posts.entries()) {
  const c = CHANNEL_REACH[p.channel];
  const growth = 1 + (p.t - START) / (180 * DAY); // audiences grow over the 6 months
  const base = c.reach * between(0.6, 1.4) * growth;
  for (let d = 0; d < 14 && p.t + d * DAY <= END + DAY; d++) {
    const reach = Math.round(base * Math.pow(0.62, d));
    const nClicks = Math.round(reach * c.ctr * between(0.7, 1.3));
    metrics.push({ store_id: demo.id, post_id: postRows[i].id, channel: p.channel, day: ymd(p.t + d * DAY), reach, impressions: Math.round(reach * 1.35), engagements: Math.round(reach * c.er * between(0.7, 1.3)), clicks: nClicks, source: "seed" });
    for (let k = 0; k < nClicks; k++) {
      const when = p.t + 5 * 60_000 + d * DAY + rand() * (d === 0 ? DAY - 5 * 60_000 : DAY);
      if (when > END + DAY) continue;
      clicks.push({ store_id: demo.id, link_id: linkByCode.get(p.code), at: iso(when), country: chance(0.85) ? "NG" : pick(["GB", "US", "CA", "DE"]), device: weighted([["mobile", 0.82], ["desktop", 0.15], ["tablet", 0.03]]) });
    }
  }
}
await insertAll("post_metrics", metrics);

// ─── contacts pool ───
rand = mulberry32(SEED + 3);
type Contact = { ref: string; name: string; email: string; phone: string; telegram?: string; country: string; regular: boolean; lead: boolean; firstSeen?: number; orders: number; consentChannel: string; marketing: boolean; labels: string[] };
function makeContacts(prefix: string, n: number, abroadShare: number, homeCountry: string, regulars: number, leadsFrom: number): Contact[] {
  return Array.from({ length: n }, (_, i) => {
    const first = pick(FIRST);
    const last = pick(LAST);
    const abroad = homeCountry === "NG" && chance(abroadShare);
    return {
      ref: `${prefix}${i}`,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      phone: homeCountry === "NG" ? `+23480${String(10_000_000 + int(0, 89_999_999))}` : `+447${String(100_000_000 + int(0, 899_999_999))}`,
      telegram: chance(0.25) ? `${first}${last}${i}`.toLowerCase() : undefined,
      country: abroad ? weighted([["GB", 0.4], ["US", 0.33], ["CA", 0.14], ["DE", 0.13]]) : homeCountry,
      regular: i < regulars,
      lead: i >= leadsFrom,
      orders: 0,
      consentChannel: "email",
      marketing: chance(0.7),
      labels: [],
    };
  });
}

// ─── orders ───
type Line = { productId: string; name: string; quantity: number; unit: number; line: number };
type GenOrder = { ref: string; t: number; channel: string; contact: Contact; lines: Line[]; total: number; tax: number; chargeCurrency: string; charge: number; fxRate: number | null; fee: number; refunded: number; refundedCharge: number; refundAt?: number; partial?: boolean; linkCode?: string; fulfilledAt?: number };

function lastPostBefore(channel: string, t: number) {
  for (let i = posts.length - 1; i >= 0; i--) {
    const p = posts[i];
    if (p.channel === channel && p.t + 2 * 3_600_000 < t) return t - p.t < 7 * DAY ? p : undefined;
  }
  return undefined;
}

function genDemoOrders(contacts: Contact[]): { orders: GenOrder[]; lost: number } {
  rand = mulberry32(SEED + 4);
  const orders: GenOrder[] = [];
  let nextNew = 0;
  let lost = 0;
  const customers: Contact[] = [];
  const leadPool = contacts.filter((c) => c.lead);
  const newPool = contacts.filter((c) => !c.lead);
  const indy = [at(2026, 9, 25), at(2026, 10, 1)];
  const b2s = [at(2026, 9, 8), at(2026, 9, 15)];
  const stockout = [at(2026, 9, 2), at(2026, 9, 6)];
  for (const t of days) {
    const months = (t - START) / (30.44 * DAY);
    const dow = new Date(t).getUTCDay();
    let lambda = (6.6 + 0.5 * months) * [0.85, 0.7, 0.8, 0.85, 0.95, 1.4, 1.5][dow];
    if (md(t) === "05-27") lambda *= 1.9;
    if (md(t) === "05-26") lambda *= 1.4;
    if (md(t) === "06-21") lambda *= 1.7;
    if (md(t) === "06-20") lambda *= 1.3;
    if (inWindow(t, indy[0], indy[1])) lambda *= 3;
    if (inWindow(t, b2s[0], b2s[1])) lambda *= 1.04;
    if (t >= at(2026, 11, 1)) lambda *= 1 + 0.025 * ((t - at(2026, 11, 1)) / DAY);
    const n = poisson(lambda);
    for (let k = 0; k < n; k++) {
      const time = lagosTime(t);
      const ubeWeight = t >= at(2026, 8, 3) ? 0.07 * Math.pow(1.4, (t - at(2026, 8, 3)) / (30.44 * DAY)) : 0;
      const main = weighted<keyof typeof P>([
        ["red", 0.42],
        ["ube", ubeWeight],
        ["choc", 0.16],
        ["brownie", 0.17],
        ["chin", t < at(2026, 11, 7) ? 0.2 * (1 - 0.75 * Math.min(1, months / 6)) : 0],
      ]);
      if (main === "brownie" && inWindow(t, stockout[0], stockout[1])) {
        lost++;
        continue; // sold out: the sale is lost
      }
      const channel = weighted<string>([
        ["web", 0.5],
        ["telegram", t >= at(2026, 6, 1) ? 0.1 + 0.06 * Math.min(1, (t - at(2026, 6, 1)) / (150 * DAY)) : 0],
        ["whatsapp", t >= at(2026, 8, 1) ? 0.04 + 0.1 * Math.min(1, (t - at(2026, 8, 1)) / (100 * DAY)) : 0],
        ["instagram", 0.12],
        ["facebook", 0.1],
        ["tiktok", 0.005],
        ["google", 0.03],
      ]);
      const qty = (key: keyof typeof P) => (key === "chin" ? int(1, 4) : key === "brownie" ? int(1, 2) : chance(channel === "google" ? 0.5 : 0.08) ? 2 : 1);
      const keys: (keyof typeof P)[] = [main];
      if (chance(0.15)) keys.push(weighted<keyof typeof P>([["brownie", inWindow(t, stockout[0], stockout[1]) ? 0 : 1], ["chin", t < at(2026, 11, 7) ? 1 : 0], ["red", 0.3]]));
      const promo = inWindow(t, indy[0], indy[1]) ? chance(0.75) : inWindow(t, b2s[0], b2s[1]) ? chance(0.3) : false;
      const merged = new Map<string, number>();
      for (const key of keys) merged.set(P[key], (merged.get(P[key]) ?? 0) + qty(key));
      const lines: Line[] = [...merged].map(([id, quantity]) => {
        const p = prod.get(id)!;
        const unit = promo ? Math.round(p.price_minor * 0.9) : p.price_minor;
        return { productId: id, name: p.name, quantity, unit, line: unit * quantity };
      });
      const total = lines.reduce((s, l) => s + l.line, 0);
      // Who: regulars and returning buyers, or someone new. Leads convert after the 15 Oct campaign.
      let contact: Contact;
      const leadsWindow = inWindow(t, at(2026, 10, 15), at(2026, 10, 25));
      if (customers.length > 20 && chance(0.6)) {
        const regulars = customers.filter((c) => c.regular);
        contact = regulars.length > 0 && chance(0.6) ? pick(regulars) : pick(customers);
      } else if (leadsWindow && chance(0.35) && leadPool.some((c) => c.orders === 0)) {
        contact = leadPool.find((c) => c.orders === 0)!;
        customers.push(contact);
      } else {
        contact = newPool[nextNew++ % newPool.length];
        if (contact.orders === 0) customers.push(contact);
      }
      if (contact.orders === 0) {
        contact.firstSeen = time - int(1, 72) * 3_600_000;
        contact.consentChannel = channel === "telegram" ? "telegram" : channel === "whatsapp" ? "whatsapp" : "email";
      }
      contact.orders++;
      const ngnPerUsd = fx.get(ymd(t))!;
      const fxRate = lockRate(1 / ngnPerUsd);
      const charge = convertMinor(total, "NGN", "USD", fxRate);
      const fee = Math.round(charge * 0.0449) + 49;
      const post = ["instagram", "facebook", "tiktok", "google", "telegram"].includes(channel) && chance(0.75) ? lastPostBefore(channel, time) : undefined;
      // The click that led to this order, a few minutes to an hour and a half before it.
      if (post) clicks.push({ store_id: demo.id, link_id: linkByCode.get(post.code), at: iso(Math.max(post.t + 5 * 60_000, time - int(5, 90) * 60_000)), country: contact.country, device: "mobile" });
      orders.push({
        ref: `D${orders.length + 1}`,
        t: time,
        channel,
        contact,
        lines,
        total,
        tax: Math.round((total * 750) / 10_750),
        chargeCurrency: "USD",
        charge,
        fxRate,
        fee,
        refunded: 0,
        refundedCharge: 0,
        linkCode: post?.code,
        fulfilledAt: t >= END - DAY ? undefined : time + int(20, 52) * 3_600_000,
      });
    }
  }
  return { orders, lost };
}

function genUkOrders(contacts: Contact[]): GenOrder[] {
  rand = mulberry32(SEED + 5);
  const orders: GenOrder[] = [];
  let nextNew = 0;
  const customers: Contact[] = [];
  for (const t of days.filter((d) => d >= at(2026, 8, 9))) {
    const dow = new Date(t).getUTCDay();
    const n = poisson(1.45 * [1.2, 0.7, 0.8, 0.85, 0.95, 1.2, 1.3][dow] * (1 + (t - at(2026, 8, 9)) / (200 * DAY)));
    for (let k = 0; k < n; k++) {
      const time = t + int(8, 21) * 3_600_000 + int(0, 59) * 60_000;
      const id = weighted<string>([[UK.red, 0.45], [UK.lemon, 0.25], [UK.coco, 0.3]]);
      const quantity = chance(0.2) ? 2 : 1;
      const p = ukProd.get(id)!;
      const lines = [{ productId: id, name: p.name, quantity, unit: p.price_minor, line: p.price_minor * quantity }];
      const total = lines[0].line;
      let contact: Contact;
      if (customers.length > 10 && chance(0.4)) contact = pick(customers);
      else {
        contact = contacts[nextNew++ % contacts.length];
        if (contact.orders === 0) {
          customers.push(contact);
          contact.firstSeen = time - int(1, 48) * 3_600_000;
        }
      }
      contact.orders++;
      orders.push({
        ref: `U${orders.length + 1}`,
        t: time,
        channel: weighted([["web", 0.6], ["instagram", 0.25], ["facebook", 0.15]]),
        contact,
        lines,
        total,
        tax: 0,
        chargeCurrency: "GBP",
        charge: total,
        fxRate: null,
        fee: Math.round(total * 0.029) + 30,
        refunded: 0,
        refundedCharge: 0,
        fulfilledAt: t >= END - DAY ? undefined : time + int(20, 52) * 3_600_000,
      });
    }
  }
  return orders;
}

function applyRefunds(orders: GenOrder[], seedOffset: number) {
  rand = mulberry32(SEED + seedOffset);
  for (const o of orders) {
    if (!chance(0.04)) continue;
    const partial = chance(1 / 3);
    o.partial = partial;
    o.refunded = partial ? Math.round(o.total * between(0.2, 0.5)) : o.total;
    o.refundedCharge = o.fxRate ? Math.min(o.charge, convertMinor(o.refunded, "NGN", "USD", o.fxRate)) : Math.min(o.charge, o.refunded);
    o.refundAt = Math.min(o.t + int(4, 72) * 3_600_000, END + DAY - 60_000);
  }
}

// ─── write CSVs and load through the import module ───
const ORDER_COLS = ["order_ref", "paid_at", "status", "channel", "contact_ref", "product_id", "product_name", "quantity", "unit_minor", "line_minor", "currency", "total_minor", "tax_minor", "tax_rate_bp", "tax_inclusive", "charge_currency", "charge_total_minor", "fx_rate", "fx_source", "paypal_fee_minor", "paypal_net_minor", "refunded_minor", "refunded_charge_minor", "delivery_country", "buyer_country", "link_code", "fulfilled_at"] as const;
const CONTACT_COLS = ["ref", "name", "email", "phone", "telegram_username", "country", "first_seen_at", "marketing_consent", "consent_channel", "labels"] as const;
const REFUND_COLS = ["order_ref", "amount_minor", "currency", "store_amount_minor", "vat_reversed_minor", "reason", "created_at"] as const;

async function load(slug: string, storeId: string, currency: string, deliveryCountry: string, vatBp: number, contacts: Contact[], orders: GenOrder[]) {
  const dir = `data/demo/${slug}`;
  mkdirSync(dir, { recursive: true });
  const contactRows = contacts.map((c) => ({
    ref: c.ref,
    name: c.name,
    email: c.email,
    phone: c.phone,
    telegram_username: c.telegram,
    country: c.country,
    first_seen_at: iso(c.firstSeen ?? START + Math.floor(rand() * (END - START))),
    marketing_consent: c.marketing ? "yes" : "no",
    consent_channel: c.consentChannel,
    labels: c.labels.join(";"),
  }));
  const orderRows = orders.flatMap((o) =>
    o.lines.map((l) => ({
      order_ref: o.ref,
      paid_at: iso(o.t),
      status: o.refunded === 0 ? "paid" : o.refunded >= o.total ? "refunded" : "partially_refunded",
      channel: o.channel,
      contact_ref: o.contact.ref,
      product_id: l.productId,
      product_name: l.name,
      quantity: l.quantity,
      unit_minor: l.unit,
      line_minor: l.line,
      currency,
      total_minor: o.total,
      tax_minor: o.tax,
      tax_rate_bp: vatBp,
      tax_inclusive: "true",
      charge_currency: o.chargeCurrency,
      charge_total_minor: o.charge,
      fx_rate: o.fxRate ?? undefined,
      fx_source: o.fxRate ? "open.er-api.com" : undefined,
      paypal_fee_minor: o.fee,
      paypal_net_minor: o.charge - o.fee,
      refunded_minor: o.refunded,
      refunded_charge_minor: o.refundedCharge,
      delivery_country: deliveryCountry,
      buyer_country: o.contact.country,
      link_code: o.linkCode,
      fulfilled_at: o.fulfilledAt ? iso(o.fulfilledAt) : undefined,
    })),
  );
  const refundRows = orders
    .filter((o) => o.refunded > 0)
    .map((o) => ({
      order_ref: o.ref,
      amount_minor: o.refundedCharge,
      currency: o.chargeCurrency,
      store_amount_minor: o.refunded,
      vat_reversed_minor: Math.round((o.tax * o.refunded) / o.total),
      reason: o.partial ? pick(["Cake damaged in delivery", "Wrong message on the cake", "Late delivery"]) : pick(["Couldn't deliver on the day", "Customer cancelled in time", "Duplicate payment"]),
      created_at: iso(o.refundAt!),
    }));
  writeFileSync(`${dir}/contacts.csv`, toCsv(contactRows, [...CONTACT_COLS]));
  writeFileSync(`${dir}/orders.csv`, toCsv(orderRows, [...ORDER_COLS]));
  writeFileSync(`${dir}/refunds.csv`, toCsv(refundRows, [...REFUND_COLS]));

  const c = await importContactsCsv(storeId, readFileSync(`${dir}/contacts.csv`, "utf8"));
  const o = await importOrdersCsv(storeId, readFileSync(`${dir}/orders.csv`, "utf8"), c.ids);
  const r = await importRefundsCsv(storeId, readFileSync(`${dir}/refunds.csv`, "utf8"), o.ids);
  const problems = [...c.problems, ...o.problems, ...r.problems];
  if (problems.length > 0) throw new Error(`${slug} import problems: ${JSON.stringify(problems.slice(0, 5))}`);
  return { contactIds: c.ids, orderIds: o.ids };
}

const demoContacts = makeContacts("C", 900, 0.17, "NG", 160, 620);
const { orders: demoOrders, lost } = genDemoOrders(demoContacts);
applyRefunds(demoOrders, 6);
rand = mulberry32(SEED + 7);
for (const c of demoContacts) {
  if (c.orders >= 4) c.labels.push("Birthday regular");
  if (c.orders > 0 && chance(0.05)) c.labels.push("Corporate");
  if (chance(0.07)) c.labels.push("Abuja");
  if (c.orders >= 2 && chance(0.04)) c.labels.push("Wholesale");
}
const ukContacts = makeContacts("K", 120, 0, "GB", 25, 110);
const ukOrders = genUkOrders(ukContacts);
applyRefunds(ukOrders, 8);

await insertAll("link_clicks", clicks);
const demoIds = await load("demo", demo.id, "NGN", "NG", 750, demoContacts, demoOrders);
const ukIds = await load("eko-sweet-kitchen-uk", uk.id, "GBP", "GB", 0, ukContacts, ukOrders);

// System labels: customer (1+ paid order) and lead. Computed, can't be deleted in the app.
for (const [storeId, contacts, ids] of [[demo.id, demoContacts, demoIds.contactIds], [uk.id, ukContacts, ukIds.contactIds]] as const) {
  const sys = await must(
    admin.from("labels").insert([{ store_id: storeId, name: "customer", colour: "#2F9E5B", system: true }, { store_id: storeId, name: "lead", colour: "#E3FF48", system: true }]).select("id, name"),
    "system labels",
  );
  const byName = new Map(sys.map((l) => [l.name, l.id]));
  await insertAll("contact_labels", contacts.map((c) => ({ store_id: storeId, contact_id: ids.get(c.ref), label_id: byName.get(c.orders > 0 ? "customer" : "lead") })));
}

// ─── campaigns and sends ───
rand = mulberry32(SEED + 9);
const labels = await must(admin.from("labels").select("id, name").eq("store_id", demo.id), "labels");
const labelId = new Map(labels.map((l) => [l.name, l.id]));
const CAMPAIGNS = [
  { name: "Children's Day treats", kind: "broadcast", t: at(2026, 5, 24), seg: [] as string[] },
  { name: "We're on Telegram now", kind: "broadcast", t: at(2026, 6, 3), seg: [] },
  { name: "Father's Day cakes", kind: "broadcast", t: at(2026, 6, 18), seg: ["customer"] },
  { name: "New: Ube Coconut Cake", kind: "new_product", t: at(2026, 8, 3), seg: ["customer"] },
  { name: "Brownie boxes are back", kind: "restock", t: at(2026, 9, 7), seg: ["customer"] },
  { name: "BACK2SCHOOL ends tomorrow", kind: "promo_ending", t: at(2026, 9, 14), seg: [] },
  { name: "INDEPENDENCE10 ends in 24 hours", kind: "promo_ending", t: at(2026, 9, 30), seg: [] },
  { name: "Your first cake, 10% off", kind: "broadcast", t: at(2026, 10, 15), seg: ["lead"] },
  { name: "Christmas pre-orders open", kind: "broadcast", t: at(2026, 11, 3), seg: ["customer"] },
  { name: "Weekend specials for regulars", kind: "broadcast", t: at(2026, 11, 13), seg: ["Birthday regular"], future: true },
];
const campaignRows = await must(
  admin
    .from("campaigns")
    .insert(
      CAMPAIGNS.map((c) => ({
        store_id: demo.id,
        name: c.name,
        kind: c.kind,
        segment: c.seg.map((s) => labelId.get(s)!),
        channels: ["telegram", "whatsapp", "email"],
        message: c.name,
        status: "future" in c && c.future ? "scheduled" : "sent",
        scheduled_at: iso(c.t + 9 * 3_600_000),
        source: "seed",
        created_at: iso(c.t - 2 * DAY),
      })),
    )
    .select("id"),
  "campaigns",
);
const sends: Record<string, unknown>[] = [];
CAMPAIGNS.forEach((c, i) => {
  if ("future" in c && c.future) return;
  const audience = demoContacts.filter((x) => (c.seg.length === 0 ? true : c.seg.some((s) => (s === "customer" ? x.orders > 0 : s === "lead" ? x.orders === 0 && x.lead : x.labels.includes(s))))).filter((x) => (x.firstSeen ?? START) < c.t || x.lead);
  for (const x of audience.slice(0, 400)) {
    const channel = x.consentChannel === "email" ? "email" : x.consentChannel;
    const outsideWindow = channel === "whatsapp" && chance(0.3);
    sends.push({
      store_id: demo.id,
      campaign_id: campaignRows[i].id,
      contact_id: demoIds.contactIds.get(x.ref),
      channel,
      status: !x.marketing ? "skipped" : outsideWindow ? "skipped" : "sent",
      skipped_reason: !x.marketing ? "opted_out" : outsideWindow ? "outside_whatsapp_window" : null,
      sent_at: x.marketing && !outsideWindow ? iso(c.t + 9 * 3_600_000) : null,
    });
  }
});
await insertAll("campaign_sends", sends);

await insertAll("promotions", [
  { store_id: demo.id, code: "INDEPENDENCE10", kind: "percent", value: 10, starts_at: iso(at(2026, 9, 25) - 3_600_000), ends_at: iso(at(2026, 10, 2) - 3_600_000), source: "seed" },
  { store_id: demo.id, code: "BACK2SCHOOL", kind: "percent", value: 10, starts_at: iso(at(2026, 9, 8) - 3_600_000), ends_at: iso(at(2026, 9, 16) - 3_600_000), source: "seed" },
]);

// ─── visits, expenses, withdrawals ───
rand = mulberry32(SEED + 10);
const byDay = (orders: GenOrder[]) => {
  const m = new Map<string, GenOrder[]>();
  for (const o of orders) m.set(ymd(o.t), [...(m.get(ymd(o.t)) ?? []), o]);
  return m;
};
const demoByDay = byDay(demoOrders);
const ukByDay = byDay(ukOrders);
const visits: Record<string, unknown>[] = [];
for (const t of days) {
  const n = demoByDay.get(ymd(t))?.length ?? 0;
  const v = Math.round((n + 0.5) / between(0.022, 0.038));
  visits.push({ store_id: demo.id, day: ymd(t), path: "/", visits: v, unique_visitors: Math.round(v * between(0.74, 0.86)) });
  if (t >= at(2026, 8, 9)) {
    const u = ukByDay.get(ymd(t))?.length ?? 0;
    const uv = Math.round((u + 0.4) / between(0.025, 0.04));
    visits.push({ store_id: uk.id, day: ymd(t), path: "/", visits: uv, unique_visitors: Math.round(uv * 0.8) });
  }
}
await insertAll("store_visits", visits);

const expenses: Record<string, unknown>[] = [];
const months = [...new Set(days.map((t) => ymd(t).slice(0, 7)))];
for (const m of months) {
  const monthOrders = demoOrders.filter((o) => ymd(o.t).startsWith(m));
  const revenue = monthOrders.reduce((s, o) => s + o.total - o.refunded, 0);
  const mDays = days.filter((t) => ymd(t).startsWith(m));
  const weekly = mDays.filter((t) => new Date(t).getUTCDay() === 1);
  for (const w of weekly) {
    const share = 1 / Math.max(1, weekly.length);
    expenses.push({ store_id: demo.id, day: ymd(w), amount_minor: Math.round(revenue * 0.11 * share * between(0.9, 1.1)), currency: "NGN", category: "Flour", note: "Weekly flour", source: "seed" });
    expenses.push({ store_id: demo.id, day: ymd(w), amount_minor: Math.round(revenue * 0.06 * share * between(0.9, 1.1)), currency: "NGN", category: "Sugar", source: "seed" });
    expenses.push({ store_id: demo.id, day: ymd(w + DAY), amount_minor: Math.round(revenue * 0.09 * share * between(0.9, 1.1)), currency: "NGN", category: "Butter", source: "seed" });
    expenses.push({ store_id: demo.id, day: ymd(w + 2 * DAY), amount_minor: Math.round(revenue * 0.06 * share * between(0.9, 1.1)), currency: "NGN", category: "Delivery riders", source: "seed" });
  }
  const first = mDays[0];
  const last = mDays[mDays.length - 1];
  expenses.push({ store_id: demo.id, day: ymd(first), amount_minor: Math.round(revenue * 0.05), currency: "NGN", category: "Packaging", source: "seed" });
  expenses.push({ store_id: demo.id, day: ymd(first + 4 * DAY > last ? first : first + 4 * DAY), amount_minor: 18_000_000, currency: "NGN", category: "Gas", source: "seed" });
  if (mDays.length > 20) expenses.push({ store_id: demo.id, day: ymd(last), amount_minor: 140_000_000, currency: "NGN", category: "Staff", note: "Two bakers and a packer", source: "seed" });
  expenses.push({ store_id: demo.id, day: ymd(first + DAY > last ? first : first + DAY), amount_minor: 25_000_000, currency: "NGN", category: "Ads (demo)", source: "seed" });
}
await insertAll("expenses", expenses.filter((e) => (e.day as string) <= ymd(END)));

const withdrawals: Record<string, unknown>[] = [];
{
  let pending = 0; // USD cents of net not yet withdrawn
  let cursor = 0;
  const sorted = [...demoOrders].sort((a, b) => a.t - b.t);
  for (const t of days) {
    while (cursor < sorted.length && sorted[cursor].t < t + DAY) {
      const o = sorted[cursor++];
      pending += o.charge - o.fee - o.refundedCharge;
    }
    const dom = new Date(t).getUTCDate();
    if ((dom === 10 || dom === 20 || (dom === 28 && chance(0.5))) && pending > 50_000) {
      const usd = Math.round(pending * between(0.8, 0.92));
      pending -= usd;
      const rate = Math.round(fx.get(ymd(t))! * (1 - between(0.012, 0.022)) * 100) / 100;
      withdrawals.push({ owner_id: owner.id, store_id: demo.id, day: ymd(t), usd_minor: usd, ngn_minor: Math.round(usd * rate), rate, provider: "paga", reference: `PAGA-${(SEED + withdrawals.length * 7919).toString(36).toUpperCase()}`, source: "seed" });
    }
  }
}
await insertAll("withdrawals", withdrawals);

// ─── media library: product photos ───
await insertAll(
  "media",
  [...demoProducts, ...ukProducts]
    .filter((p) => p.image_url)
    .map((p) => ({ owner_id: owner.id, store_id: prod.has(p.id) ? demo.id : uk.id, url: p.image_url, kind: "image", tags: ["product photo", p.name], product_ids: [p.id], source: "seed" })),
);

// ─── insights: computed from the data above, so every claim holds ───
const monthTotal = (pid: string, m: string) => demoOrders.filter((o) => ymd(o.t).startsWith(m)).reduce((s, o) => s + o.lines.filter((l) => l.productId === pid).reduce((a, l) => a + l.line, 0), 0);
const ubeAug = monthTotal(P.ube, "2026-08");
const ubeOct = monthTotal(P.ube, "2026-10");
const weekBefore = demoOrders.filter((o) => inWindow(o.t, at(2026, 9, 17), at(2026, 9, 24) - 1)).length;
const indyWeek = demoOrders.filter((o) => inWindow(o.t, at(2026, 9, 25), at(2026, 10, 2) - 1)).length;
const b2sWeek = demoOrders.filter((o) => inWindow(o.t, at(2026, 9, 8), at(2026, 9, 16) - 1)).length;
const b2sBefore = demoOrders.filter((o) => inWindow(o.t, at(2026, 8, 31), at(2026, 9, 8) - 1)).length;
const tiktokClicks = clicks.filter((c) => posts.some((p) => p.channel === "tiktok" && linkByCode.get(p.code) === c.link_id)).length;
const tiktokOrders = demoOrders.filter((o) => o.channel === "tiktok").length;
const tiktokReach = metrics.filter((m) => m.channel === "tiktok").reduce((s, m) => s + (m.reach as number), 0);
const friSat = demoOrders.filter((o) => [5, 6].includes(new Date(o.t + 3_600_000).getUTCDay())).length / demoOrders.length;
const repeatRevenue = demoOrders.filter((o) => demoOrders.some((p) => p.contact === o.contact && p.t < o.t)).reduce((s, o) => s + o.total, 0) / demoOrders.reduce((s, o) => s + o.total, 0);
const googleAov = demoOrders.filter((o) => o.channel === "google").reduce((s, o) => s + o.total, 0) / Math.max(1, demoOrders.filter((o) => o.channel === "google").length);
const allAov = demoOrders.reduce((s, o) => s + o.total, 0) / demoOrders.length;
const naira = (minor: number) => `₦${Math.round(minor / 100).toLocaleString("en-NG")}`;
const growth = Math.pow(ubeOct / Math.max(1, ubeAug), 1 / 2) - 1;
await insertAll("insights", [
  { finding: `Ube Coconut grew about ${Math.round(growth * 100)}% a month since its August launch (${naira(ubeAug)} in August, ${naira(ubeOct)} in October).`, numbers: { aug: ubeAug, oct: ubeOct, monthlyGrowth: growth }, suggested_action: "Schedule a weekend Ube promo post?", period: "2026-08..2026-10" },
  { finding: `INDEPENDENCE10 drove ${(indyWeek / Math.max(1, weekBefore)).toFixed(1)}× the orders of the week before (${indyWeek} vs ${weekBefore}).`, numbers: { promoWeek: indyWeek, weekBefore }, suggested_action: "Plan a similar code for Christmas?", period: "2026-09-25..2026-10-01" },
  { finding: `BACK2SCHOOL barely moved sales: ${b2sWeek} orders vs ${b2sBefore} the week before.`, numbers: { promoWeek: b2sWeek, weekBefore: b2sBefore }, suggested_action: "Skip this promo next year?", period: "2026-09-08..2026-09-15" },
  { finding: `TikTok reached ${tiktokReach.toLocaleString("en")} people but converts at ${((100 * tiktokOrders) / Math.max(1, tiktokClicks)).toFixed(1)}% of clicks (${tiktokOrders} orders from ${tiktokClicks} clicks).`, numbers: { reach: tiktokReach, clicks: tiktokClicks, orders: tiktokOrders }, suggested_action: "Move TikTok effort to Instagram?", period: "6m" },
  { finding: `Fridays and Saturdays bring ${Math.round(friSat * 100)}% of orders.`, numbers: { share: friSat }, suggested_action: "Post on Thursday evenings?", period: "6m" },
  { finding: `${Math.round(repeatRevenue * 100)}% of revenue comes from customers who bought before.`, numbers: { share: repeatRevenue }, suggested_action: "Send regulars a thank-you offer?", period: "6m" },
  { finding: `Google orders are worth ${naira(googleAov)} on average, ${(googleAov / allAov).toFixed(1)}× the store average.`, numbers: { googleAov, allAov }, suggested_action: "Ask happy Google customers for a review?", period: "6m" },
  { finding: `Fudge Brownie Box sold out 2–6 September; about ${lost} orders were lost.`, numbers: { lostOrders: lost }, suggested_action: "Raise the low-stock alert to 10 boxes?", period: "2026-09-02..2026-09-06" },
].map((i) => ({ ...i, store_id: demo.id, source: "seed", status: "new" })));

// ─── report ───
const monthly = months.map((m) => `${m}: ${naira(demoOrders.filter((o) => ymd(o.t).startsWith(m)).reduce((s, o) => s + o.total - o.refunded, 0))}`);
console.log(`demo: ${demoOrders.length} orders, ${demoContacts.length} contacts, ${demoOrders.filter((o) => o.refunded).length} refunds, ${posts.length} posts, ${clicks.length} clicks, ${withdrawals.length} withdrawals, ${expenses.length} expenses, ${lost} lost to stockout`);
console.log(`uk: ${ukOrders.length} orders, ${ukContacts.length} contacts, ${ukOrders.filter((o) => o.refunded).length} refunds`);
console.log(`abroad share: ${Math.round((100 * demoOrders.filter((o) => o.contact.country !== "NG").length) / demoOrders.length)}%`);
console.log(monthly.join("\n"));
console.log(`history ${ymd(START)} → ${ymd(END)}`);
