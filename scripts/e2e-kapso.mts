// Step 6.11: Kapso WhatsApp, everything except the real phone round trip.
// Forged and unsigned webhooks get 403; a signed `start demo` binds the chat; a signed text opens the
// conversation with a 24 h window; the Inbox shows the countdown, then the template picker once the window has
// closed, and the "WhatsApp paused" banner while the store is flagged. Cleans up its own rows.
//
// The server must run with test-only Kapso values and a local Inngest dev server, so nothing reaches production:
//   WHATSAPP_PROVIDER=kapso KAPSO_API_KEY=test KAPSO_PHONE_NUMBER_ID=test KAPSO_WEBHOOK_SECRET=<KAPSO_TEST_SECRET>
//   INNGEST_DEV=1 next start -p 3100   and   npx inngest-cli@latest dev -u http://localhost:3100/api/inngest
// Run: KAPSO_TEST_SECRET=<same> npx tsx --env-file=.env.local scripts/e2e-kapso.mts [baseUrl]
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { check, openEdge } from "./edge";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const secret = process.env.KAPSO_TEST_SECRET;
if (!secret) throw new Error("Set KAPSO_TEST_SECRET to the secret the test server uses");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: store } = await admin.from("stores").select("id, slug, whatsapp_paused_at").eq("slug", "demo").single();
const storeId = store!.id;
const phone = "15550006110";
const run = Date.now();

const message = (id: string, text: string, ts = Math.floor(Date.now() / 1000)) => ({
  message: { id, timestamp: String(ts), type: "text", from: phone, text: { body: text }, kapso: { direction: "inbound" } },
  conversation: { id: "conv_e2e", phone_number: phone },
  is_new_conversation: false,
  phone_number_id: "test",
});

async function post(body: unknown, opts: { sign?: string | null; event?: string } = {}) {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Webhook-Event": opts.event ?? "whatsapp.message.received" };
  const signature = opts.sign === undefined ? createHmac("sha256", secret!).update(raw).digest("hex") : opts.sign;
  if (signature) headers["X-Webhook-Signature"] = signature;
  return fetch(`${base}/api/webhooks/kapso`, { method: "POST", headers, body: raw });
}

async function until<T>(read: () => Promise<T | null | undefined>, label: string, ms = 30_000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await read();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`FAIL timed out: ${label}`);
}

async function cleanup() {
  const { data: convs } = await admin.from("conversations").select("id").eq("channel", "whatsapp").eq("customer_ref", phone);
  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length) {
    await admin.from("messages").delete().in("conversation_id", ids);
    await admin.from("conversations").delete().in("id", ids);
  }
  await admin.from("channel_bindings").delete().eq("channel", "whatsapp").eq("customer_ref", phone);
  await admin.from("webhook_events").delete().eq("provider", "kapso").like("event_id", "wamid.e2e-%");
  await admin.from("stores").update({ whatsapp_paused_at: store!.whatsapp_paused_at }).eq("id", storeId);
}

await cleanup();
try {
  // ── Webhook security ──
  const forged = await post(message(`wamid.e2e-${run}-x`, "hi"), { sign: createHmac("sha256", "not-the-secret").update("x").digest("hex") });
  check(forged.status === 403, `forged signature → ${forged.status}`);
  const unsigned = await post(message(`wamid.e2e-${run}-y`, "hi"), { sign: null });
  check(unsigned.status === 403, `unsigned → ${unsigned.status}`);
  const other = await post({ any: "thing" }, { event: "whatsapp.message.sent" });
  check(other.status === 200, `signed non-message event acknowledged → ${other.status}`);
  const { count: junk } = await admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("provider", "kapso").like("event_id", `wamid.e2e-${run}-%`);
  check(junk === 0, "rejected deliveries stored nothing");

  // ── Binding ──
  const startId = `wamid.e2e-${run}-start`;
  const started = await post(message(startId, "start demo"));
  check(started.status === 200, `signed "start demo" → ${started.status}`);
  const replay = await post(message(startId, "start demo"));
  check(replay.status === 200, "replay acknowledged");
  const { count: stored } = await admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("provider", "kapso").eq("event_id", startId);
  check(stored === 1, "replayed event stored once");
  const binding = await until(
    async () => (await admin.from("channel_bindings").select("store_id").eq("channel", "whatsapp").eq("customer_ref", phone).maybeSingle()).data,
    "binding row",
  );
  check(binding.store_id === storeId, "WhatsApp chat bound to the demo store by the job");

  // ── Message opens the conversation with a 24 h window (taken over first, so no model call) ──
  await admin.from("conversations").insert({ store_id: storeId, channel: "whatsapp", customer_ref: phone, agent_paused: true, last_message_at: new Date().toISOString() });
  const ts = Math.floor(Date.now() / 1000);
  check((await post(message(`wamid.e2e-${run}-1`, "Do you deliver to Lekki on Saturday?", ts))).status === 200, "signed text → 200");
  const conv = await until(async () => {
    const { data } = await admin.from("conversations").select("id, whatsapp_window_ends_at").eq("store_id", storeId).eq("channel", "whatsapp").eq("customer_ref", phone).single();
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", data!.id).eq("role", "customer");
    return count ? data : null;
  }, "customer message recorded");
  check(new Date(conv.whatsapp_window_ends_at!).getTime() === (ts + 86400) * 1000, "window ends 24 h after the customer's message");
  const processed = await until(
    async () => (await admin.from("webhook_events").select("processed_at").eq("provider", "kapso").eq("event_id", `wamid.e2e-${run}-1`).single()).data?.processed_at,
    "event marked processed",
  );
  check(processed, "webhook_events row marked processed by the job");

  // ── Inbox ──
  const e = await openEdge(base, 9342);
  try {
    check(await e.go(`/dashboard/inbox?c=${conv.id}`, "!!document.querySelector('[data-window-countdown]')"), "Inbox shows the reply-window countdown");
    const countdown = await e.evaluate<string>("document.querySelector('[data-window-countdown]').textContent");
    check(/2[34] h \d\d m left/.test(countdown), `countdown reads "${countdown.trim()}"`);
    check(await e.evaluate<boolean>("!document.querySelector('[data-template-picker]') && !!document.querySelector('#seller-reply')"), "text composer while the window is open");

    await admin.from("conversations").update({ whatsapp_window_ends_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", conv.id);
    await admin.from("stores").update({ whatsapp_paused_at: new Date().toISOString() }).eq("id", storeId);
    check(await e.go(`/dashboard/inbox?c=${conv.id}`, "!!document.querySelector('[data-template-picker]')"), "template picker once the window has closed");
    check(await e.evaluate<boolean>("!document.querySelector('#seller-reply') && !document.querySelector('[data-window-countdown]')"), "no free-text composer or countdown after the window");
    const options = await e.evaluate<number>("document.querySelectorAll('#template option').length");
    check(options >= 1, `${options} templates offered`);
    const banner = await e.evaluate<string>("document.querySelector('[data-whatsapp-paused]')?.textContent ?? ''");
    check(banner.includes("WhatsApp paused: add Kapso credits"), "paused banner shows");

    // The fake key makes Kapso refuse the send: the seller sees an error, and nothing is recorded as sent.
    await e.evaluate("document.querySelector('[data-template-picker] button[type=submit]').click()");
    check(await e.waitFor("!!document.querySelector('[data-template-picker] ~ [role=alert], [role=alert].text-red-300')"), "failed template send shows an error");
    const { count: sellerRows } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("role", "seller");
    check(sellerRows === 0, "failed send recorded nothing");

    await e.phone();
    check(await e.go(`/dashboard/inbox?c=${conv.id}`, "!!document.querySelector('[data-template-picker]')"), "390 px: picker renders");
    check(await e.evaluate<boolean>("document.documentElement.scrollWidth <= window.innerWidth"), "390 px: no horizontal overflow");
    await e.shot("inbox-whatsapp-390");
    check(e.consoleErrors.length === 0, `no console errors (${e.consoleErrors.join(" | ")})`);
  } finally {
    e.close();
  }
} finally {
  await cleanup();
}
console.log("e2e-kapso: all checks passed");
