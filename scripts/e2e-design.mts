// Step 6.14: an upload in Axori AI lands in the media library, tagged, and reaches the agent as context.
// Then the Design tab: tags fixed by hand, delete guard for a file in use, delete, brand kits, templates, 390 px.
// Run against a server on :3100 as the demo seller:
//   npx tsx --env-file=.env.local scripts/e2e-design.mts [baseUrl] [--chat]
// --chat also asks Axori AI about the attached file (one model call).
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { check, openEdge } from "./edge";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const withChat = process.argv.includes("--chat");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: store } = await admin.from("stores").select("id, owner_id").eq("slug", "demo").single();
const { data: redVelvet } = await admin.from("products").select("id, name, image_url").eq("store_id", store!.id).ilike("name", "Red Velvet%").limit(1).single();
const rvTag = redVelvet!.name.toLowerCase();

const dir = mkdtempSync(join(tmpdir(), "axorios-media-"));
const upload = join(dir, "red-velvet-e2e.png");
copyFileSync("public/images/stores/bakery/sticker-slice-red-velvet.png", upload);

const b = await openEdge(base);
const cleanup: string[] = [];
let guardRow: string | null = null;
try {
  // ── API guards ──
  const post = (body: FormData, cookie?: string) =>
    fetch(`${base}/api/media`, { method: "POST", body, headers: cookie ? { cookie } : {}, redirect: "manual" });
  const form = (bytes: Uint8Array, name: string) => {
    const f = new FormData();
    f.set("file", new Blob([bytes as BlobPart]), name);
    return f;
  };
  const { count: before } = await admin.from("media").select("id", { count: "exact", head: true }).eq("owner_id", store!.owner_id);
  check((await post(form(new Uint8Array([0xff, 0xd8, 0xff, 1]), "a.jpg"))).status === 401, "signed-out upload 401");
  check(
    (await post(form(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "evil.jpg"), b.cookie.header)).status === 415,
    "an SVG named .jpg is refused (415)",
  );
  const big = new Uint8Array(4 * 1024 * 1024 + 10);
  big.set([0xff, 0xd8, 0xff]);
  check([413].includes((await post(form(big, "big.jpg"), b.cookie.header)).status), "over 4 MB refused (413)");
  const foreign = form(new Uint8Array([0xff, 0xd8, 0xff, 1]), "x.jpg");
  foreign.set("threadId", "00000000-0000-4000-8000-000000000000");
  check((await post(foreign, b.cookie.header)).status === 404, "unknown thread 404");
  const { count: after } = await admin.from("media").select("id", { count: "exact", head: true }).eq("owner_id", store!.owner_id);
  check(after === before, "refused uploads stored nothing");

  // ── Upload in Axori AI ──
  await b.go("/dashboard/design", `!!document.querySelector('main h1')`);
  check(
    await b.evaluate<boolean>(`!![...document.querySelectorAll('a[href="/dashboard/design"]')].find(a => a.closest('aside'))`),
    "Design is live in the sidebar",
  );
  await new Promise((r) => setTimeout(r, 3000)); // hydration
  let opened = false;
  for (let i = 0; i < 3 && !opened; i++) {
    await b.evaluate(`document.querySelector('header button[aria-label="Open Axori AI"]').click()`);
    opened = await b.waitFor(`!!document.querySelector('#axori-input-panel')`, 15_000);
  }
  check(opened, "Axori AI panel opens a thread");
  const { root } = (await b.send("DOM.getDocument", { depth: -1, pierce: true })) as { root: { nodeId: number } };
  const { nodeId } = (await b.send("DOM.querySelector", { nodeId: root.nodeId, selector: '[role="dialog"] input[data-axori-file]' })) as { nodeId: number };
  check(nodeId > 0, "panel has a file input behind the paperclip");
  check(await b.evaluate<boolean>(`!!document.querySelector('[role="dialog"] button[aria-label="Attach a photo or file"]')`), "paperclip button");
  await b.send("DOM.setFileInputFiles", { nodeId, files: [upload] });
  check(await b.waitFor(`document.querySelector('[data-media-status]')?.dataset.mediaStatus === 'done'`, 30_000), "upload finished");
  const status = await b.evaluate<string>(`document.querySelector('[data-media-status]').textContent`);
  console.log(`status: ${status}`);
  check(status.includes(rvTag) && status.includes("photo"), "status line shows the tags");
  check(
    await b.evaluate<boolean>(`[...document.querySelectorAll('[role="dialog"] span')].some(s => s.textContent.trim().startsWith('red-velvet-e2e') && s.className.includes('lime'))`),
    "the file is attached as a context chip",
  );

  const { data: rows } = await admin
    .from("media")
    .select("id, owner_id, store_id, url, kind, tags, product_ids, source")
    .eq("owner_id", store!.owner_id)
    .like("url", "%red-velvet-e2e%")
    .order("created_at", { ascending: false })
    .limit(1);
  const row = rows![0];
  cleanup.push(row.id);
  check(row.store_id === store!.id && row.kind === "image" && row.source === "upload", "row: this owner, this store, image, upload");
  check(row.tags.includes("photo") && row.tags.includes(rvTag), `row tagged by type and product (${row.tags.join(", ")})`);
  check(row.product_ids.includes(redVelvet!.id), "row linked to the Red Velvet product");
  check(row.url.includes(`/owners/${store!.owner_id}/media/`), "stored under the owner's folder");
  const img = await fetch(row.url);
  check(img.ok && img.headers.get("content-type") === "image/png", "file is served as image/png");

  if (withChat) {
    await b.evaluate(`document.querySelector('#axori-input-panel').focus()`);
    await b.send("Input.insertText", { text: "Which file did I just attach, and what are its tags? One short sentence." });
    await b.evaluate(`document.querySelector('[role="dialog"] button[aria-label="Send"]').click()`);
    const last = `[...document.querySelectorAll('[role="dialog"] [aria-live] p')].at(-1)?.textContent ?? ''`;
    check(await b.waitFor(`/red.?velvet/i.test(${last}) && !/Which file did I/.test(${last})`, 60_000), "Axori AI sees the attached file's details");
    console.log(`reply: ${(await b.evaluate<string>(last)).slice(0, 160)}`);
  }
  await b.shot("design-axori-upload");

  // ── Design tab: the upload is in the library with its tags ──
  await b.go("/dashboard/design", `!!document.querySelector('[data-media="${row.id}"]')`);
  await new Promise((r) => setTimeout(r, 2500)); // hydration
  const card = `document.querySelector('[data-media="${row.id}"]')`;
  check(await b.evaluate<boolean>(`!!${card}.querySelector('[data-tag="${rvTag}"]') && !!${card}.querySelector('[data-tag="photo"]')`), "library card shows the tags");
  check(await b.evaluate<boolean>(`${card}.textContent.includes('Not used yet')`), "card says where it's used (nowhere yet)");

  // Fix tags by hand: add one, remove one.
  await b.evaluate(`${card}.querySelector('input[id^="tag-"]').focus()`);
  await b.send("Input.insertText", { text: "Weekend Promo!" });
  await b.evaluate(`${card}.querySelector('input[id^="tag-"]').form.querySelector('button[type=submit]').click()`);
  check(await b.waitFor(`!!${card}.querySelector('[data-tag="weekend promo"]')`, 20_000), "tag added (normalised)");
  await b.waitFor(`!${card}.querySelector('[data-tag="photo"] button').disabled`);
  await b.evaluate(`${card}.querySelector('[data-tag="photo"] button').click()`);
  check(await b.waitFor(`!${card}.querySelector('[data-tag="photo"]')`, 20_000), "tag removed");
  await new Promise((r) => setTimeout(r, 800));
  const { data: tagged } = await admin.from("media").select("tags").eq("id", row.id).single();
  check(!tagged!.tags.includes("photo") && tagged!.tags.includes(rvTag) && tagged!.tags.includes("weekend promo"), `tags saved (${tagged!.tags.join(", ")})`);

  // Filter by tag.
  await b.go(`/dashboard/design?tag=${encodeURIComponent("weekend promo")}`, `!!document.querySelector('[data-media]')`);
  check(
    await b.evaluate<boolean>(`[...document.querySelectorAll('[data-media]')].every(c => c.querySelector('[data-tag="weekend promo"]'))`),
    "tag filter shows only matching files",
  );

  // Delete guard: a library row pointing at the live product photo can't be deleted.
  const { data: guard } = await admin
    .from("media")
    .insert({ owner_id: store!.owner_id, store_id: store!.id, url: redVelvet!.image_url!, kind: "image", tags: ["e2e guard"], source: "seed" })
    .select("id")
    .single();
  guardRow = guard!.id;
  await b.go("/dashboard/design", `!!document.querySelector('[data-media="${guardRow}"]')`);
  await new Promise((r) => setTimeout(r, 2500));
  const gcard = `document.querySelector('[data-media="${guardRow}"]')`;
  check(await b.evaluate<boolean>(`${gcard}.textContent.includes('Product photo: ${redVelvet!.name}')`), "card shows it's the Red Velvet product photo");
  await b.evaluate(`${gcard}.querySelector('button[aria-label^="Delete"]').click()`);
  await b.waitFor(`!!document.querySelector('[role="dialog"]')`);
  await b.evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Delete').click()`);
  check(
    await b.waitFor(`document.querySelector('[role="dialog"] [role="alert"]')?.textContent.includes(${JSON.stringify(redVelvet!.name)})`, 20_000),
    "deleting a file in use is refused, naming the product",
  );
  const { count: still } = await admin.from("media").select("id", { count: "exact", head: true }).eq("id", guardRow);
  check(still === 1 && (await fetch(redVelvet!.image_url!)).ok, "row and product photo both still there");
  await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });

  // Delete the upload.
  await b.go("/dashboard/design", `!!document.querySelector('[data-media="${row.id}"]')`);
  await new Promise((r) => setTimeout(r, 2500));
  await b.evaluate(`${card}.querySelector('button[aria-label^="Delete"]').click()`);
  await b.waitFor(`!!document.querySelector('[role="dialog"]')`);
  await b.evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Delete').click()`);
  check(await b.waitFor(`!document.querySelector('[data-media="${row.id}"]')`, 20_000), "unused file deleted from the library");
  const { count: gone } = await admin.from("media").select("id", { count: "exact", head: true }).eq("id", row.id);
  check(gone === 0, "row deleted");
  const stale = await fetch(`${row.url}?t=${Date.now()}`);
  check(!stale.ok, `storage object removed (${stale.status})`);
  cleanup.length = 0;

  // ── Brand kits and templates ──
  await b.go("/dashboard/design?tab=brand", `!!document.querySelector('[data-brand="demo"]')`);
  check(
    await b.evaluate<boolean>(`document.querySelector('[data-brand="demo"]').querySelectorAll('.font-mono').length === 5`),
    "brand kit: the demo store's 5 colours",
  );
  check(await b.evaluate<boolean>(`[...document.querySelectorAll('main button')].some(x => x.textContent.includes('Edit with Axori AI'))`), "brand kit: Edit with Axori AI");
  await b.shot("design-brand-1280");
  await b.go("/dashboard/design?tab=templates", `document.querySelectorAll('[data-template]').length === 4`);
  check(
    await b.evaluate<boolean>(`document.querySelector('[data-template="bakery"]').textContent.includes('v1') && document.querySelector('[data-template="bakery"]').closest('section').textContent.includes('v1')`),
    "templates: 4 presets with versions",
  );
  const onBakery = await b.evaluate<string>(`document.querySelector('[data-template="bakery"]').textContent`);
  check(/Eko Sweet/i.test(onBakery), "templates: the demo store is listed on Bakery");
  await b.shot("design-templates-1280");

  // ── Phone ──
  await b.phone();
  for (const tab of ["", "?tab=brand", "?tab=templates"]) {
    await b.go(`/dashboard/design${tab}`, `!!document.querySelector('main h1')`);
    await new Promise((r) => setTimeout(r, 1000));
    check(await b.evaluate<boolean>(`document.documentElement.scrollWidth <= 390`), `390 ${tab || "media"}: no sideways scroll`);
  }
  await b.shot("design-390");
  check(b.consoleErrors.length === 0, `no console errors (${b.consoleErrors.join(" | ").slice(0, 300)})`);
} finally {
  if (guardRow) await admin.from("media").delete().eq("id", guardRow);
  for (const id of cleanup) {
    const { data: left } = await admin.from("media").select("url").eq("id", id).maybeSingle();
    if (left) await admin.storage.from("store-assets").remove([decodeURIComponent(left.url.split("/object/public/store-assets/")[1])]);
    await admin.from("media").delete().eq("id", id);
  }
  // --chat asked its question in the demo seller's latest thread; take that turn back out.
  const { data: threads } = await admin.from("ai_threads").select("id, messages").eq("owner_id", store!.owner_id);
  for (const t of threads ?? []) {
    type Msg = { role: string; parts: { text?: string }[] };
    const msgs = (t.messages as unknown as Msg[]) ?? [];
    const ours = (m?: Msg) => m?.role === "user" && m.parts.some((p) => p.text?.startsWith("Which file did I just attach"));
    if (!msgs.some((m) => ours(m))) continue;
    const kept = msgs.filter((m, i) => !ours(m) && !(m.role === "assistant" && ours(msgs[i - 1])));
    await admin.from("ai_threads").update({ messages: kept as never }).eq("id", t.id);
  }
  b.close();
}
console.log("e2e-design: all checks passed");
process.exit(0);
