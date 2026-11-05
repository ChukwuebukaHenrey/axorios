// End-to-end check of step 1.1 against a running app. Signs in as the demo seller; prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-brand.mts [baseUrl]
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
console.log("PASS password sign-in");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function chat(history: unknown[], text: string) {
  const messages = [...history, { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] }];
  const started = Date.now();
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`Agent HTTP ${res.status}: ${await res.text()}`);
  const events = (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
  const reply = events.filter((e) => e.type === "text-delta").map((e) => e.delta).join("");
  const tools = events.filter((e) => e.type === "tool-input-available").map((e) => e.toolName);
  const errors = events.filter((e) => e.type === "error" || e.type === "tool-output-error");
  console.log(`  ${Date.now() - started} ms, tools=${JSON.stringify(tools)}, errors=${JSON.stringify(errors)}`);
  console.log(`  reply: ${reply.slice(0, 300)}`);
  return { tools, messages };
}

async function currentStore() {
  const { data, error: e } = await admin
    .from("stores")
    .select("id, slug, status, brand_kit, store_language")
    .eq("owner_id", signIn.user!.id)
    .order("created_at")
    .limit(1)
    .single();
  if (e) throw new Error(`Store read failed: ${e.code}`);
  return data;
}

console.log("1. Describe the business");
const first = await chat([], "I bake celebration cakes in Lagos, prices from 30,000 naira.");
if (!first.tools.includes("create_brand_kit")) throw new Error("create_brand_kit was not called");
const store = await currentStore();
const kit = store.brand_kit as { name: string; tagline: string; palette: Record<string, string>; fonts: object };
console.log(`  saved: ${JSON.stringify({ slug: store.slug, lang: store.store_language, name: kit.name, tagline: kit.tagline, palette: kit.palette, fonts: kit.fonts })}`);
if (!kit.name || !kit.palette?.primary) throw new Error("Brand kit was not saved");
console.log("PASS brand kit saved");

console.log("2. Edit one field by chat");
const second = await chat(first.messages, "Change the tagline to: Every birthday deserves this.");
if (!second.tools.includes("update_brand_kit")) throw new Error("update_brand_kit was not called");
const after = (await currentStore()).brand_kit as typeof kit;
if (!after.tagline.includes("Every birthday")) throw new Error(`Tagline unchanged: ${after.tagline}`);
if (after.name !== kit.name || after.palette.primary !== kit.palette.primary) throw new Error("Other fields changed");
console.log("PASS only the tagline changed");

console.log("3. Pidgin");
await chat(second.messages, "Abeg make the name sound more Lagos, wetin you fit suggest?");

console.log("4. Signed-out request is refused");
const anon = await fetch(`${base}/api/agent`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ id: "x", role: "user", parts: [{ type: "text", text: "hi" }] }] }),
});
if (anon.status !== 401) throw new Error(`Expected 401, got ${anon.status}`);
const page = await fetch(`${base}/build`, { redirect: "manual" });
console.log(`PASS 401 on agent; /build signed out -> ${page.status} ${page.headers.get("location")}`);
