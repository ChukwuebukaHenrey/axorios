// Step 5.1 on production: voice notes straight to the agent, through the real model, on a throwaway store deleted at the end.
// The audio files come from the folder given. They must hold the phrases listed below. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-voice.mts <audioFolder> [baseUrl]
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const folder = process.argv[2];
const base = process.argv[3] ?? "https://axorios.vercel.app";
if (!folder) throw new Error("Give the folder holding the audio files");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
function check(ok: boolean, label: string, detail = "") {
  if (!ok) throw new Error(`FAIL ${label} ${detail}`);
  console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
}

const MEDIA: Record<string, string> = { ".wav": "audio/wav", ".webm": "audio/webm", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };
const suffix = randomBytes(4).toString("hex");
const email = `voice-${suffix}@example.com`;
const password = randomBytes(18).toString("base64url");
const { data: created, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (userError || !created.user) throw new Error(`User create failed: ${userError?.code}`);

async function send(cookie: string, messages: unknown[]) {
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
  const calls = events.filter((e) => e.type === "tool-input-available");
  const transcript = calls.find((e) => e.toolName === "show_transcript")?.input?.transcript as string | undefined;
  const reply = events.filter((e) => e.type === "text-delta").map((e) => e.delta).join("");
  const errors = events.filter((e) => e.type === "error" || e.type === "tool-output-error");
  console.log(`  ${((Date.now() - started) / 1000).toFixed(1)} s, tools: ${calls.map((e) => e.toolName).join(", ")}`);
  console.log(`  heard: ${transcript}`);
  console.log(`  reply: ${reply.slice(0, 220)}`);
  if (errors.length) console.log(`  errors: ${JSON.stringify(errors).slice(0, 300)}`);
  return { calls: calls.map((e) => e.toolName as string), transcript: transcript ?? "", reply };
}

const voiceMessage = (file: string) => {
  const mediaType = MEDIA[extname(file)];
  const data = readFileSync(join(folder, file)).toString("base64");
  return { id: crypto.randomUUID(), role: "user", parts: [{ type: "file", mediaType, url: `data:${mediaType};base64,${data}` }] };
};

let exit = 0;
try {
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !signIn.session) throw new Error(`Sign-in failed: ${error?.code}`);
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;
  const { data: storeRow } = await admin.from("stores").insert({ owner_id: created.user.id, slug: `voice-${suffix}` }).select("id").single();
  const storeId = storeRow!.id as string;

  console.log("1. English: describes the business");
  const english = await send(cookie, [voiceMessage("english.wav")]);
  check(english.calls.includes("show_transcript"), "the transcript is shown");
  check(/cake/i.test(english.transcript) && /lagos/i.test(english.transcript), "what was said was understood", english.transcript);
  check(english.calls.includes("create_brand_kit"), "it acted on it: a brand kit was made");
  const { data: withKit } = await admin.from("stores").select("brand_kit").eq("id", storeId).single();
  check(Boolean((withKit?.brand_kit as { name?: string }).name), "the kit is saved", (withKit?.brand_kit as { name?: string }).name);

  console.log("2. Pidgin: adds a product with a price");
  const pidgin = await send(cookie, [voiceMessage("pidgin-product.wav")]);
  check(pidgin.calls.includes("show_transcript"), "the transcript is shown");
  check(pidgin.calls.includes("add_products"), "it acted on it: add_products was called");
  const { data: rows } = await admin.from("products").select("name, price_minor, currency").eq("store_id", storeId);
  console.log(`  saved: ${JSON.stringify(rows)}`);
  check(rows?.length === 1 && rows[0].price_minor === 4_500_000 && rows[0].currency === "NGN", "the spoken price saved exactly: 45,000 naira");

  console.log("3. Pidgin: asks a question");
  const question = await send(cookie, [voiceMessage("pidgin-question.wav")]);
  check(question.calls.includes("show_transcript"), "the transcript is shown");
  check(question.reply.length > 0, "it replied");

  console.log("4. No audio is saved");
  const { data: session } = await admin.from("agent_sessions").select("messages").eq("store_id", storeId).limit(1).single();
  const saved = JSON.stringify(session?.messages);
  check(!saved.includes("base64"), "the saved chat holds no audio", `${saved.length} chars`);
  check(saved.length < 50_000, "the saved chat stays small");

  console.log("5. Limits");
  const tooBig = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages: [{ id: "x", role: "user", parts: [{ type: "file", mediaType: "audio/webm", url: `data:audio/webm;base64,${"A".repeat(2_000_001)}` }] }] }),
  });
  check(tooBig.status === 413, "an oversized clip is refused", `HTTP ${tooBig.status}`);
  console.log("ALL PASS");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exit = 1;
} finally {
  await admin.auth.admin.deleteUser(created.user.id);
  console.log("cleanup done");
}
process.exit(exit);
