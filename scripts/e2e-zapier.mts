// Step 6.13: "Export orders to Google Sheets" through the real seller agent, approval card, database and activity log.
// Default: a local fake Zapier MCP server on :3199, so outage, quota and idempotency can be forced. Start the app with
//   ZAPIER_ENABLED=true ZAPIER_MCP_URL=http://127.0.0.1:3199/mcp ZAPIER_MCP_TOKEN=e2e-token
//   ZAPIER_SHEET_SPREADSHEET_ID=e2e-sheet ZAPIER_SHEET_WORKSHEET_ID=0 ZAPIER_SHEET_LABEL="E2E sheet"
// --real: the app's own Zapier keys and sheet; exports one order and leaves it there as evidence.
// Run: npx tsx --env-file=.env.local scripts/e2e-zapier.mts [baseUrl] [--real]. Prints no credentials.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const REAL = process.argv.includes("--real");
const shots = process.env.SHOTS ?? tmpdir();
const FAKE_PORT = 3199;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const CDP_PORT = 9337;
const FIELDS = ["Order", "Date", "Status", "Channel", "Items", "Total", "Currency", "Charged", "Charged currency", "Country"];

function check(ok: unknown, label: string) {
  if (!ok) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

// ── Fake Zapier MCP: the meta tools the real server exposes, with a switch for failure modes ──
type Mode = "ok" | "quota" | "down";
let mode: Mode = "ok";
const rows: Record<string, string>[] = [];
let executeCalls = 0;
let authHeaderSeen = "";
// Our columns, deliberately in a different order with an extra one, keyed like Zapier's COL$A.
const sheetHeaders = ["Notes", ...[...FIELDS].reverse()];
const columnSchema = Object.fromEntries(sheetHeaders.map((h, i) => [`COL$${String.fromCharCode(65 + i)}`, { type: "string", title: h }]));
const text = (value: unknown, isError = false) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }], isError });
const readBody = (req: IncomingMessage) => new Promise<string>((r) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => r(s)); });
const fake = createServer(async (req, res) => {
  const raw = await readBody(req);
  authHeaderSeen = String(req.headers.authorization ?? "");
  if (mode === "down") {
    res.writeHead(503).end("Service Unavailable");
    return;
  }
  const msg = JSON.parse(raw || "{}") as { id?: number; method: string; params?: Record<string, unknown> };
  const reply = (body: Record<string, unknown>) => {
    res.writeHead(200, { "content-type": "application/json", "mcp-session-id": "fake-session" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, ...body }));
  };
  if (msg.id === undefined) return void res.writeHead(202).end();
  if (msg.method === "initialize") {
    return reply({ result: { protocolVersion: (msg.params?.protocolVersion as string) ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fake-zapier", version: "1" } } });
  }
  if (msg.method === "tools/list") {
    return reply({ result: { tools: ["inspect_zapier_actions", "execute_zapier_write_action"].map((name) => ({ name, inputSchema: { type: "object" } })) } });
  }
  if (msg.method === "tools/call") {
    const { name, arguments: args } = msg.params as { name: string; arguments: Record<string, unknown> };
    if (name === "inspect_zapier_actions") return reply({ result: text([{ tool_name: args.tool_name, dynamic_properties_schema: { type: "object", properties: columnSchema } }]) });
    if (name === "execute_zapier_write_action") {
      executeCalls++;
      if (mode === "quota") return reply({ result: text({ error: "You have reached your Zapier task limit for this billing period" }, true) });
      const params = args.params as { dynamic_properties: Record<string, string> };
      rows.push(Object.fromEntries(Object.entries(params.dynamic_properties).map(([k, v]) => [(columnSchema as Record<string, { title: string }>)[k].title, v])));
      return reply({ result: text({ results: [{ row: rows.length + 1 }] }) });
    }
  }
  reply({ error: { code: -32601, message: "Method not found" } });
});
if (!REAL) await new Promise<void>((r) => fake.listen(FAKE_PORT, "127.0.0.1", r));

// ── Agent over HTTP, approvals answered the way the card does ──
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const COOKIE = `sb-${ref}-auth-token`;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email: process.env.DEMO_SELLER_EMAIL!, password: process.env.DEMO_SELLER_PASSWORD! });
if (signInError || !signIn.session) throw new Error(`Sign-in failed: ${signInError?.code}`);
const cookieValue = `base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;
const ownerId = signIn.user.id;
const { data: store } = await admin.from("stores").select("id").eq("owner_id", ownerId).eq("slug", process.env.DEMO_STORE_SLUG ?? "demo").single();
const storeId = store!.id;
const destination = REAL ? `${process.env.ZAPIER_SHEET_SPREADSHEET_ID}/${process.env.ZAPIER_SHEET_WORKSHEET_ID}` : "e2e-sheet/0";

type Msg = { id: string; role: string; parts: Record<string, unknown>[] };
type Event = Record<string, unknown> & { type: string };
const { data: thread } = await admin.from("ai_threads").insert({ owner_id: ownerId, store_id: storeId, title: "e2e zapier (deleted after)" }).select("id").single();
const threadId = thread!.id;
async function agent(messages: Msg[]): Promise<Event[]> {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${COOKIE}=${cookieValue}` },
    body: JSON.stringify({ threadId, messages }),
  });
  if (!res.ok) throw new Error(`Agent HTTP ${res.status}`);
  return (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)) as Event);
}
async function ask(text: string) {
  const first: Msg = { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] };
  const events = await agent([first]);
  const call = events.find((e) => e.type === "tool-input-available" && e.toolName === "zapier_action") as Event | undefined;
  const request = events.find((e) => e.type === "tool-approval-request") as Event | undefined;
  return { first, call, request, events };
}
type Outcome = { ok: boolean; error?: string; sent: string[]; skipped: string[]; notSent: string[] };
async function approve(a: Awaited<ReturnType<typeof ask>>, approved = true): Promise<Outcome | undefined> {
  const events = await agent([
    a.first,
    {
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: "tool-zapier_action", toolCallId: a.call!.toolCallId, state: "approval-responded", input: a.call!.input, approval: { id: a.request!.approvalId, approved } },
      ],
    },
  ]);
  return events.find((e) => e.type === "tool-output-available")?.output as Outcome | undefined;
}
const exportsRows = async () =>
  (await admin.from("connection_exports").select("order_id, status, error, approval_id").eq("store_id", storeId).eq("destination", destination)).data ?? [];
const latestPaid = async (n: number) =>
  (
    await admin
      .from("orders")
      .select("id, status, paid_at, updated_at, total_minor, refunded_minor, paypal_capture_id")
      .eq("store_id", storeId)
      .not("paid_at", "is", null)
      .neq("source", "test")
      .in("status", ["paid", "refunded", "partially_refunded"])
      .order("paid_at", { ascending: false })
      .limit(n)
  ).data!;

const startedAt = new Date().toISOString();
let edge: ReturnType<typeof spawn> | undefined;
try {
  if (!REAL) await admin.from("connection_exports").delete().eq("store_id", storeId).eq("destination", destination);

  // ── 1. A card first; nothing sent before Approve ──
  const n = REAL ? 1 : 2;
  const first = await ask(`Export my latest ${n} paid orders to Google Sheets. Use your zapier_action tool with count ${n}.`);
  check(first.call && first.request, "zapier_action returns an approval card first");
  console.log(`input: ${JSON.stringify(first.call!.input)}`);
  check(executeCalls === 0 && (await exportsRows()).length === 0, "nothing sent and nothing recorded before Approve");

  // The card in the Axori AI page: app, action, destination, fields, orders.
  if (!REAL) {
    const profile = mkdtempSync(join(tmpdir(), "axorios-zapier-"));
    edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, "--window-size=1280,900", "--no-first-run", "about:blank"], { stdio: "ignore" });
    let wsUrl: string | undefined;
    for (let i = 0; i < 40 && !wsUrl; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const targets = await fetch(`http://127.0.0.1:${CDP_PORT}/json`).then((r) => r.json() as Promise<{ type: string; webSocketDebuggerUrl: string }[]>).catch(() => []);
      wsUrl = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    }
    const ws = new WebSocket(wsUrl!);
    await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
    let id = 1;
    const pending = new Map<number, (v: Record<string, unknown>) => void>();
    const consoleErrors: string[] = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(String(m.data));
      if (d.id && pending.has(d.id)) pending.get(d.id)!(d.result ?? {});
      if (d.method === "Runtime.exceptionThrown") consoleErrors.push(d.params.exceptionDetails?.exception?.description ?? "exception");
      if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") consoleErrors.push(String(d.params.args?.[0]?.value ?? ""));
    };
    const send = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<Record<string, unknown>>((resolve) => { const i = id++; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async <T,>(expression: string) => ((await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result as { value: T }).value;
    const waitFor = async (expression: string, ms = 20_000) => {
      for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 250))) if (await evaluate<boolean>(expression)) return true;
      return false;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.setCookie", { name: COOKIE, value: cookieValue, url: base, path: "/" });
    await send("Page.navigate", { url: `${base}/dashboard/ai?t=${threadId}` });
    const cardText = `[...document.querySelectorAll('article')].map(a => a.innerText).find(t => t.includes('Export orders to Google Sheets')) ?? ''`;
    check(await waitFor(`(${cardText}).includes('Fields sent')`), "card shows in the Axori AI page");
    const card = await evaluate<string>(cardText);
    check(card.includes("Zapier · Google Sheets") && card.includes("Add one row per order") && card.includes("E2E sheet"), "card shows app, action and destination");
    check(FIELDS.every((f) => card.includes(f)), "card lists every field sent");
    const ids = (await latestPaid(2)).map((o) => o.id.slice(0, 8));
    check(ids.every((i) => card.includes(`#${i}`)), `card lists the orders (${ids.join(", ")})`);
    check(card.includes("Uses 4 Zapier tasks"), "card says how many Zapier tasks it uses");
    const { data } = (await send("Page.captureScreenshot", { format: "png" })) as { data: string };
    writeFileSync(join(shots, "zapier-card-1280.png"), Buffer.from(data, "base64"));
    console.log(`shot ${join(shots, "zapier-card-1280.png")}`);
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Page.reload");
    check(await waitFor(`(${cardText}).includes('Fields sent')`), "390: card renders");
    check(await evaluate<boolean>(`document.documentElement.scrollWidth <= 390`), "390: no sideways scroll");
    check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
    check(executeCalls === 0, "opening the card sent nothing");
    ws.close();
  }

  // ── 2. Approve: rows land, recorded once, logged ──
  const before = await latestPaid(n);
  const out = await approve(first);
  console.log(`output: ${JSON.stringify(out)}`);
  check(out?.ok && out.sent.length === n, `${n} row(s) sent after Approve`);
  const recorded = await exportsRows();
  check(recorded.length === n && recorded.every((r) => r.status === "sent" && r.approval_id === first.call!.toolCallId), "each order recorded as sent under this approval");
  const { data: logLines } = await admin.from("activity_log").select("action, target, approval_id, details").eq("owner_id", ownerId).eq("action", "zapier_action").gte("at", startedAt);
  check(logLines?.length === 1 && logLines[0].approval_id === first.call!.toolCallId && String(logLines[0].target).startsWith("Google Sheets ›"), "one activity_log line with the approval id");
  if (!REAL) {
    check(authHeaderSeen === "Bearer e2e-token", "Zapier called with the bearer token");
    check(rows.length === n, `fake sheet has ${n} rows`);
    const expectedIds = before.map((o) => o.id.slice(0, 8));
    check(rows.every((r) => expectedIds.includes(r.Order)) && rows.every((r) => FIELDS.every((f) => f in r) && !("Notes" in r)), "each value in its own column, matched by header");
    check(rows.every((r) => /^\d+(\.\d+)?$/.test(r.Total) && r.Currency === "NGN"), `amounts as plain decimals (${rows[0].Total} ${rows[0].Currency})`);

    // ── 3. Same approval replayed: nothing new ──
    const again = await approve(first);
    check(again && again.sent.length === 0 && again.skipped.length === n && rows.length === n, "replaying the approval sends nothing (idempotency key)");

    // ── 4. Quota: clear error, order and payment untouched ──
    mode = "quota";
    const q = await ask("Export my latest 1 paid order to Google Sheets that isn't there yet. Use your zapier_action tool with count 1.");
    check(q.call && q.request, "second export asks for approval");
    const [target] = await latestPaid(n + 1).then((o) => o.slice(n));
    const qOut = await approve(q);
    console.log(`quota output: ${JSON.stringify(qOut)}`);
    check(qOut && !qOut.ok && qOut.error === "zapier_quota" && qOut.notSent.length === 1, "quota error is reported as zapier_quota");
    const [after] = (await admin.from("orders").select("id, status, paid_at, updated_at, total_minor, refunded_minor, paypal_capture_id").eq("id", target.id)).data!;
    check(JSON.stringify(after) === JSON.stringify(target), "the order and its payment are unchanged");
    check((await exportsRows()).some((r) => r.order_id === target.id && r.status === "failed" && r.error === "zapier_quota"), "failed row recorded with the reason");
    check(rows.length === n, "no row added on quota error");

    // ── 5. Outage ──
    mode = "down";
    const dOut = await approve(q);
    console.log(`outage output: ${JSON.stringify(dOut)}`);
    check(dOut && !dOut.ok && dOut.error === "zapier_unavailable", "outage is reported as zapier_unavailable");
    const [afterDown] = (await admin.from("orders").select("id, status, paid_at, updated_at, total_minor, refunded_minor, paypal_capture_id").eq("id", target.id)).data!;
    check(JSON.stringify(afterDown) === JSON.stringify(target), "outage leaves the order and payment unchanged");

    // ── 6. Back up: the failed order goes, once ──
    mode = "ok";
    const rOut = await approve(q);
    check(rOut?.ok && rOut.sent.length === 1 && rows.length === n + 1, "after the outage, approving again sends the missing row");
    const final = await exportsRows();
    check(final.length === n + 1 && final.every((r) => r.status === "sent"), "every exported order is recorded once, as sent");

    // ── 7. Deny: nothing ──
    const d = await ask("Export my latest 1 paid order to Google Sheets. Use your zapier_action tool with count 1.");
    const callsBefore = executeCalls;
    await approve(d, false);
    check(executeCalls === callsBefore && (await exportsRows()).length === n + 1, "Cancel sends nothing");
  } else {
    console.log(`Order(s) sent to the real sheet: ${before.map((o) => o.id.slice(0, 8)).join(", ")}`);
    const again = await approve(first);
    check(again && again.sent.length === 0 && again.skipped.length === n, "replaying the approval sends nothing (idempotency key)");
  }
} finally {
  if (threadId) await admin.from("ai_threads").delete().eq("id", threadId);
  if (!REAL) {
    await admin.from("connection_exports").delete().eq("store_id", storeId).eq("destination", destination);
    await admin.from("activity_log").delete().eq("owner_id", ownerId).eq("action", "zapier_action").gte("at", startedAt);
  }
  edge?.kill();
  fake.close();
}
