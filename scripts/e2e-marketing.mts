// Step 6.10: Marketing performance. Post conversion on the page equals orders with that link_id in the database;
// demo publishers return an internal permalink that opens; campaigns and breakdowns render on desktop and phone.
// Run: npx tsx --import ./scripts/no-server-only.mjs --env-file=.env.local scripts/e2e-marketing.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";
import { DEMO_PUBLISHERS, getPublisher, publishTargets } from "../src/modules/publishers/index";
import { check, openEdge } from "./edge";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: store } = await admin.from("stores").select("id, slug").eq("slug", "demo").single();
const storeId = store!.id;

// ── Demo publishers ──
const targets = await publishTargets(storeId);
check(DEMO_PUBLISHERS.every((n) => targets.includes(n)), `demo store targets include ${DEMO_PUBLISHERS.join(", ")}`);
const { data: published } = await admin
  .from("posts")
  .select("id, caption, link_id, scheduled_at, created_at")
  .eq("store_id", storeId)
  .eq("status", "published")
  .not("link_id", "is", null)
  .order("scheduled_at", { ascending: false })
  .limit(200);
check((published?.length ?? 0) > 0, "demo store has published posts with tracked links");
const sample = published![0];
const { url } = await getPublisher("instagram").publish({ caption: sample.caption, postId: sample.id, storeSlug: store!.slug });
const app = new URL(process.env.NEXT_PUBLIC_APP_URL!);
check(url && new URL(url).host === app.host && new URL(url).pathname === `/s/demo/p/${sample.id}`, `demo publish returns an internal permalink (${new URL(url!).pathname})`);
const page = await fetch(`${base}/s/demo/p/${sample.id}`);
const html = await page.text();
check(page.status === 200 && html.includes(sample.caption.slice(0, 20).replace(/&/g, "&amp;")), "permalink page opens and shows the caption");
const missing = await fetch(`${base}/s/demo/p/00000000-0000-0000-0000-000000000000`);
check(missing.status === 404, "unknown post id is 404");

// ── Post conversion = orders with that link_id ──
async function ordersWithLink(linkId: string) {
  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("link_id", linkId)
    .neq("source", "test")
    .not("paid_at", "is", null)
    .in("status", ["paid", "refunded", "partially_refunded"]);
  if (error) throw new Error(`orders count: ${error.code}`);
  return count ?? 0;
}

const e = await openEdge(base, 9341);
try {
  check(await e.go("/dashboard/campaigns?tab=performance&period=6m&sort=orders", "!!document.querySelector('[data-table=posts]')"), "Performance tab renders per-post table");
  const shownRows = await e.evaluate<{ id: string; orders: number }[]>(
    "[...document.querySelectorAll('[data-post]')].map(r => ({ id: r.dataset.post, orders: Number(r.dataset.orders) }))",
  );
  check(shownRows.length > 0 && shownRows[0].orders > 0, `top post has orders (${shownRows[0]?.orders})`);
  const linkOf = new Map(published!.map((p) => [p.id, p.link_id as string]));
  let compared = 0;
  for (const r of shownRows.slice(0, 10)) {
    let linkId = linkOf.get(r.id);
    if (!linkId) linkId = (await admin.from("posts").select("link_id").eq("id", r.id).single()).data?.link_id ?? undefined;
    if (!linkId) continue;
    const db = await ordersWithLink(linkId);
    if (db !== r.orders) throw new Error(`FAIL post ${r.id}: page ${r.orders} vs db ${db}`);
    compared++;
  }
  check(compared >= 5, `post conversion equals orders with that link_id for ${compared} posts`);

  const stat = await e.evaluate<string>("document.querySelector('[data-stat=Orders]')?.textContent ?? ''");
  const tableSum = await e.evaluate<number>("[...document.querySelectorAll('[data-table=breakdown] [data-group]')].reduce((s, r) => s + Number(r.children[4].textContent.replace(/,/g, '')), 0)");
  check(Number(stat.replace(/,/g, "")) === tableSum, `channel breakdown orders add up to the Orders stat (${stat})`);
  await e.shot("marketing-performance");

  for (const by of ["contentType", "length", "product", "weekday", "daypart"]) {
    check(await e.go(`/dashboard/campaigns?tab=performance&period=6m&by=${by}`, "document.querySelectorAll('[data-table=breakdown] [data-group]').length > 0"), `breakdown by ${by} renders`);
  }

  check(await e.go("/dashboard/campaigns?tab=campaigns&period=6m", "document.querySelectorAll('[data-campaign]').length > 0"), "Campaigns tab lists campaigns");
  await e.shot("marketing-campaigns");
  check(await e.go("/dashboard/campaigns", "!!document.querySelector('main')"), "Posts tab still renders");

  await e.phone();
  check(await e.go("/dashboard/campaigns?tab=performance&period=6m"), "Performance on phone");
  const overflow = await e.evaluate<boolean>("document.documentElement.scrollWidth > window.innerWidth + 1");
  check(!overflow, "no horizontal page scroll on phone");
  await e.shot("marketing-phone");
  check(e.consoleErrors.length === 0, `no console errors${e.consoleErrors.length ? `: ${e.consoleErrors.join(" | ")}` : ""}`);
} finally {
  e.close();
}
console.log("e2e-marketing: all checks passed");
