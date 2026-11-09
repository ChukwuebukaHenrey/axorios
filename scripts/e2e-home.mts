// Step 6.8 in headless Edge against a running app (default http://localhost:3100), as the demo seller.
// Home's Sales tile equals the metrics module (and so Money and Analytics) for 7d/30d/3m/6m; low-stock count matches
// the products table; Store overview, products, promotions and details render; ranking sums to Sales; phone layout.
// Run: npx tsx --env-file=.env.local scripts/e2e-home.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";
import { formatMinor } from "../src/lib/money";
import {
  inRange,
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
const storeId = store!.id;

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
const { data: products } = await admin
  .from("products")
  .select("inventory_mode, stock, low_stock_threshold, active")
  .eq("store_id", storeId);
const lowDb = (products ?? []).filter(
  (p) =>
    p.active &&
    p.inventory_mode === "tracked" &&
    p.stock <= p.low_stock_threshold,
).length;

const b = await openEdge(base);
const text = (sel: string) =>
  b.evaluate<string>(
    `document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`,
  );
try {
  for (const p of PERIODS) {
    await b.go(
      `/dashboard?period=${p}`,
      `!!document.querySelector('[data-tile="Sales"]')`,
    );
    const want = formatMinor(sales(inRange(raw, periodRange(p))), "NGN");
    const home = await text('[data-tile="Sales"]');
    check(home === want, `Home Sales ${p} = metrics (${home})`);
    await b.go(
      `/dashboard/money?tab=in&period=${p}`,
      `document.body.textContent.includes('Sales per day')`,
    );
    const money = await text('[data-stat="Sales"]');
    check(money === home, `Money Sales ${p} = Home (${money})`);
    await b.go(
      `/dashboard/store?period=${p}`,
      `!!document.querySelector('[data-stat="Sales"]')`,
    );
    const st = await text('[data-stat="Sales"]');
    check(st === home, `Store Sales ${p} = Home (${st})`);
  }
  await b.go(
    "/dashboard",
    `!!document.querySelector('[data-tile="Low stock"]')`,
  );
  const low = await text('[data-tile="Low stock"]');
  check(
    Number(low) === lowDb,
    `Home low stock = products table (${low} = ${lowDb})`,
  );
  for (const label of [
    "Orders to fulfil",
    "Chats waiting",
    "Store visits",
    "Last post",
  ])
    check(
      (await text(`[data-tile="${label}"]`)).length > 0,
      `tile "${label}" shows a value`,
    );
  await b.shot("home-1280");

  await b.go(
    "/dashboard/store",
    `!!document.querySelector('[data-stat="Conversion"]')`,
  );
  check(
    await b.evaluate<boolean>(
      `!!document.querySelector('a[href="/dashboard/store"][aria-current="page"], nav a[href="/dashboard/store"]')`,
    ),
    "Store is the sidebar link",
  );
  check(
    await b.evaluate<boolean>(
      `!!document.querySelector('iframe[src^="/s/"]') && !!document.querySelector('a[href="/build"]')`,
    ),
    "overview: storefront preview and Edit storefront",
  );
  const ranked = await b.evaluate<number>(
    `document.querySelectorAll('[data-rank-sales]').length`,
  );
  check(ranked > 0, `overview: ${ranked} top products ranked`);
  await b.shot("store-1280");

  await b.go(
    "/dashboard/store?tab=products",
    `document.querySelectorAll('[data-product]').length > 0`,
  );
  const lowRows = await b.evaluate<number>(
    `document.querySelectorAll('[data-low]').length`,
  );
  check(lowRows === lowDb, `products: low rows = products table (${lowRows})`);
  check(
    await b.evaluate<boolean>(
      `['Tracked', 'Made to order'].every(m => document.body.textContent.includes(m))`,
    ),
    "products: inventory modes shown",
  );
  await b.shot("store-products-1280");
  await b.go(
    "/dashboard/store?tab=promotions",
    `document.readyState === 'complete'`,
  );
  check(
    await b.evaluate<boolean>(
      `document.querySelectorAll('main li span.font-mono').length > 0`,
    ),
    "promotions listed",
  );
  await b.go("/dashboard/store?tab=details", `!!document.querySelector('dl')`);
  check(
    await b.evaluate<boolean>(
      `(t => t.includes('NGN') && t.includes('Lekki'))([...document.querySelectorAll('main dl')].map(d => d.textContent).join(' '))`,
    ),
    "details: currency and delivery zones",
  );

  await b.phone();
  for (const path of [
    "/dashboard",
    "/dashboard/store",
    "/dashboard/store?tab=products",
  ]) {
    await b.go(path, `document.readyState === 'complete'`);
    await new Promise((r) => setTimeout(r, 800));
    check(
      await b.evaluate<boolean>(
        `document.documentElement.scrollWidth <= window.innerWidth + 1`,
      ),
      `no sideways scroll at 390 px: ${path}`,
    );
  }
  await b.go("/dashboard", `!!document.querySelector('[data-tile="Sales"]')`);
  await b.shot("home-390");
  const errors = b.consoleErrors.filter(
    (e) => !/license|licence|watermark|trial|^[\s*]*$/i.test(e),
  );
  if (errors.length) console.log(errors.join(" | ").slice(0, 800));
  check(errors.length === 0, `no console errors (${errors.length})`);
} finally {
  b.close();
}
