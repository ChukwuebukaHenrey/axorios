// End-to-end check of step 1.2 against a running app. Signs in as the demo seller; prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-catalog.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];

const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: signIn, error } = await auth.auth.signInWithPassword({
  email: process.env.DEMO_SELLER_EMAIL!,
  password: process.env.DEMO_SELLER_PASSWORD!,
});
if (error || !signIn.session) throw new Error(`Password sign-in failed: ${error?.code}`);
const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: storeRow, error: storeError } = await admin
  .from("stores")
  .select("id")
  .eq("owner_id", signIn.user!.id)
  .order("created_at")
  .limit(1)
  .single();
if (storeError || !storeRow) throw new Error(`Store read failed: ${storeError?.code}`);
const store = storeRow;

async function chat(text: string) {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] }] }),
  });
  if (!res.ok) throw new Error(`Agent HTTP ${res.status}: ${await res.text()}`);
  const events = (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
  const reply = events.filter((e) => e.type === "text-delta").map((e) => e.delta).join("");
  const tools = events.filter((e) => e.type === "tool-input-available");
  const errors = events.filter((e) => e.type === "error" || e.type === "tool-output-error");
  console.log(`  tools=${JSON.stringify(tools.map((e) => e.toolName))}, errors=${JSON.stringify(errors)}`);
  console.log(`  reply: ${reply.slice(0, 200)}`);
  return tools.map((e) => e.toolName) as string[];
}

async function rows() {
  const { data, error: e } = await admin
    .from("products")
    .select("name, price_minor, currency, stock")
    .eq("store_id", store.id)
    .order("created_at");
  if (e) throw new Error(`Product read failed: ${e.code}`);
  return data;
}

await admin.from("products").delete().eq("store_id", store.id);

console.log("1. Add products in naira");
const first = await chat("Add these: Red Velvet Cake 45,000 naira, Ube Celebration Cake 60,000 naira, Chin Chin Jar 3,500 naira.");
if (!first.includes("add_products")) throw new Error("add_products was not called");
const saved = await rows();
console.log(`  saved: ${JSON.stringify(saved)}`);
if (saved.length !== 3) throw new Error(`Expected 3 products, got ${saved.length}`);
const velvet = saved.find((p) => p.name.includes("Velvet"));
if (velvet?.price_minor !== 4_500_000 || velvet.currency !== "NGN") throw new Error("Red Velvet not saved as 4500000 NGN");
const { data: s2 } = await admin.from("stores").select("currency").eq("id", store.id).single();
if (s2?.currency !== "NGN") throw new Error(`Store currency is ${s2?.currency}`);
console.log("PASS 45,000 NGN saved as 4500000 minor units; store currency NGN");

console.log("2. Saying a product again changes it");
const second = await chat("Change the Red Velvet Cake to 50,000 naira.");
if (!second.includes("add_products")) throw new Error("add_products was not called");
const changed = await rows();
if (changed.length !== 3) throw new Error(`Expected 3 products, got ${changed.length}`);
if (changed.find((p) => p.name.includes("Velvet"))?.price_minor !== 5_000_000) throw new Error("Price not changed");
console.log("PASS price changed, no duplicate");

console.log("3. No price stated: must not invent one");
const before = (await rows()).length;
await chat("Add Coconut Cake to my products.");
const after = await rows();
if (after.length !== before) throw new Error(`Invented a price: ${JSON.stringify(after.at(-1))}`);
console.log("PASS no product saved without a price");

console.log("4. A signed-out visitor can't read a draft store's products");
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: leaked } = await anon.from("products").select("id").eq("store_id", store.id);
if (leaked?.length) throw new Error("Draft store's products are public");
console.log("PASS row-level security hides them");
