// Step 6.12 in headless Edge against a running app, as the demo seller. Prints no credentials.
// Checks: log out from the avatar menu and from Settings; a tool set to Blocked in Settings can't run.
// Run: npx tsx --env-file=.env.local scripts/e2e-settings.mts [baseUrl]
// Screenshots go to $SHOTS (default: the OS temp folder).
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const shots = process.env.SHOTS ?? tmpdir();
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9335;

function check(ok: unknown, label: string) {
  if (!ok) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const COOKIE = `sb-${ref}-auth-token`;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** A fresh session each time: logging out ends the one before. */
async function session() {
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: process.env.DEMO_SELLER_EMAIL!, password: process.env.DEMO_SELLER_PASSWORD! });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.code}`);
  return { cookie: `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`, userId: data.user.id };
}

const profile = mkdtempSync(join(tmpdir(), "axorios-settings-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1280,900", "--no-first-run", "about:blank"], { stdio: "ignore" });
let wsUrl: string | undefined;
for (let i = 0; i < 40 && !wsUrl; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json() as Promise<{ type: string; webSocketDebuggerUrl: string }[]>).catch(() => []);
  wsUrl = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
}
if (!wsUrl) throw new Error("Edge did not open");
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
let nextId = 1;
const pending = new Map<number, (v: Record<string, unknown>) => void>();
const consoleErrors: string[] = [];
ws.onmessage = (m) => {
  const data = JSON.parse(String(m.data));
  if (data.id && pending.has(data.id)) pending.get(data.id)!(data.result ?? {});
  if (data.method === "Runtime.exceptionThrown") consoleErrors.push(data.params.exceptionDetails?.exception?.description ?? "exception");
  if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error") consoleErrors.push(String(data.params.args?.[0]?.value ?? ""));
};
const send = (method: string, params: Record<string, unknown> = {}) =>
  new Promise<Record<string, unknown>>((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async <T,>(expression: string): Promise<T> =>
  ((await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result as { value: T }).value;
const waitFor = async (expression: string, ms = 20_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await evaluate<boolean>(expression)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};
const shot = async (name: string) => {
  const { data } = (await send("Page.captureScreenshot", { format: "png" })) as { data: string };
  const file = join(shots, `${name}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`shot ${file}`);
};
const signInBrowser = async () => {
  const s = await session();
  await send("Network.setCookie", { name: COOKIE, value: s.cookie, url: base, path: "/" });
  return s;
};
const click = (selector: string) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.click(); return true; })()`);
/** Radix opens menus on pointerdown, not click. */
const press = (selector: string) =>
  evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return true; })()`);
const permissionOf = async (ownerId: string, tool: string) =>
  ((await admin.from("account_settings").select("tool_permissions").eq("owner_id", ownerId).maybeSingle()).data?.tool_permissions as Record<string, string> | undefined)?.[tool];

const startedAt = new Date().toISOString();
let threadId: string | undefined;
let ownerId: string | undefined;
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  // ── Settings renders: every section, Connections directory, 1280 and 390 ──
  ({ userId: ownerId } = await signInBrowser());
  await send("Page.navigate", { url: `${base}/dashboard/settings?section=connections` });
  check(await waitFor(`!!document.querySelector('#conn-shopify')`), "Connections directory renders");
  const groups = await evaluate<string[]>(`[...document.querySelectorAll('main h3')].map(h => h.textContent.trim())`);
  check(["Sales channels", "Messaging", "Social", "Payments", "Files & apps", "Advanced"].every((g) => groups.includes(g)), `directory groups (${groups.join(", ")})`);
  const sections = await evaluate<number>(`document.querySelectorAll('main nav a[href^="/dashboard/settings?section="]').length`);
  check(sections === 14, `14 Settings sections (${sections})`);
  check(await evaluate<boolean>(`!!document.querySelector('[role="radiogroup"][data-tool="refund_order"]')`), "PayPal shows refund permission");
  check(
    await evaluate<boolean>(`document.querySelector('[role="radiogroup"][data-tool="refund_order"] [role="radio"]').disabled`),
    "refund can't be set to Always allow (never looser)",
  );
  check(await evaluate<boolean>(`!!document.querySelector('aside a[href="/dashboard/settings"][aria-current="page"]')`), "sidebar marks Settings");
  await shot("settings-connections-1280");
  for (const id of ["profile", "security", "ai", "stores", "payments", "messages", "activity", "usage", "team"]) {
    await send("Page.navigate", { url: `${base}/dashboard/settings?section=${id}` });
    check(await waitFor(`!!document.querySelector('main nav a[aria-current="page"][href$="section=${id}"]') && !!document.querySelector('main h2, #conn-shopify')`), `section ${id} renders`);
  }
  await send("Page.navigate", { url: `${base}/dashboard/integrations` });
  check(await waitFor(`location.search === '?section=connections'`), "old Integrations link lands on Connections");

  // ── A Blocked tool can't run ──
  await send("Page.navigate", { url: `${base}/dashboard/settings?section=ai` });
  check(await waitFor(`!!document.querySelector('[role="radiogroup"][data-tool="add_products"]')`), "Axori AI permissions render");
  await click(`[role="radiogroup"][data-tool="add_products"] [role="radio"]:nth-child(3)`);
  let saved = false;
  for (let i = 0; i < 40 && !saved; i++) {
    await new Promise((r) => setTimeout(r, 250));
    saved = (await permissionOf(ownerId!, "add_products")) === "blocked";
  }
  check(saved, "Blocked saved from Settings");
  await shot("settings-ai-blocked-1280");

  const { data: store } = await admin.from("stores").select("id").eq("owner_id", ownerId!).eq("slug", process.env.DEMO_STORE_SLUG ?? "demo").single();
  const { count: before } = await admin.from("products").select("id", { count: "exact", head: true }).eq("store_id", store!.id);
  const { data: thread } = await admin.from("ai_threads").insert({ owner_id: ownerId!, store_id: store!.id, title: "e2e settings (deleted after)" }).select("id").single();
  threadId = thread!.id;
  const api = await session();
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${COOKIE}=${api.cookie}` },
    body: JSON.stringify({
      threadId,
      messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "Add a product right now: E2E Blocked Test Cake, 5000 naira, stock 3. Use your add_products tool." }] }],
    }),
  });
  const stream = await res.text();
  check(res.status === 200, `agent answered (${res.status})`);
  check(!stream.includes('"toolName":"add_products"'), "agent never called add_products");
  const { count: after } = await admin.from("products").select("id", { count: "exact", head: true }).eq("store_id", store!.id);
  const { count: named } = await admin.from("products").select("id", { count: "exact", head: true }).eq("store_id", store!.id).ilike("name", "%E2E Blocked%");
  check(after === before && named === 0, `no product was added (${before} → ${after})`);
  const text = [...stream.matchAll(/"delta":"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`)).join("");
  console.log(`reply: ${text.slice(0, 160)}`);

  // Put it back, from the UI.
  await click(`[role="radiogroup"][data-tool="add_products"] [role="radio"]:nth-child(1)`);
  let restored = false;
  for (let i = 0; i < 40 && !restored; i++) {
    await new Promise((r) => setTimeout(r, 250));
    restored = (await permissionOf(ownerId!, "add_products")) === "always";
  }
  check(restored, "set back to Always allow");

  await send("Page.navigate", { url: `${base}/dashboard/settings?section=activity` });
  check(
    await waitFor(`[...document.querySelectorAll('[data-testid="activity-log"] td')].some(td => td.textContent.includes('set permission') && td.textContent.includes('Add or change products'))`),
    "activity log shows the permission changes",
  );
  await shot("settings-activity-1280");

  // ── Log out from the avatar menu ──
  await send("Page.navigate", { url: `${base}/dashboard` });
  check(await waitFor(`!!document.querySelector('header button[aria-label="Account"]')`), "avatar menu present");
  await press(`header button[aria-label="Account"]`);
  check(await waitFor(`[...document.querySelectorAll('[role="menu"] button')].some(b => b.textContent.trim() === 'Log out')`), "avatar menu has Log out");
  await evaluate(`[...document.querySelectorAll('[role="menu"] button')].find(b => b.textContent.trim() === 'Log out').click()`);
  check(await waitFor(`location.pathname === '/sign-in'`), "avatar Log out lands on sign-in");
  await send("Page.navigate", { url: `${base}/dashboard` });
  check(await waitFor(`location.pathname === '/sign-in'`), "after avatar Log out, the dashboard needs sign-in");

  // ── Log out from Settings ──
  await signInBrowser();
  await send("Page.navigate", { url: `${base}/dashboard/settings?section=security` });
  check(await waitFor(`!!document.querySelector('[data-testid="settings-log-out"]')`), "Settings has Log out");
  await click(`[data-testid="settings-log-out"]`);
  check(await waitFor(`location.pathname === '/sign-in'`), "Settings Log out lands on sign-in");
  await send("Page.navigate", { url: `${base}/dashboard/settings` });
  check(await waitFor(`location.pathname === '/sign-in'`), "after Settings Log out, Settings needs sign-in");

  // ── Phone 390 ──
  await signInBrowser();
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: `${base}/dashboard/settings?section=connections` });
  check(await waitFor(`!!document.querySelector('#conn-shopify')`), "390: Connections renders");
  check(await evaluate<boolean>(`document.documentElement.scrollWidth <= 390`), "390: no sideways scroll");
  await shot("settings-connections-390");

  check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
} finally {
  if (threadId) await admin.from("ai_threads").delete().eq("id", threadId);
  // Keep the demo account's activity log free of test lines.
  if (ownerId) await admin.from("activity_log").delete().eq("owner_id", ownerId).eq("action", "set_permission").eq("target", "add_products").gte("at", startedAt);
  if (ownerId && (await permissionOf(ownerId, "add_products")) === "blocked") {
    const { data } = await admin.from("account_settings").select("tool_permissions").eq("owner_id", ownerId).single();
    await admin.from("account_settings").update({ tool_permissions: { ...(data!.tool_permissions as object), add_products: "always" } }).eq("owner_id", ownerId);
  }
  ws.close();
  edge.kill();
}
