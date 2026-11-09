/**
 * Spec v2 "Checks after seeding". Prints row counts (compare two runs for determinism) and fails on any broken rule.
 * Run: npx tsx --env-file=.env.local scripts/check-demo.mts
 */
import { createClient } from "@supabase/supabase-js";
import { periodRange, PERIODS, sales, summary, type MetricOrder } from "../src/modules/analytics/metrics";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST builder types differ per table
async function all<T>(table: string, select: string, filter: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const order = table === "post_metrics" ? ["post_id", "channel", "day"] : ["id"];
    let q = filter(admin.from(table).select(select));
    for (const c of order) q = q.order(c);
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as T[]));
    if (data.length < 1000) return out;
  }
}

let failures = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
};

const { data: stores } = await admin.from("stores").select("id, slug, currency, vat_rate_bp, vat_registered").in("slug", ["demo", "eko-sweet-kitchen-uk"]);
for (const store of stores ?? []) {
  console.log(`\n── ${store.slug}`);
  const orders = await all<MetricOrder & { created_at: string; charge_total_minor: number; paypal_net_minor: number | null; tax_rate_bp: number }>(
    "orders",
    "id, status, source, channel, currency, total_minor, refunded_minor, tax_minor, tax_rate_bp, charge_currency, charge_total_minor, fx_rate, paypal_fee_minor, paypal_net_minor, paid_at, contact_id, link_id, created_at",
    (q) => q.eq("store_id", store.id),
  );
  const counts: Record<string, number> = {};
  for (const t of ["contacts", "refunds", "posts", "tracked_links", "post_metrics", "link_clicks", "campaigns", "campaign_sends", "store_visits", "expenses", "insights", "labels"]) {
    const { count } = await admin.from(t).select("*", { count: "exact", head: true }).eq("store_id", store.id);
    counts[t] = count ?? 0;
  }
  console.log(`counts: orders=${orders.length} (${orders.filter((o) => o.source === "test").length} test) ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ")}`);

  // Sales: metrics module vs an independent sum, for each period.
  for (const p of PERIODS) {
    const r = periodRange(p);
    const viaMetrics = summary(orders, r).sales;
    const manual = orders
      .filter((o) => o.paid_at && o.source !== "test" && ["paid", "refunded", "partially_refunded"].includes(o.status))
      .filter((o) => Date.parse(o.paid_at!) >= r.from.getTime() && Date.parse(o.paid_at!) < r.to.getTime())
      .reduce((s, o) => s + o.total_minor - o.refunded_minor, 0);
    check(viaMetrics === manual && viaMetrics === sales(orders.filter((o) => o.paid_at && Date.parse(o.paid_at) >= r.from.getTime() && Date.parse(o.paid_at) < r.to.getTime())), `${p} Sales ${viaMetrics} agrees`);
  }

  const seeded = orders.filter((o) => o.source === "import" || o.source === "seed");
  const badVat = seeded.filter((o) => o.tax_minor !== (store.vat_registered ? Math.round((o.total_minor * store.vat_rate_bp) / (10_000 + store.vat_rate_bp)) : 0));
  check(badVat.length === 0, `VAT adds up on every order (${badVat.length} off)`);
  const badNet = seeded.filter((o) => o.paypal_fee_minor === null || o.paypal_net_minor !== o.charge_total_minor - o.paypal_fee_minor);
  check(badNet.length === 0, `fee + net = charge on every order (${badNet.length} off)`);
  check(seeded.every((o) => o.refunded_minor <= o.total_minor), "no refund exceeds its order");

  // Links: every post with clicks has its link; orders through a link come after a click on it.
  const links = await all<{ id: string; post_id: string | null }>("tracked_links", "id, post_id", (q) => q.eq("store_id", store.id));
  const metrics = await all<{ post_id: string; clicks: number }>("post_metrics", "post_id, clicks", (q) => q.eq("store_id", store.id).gt("clicks", 0));
  const linkedPosts = new Set(links.map((l) => l.post_id));
  check(metrics.every((m) => linkedPosts.has(m.post_id)), "every post with clicks has a tracked link");
  const clicks = await all<{ link_id: string; at: string }>("link_clicks", "link_id, at", (q) => q.eq("store_id", store.id));
  const firstClick = new Map<string, number>();
  for (const c of clicks) firstClick.set(c.link_id, Math.min(firstClick.get(c.link_id) ?? Infinity, Date.parse(c.at)));
  const early = orders.filter((o) => o.link_id && !(Date.parse(o.paid_at!) > (firstClick.get(o.link_id) ?? Infinity)));
  check(early.length === 0, `orders with a link_id come after a click (${orders.filter((o) => o.link_id).length} linked, ${early.length} early)`);
}

console.log(failures === 0 ? "\nPASS" : `\nFAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
