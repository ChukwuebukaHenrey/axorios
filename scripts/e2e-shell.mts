// Step 6.3 in headless Edge against a running app, as the demo seller. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-shell.mts [baseUrl] [--chat]
// Screenshots go to $SHOTS (default: the OS temp folder).
// Without --chat no Axori AI request reaches the server: the page-context checks stub /api/agent in the browser
// and read the body the panel would have sent.
import { createClient } from "@supabase/supabase-js";
import { check, demoSellerCookie, openEdge } from "./edge";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const withChat = process.argv.includes("--chat");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PANEL = `[role="dialog"][aria-label="Axori AI"]`;

// The API refuses a thread that isn't the caller's, and a chip that isn't one of the known pages.
const cookie = await demoSellerCookie();
const res = await fetch(`${base}/api/agent`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookie.header },
  body: JSON.stringify({ threadId: crypto.randomUUID(), messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }] }),
});
check(res.status === 404, `unknown thread id is refused (${res.status})`);
const bad = await fetch(`${base}/api/agent`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookie.header },
  body: JSON.stringify({ context: [{ kind: "page", page: "../../etc" }], messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }] }),
});
check(bad.status === 400, `free-text chip is refused (${bad.status})`);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const owner = users.users.find((u) => u.email === process.env.DEMO_SELLER_EMAIL)!.id;
const threadCount = async () => (await db.from("ai_threads").select("id", { count: "exact", head: true }).eq("owner_id", owner)).count ?? 0;

const b = await openEdge(base, 9334);
const key = (k: string, code: string, modifiers = 0) =>
  b.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, modifiers, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) }).then(() =>
    b.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers }),
  );
// The shell is server-rendered, so it can be on screen before React has attached the shortcut. Press until it opens.
const ctrlJOpens = async () => {
  for (let i = 0; i < 10; i++) {
    await key("j", "KeyJ", 2);
    if (await b.waitFor(`!!document.querySelector('${PANEL}')`, 2000)) return true;
  }
  return false;
};
// Stub /api/agent in the page: keep the body the chat would send, answer 503, so no request or chat row is made.
const sendStubbed = async (input: string, text: string) => {
  const errorsBefore = b.consoleErrors.length;
  await b.evaluate(`(() => {
    window.__agentBody = null;
    const real = window.__realFetch ?? (window.__realFetch = window.fetch);
    window.fetch = (url, init) => {
      if (String(url).includes('/api/agent')) { window.__agentBody = JSON.parse(init.body); return Promise.resolve(new Response('stub', { status: 503 })); }
      return real(url, init);
    };
  })()`);
  await b.evaluate(`(() => { const el = document.querySelector('${input}'); el.focus(); })()`);
  await b.send("Input.insertText", { text });
  await b.evaluate(`document.querySelector('${PANEL} button[aria-label="Send"]').click()`);
  const sent = await b.waitFor("!!window.__agentBody", 10_000);
  const body = await b.evaluate<{ context?: { kind: string; page?: string }[]; newThread?: string } | null>("window.__agentBody");
  await b.evaluate("window.fetch = window.__realFetch");
  // The stubbed 503 is reported by the chat as an error; that one is expected.
  b.consoleErrors.length = errorsBefore;
  return sent ? body : null;
};

try {
  // ── Desktop 1280 ──
  await b.go("/dashboard/orders", `!!document.querySelector('nav a[href="/dashboard/orders"][aria-current="page"]')`);
  check(await b.evaluate<boolean>(`!!document.querySelector('nav a[href="/dashboard/orders"][aria-current="page"]')`), "1280: sidebar marks Orders");
  const groups = await b.evaluate<string[]>(`[...document.querySelectorAll('aside nav p')].map(p => p.textContent.trim())`);
  check(["Business", "Grow", "Workspace"].every((g) => groups.includes(g)), `1280: grouped sidebar (${groups.join(", ")})`);
  const items = await b.evaluate<number>(`document.querySelector('aside').querySelectorAll('nav a, nav span[aria-disabled], div.border-t a').length`);
  check(items === 11, `1280: 10 items + Settings (${items})`);
  check(await b.evaluate<boolean>(`!!document.querySelector('header button[aria-label="Open Axori AI"]')`), "1280: top bar has Axori AI");
  await b.shot("shell-1280");

  check(await ctrlJOpens(), "Ctrl+J opens the panel");
  check(await b.waitFor(`!!document.querySelector('#axori-input-panel')`, 30_000), "a new chat opened in the panel");
  await sleep(800);
  await b.shot("panel-1280");

  // Ctrl+J while typing does nothing; Esc closes even from the text box.
  await b.evaluate(`document.querySelector('#axori-input-panel').focus()`);
  await key("j", "KeyJ", 2);
  check(await b.evaluate<boolean>(`!!document.querySelector('${PANEL}')`), "Ctrl+J in a text field is ignored");
  await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  check(await b.waitFor(`!document.querySelector('${PANEL}')`), "Esc closes the panel");

  // The page is known from the session, so it isn't drawn as a chip, but every message carries it.
  const threadsBefore = await threadCount();
  check(await ctrlJOpens(), "Ctrl+J opens the panel again");
  await b.waitFor(`!!document.querySelector('#axori-input-panel')`, 30_000);
  check(
    !(await b.evaluate<boolean>(`[...document.querySelectorAll('${PANEL} span')].some(s => s.textContent.trim() === 'Orders' && s.className.includes('lime'))`)),
    "panel doesn't draw the page as a chip",
  );
  const body = await sendStubbed("#axori-input-panel", "What's on this page?");
  check(body?.context?.some((c) => c.kind === "page" && c.page === "orders"), `panel sends the Orders page chip (${JSON.stringify(body?.context)})`);
  check(body?.newThread === "store", `a new panel chat is a store chat (${body?.newThread})`);
  check((await threadCount()) === threadsBefore, "the stubbed message saved no chat");
  await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await b.waitFor(`!document.querySelector('${PANEL}')`);

  if (withChat) {
    // One real turn in a fresh chat; the chat is deleted afterwards.
    await b.go("/dashboard/orders");
    await ctrlJOpens();
    await b.waitFor(`!!document.querySelector('#axori-input-panel')`, 30_000);
    const before = await b.evaluate<number>(`document.querySelectorAll('${PANEL} [aria-live] p').length`);
    const startedAt = new Date().toISOString();
    await b.evaluate(`document.querySelector('#axori-input-panel').focus()`);
    await b.send("Input.insertText", { text: "How many products do I have? One short sentence." });
    await b.evaluate(`document.querySelector('${PANEL} button[aria-label="Send"]').click()`);
    // Done when the reply's text is on screen and the send button is usable again.
    check(
      await b.waitFor(
        `document.querySelectorAll('${PANEL} [aria-live] p').length >= ${before} + 2 && !document.querySelector('${PANEL} [aria-live]').textContent.includes('Working on it') && /\\d|product/i.test([...document.querySelectorAll('${PANEL} [aria-live] p')].at(-1).textContent)`,
        60_000,
      ),
      "agent replied in the panel",
    );
    console.log(`reply: ${await b.evaluate<string>(`[...document.querySelectorAll('${PANEL} [aria-live] p')].at(-1).textContent.slice(0, 120)`)}`);
    await sleep(1500);
    await b.shot("panel-chat-1280");
    const { data: made } = await db.from("ai_threads").select("id").eq("owner_id", owner).gte("created_at", startedAt);
    check(made?.length === 1, `the first message saved one chat (${made?.length})`);
    for (const t of made ?? []) await db.from("ai_threads").delete().eq("id", t.id);
  }

  // Full page shares the same chats: a new chat (no ?t= until the first message) and the history list, which holds
  // this store's chats plus account-wide ones that have a seller message (newest 40). Pin the store so we know which.
  const { data: stores } = await db.from("stores").select("id").eq("owner_id", owner).order("status", { ascending: false }).order("created_at").limit(1);
  const storeId = stores![0].id;
  await b.send("Network.setCookie", { name: "axorios_store", value: storeId, url: base, path: "/" });
  const { data: rows } = await db.from("ai_threads").select("messages").eq("owner_id", owner).or(`store_id.is.null,store_id.eq.${storeId}`).order("updated_at", { ascending: false }).limit(40);
  const expected = (rows ?? []).filter((r) => ((r.messages as { role: string }[] | null) ?? []).some((m) => m.role === "user")).length;
  await b.go("/dashboard/ai", "!!document.querySelector('#axori-input-page')");
  check((await b.evaluate<string>("location.pathname + location.search")) === "/dashboard/ai", "full page opens a new, unsaved chat");
  check(await b.evaluate<boolean>(`!!document.querySelector('aside[aria-label="Chat history"] button[aria-current="page"]')`), "full page: New chat is the current one");
  check(
    await b.waitFor(`(() => { const h = document.querySelector('aside[aria-label="Chat history"]'); return !!h && (h.querySelectorAll('li').length > 0 || h.textContent.includes('No chats yet.')); })()`, 15_000),
    "full page: history loaded",
  );
  await sleep(800);
  const listed = await b.evaluate<number>(`document.querySelectorAll('aside[aria-label="Chat history"] li').length`);
  check(expected > 0 && listed === expected, `full page lists the seller's saved chats (${listed} of ${expected})`);
  await sleep(500);
  await b.shot("ai-page-1280");

  // ── Phone 390 ──
  await b.phone();
  await b.go("/dashboard/inbox", `!!document.querySelector('nav[data-bottom-bar] a[href="/dashboard/inbox"][aria-current="page"]')`);
  check(await b.evaluate<boolean>(`!!document.querySelector('nav[data-bottom-bar] a[href="/dashboard/inbox"][aria-current="page"]')`), "390: bottom bar marks Inbox");
  const bar = await b.evaluate<string[]>(`[...document.querySelectorAll('nav[data-bottom-bar] a, nav[data-bottom-bar] button')].map(a => a.textContent.trim() || a.getAttribute('aria-label'))`);
  check(bar.join("|") === "Home|Orders|Axori AI: Tap to type, hold to talk|Inbox|More", `390: bottom bar (${bar.join(", ")})`);
  check(await b.evaluate<boolean>(`document.documentElement.scrollWidth <= 390`), "390: no sideways scroll");
  await b.shot("shell-390");
  let opened = false;
  for (let i = 0; i < 10 && !opened; i++) {
    await b.evaluate(`(() => { const b = document.querySelector('button[aria-label="Axori AI: Tap to type, hold to talk"]'); b.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); b.dispatchEvent(new PointerEvent('pointerup', {bubbles:true})); })()`);
    opened = await b.waitFor(`!!document.querySelector('${PANEL}')`, 2000);
  }
  check(opened, "390: tapping the bar's Axori AI button opens the panel");
  // The panel springs in from the right; measure once it has settled.
  await b.waitFor(`(() => { const r = document.querySelector('${PANEL}').getBoundingClientRect(); return r.left === 0 && r.width === 390; })()`, 5000);
  const rect = await b.evaluate<{ left: number; width: number }>(`(() => { const r = document.querySelector('${PANEL}').getBoundingClientRect(); return { left: r.left, width: r.width }; })()`);
  check(rect.left === 0 && rect.width === 390, `390: panel is full screen (left ${rect.left}, width ${rect.width})`);
  await b.waitFor(`!!document.querySelector('#axori-input-panel')`, 30_000);
  await sleep(800);
  await b.shot("panel-390");
  const phoneBody = await sendStubbed("#axori-input-panel", "Anything new?");
  check(phoneBody?.context?.some((c) => c.kind === "page" && c.page === "inbox"), `390: panel sends the Inbox page chip (${JSON.stringify(phoneBody?.context)})`);

  const errors = b.consoleErrors.filter((e) => !/AG Grid|AG Studio|licen[cs]e|\*{5}/i.test(e));
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
} finally {
  b.close();
}
