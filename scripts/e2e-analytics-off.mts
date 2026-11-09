// Step 6.6 flag off: start the app with AG_STUDIO_ENABLED=false, then run this. Analytics falls back to the basic
// table, whose Sales equal the metrics module for each period, and no Studio code loads.
// Run: npx tsx --env-file=.env.local scripts/e2e-analytics-off.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";
import { formatMinor } from "../src/lib/money";
import { inRange, periodRange, PERIODS, sales, type MetricOrder } from "../src/modules/analytics/metrics";
import { check, openEdge } from "./edge";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: store } = await admin.from("stores").select("id").eq("slug", "demo").single();
const raw: MetricOrder[] = [];
for (let from = 0; ; from += 1000) {
  const { data } = await admin
    .from("orders")
    .select("id, status, source, channel, currency, total_minor, refunded_minor, tax_minor, charge_currency, charge_total_minor, fx_rate, paypal_fee_minor, paid_at, contact_id, link_id")
    .eq("store_id", store!.id)
    .neq("source", "test")
    .not("paid_at", "is", null)
    .order("id")
    .range(from, from + 999);
  raw.push(...((data ?? []) as MetricOrder[]));
  if (!data || data.length < 1000) break;
}
const b = await openEdge(base);
try {
  await b.go("/dashboard/analytics", `!!document.querySelector('tr[data-period]')`);
  check(await b.evaluate<boolean>(`!window.__axoriStudio && !document.querySelector('[data-period] button')`), "flag off: no Studio on the page");
  for (const p of PERIODS) {
    const cell = await b.evaluate<string>(`document.querySelector('tr[data-period="${p}"] td:nth-child(2)').textContent`);
    check(cell === formatMinor(sales(inRange(raw, periodRange(p))), "NGN"), `flag off: Sales ${p} = metrics (${cell})`);
  }
  await b.go(`/s/demo`, `document.readyState === 'complete'`);
  check(await b.evaluate<boolean>(`document.body.innerText.length > 100`), "flag off: storefront still opens");
} finally {
  b.close();
}
