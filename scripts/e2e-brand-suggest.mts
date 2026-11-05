// Does asking for name suggestions change the saved brand kit? Uses a throwaway seller, deleted at the end.
// Run: npx tsx --env-file=.env.local scripts/e2e-brand-suggest.mts [baseUrl]
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const email = `suggest-${randomBytes(4).toString("hex")}@example.com`;
const password = randomBytes(18).toString("base64url");
const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createError || !created.user) throw new Error(`User create failed: ${createError?.code}`);
const userId = created.user.id;

let failures = 0;
try {
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !signIn.session) throw new Error(`Sign-in failed: ${error?.code}`);
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;

  async function chat(history: unknown[], text: string) {
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
    const tools = events.filter((e) => e.type === "tool-input-available").map((e) => ({ name: e.toolName, input: e.input }));
    const assistant = { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: reply }] };
    return { tools, reply, messages: [...messages, assistant] };
  }

  async function kit() {
    const { data, error: e } = await admin.from("stores").select("brand_kit").eq("owner_id", userId).single();
    if (e) throw new Error(`Store read failed: ${e.code}`);
    return data.brand_kit as Record<string, unknown>;
  }

  // The options list is where suggestions belong, so only the other fields must stay put.
  const saved = async () => {
    const rest = await kit();
    delete rest.nameOptions;
    return rest;
  };

  const first = await chat([], "I bake celebration cakes in Lagos. Call the shop Sweet Crumbs.");
  const original = JSON.stringify(await saved());
  const originalKit = await kit();
  console.log(`setup: name=${originalKit.name}, tools=${first.tools.map((t) => t.name)}`);

  const asks = [
    "Abeg make the name sound more Lagos, wetin you fit suggest?",
    "Can you suggest some other names for the shop?",
    "What would be a better tagline? Just give me ideas.",
  ];
  for (const ask of asks) {
    const turn = await chat(first.messages, ask);
    const after = JSON.stringify(await saved());
    const changed = after !== original;
    if (changed) failures++;
    console.log(`${changed ? "FAIL" : "PASS"} "${ask}"`);
    console.log(`  tools: ${JSON.stringify(turn.tools)}`);
    console.log(`  reply: ${turn.reply.slice(0, 200)}`);
    if (changed) {
      console.log(`  saved kit changed: ${after}`);
      const { error: restoreError } = await admin
        .from("stores")
        .update({ brand_kit: originalKit })
        .eq("owner_id", userId);
      if (restoreError) throw new Error(`Restore failed: ${restoreError.code}`);
    }
  }

  // The fix must not stop a real rename.
  const rename = await chat(first.messages, "Change the name to Owambe Treats.");
  const renamed = (await kit()).name;
  if (renamed !== "Owambe Treats") failures++;
  console.log(`${renamed === "Owambe Treats" ? "PASS" : "FAIL"} an explicit rename still works: name=${renamed}, tools=${rename.tools.map((t) => t.name)}`);
} finally {
  await admin.from("stores").delete().eq("owner_id", userId);
  await admin.auth.admin.deleteUser(userId);
}
console.log(failures ? `${failures} of 3 suggestion requests changed the saved kit` : "PASS no suggestion request changed the saved kit");
process.exitCode = failures ? 1 : 0;
