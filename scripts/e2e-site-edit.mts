// End-to-end check of step 1.4 against a running app: edit by chat, undo, edit again, select a section.
// Signs in as the demo seller; prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-site-edit.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";
import { signDraftToken } from "../src/modules/storefront/draft-token";

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
  .select("id, slug, status")
  .eq("owner_id", signIn.user!.id)
  .order("created_at")
  .limit(1)
  .single();
if (storeError || !storeRow) throw new Error(`Store read failed: ${storeError?.code}`);
const store = storeRow;

const token = signDraftToken(store.id, process.env.DRAFT_PREVIEW_SECRET!);
const preview = async () => {
  const res = await fetch(`${base}/s/${store.slug}?draft=${token}`);
  if (res.status !== 200) throw new Error(`Preview returned ${res.status}`);
  return res.text();
};

async function chat(text: string, selectedSectionId?: string) {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] }],
      selectedSectionId,
    }),
  });
  if (!res.ok) throw new Error(`Agent HTTP ${res.status}: ${await res.text()}`);
  const events = (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
  const tools = events.filter((e) => e.type === "tool-input-available");
  const errors = events.filter((e) => e.type === "error" || e.type === "tool-output-error");
  console.log(`  tools=${JSON.stringify(tools.map((e) => [e.toolName, e.input]))}`);
  if (errors.length) console.log(`  errors=${JSON.stringify(errors)}`);
  console.log(`  reply: ${events.filter((e) => e.type === "text-delta").map((e) => e.delta).join("").slice(0, 160)}`);
  return tools.map((e) => e.toolName) as string[];
}

async function versions() {
  const { data, error: e } = await admin
    .from("site_versions")
    .select("status")
    .eq("store_id", store.id);
  if (e) throw new Error(`Version read failed: ${e.code}`);
  return { drafts: data.filter((v) => v.status === "draft").length, archived: data.filter((v) => v.status === "archived").length };
}

await admin.from("site_versions").delete().eq("store_id", store.id);

const FIRST = "Sweet moments start here";
const SECOND = "Made for your big day";

console.log("0. Preview renders with no versions yet");
const start = await preview();
console.log(`PASS draft renders; noindex=${start.includes('name="robots" content="noindex')}`);
if (!start.includes('name="robots" content="noindex')) throw new Error("Draft preview is missing noindex");

console.log("1. Edit by chat");
const first = await chat(`Change the hero headline to exactly: ${FIRST}`);
if (!first.includes("edit_site")) throw new Error("edit_site was not called");
if (!(await preview()).includes(FIRST)) throw new Error("The preview didn't change");
console.log(`PASS preview shows the new headline; ${JSON.stringify(await versions())}`);

console.log("2. Undo");
const undo = await chat("Undo that last change.");
if (!undo.includes("revert_site")) throw new Error("revert_site was not called");
if ((await preview()).includes(FIRST)) throw new Error("The headline is still there after undo");
console.log(`PASS undo restored the previous version; ${JSON.stringify(await versions())}`);

console.log("3. Edit again");
const again = await chat(`Change the hero headline to exactly: ${SECOND}`);
if (!again.includes("edit_site")) throw new Error("edit_site was not called");
const html = await preview();
if (!html.includes(SECOND) || html.includes(FIRST)) throw new Error("Second edit didn't land cleanly");
console.log(`PASS second edit applied; ${JSON.stringify(await versions())}`);

console.log("4. A clicked section is what 'this' means");
const selected = await chat("Hide this.", "products");
if (!selected.includes("edit_site")) throw new Error("edit_site was not called");
const { data: latest } = await admin
  .from("site_versions")
  .select("config")
  .eq("store_id", store.id)
  .eq("status", "draft")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();
const sections = (latest!.config as { sections: { id: string; hidden: boolean }[] }).sections;
if (!sections.find((s) => s.id === "products")?.hidden) throw new Error("Selected section wasn't hidden");
if (sections.some((s) => s.id !== "products" && s.hidden)) throw new Error("Another section was hidden");
console.log("PASS only the selected section changed");

console.log("5. Drafts are private");
const forged = await fetch(`${base}/s/${store.slug}?draft=${signDraftToken(store.id, "x".repeat(44))}`);
const none = await fetch(`${base}/s/${store.slug}`);
if (store.status !== "live" && (forged.status !== 404 || none.status !== 404)) {
  throw new Error(`Forged ${forged.status}, no token ${none.status}`);
}
const forgedHtml = await forged.text();
if (forgedHtml.includes(SECOND)) throw new Error("A forged token showed the draft");
console.log(`PASS forged token ${forged.status}, no token ${none.status}`);
