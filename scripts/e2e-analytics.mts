// Step 6.6 in headless Edge against a running app (default http://localhost:3100), as the demo seller.
// Studio's Sales (its own query engine over the loaded rows) equals the metrics module for 7d/30d/3m/6m; the KPI tile
// follows the period toggle; every default page renders; another store's rows never load; phone width has no sideways scroll.
// Run: npx tsx --env-file=.env.local scripts/e2e-analytics.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";
import {
  aov,
  inRange,
  orderCount,
  periodRange,
  PERIODS,
  sales,
  type MetricOrder,
} from "../src/modules/analytics/metrics";
import { check, openEdge } from "./edge";

const base =
  process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const { data: store } = await admin
  .from("stores")
  .select("id")
  .eq("slug", "demo")
  .single();
const { data: other } = await admin
  .from("stores")
  .select("id")
  .eq("slug", "eko-sweet-kitchen-uk")
  .single();

async function ordersOf(storeId: string) {
  const raw: MetricOrder[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("orders")
      .select(
        "id, status, source, channel, currency, total_minor, refunded_minor, tax_minor, charge_currency, charge_total_minor, fx_rate, paypal_fee_minor, paid_at, contact_id, link_id",
      )
      .eq("store_id", storeId)
      .neq("source", "test")
      .not("paid_at", "is", null)
      .order("id")
      .range(from, from + 999);
    raw.push(...((data ?? []) as MetricOrder[]));
    if (!data || data.length < 1000) break;
  }
  return raw;
}
const mine = await ordersOf(store!.id);
const theirs = await ordersOf(other!.id);

const b = await openEdge(base);
try {
  await b.go("/dashboard/analytics", `!!window.__axoriStudio`);
  check(
    await b.waitFor(
      `document.querySelectorAll('[data-period]').length === 4`,
      60_000,
    ),
    "Analytics opens with Studio and the 7d/30d/3m/6m toggle",
  );
  check(
    await b.evaluate<boolean>(
      `!!document.querySelector('a[href="/dashboard/analytics"]')`,
    ),
    "Analytics is a live sidebar link",
  );

  // ── Studio's engine vs the metrics module ── (executeQuery sits behind Studio 3.0's internal symbol)
  await b.evaluate(
    `window.__q = (q) => { const api = window.__axoriStudio; const sym = Object.getOwnPropertySymbols(api).find((s) => s.description === "ag.internal"); return api[sym].executeQuery(q); }`,
  );
  const now = new Date();
  for (const p of PERIODS) {
    const r = periodRange(p, now);
    const want = inRange(mine, r);
    const q = {
      kind: "apiQuery",
      variant: "aggregation",
      measures: [
        { field: { id: "orders.sales", aggregation: "sum" }, as: "s" },
        { field: { id: "orders.one", aggregation: "sum" }, as: "n" },
      ],
      filter: {
        combinator: "and",
        conditions: [
          {
            field: { id: "orders.paidAt" },
            operator: "greaterThanOrEqual",
            value: "__FROM__",
          },
          {
            field: { id: "orders.paidAt" },
            operator: "lessThan",
            value: "__TO__",
          },
        ],
      },
    };
    const expr = `(async () => { const q = ${JSON.stringify(q)}; q.filter.conditions[0].value = new Date(${JSON.stringify(r.from.toISOString())}); q.filter.conditions[1].value = new Date(${JSON.stringify(r.to.toISOString())}); try { const res = await window.__q(q); return JSON.stringify(res); } catch (e) { return JSON.stringify({ success: false, issues: String(e && e.stack || e) }); } })()`;
    const res = JSON.parse(await b.evaluate<string>(expr)) as {
      success: boolean;
      value?: unknown;
      issues?: unknown;
    };
    if (!res.success)
      throw new Error(
        `query failed: ${JSON.stringify(res.issues).slice(0, 400)}`,
      );
    const flat = JSON.stringify(res.value);
    const s = Number(/"s":(-?[\d.e+]+)/.exec(flat)?.[1]);
    const n = Number(/"n":(-?[\d.e+]+)/.exec(flat)?.[1]);
    check(
      Math.round(s * 100) === sales(want) && n === orderCount(want),
      `Studio Sales ${p} = metrics (${Math.round(s * 100)} = ${sales(want)}, ${n} orders, AOV ${aov(want)})`,
    );
  }

  // ── Another store's rows never load ──
  const loadedIds = await b.evaluate<string>(
    `(async () => { const r = await window.__q({ kind: "apiQuery", variant: "projection", projection: [{ field: { id: "orders.id" } }] }); return JSON.stringify(r); })()`,
  );
  const theirIds = theirs.map((o) => o.id);
  check(
    theirIds.length > 0 && !theirIds.some((id) => loadedIds.includes(id)),
    `none of the UK store's ${theirIds.length} orders loaded`,
  );
  check(
    mine.slice(0, 20).every((o) => loadedIds.includes(o.id)),
    "this store's orders loaded",
  );

  // ── Period toggle drives Studio's page filters (6m default) ──
  await b.waitFor(
    `document.body.innerText.includes('Sales and orders by week')`,
    30_000,
  );
  await b.shot("analytics-1280");
  await b.evaluate(`document.querySelector('[data-period="7d"]').click()`);
  await new Promise((r) => setTimeout(r, 1500));
  const filt = await b.evaluate<string>(
    `JSON.stringify(window.__axoriStudio.getState().pages.find(p => p.id === 'sales').filter)`,
  );
  check(
    filt.includes("between") &&
      filt.includes(periodRange("7d", now).from.toISOString().slice(0, 13)),
    "7d toggle sets the period filter in Studio state",
  );

  // ── Every default page renders ──
  for (const title of [
    "Top products",
    "Sales by channel",
    "Marketing funnel",
    "Customers",
    "Reconciliation",
    "PayPal transactions",
  ]) {
    await b.evaluate(
      `[...document.querySelectorAll('nav[aria-label="Report pages"] button')].find(x => x.textContent === ${JSON.stringify(title)}).click()`,
    );
    await new Promise((r) => setTimeout(r, 2500));
    const page = await b.evaluate<string>(
      `window.__axoriStudio.getState().selectedPageId`,
    );
    check(!!page, `page "${title}" opens (${page})`);
    await b.shot(`analytics-${page}`);
  }

  // ── Phone ──
  await b.phone();
  await b.go("/dashboard/analytics", `!!window.__axoriStudio`);
  await new Promise((r) => setTimeout(r, 3000));
  check(
    await b.evaluate<boolean>(
      `document.documentElement.scrollWidth <= window.innerWidth + 1`,
    ),
    "no sideways scroll at 390 px",
  );
  await b.shot("analytics-390");

  const errors = b.consoleErrors.filter(
    (e) =>
      !/license|licence|watermark|AG Studio|AG Grid|trial|^[\s*]*$/i.test(e),
  );
  if (errors.length) console.log(`errors: ${errors.join(" | ").slice(0, 800)}`);
  if (b.consoleErrors.length)
    console.log(
      `info console: ${b.consoleErrors.slice(0, 5).join(" | ").slice(0, 600)}`,
    );
  check(errors.length === 0, `no console errors (${errors.length})`);
} finally {
  b.close();
}
