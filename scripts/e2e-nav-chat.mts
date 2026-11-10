// Navigation, chat drafts, Analytics layout and the public footer, in headless Edge against a running app.
//   npx tsx --env-file=.env.local scripts/e2e-nav-chat.mts [baseUrl]      (SHOTS=<dir> keeps the screenshots)
// Sends one real Axori AI message (one daily request) and deletes the chat it creates. Prints no credentials.
import { createClient } from "@supabase/supabase-js";
import { openEdge } from "./edge";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const results: { ok: boolean; label: string }[] = [];
const ok = (pass: unknown, label: string) => {
  results.push({ ok: Boolean(pass), label });
  console.log(`${pass ? "PASS" : "FAIL"} ${label}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const owner = users.users.find((u) => u.email === process.env.DEMO_SELLER_EMAIL)!.id;
const threadCount = async () => (await db.from("ai_threads").select("id", { count: "exact", head: true }).eq("owner_id", owner)).count ?? 0;

const b = await openEdge(base);
const width = (w: number, h = 900) => b.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
const path = () => b.evaluate<string>("location.pathname + location.search");

try {
  // 1. Signing in lands on Home; /build is gone.
  await b.send("Network.clearBrowserCookies");
  await b.go("/sign-in", "!!document.querySelector('form')");
  // On a cold server the form can be on screen before React has hydrated it; click until the password field shows.
  for (let i = 0; i < 40 && !(await b.evaluate<boolean>("!!document.querySelector('input[name=password]')")); i++) {
    await b.evaluate(`[...document.querySelectorAll('form button[type=button]')].find(x => /password/i.test(x.textContent))?.click()`);
    await sleep(500);
  }
  const fill = (name: string, value: string) =>
    b.evaluate(`(() => { const el = document.querySelector('input[name=${name}]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await fill("email", process.env.DEMO_SELLER_EMAIL!);
  await fill("password", process.env.DEMO_SELLER_PASSWORD!);
  await b.evaluate("document.querySelector('form button[type=submit]').click()");
  ok(await b.waitFor("location.pathname === '/dashboard'", 30_000), "password sign-in lands on /dashboard");
  await b.go("/build");
  ok((await path()) === "/dashboard", "/build redirects to /dashboard");
  await b.go("/build?prompt=Change%20my%20banner", "!!document.querySelector('#axori-input-page')");
  ok((await path()).startsWith("/dashboard/ai?prompt="), "/build?prompt= redirects to Axori AI");
  ok((await b.evaluate<string>("document.querySelector('#axori-input-page').value")) === "Change my banner", "the prompt prefills the composer, unsent");

  // 2. API guards.
  const api = (body: object) =>
    b.evaluate<number>(`fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(JSON.stringify(body))} }).then(r => r.status)`);
  const user = { id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] };
  ok((await api({ threadId: crypto.randomUUID(), messages: [user] })) === 404, "unknown thread id without newThread is 404");
  ok((await api({ threadId: crypto.randomUUID(), newThread: "store", messages: [{ id: "a", role: "assistant", parts: [{ type: "text", text: "x" }] }] })) === 400, "a new thread with no seller message is refused, nothing saved");

  // 3. A new chat stays unsaved until the first message.
  const before = await threadCount();
  await b.go("/dashboard/ai", "!!document.querySelector('#axori-input-page')");
  await b.evaluate(`(() => { const el = document.querySelector('#axori-input-page'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(el, 'Draft I have not sent'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(300);
  await b.go("/dashboard/orders", "!!document.querySelector('main')");
  await b.go("/dashboard/ai", "!!document.querySelector('#axori-input-page')");
  await b.waitFor("document.querySelector('#axori-input-page').value === 'Draft I have not sent'", 5000);
  ok((await b.evaluate<string>("document.querySelector('#axori-input-page').value")) === "Draft I have not sent", "unsent text comes back after navigating away (sessionStorage)");
  await b.evaluate(`[...document.querySelectorAll('aside[aria-label] button')].find(x => x.textContent.trim() === 'New chat')?.click()`);
  await sleep(800);
  ok((await threadCount()) === before, "typing, leaving and New chat save no thread");

  const prompt = "Reply with just the word OK.";
  await b.evaluate(`(() => { const el = document.querySelector('#axori-input-page'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(el, ${JSON.stringify(prompt)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(200);
  await b.evaluate(`document.querySelector('button[aria-label="Send"]').click()`);
  ok(await b.waitFor("location.search.startsWith('?t=')", 15_000), "the first message gives the chat its own URL");
  const id = (await path()).split("?t=")[1];
  ok(await b.waitFor(`[...document.querySelectorAll('aside[aria-label] li button')].some(x => x.textContent.includes('Reply with just'))`, 30_000), "the new chat shows in the history");
  const { data: row } = await db.from("ai_threads").select("messages").eq("id", id).maybeSingle();
  const firstRole = (row?.messages as { role: string }[] | undefined)?.[0]?.role;
  ok(firstRole === "user", "the saved row starts with the seller's message");
  await b.waitFor(`!!document.querySelector('button[aria-label="Send"]')`, 60_000);
  await sleep(4000);
  ok((await threadCount()) === before + 1, "exactly one thread was saved");
  await b.shot("chat-desktop");

  // Delete it through the menu, with the inline confirm.
  await b.evaluate(`document.querySelector('aside[aria-label] li button[aria-current="page"]')?.parentElement.querySelector('[aria-label^="Chat actions"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))`);
  await b.waitFor(`[...document.querySelectorAll('[role=menuitem]')].some(x => x.textContent.includes('Delete chat'))`, 5000);
  await b.evaluate(`[...document.querySelectorAll('[role=menuitem]')].find(x => x.textContent.includes('Delete chat')).click()`);
  await b.waitFor(`!!document.querySelector('[role=alertdialog]')`, 5000);
  await b.evaluate(`[...document.querySelectorAll('[role=alertdialog] button')].find(x => x.textContent.trim() === 'Delete').click()`);
  ok(await b.waitFor(`location.search === ''`, 10_000), "deleting the open chat returns to a new chat");
  await sleep(1000);
  ok((await threadCount()) === before, "the deleted thread is gone");

  // 4. Analytics: one scroll (the page's), no clipping, filters out of the way.
  for (const [w, label] of [
    [1280, "desktop"],
    [820, "tablet"],
    [390, "phone"],
    [320, "small phone"],
  ] as const) {
    await width(w);
    await b.go("/dashboard/analytics", "!!document.querySelector('.ag-studio-layout-canvas')");
    await b.waitFor(`(() => { const s = document.querySelector('.axori-studio'); return s && parseFloat(s.style.height) > 400; })()`, 20_000);
    await sleep(2500);
    const m = await b.evaluate<{ inner: boolean; pageScrolls: boolean; sideways: boolean; strip: boolean; tiles: number[] } | null>(`(() => {
      const layout = [...document.querySelectorAll('.ag-studio-layout')].find(n => n.offsetParent !== null);
      if (!layout) return null;
      const main = document.querySelector('main');
      const tiles = [...document.querySelectorAll('.ag-studio-layout-content-container > *')].slice(0, 4).map(n => Math.round(n.getBoundingClientRect().left));
      return {
        inner: layout.scrollHeight > layout.clientHeight,
        pageScrolls: main.scrollHeight > main.clientHeight,
        sideways: document.documentElement.scrollWidth > innerWidth || main.scrollWidth > main.clientWidth + 1 || layout.scrollWidth > layout.clientWidth + 1,
        strip: !!document.querySelector('.ag-studio-panel-right'),
        tiles,
      };
    })()`);
    ok(m, `${label}: the report rendered`);
    if (!m) continue;
    ok(!m.inner, `${label}: the report has no scrollbar of its own`);
    ok(m.pageScrolls, `${label}: the page scrolls through the whole report`);
    ok(!m.sideways, `${label}: nothing runs off the side`);
    ok(!m.strip, `${label}: no filter strip until Filters is opened`);
    if (w === 390) ok(new Set(m.tiles).size === 2, `${label}: KPI tiles two to a row`);
    if (w === 320) ok(new Set(m.tiles).size === 1, `${label}: KPI tiles one to a row`);
    await b.shot(`analytics-${w}`);
    await b.evaluate(`document.querySelector('[data-filters]').click()`);
    ok(await b.waitFor("!!document.querySelector('.ag-studio-panel-right .ag-studio-panel-content')", 5000), `${label}: Filters opens the filter panel`);
    if (w < 768) {
      const sheet = await b.evaluate<{ fixed: boolean; bottom: number; width: number }>(`(() => { const p = document.querySelector('.ag-studio-panel-right'); const r = p.getBoundingClientRect(); return { fixed: getComputedStyle(p).position === 'fixed', bottom: Math.round(r.bottom), width: Math.round(r.width) }; })()`);
      ok(sheet.fixed && Math.abs(sheet.bottom - 900) <= 2 && sheet.width >= w - 2, `${label}: filters open as a full-width bottom sheet`);
      const content = await b.evaluate<number>("Math.round(document.querySelector('.ag-studio-panel-right .ag-studio-panel-content').getBoundingClientRect().width)");
      ok(content >= w - 2, `${label}: the filter controls use the sheet's full width (${content}px)`);
    }
    await b.shot(`analytics-${w}-filters`);
    await b.evaluate(`document.querySelector('[data-filters]')?.click()`);
  }

  // 5. Phone shell: one bottom bar, nothing floating over the page.
  await width(390, 844);
  for (const p of ["/dashboard", "/dashboard/orders", "/dashboard/inbox", "/dashboard/analytics", "/dashboard/ai"]) {
    await b.go(p, "!!document.querySelector('nav[data-bottom-bar]')");
    await sleep(800);
    const r = await b.evaluate<{ navTop: number; contentBottom: number; floating: number; sideways: boolean } | null>(`(() => {
      const nav = document.querySelector('nav[data-bottom-bar]');
      if (!nav) return null;
      const wrap = document.querySelector('header')?.nextElementSibling;
      return {
        navTop: Math.round(nav.getBoundingClientRect().top),
        contentBottom: Math.round(wrap.getBoundingClientRect().bottom - parseFloat(getComputedStyle(wrap).paddingBottom)),
        floating: [...document.querySelectorAll('button.fixed')].length,
        sideways: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    ok(r, `phone ${p}: the bottom bar is there`);
    if (!r) continue;
    ok(r.contentBottom <= r.navTop, `phone ${p}: page content ends above the bottom bar`);
    ok(r.floating === 0, `phone ${p}: no floating button over the page`);
    ok(!r.sideways, `phone ${p}: no sideways scroll`);
    await b.shot(`phone${p.replace(/\//g, "-")}`);
  }

  // 6. Footer.
  for (const w of [1280, 390]) {
    await width(w);
    await b.go("/", "!!document.querySelector('footer img')");
    await b.evaluate("document.querySelector('footer').scrollIntoView()");
    await b.waitFor("document.querySelector('footer img').complete && document.querySelector('footer img').naturalWidth > 0", 15_000);
    await sleep(800);
    const f = await b.evaluate<{ links: string[]; sideways: boolean }>(`({ links: [...document.querySelectorAll('footer a')].map(a => a.getAttribute('href')), sideways: document.documentElement.scrollWidth > innerWidth })`);
    ok(!f.links.includes("/404") && !f.links.some((h) => h?.startsWith("/build")), `footer ${w}: no dead links`);
    ok(!f.sideways, `footer ${w}: no sideways scroll`);
    await b.evaluate(`(() => { const r = document.querySelector('footer').getBoundingClientRect(); scrollBy(0, r.top); })()`);
    await sleep(500);
    await b.shot(`footer-${w}`);
  }

  ok(b.consoleErrors.filter((e) => !/AG Grid|AG Studio|licen[cs]e|\*{5}/i.test(e)).length === 0, `no console errors (${b.consoleErrors.length} raw)`);
  if (b.consoleErrors.length) console.log(b.consoleErrors.map((e) => e.slice(0, 200)).join("\n"));
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
