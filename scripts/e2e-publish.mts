// Step 4.2 on production as the demo seller: approval, the scheduled job, a real post to the Telegram channel, and the pack.
// Publishes ONE real post to the channel and leaves it there. Removes the other test posts. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-publish.mts [imageFolder]
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const base = "https://axorios.vercel.app";
const imageFolder = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function check(ok: boolean, label: string, detail = "") {
  if (!ok) throw new Error(`FAIL ${label} ${detail}`);
  console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
}

const { data: signIn, error } = await anon.auth.signInWithPassword({
  email: process.env.DEMO_SELLER_EMAIL!,
  password: process.env.DEMO_SELLER_PASSWORD!,
});
if (error || !signIn.session) throw new Error(`Sign-in failed: ${error?.code}`);
const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;

const { data: store, error: storeError } = await admin.from("stores").select("id, slug").eq("slug", "demo").single();
if (storeError) throw new Error(`Demo store read failed: ${storeError.code}`);
const { data: before } = await admin.from("posts").select("id").eq("store_id", store.id);
const existing = new Set((before ?? []).map((p) => p.id));

// The demo seller's chat history is the demo's, so this sends a one-off history and restores the saved session after.
const { data: session } = await admin.from("agent_sessions").select("id, messages").eq("store_id", store.id).limit(1).maybeSingle();

type Msg = { id: string; role: string; parts: Record<string, unknown>[] };
async function agent(messages: Msg[]) {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`Agent HTTP ${res.status}`);
  return (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
}
const userMessage = (text: string): Msg => ({ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] });

/** Asks to schedule, checks nothing happened yet, then answers the approval the way the card does. */
async function askToSchedule(postId: string, approved: boolean) {
  const first = userMessage(`Schedule post ${postId} to go out 2 minutes from now.`);
  const events = await agent([first]);
  const call = events.find((e) => e.type === "tool-input-available" && e.toolName === "schedule_posts");
  const request = events.find((e) => e.type === "tool-approval-request");
  check(Boolean(call && request), "asking to schedule returns an approval request, not a schedule");
  const { data: waiting } = await admin.from("posts").select("status").eq("id", postId).single();
  check(waiting?.status === "draft", "the post stays a draft until the seller answers", waiting?.status);

  const answered = await agent([
    first,
    {
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [
        { type: "step-start" },
        {
          type: "tool-schedule_posts",
          toolCallId: call.toolCallId,
          state: "approval-responded",
          input: call.input,
          approval: { id: request.approvalId, approved },
        },
      ],
    },
  ]);
  return { answered, input: call.input as { posts: { scheduledAt: string }[] } };
}

let published = "";
let exit = 0;
try {
  console.log("1. Generate a campaign on the demo store");
  const queued = await agent([userMessage("Make me 3 posts for birthday season.")]);
  check(queued.some((e) => e.type === "tool-input-available" && e.toolName === "generate_campaign"), "agent called generate_campaign");
  const started = Date.now();
  type Row = { id: string; status: string; caption: string; media_url: string | null; campaign_id: string | null; publish_results: Record<string, { url?: string; at?: string }>; scheduled_at: string | null };
  let posts: Row[] = [];
  while (Date.now() - started < 120_000) {
    const { data } = await admin.from("posts").select("id, status, caption, media_url, campaign_id, publish_results, scheduled_at").eq("store_id", store.id);
    posts = ((data ?? []) as Row[]).filter((p) => !existing.has(p.id));
    if (posts.length > 0 && posts.every((p) => p.status !== "generating")) break;
    await sleep(3000);
  }
  check(posts.length === 3 && posts.every((p) => p.status === "draft"), "3 drafts", posts.map((p) => p.status).join());
  if (imageFolder) {
    mkdirSync(imageFolder, { recursive: true });
    for (const [i, p] of posts.entries()) writeFileSync(join(imageFolder, `${i}.png`), Buffer.from(await (await fetch(p.media_url!)).arrayBuffer()));
  }
  const [toPublish, toDeny, toCancel] = posts;
  const campaignId = toPublish.campaign_id!;

  console.log("2. Download pack");
  check((await fetch(`${base}/api/campaigns/${campaignId}/pack`)).status === 401, "a signed-out download is refused");
  const pack = await fetch(`${base}/api/campaigns/${campaignId}/pack`, { headers: { Cookie: cookie } });
  check(pack.ok && pack.headers.get("content-type") === "application/zip", "the owner gets a zip");
  const dir = mkdtempSync(join(tmpdir(), "axorios-pack-"));
  writeFileSync(join(dir, "pack.zip"), Buffer.from(await pack.arrayBuffer()));
  execFileSync("C:\\Windows\\System32\\tar.exe", ["-xf", join(dir, "pack.zip"), "-C", dir]); // Windows' tar reads zips.
  const folders = readdirSync(dir).filter((f) => f.startsWith("post-"));
  check(folders.length === 3, "the zip opens and holds 3 posts", folders.join());
  check(readdirSync(join(dir, "post-1")).sort().join() === "caption.txt,image.png,suggested-time.txt", "each has image, caption and suggested time");
  check(readFileSync(join(dir, "post-1", "image.png")).subarray(1, 4).toString() === "PNG", "the image in the zip is a PNG");
  rmSync(dir, { recursive: true, force: true });
  const one = await fetch(`${base}/api/campaigns/${campaignId}/pack?post=${toPublish.id}`, { headers: { Cookie: cookie } });
  check(one.ok, "a single post's pack downloads");

  console.log("3. Denying leaves the post alone");
  await askToSchedule(toDeny.id, false);
  await sleep(1500);
  const { data: denied } = await admin.from("posts").select("status, scheduled_at").eq("id", toDeny.id).single();
  check(denied?.status === "draft" && !denied.scheduled_at, "denied post is still an unscheduled draft");

  console.log("4. Approving schedules it");
  const { input } = await askToSchedule(toPublish.id, true);
  await sleep(1500);
  const { data: scheduled } = await admin.from("posts").select("status, scheduled_at, targets").eq("id", toPublish.id).single();
  check(scheduled?.status === "scheduled", "approved post is scheduled", scheduled?.status);
  check(scheduled?.targets?.join() === "telegram_channel", "demo store's target is the Telegram channel");
  const dueAt = new Date(scheduled!.scheduled_at!);
  console.log(`  asked for ${input.posts[0].scheduledAt}; due ${dueAt.toISOString()}, in ${Math.round((dueAt.getTime() - Date.now()) / 1000)} s`);

  console.log("5. A cancelled post doesn't go out");
  const { error: cancelError } = await admin
    .from("posts")
    .update({ status: "scheduled", scheduled_at: new Date(Date.now() + 60_000).toISOString(), targets: ["telegram_channel"] })
    .eq("id", toCancel.id);
  if (cancelError) throw new Error(cancelError.code);
  await anonInngest(toCancel.id);
  await admin.from("posts").update({ status: "draft", scheduled_at: null }).eq("id", toCancel.id);

  console.log("6. Wait for the scheduled minute");
  let row: Row | undefined;
  while (Date.now() < dueAt.getTime() + 120_000) {
    const { data } = await admin.from("posts").select("id, status, caption, media_url, campaign_id, publish_results, scheduled_at").eq("id", toPublish.id).single();
    row = data as Row;
    if (row.status !== "scheduled") break;
    await sleep(5000);
  }
  console.log(`  status=${row?.status} results=${JSON.stringify(row?.publish_results)}`);
  check(row?.status === "published", "the post published");
  const result = row!.publish_results.telegram_channel;
  const lateBy = (new Date(result.at!).getTime() - dueAt.getTime()) / 1000;
  check(lateBy >= 0 && lateBy < 60, "at the scheduled minute", `${lateBy.toFixed(1)} s after the time`);
  published = result.url!;
  const page = await fetch(`${published}?embed=1`).then((r) => r.text());
  check(page.includes("tgme_widget_message"), "the post exists on Telegram", published);

  await sleep(75_000 - Math.min(75_000, Date.now() - dueAt.getTime()));
  const { data: stayed } = await admin.from("posts").select("status, publish_results").eq("id", toCancel.id).single();
  check(stayed?.status === "draft" && !Object.keys(stayed.publish_results as object).length, "the cancelled post stayed a draft and never posted");
  console.log("ALL PASS");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  exit = 1;
} finally {
  const { data: rows } = await admin.from("posts").select("id, status").eq("store_id", store.id);
  const stale = (rows ?? []).filter((p) => !existing.has(p.id) && p.status !== "published").map((p) => p.id);
  if (stale.length) {
    await admin.from("posts").delete().in("id", stale);
    await admin.storage.from("store-assets").remove(stale.map((id) => `stores/${store.id}/posts/${id}.png`));
  }
  if (session) await admin.from("agent_sessions").update({ messages: session.messages }).eq("id", session.id);
  console.log(`cleanup: removed ${stale.length} test posts${published ? `; kept the real post ${published}` : ""}`);
}
process.exit(exit);

/** Queues the same event the app queues for a scheduled post. */
async function anonInngest(postId: string) {
  const { data } = await admin.from("posts").select("scheduled_at").eq("id", postId).single();
  const res = await fetch(`https://inn.gs/e/${process.env.INNGEST_EVENT_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "publishers/post.publish",
      data: { storeId: store!.id, postId, scheduledAt: new Date(data!.scheduled_at!).toISOString() },
    }),
  });
  if (!res.ok) throw new Error(`Inngest send failed: HTTP ${res.status}`);
}
