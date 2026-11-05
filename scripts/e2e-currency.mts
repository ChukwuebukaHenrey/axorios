// Step 2.3: set_currency through the real agent, on a throwaway seller deleted at the end.
// Run: npx tsx --env-file=.env.local scripts/e2e-currency.mts [baseUrl]
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const email = `currency-${randomBytes(4).toString("hex")}@example.com`;
const password = randomBytes(18).toString("base64url");
const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createError || !created.user) throw new Error(`User create failed: ${createError?.code}`);
const userId = created.user.id;

function check(ok: boolean, label: string, detail = "") {
  if (!ok) throw new Error(`FAIL ${label} ${detail}`);
  console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
}

try {
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !signIn.session) throw new Error(`Sign-in failed: ${error?.code}`);
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;

  let history: unknown[] = [];
  async function chat(text: string) {
    const messages = [...history, { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] }];
    const res = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`Agent HTTP ${res.status}`);
    const events = (await res.text())
      .split("\n")
      .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
      .map((l) => JSON.parse(l.slice(6)));
    const reply = events.filter((e) => e.type === "text-delta").map((e) => e.delta).join("");
    const tools = events.filter((e) => e.type === "tool-input-available").map((e) => e.toolName as string);
    history = [...messages, { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: reply }] }];
    console.log(`  tools=${JSON.stringify(tools)} reply: ${reply.slice(0, 160)}`);
    return tools;
  }

  async function store() {
    const { data, error: e } = await admin
      .from("stores")
      .select("currency, settlement_currency")
      .eq("owner_id", userId)
      .single();
    if (e) throw new Error(`Store read failed: ${e.code}`);
    return data;
  }

  await chat("I bake cakes in Lagos. Call the shop Sweet Crumbs. I sell a birthday cake for 45,000 naira.");
  const start = await store();
  check(start.currency === "NGN" && start.settlement_currency === "USD", "a naira store settles in USD by default");

  const tools = await chat("Please charge my customers in euros instead of dollars.");
  const euros = await store();
  check(tools.includes("set_currency") && euros.settlement_currency === "EUR", "the owner can choose the charge currency", euros.settlement_currency);
  check(euros.currency === "NGN", "prices stay in naira");

  await chat("Actually make my store's prices in pounds, GBP.");
  check((await store()).currency === "NGN", "prices can't change currency while products are priced in naira");
} finally {
  await admin.from("stores").delete().eq("owner_id", userId);
  await admin.auth.admin.deleteUser(userId);
}
console.log("DONE");
