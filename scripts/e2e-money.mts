// Step 6.7 UI in headless Edge against a running app (default http://localhost:3100), as the demo seller.
// Orders paging/search/filter, order detail, the Refund card on a real sandbox order (partial refund through PayPal),
// every Money tab, statement CSV + print page, and the phone layout.
// Run: npx tsx --env-file=.env.local scripts/e2e-money.mts [baseUrl] [--pay]
//   --pay first makes one real sandbox payment on production (/s/demo) to have a refundable order.
import { createClient } from "@supabase/supabase-js";
import { formatMinor } from "../src/lib/money";
import { periodRange, summary, type MetricOrder } from "../src/modules/analytics/metrics";
import { check, openEdge } from "./edge";
import { payAsSandboxBuyer } from "./sandbox-pay";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: store } = await admin.from("stores").select("id").eq("slug", "demo").single();
const storeId = store!.id;

if (process.argv.includes("--pay")) {
  const prod = "https://axorios.vercel.app";
  const { data: product } = await admin.from("products").select("id").eq("store_id", storeId).eq("name", "Red Velvet Celebration Cake").single();
  const res = await fetch(`${prod}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "demo", items: [{ productId: product!.id, quantity: 1 }], deliveryNote: "Birthday cake for Mum, Lekki Phase 1" }),
  });
  const checkout = (await res.json()) as { orderId: string; paypalOrderId: string };
  check(res.ok, "sandbox checkout opened");
  const landed = await payAsSandboxBuyer(`https://www.sandbox.paypal.com/checkoutnow?token=${checkout.paypalOrderId}`, prod);
  check(landed.includes(checkout.orderId), "PayPal returned the buyer");
  await fetch(`${prod}/s/demo/order/${checkout.orderId}`);
}

const { data: refundable } = await admin
  .from("orders")
  .select("id, charge_total_minor, refunded_charge_minor")
  .eq("store_id", storeId)
  .eq("source", "app")
  .eq("status", "paid")
  .not("paypal_capture_id", "is", null)
  .order("paid_at", { ascending: false })
  .limit(1);
const real = refundable?.[0];
const { data: imported } = await admin.from("orders").select("id").eq("store_id", storeId).eq("source", "import").eq("status", "paid").limit(1).single();

const b = await openEdge(base);
try {
  // ── Orders: paging, search, filter ──
  await b.go("/dashboard/orders", `document.querySelectorAll('main ul li a[href^="/dashboard/orders/"]').length > 0`);
  const rows = await b.evaluate<number>(`document.querySelectorAll('main ul li a[href^="/dashboard/orders/"]').length`);
  check(rows === 25, `orders page 1 shows 25 rows (${rows})`);
  const pager = await b.evaluate<string>(`[...document.querySelectorAll('nav[aria-label="Pages"] span')][0].textContent`);
  check(/Page 1 of \d+/.test(pager), `pager: ${pager}`);
  const first1 = await b.evaluate<string>(`document.querySelector('main ul li a').getAttribute('href')`);
  await b.evaluate(`[...document.querySelectorAll('nav[aria-label="Pages"] a')].find(a => a.textContent.includes('Older')).click()`);
  check(await b.waitFor(`location.search.includes('page=2') && document.querySelector('main ul li a')?.getAttribute('href') !== ${JSON.stringify(first1)}`), "Older goes to page 2 with different orders");
  check(await b.evaluate<boolean>(`!!document.querySelector('a[href="/dashboard/money"]')`), "Money is a live sidebar link");

  await b.go("/dashboard/orders?q=Ube", `document.querySelectorAll('main ul li a[href^="/dashboard/orders/"]').length > 0`);
  check(await b.evaluate<boolean>(`[...document.querySelectorAll('main ul li a')].every(a => a.textContent.includes('Ube'))`), "search by product name: every row has Ube");
  await b.go("/dashboard/orders?status=refunded", `document.querySelectorAll('main ul li a').length > 0`);
  check(await b.evaluate<boolean>(`[...document.querySelectorAll('main ul li a')].every(a => a.textContent.includes('Refunded'))`), "status filter: every row is Refunded");
  await b.shot("orders-1280");

  // ── Imported order: Refund is disabled with the reason ──
  await b.go(`/dashboard/orders/${imported!.id}`, `!!document.querySelector('h1')`);
  check(await b.evaluate<boolean>(`[...document.querySelectorAll('button')].some(x => x.textContent.trim() === 'Refund' && x.disabled) && document.body.textContent.includes("can't be refunded from AxoriOS")`), "imported order: Refund disabled with reason");
  check(await b.evaluate<boolean>(`document.body.textContent.includes('Imported, not in PayPal') && document.body.textContent.includes('VAT')`), "imported order: capture shows 'Imported, not in PayPal'; VAT line");

  // ── Real sandbox order: partial refund through the card ──
  if (!real) {
    console.log("SKIP refund card: no refundable real order (run with --pay)");
  } else {
    await b.go(`/dashboard/orders/${real.id}`, `!!document.querySelector('h1')`);
    check(await b.evaluate<boolean>(`document.body.textContent.includes('Rate locked at sale') && /[0-9A-Z]{17}/.test(document.body.textContent)`), "real order: FX rate and capture ID shown");
    await b.evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Refund').click()`);
    check(await b.waitFor(`!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').textContent.includes('Refund to the buyer')`, 30_000), "Refund card opens with a full-refund preview");
    await b.evaluate(`[...document.querySelectorAll('[role="dialog"] [role="radio"]')].find(x => x.textContent.includes('Partial')).click()`);
    await b.waitFor(`!!document.querySelector('[role="dialog"] input[inputmode="decimal"]')`);
    await b.evaluate(`document.querySelector('[role="dialog"] input[inputmode="decimal"]').focus()`);
    await b.send("Input.insertText", { text: "5.00" });
    check(await b.waitFor(`document.querySelector('[role="dialog"]').textContent.includes('$5') && document.querySelector('[role="dialog"]').textContent.includes('VAT to reverse')`, 30_000), "partial preview shows $5 and the VAT to reverse");
    await b.shot("refund-card-1280");
    check(await b.evaluate<boolean>(`!document.querySelector('[role="dialog"] button.flex-1').disabled`), "Approve is enabled");
    await b.evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.includes('Approve refund')).click()`);
    check(await b.waitFor(`/Refunded \\$5|PayPal accepted the refund of \\$5/.test(document.querySelector('[role="dialog"]').textContent)`, 60_000), "PayPal refunded $5.00");
    await b.shot("refund-done-1280");
    const { data: after } = await admin.from("orders").select("status, refunded_charge_minor").eq("id", real.id).single();
    check(after!.status === "partially_refunded" && after!.refunded_charge_minor === real.refunded_charge_minor + 500, `order now partially refunded (${after!.refunded_charge_minor})`);
    const { count } = await admin.from("refunds").select("*", { count: "exact", head: true }).eq("order_id", real.id);
    check(count === 1, `one refund row (${count})`);
  }

  // ── Money ──
  const raw: MetricOrder[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("orders")
      .select("id, status, source, channel, currency, total_minor, refunded_minor, tax_minor, charge_currency, charge_total_minor, fx_rate, paypal_fee_minor, paid_at, contact_id, link_id")
      .eq("store_id", storeId)
      .neq("source", "test")
      .not("paid_at", "is", null)
      .order("id")
      .range(from, from + 999);
    raw.push(...((data ?? []) as MetricOrder[]));
    if (!data || data.length < 1000) break;
  }
  const want = summary(raw, periodRange("30d"));
  await b.go("/dashboard/money?tab=in", `document.body.textContent.includes('Sales per day')`);
  const salesTile = await b.evaluate<string>(`[...document.querySelectorAll('main p')].find(p => p.textContent === 'Sales').parentElement.parentElement.querySelector('p.text-3xl').textContent`);
  check(salesTile === formatMinor(want.sales, "NGN"), `Money in Sales (30d) = metrics module (${salesTile})`);

  for (const tab of ["overview", "out", "expenses", "withdrawals", "vat", "statements"]) {
    await b.go(`/dashboard/money?tab=${tab}`, `!!document.querySelector('main h2')`);
    check(await b.evaluate<boolean>(`document.querySelector('main a[aria-current="page"]')?.textContent.length > 0 && !document.body.textContent.includes('Application error')`), `Money › ${tab} renders`);
    if (tab === "overview") {
      check(await b.evaluate<boolean>(`document.body.textContent.includes("What's left") && document.body.textContent.includes('PayPal balance')`), "overview: balance, in, out, what's left");
      await b.shot("money-overview-1280");
    }
    if (tab === "withdrawals") check(await b.evaluate<boolean>(`!!document.querySelector('a[href^="https://www.mypaga.com"]') && document.querySelectorAll('main table tbody tr').length > 0`), "withdrawals: Paga link and rows");
    if (tab === "vat") check(await b.evaluate<boolean>(`document.querySelectorAll('main table tbody tr').length >= 6`), "VAT: one row per month");
    if (tab === "expenses") check(await b.evaluate<boolean>(`document.body.textContent.includes('Log an expense with Axori AI')`), "expenses: log with Axori AI");
  }

  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const csv = await fetch(`${base}/dashboard/money/statements/${month}/csv`, { headers: { cookie: b.cookie.header } });
  const text = await csv.text();
  check(csv.status === 200 && csv.headers.get("content-type")?.startsWith("text/csv") && text.includes("Sale,") && text.includes("VAT owed"), `statement CSV for ${month} (${text.split("\r\n").length} lines)`);
  const bad = await fetch(`${base}/dashboard/money/statements/2026-13/csv`, { headers: { cookie: b.cookie.header } });
  check(bad.status === 404, `bad month 404 (${bad.status})`);
  const anon = await fetch(`${base}/dashboard/money/statements/${month}/csv`, { redirect: "manual" });
  check(anon.status !== 200, `signed out gets no CSV (${anon.status})`);
  await b.go(`/statements/${month}`, `document.body.textContent.includes('Statement')`);
  check(await b.evaluate<boolean>(`document.body.textContent.includes('Print or save as PDF') && document.querySelectorAll('table tbody tr').length > 50`), "printable statement lists the month's orders");
  await b.shot("statement-1280");

  // ── Phone ──
  await b.phone();
  for (const path of ["/dashboard/money", "/dashboard/orders", `/dashboard/orders/${imported!.id}`]) {
    await b.go(path, `!!document.querySelector('main h1')`);
    check(await b.evaluate<boolean>(`document.documentElement.scrollWidth <= 390`), `390: ${path} has no sideways scroll`);
  }
  await b.go("/dashboard/money", `!!document.querySelector('main h1')`);
  await b.shot("money-390");

  check(b.consoleErrors.length === 0, `no console errors${b.consoleErrors.length ? `: ${b.consoleErrors.slice(0, 3).join(" | ")}` : ""}`);
} finally {
  b.close();
}
