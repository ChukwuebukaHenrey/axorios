// Step 6.3 in headless Edge against a running app, as the demo seller. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-shell.mts [baseUrl] [--chat]
// Screenshots go to $SHOTS (default: the OS temp folder).
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const withChat = process.argv.includes("--chat");
const shots = process.env.SHOTS ?? tmpdir();
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9334;

function check(ok: unknown, label: string) {
  if (!ok) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: signIn, error } = await anon.auth.signInWithPassword({ email: process.env.DEMO_SELLER_EMAIL!, password: process.env.DEMO_SELLER_PASSWORD! });
if (error || !signIn.session) throw new Error(`Sign-in failed: ${error?.code}`);
const cookieValue = `base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;

// The API refuses a thread that isn't the caller's.
const res = await fetch(`${base}/api/agent`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: `sb-${ref}-auth-token=${cookieValue}` },
  body: JSON.stringify({ threadId: crypto.randomUUID(), messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }] }),
});
check(res.status === 404, `unknown thread id is refused (${res.status})`);
const bad = await fetch(`${base}/api/agent`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: `sb-${ref}-auth-token=${cookieValue}` },
  body: JSON.stringify({ context: [{ kind: "page", page: "../../etc" }], messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }] }),
});
check(bad.status === 400, `free-text chip is refused (${bad.status})`);

const profile = mkdtempSync(join(tmpdir(), "axorios-shell-"));
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
const key = (k: string, code: string, modifiers = 0) =>
  send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, modifiers, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) }).then(() =>
    send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers }),
  );

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCookie", { name: `sb-${ref}-auth-token`, value: cookieValue, url: base, path: "/" });

  // ── Desktop 1280 ──
  await send("Page.navigate", { url: `${base}/dashboard/orders` });
  check(await waitFor(`!!document.querySelector('nav a[href="/dashboard/orders"][aria-current="page"]')`), "1280: sidebar marks Orders");
  const groups = await evaluate<string[]>(`[...document.querySelectorAll('aside nav p')].map(p => p.textContent.trim())`);
  check(["Business", "Grow", "Workspace"].every((g) => groups.includes(g)), `1280: grouped sidebar (${groups.join(", ")})`);
  const items = await evaluate<number>(`document.querySelector('aside').querySelectorAll('nav a, nav span[aria-disabled], div.border-t a').length`);
  check(items === 11, `1280: 10 items + Settings (${items})`);
  check(await evaluate<boolean>(`!!document.querySelector('header button[aria-label="Open Axori AI"]')`), "1280: top bar has Axori AI");
  await shot("shell-1280");

  await key("j", "KeyJ", 2); // Ctrl+J
  check(await waitFor(`!!document.querySelector('[role="dialog"][aria-label="Axori AI"]')`), "Ctrl+J opens the panel");
  check(await waitFor(`[...document.querySelectorAll('[role="dialog"] span')].some(s => s.textContent.trim() === 'Orders' && s.className.includes('lime'))`), "panel shows the Orders chip");
  check(await waitFor(`!!document.querySelector('#axori-input-panel')`, 30_000), "a thread opened in the panel");
  await new Promise((r) => setTimeout(r, 800));
  await shot("panel-1280");

  // Ctrl+J while typing does nothing; Esc closes even from the text box.
  await evaluate(`document.querySelector('#axori-input-panel').focus()`);
  await key("j", "KeyJ", 2);
  check(await evaluate<boolean>(`!!document.querySelector('[role="dialog"][aria-label="Axori AI"]')`), "Ctrl+J in a text field is ignored");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  check(await waitFor(`!document.querySelector('[role="dialog"][aria-label="Axori AI"]')`), "Esc closes the panel");

  if (withChat) {
    await key("j", "KeyJ", 2);
    await waitFor(`!!document.querySelector('#axori-input-panel')`, 30_000);
    await evaluate(`document.querySelector('[role="dialog"] button[aria-label="Open full page"]') && null`);
    await evaluate(`(() => { const el = document.querySelector('#axori-input-panel'); el.focus(); })()`);
    const before = await evaluate<number>(`document.querySelectorAll('[role="dialog"] [aria-live] p').length`);
    await send("Input.insertText", { text: "How many products do I have? One short sentence." });
    await evaluate(`document.querySelector('[role="dialog"] button[aria-label="Send"]').click()`);
    // Done when the reply's text is on screen and the send button is usable again.
    check(
      await waitFor(
        `document.querySelectorAll('[role="dialog"] [aria-live] p').length >= ${before} + 2 && !document.querySelector('[role="dialog"] [aria-live]').textContent.includes('Working on it') && /\d|product/i.test([...document.querySelectorAll('[role="dialog"] [aria-live] p')].at(-1).textContent)`,
        60_000,
      ),
      "agent replied in the panel",
    );
    console.log(`reply: ${await evaluate<string>(`[...document.querySelectorAll('[role="dialog"] [aria-live] p')].at(-1).textContent.slice(0, 120)`)}`);
    await new Promise((r) => setTimeout(r, 1500));
    await shot("panel-chat-1280");
  }

  // Full page on the same threads.
  await send("Page.navigate", { url: `${base}/dashboard/ai` });
  check(await waitFor(`location.search.startsWith('?t=') && !!document.querySelector('#axori-input-page')`, 30_000), "full page opens a thread");
  check(await evaluate<boolean>(`[...document.querySelectorAll('h3')].some(h => h.textContent.includes('Ideas'))`), "full page lists account threads");
  await new Promise((r) => setTimeout(r, 800));
  await shot("ai-page-1280");

  // ── Phone 390 ──
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: `${base}/dashboard/inbox` });
  check(await waitFor(`!!document.querySelector('nav.fixed a[href="/dashboard/inbox"][aria-current="page"]')`), "390: bottom bar marks Inbox");
  const bar = await evaluate<string[]>(`[...document.querySelectorAll('nav.fixed a, nav.fixed button')].map(a => a.textContent.trim())`);
  check(bar.join("|") === "Home|Orders|Inbox|Marketing|More", `390: bottom bar (${bar.join(", ")})`);
  check(await evaluate<boolean>(`document.documentElement.scrollWidth <= 390`), "390: no sideways scroll");
  await shot("shell-390");
  await evaluate(`(() => { const b = document.querySelector('button[aria-label="Tap to type, hold to talk"]'); b.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); b.dispatchEvent(new PointerEvent('pointerup', {bubbles:true})); })()`);
  check(await waitFor(`!!document.querySelector('[role="dialog"][aria-label="Axori AI"]')`), "390: tapping the floating button opens Axori AI");
  check(await waitFor(`[...document.querySelectorAll('[role="dialog"] span')].some(s => s.textContent.trim() === 'Inbox' && s.className.includes('lime'))`), "390: panel shows the Inbox chip");
  const width = await evaluate<number>(`document.querySelector('[role="dialog"][aria-label="Axori AI"]').getBoundingClientRect().width`);
  check(width === 390, `390: panel is full screen (${width})`);
  await new Promise((r) => setTimeout(r, 800));
  await shot("panel-390");

  check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
} finally {
  ws.close();
  edge.kill();
}
