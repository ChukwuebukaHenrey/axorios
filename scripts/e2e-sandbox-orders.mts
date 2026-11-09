/**
 * 6.15: real sandbox payments on production, refunds, and a reconciliation against PayPal's own transaction list.
 *   pay <n>      open <n> checkouts on /s/demo and pay each as the sandbox buyer (about 40 s each)
 *   refund       3 refunds on the paid 6.15 orders: one partial, one full, one second partial
 *   reconcile    every real order's capture, fee and refunds against PayPal /v1/reporting/transactions
 * Run: npx tsx --import ./scripts/no-server-only.mjs --env-file=.env.local scripts/e2e-sandbox-orders.mts <command> [n]
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { payAsSandboxBuyer } from "./sandbox-pay";

const base = "https://axorios.vercel.app";
const TAG = "6.15 sandbox";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const [command, arg] = process.argv.slice(2);

const { data: store } = await admin.from("stores").select("id").eq("slug", "demo").single();
const storeId = store!.id as string;

if (command === "pay") {
  const n = Number(arg ?? 25);
  const { data: products } = await admin.from("products").select("id, name, stock").eq("store_id", storeId).eq("active", true);
  if (!products?.length) throw new Error("no active products on the demo store");
  let paid = 0;
  for (let i = 1; i <= n; i++) {
    const product = products[i % products.length];
    const quantity = (i % 3) + 1;
    try {
      const res = await fetch(`${base}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "demo", items: [{ productId: product.id, quantity }], deliveryNote: `${TAG} #${i}: ${product.name} x${quantity}` }),
      });
      const checkout = (await res.json()) as { orderId?: string; paypalOrderId?: string; chargeMinor?: number; chargeCurrency?: string; error?: string };
      if (!res.ok || !checkout.orderId) throw new Error(`checkout ${res.status} ${checkout.error ?? ""}`);
      const landed = await payAsSandboxBuyer(`https://www.sandbox.paypal.com/checkoutnow?token=${checkout.paypalOrderId}`, base);
      if (!landed.includes(`/s/demo/order/${checkout.orderId}`)) throw new Error(`landed on ${landed}`);
      await fetch(`${base}/s/demo/order/${checkout.orderId}`); // the return page captures while it renders
      const { data: order } = await admin.from("orders").select("status").eq("id", checkout.orderId).single();
      if (order?.status === "paid") paid++;
      console.log(`${order?.status === "paid" ? "ok  " : "FAIL"} #${i} ${checkout.orderId.slice(0, 8)} ${checkout.chargeMinor} ${checkout.chargeCurrency} -> ${order?.status}`);
    } catch (e) {
      console.log(`FAIL #${i} ${(e as Error).message}`);
    }
  }
  console.log(`\n${paid}/${n} paid`);
  process.exit(paid === n ? 0 : 1);
}

type Order = { id: string; status: string; total_minor: number; charge_total_minor: number; charge_currency: string; paypal_capture_id: string | null; paypal_fee_minor: number | null; paypal_net_minor: number | null; refunded_charge_minor: number | null };
const SELECT = "id, status, total_minor, charge_total_minor, charge_currency, paypal_capture_id, paypal_fee_minor, paypal_net_minor, refunded_charge_minor";
const mine = async () =>
  ((await admin.from("orders").select(SELECT).eq("store_id", storeId).like("delivery_note", `${TAG}%`).order("created_at")).data ?? []) as Order[];

if (command === "refund") {
  const { executeRefund } = await import("../src/modules/orders/refunds");
  const paid = (await mine()).filter((o) => o.status === "paid" && o.paypal_capture_id);
  if (paid.length < 3) throw new Error(`need 3 paid ${TAG} orders, have ${paid.length}`);
  const [a, b, c] = paid;
  const plan = [
    { order: a, opts: { amountMinor: Math.floor(a.charge_total_minor / 4), reason: `${TAG} partial` }, want: "partially_refunded" },
    { order: b, opts: { reason: `${TAG} full` }, want: "refunded" },
    { order: c, opts: { amountMinor: Math.floor(c.charge_total_minor / 2), reason: `${TAG} half` }, want: "partially_refunded" },
  ];
  let failures = 0;
  for (const { order, opts, want } of plan) {
    const r = await executeRefund(storeId, order.id, randomUUID(), opts);
    const { data: after } = await admin.from("orders").select("status").eq("id", order.id).single();
    const ok = r.ok && after?.status === want;
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"} ${order.id.slice(0, 8)} ${JSON.stringify(opts)} -> ${after?.status} ${JSON.stringify(r)}`);
  }
  process.exit(failures ? 1 : 0);
}

if (command === "reconcile") {
  const { data: rows } = await admin
    .from("orders")
    .select(SELECT + ", source")
    .eq("store_id", storeId)
    .eq("source", "app")
    .in("status", ["paid", "partially_refunded", "refunded"]) // a capture PayPal still holds for review is not a settled sale
    .not("paypal_capture_id", "is", null);
  const orders = (rows ?? []) as unknown as Order[];
  const { data: refundRows } = await admin.from("refunds").select("order_id, amount_minor, paypal_refund_id, status").eq("store_id", storeId).eq("status", "completed");
  const { paypal } = await import("../src/modules/payments/adapters/paypal");
  const txs = new Map<string, Awaited<ReturnType<typeof paypal.transactions>>[number]>();
  const now = Date.now();
  for (let start = now - 62 * 86_400_000; start < now; start += 30 * 86_400_000) {
    for (const t of await paypal.transactions(new Date(start), new Date(Math.min(start + 30 * 86_400_000, now)))) txs.set(t.id, t);
  }
  let bad = 0;
  let unindexed = 0;
  const B = "https://api-m.sandbox.paypal.com";
  const token = ((await (await fetch(B + "/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).json()) as { access_token: string }).access_token;
  const direct = async (path: string) => (await (await fetch(B + path, { headers: { Authorization: "Bearer " + token } })).json()) as { status?: string; amount?: { value: string }; seller_receivable_breakdown?: { paypal_fee?: { value: string } } };
  const cents = (v?: string) => (v == null ? null : Math.round(Number(v) * 100));
  const flag = (what: string) => {
    bad++;
    console.log(`FAIL ${what}`);
  };
  let sumDb = 0;
  let sumPp = 0;
  for (const o of orders) {
    const t = txs.get(o.paypal_capture_id!);
    if (!t) {
      // The transaction search can lag by hours on new sandbox activity, so ask PayPal about the capture itself.
      unindexed++;
      const c = await direct(`/v2/payments/captures/${o.paypal_capture_id}`);
      if (c.status !== "COMPLETED" && c.status !== "PARTIALLY_REFUNDED" && c.status !== "REFUNDED") flag(`${o.id.slice(0, 8)} capture status ${c.status}`);
      else if (cents(c.amount?.value) !== o.charge_total_minor) flag(`${o.id.slice(0, 8)} amount ${o.charge_total_minor} vs PayPal ${cents(c.amount?.value)}`);
      else if (cents(c.seller_receivable_breakdown?.paypal_fee?.value) !== (o.paypal_fee_minor ?? 0)) flag(`${o.id.slice(0, 8)} fee ${o.paypal_fee_minor} vs PayPal ${cents(c.seller_receivable_breakdown?.paypal_fee?.value)}`);
      else { sumDb += o.charge_total_minor; sumPp += cents(c.amount?.value)!; }
      continue;
    }
    if (t.amountMinor !== o.charge_total_minor) flag(`${o.id.slice(0, 8)} amount ${o.charge_total_minor} vs PayPal ${t.amountMinor}`);
    if (Math.abs(t.feeMinor) !== (o.paypal_fee_minor ?? 0)) flag(`${o.id.slice(0, 8)} fee ${o.paypal_fee_minor} vs PayPal ${t.feeMinor}`);
    sumDb += o.charge_total_minor;
    sumPp += t.amountMinor;
  }
  for (const r of refundRows ?? []) {
    if (!orders.some((o) => o.id === r.order_id)) continue;
    const t = r.paypal_refund_id ? txs.get(r.paypal_refund_id) : undefined;
    if (!t) {
      unindexed++;
      const pr = await direct(`/v2/payments/refunds/${r.paypal_refund_id}`);
      if (pr.status !== "COMPLETED" || cents(pr.amount?.value) !== r.amount_minor) flag(`refund ${r.paypal_refund_id} ${pr.status} ${pr.amount?.value} vs ours ${r.amount_minor}`);
    }
    else if (Math.abs(t.amountMinor) !== r.amount_minor) flag(`refund ${r.paypal_refund_id} amount ${r.amount_minor} vs PayPal ${t.amountMinor}`);
  }
  console.log(`orders ${orders.length}, refunds ${(refundRows ?? []).filter((r) => orders.some((o) => o.id === r.order_id)).length}; captured total ours ${sumDb} vs PayPal ${sumPp}; ${unindexed} checked by direct lookup (not yet in the transaction search)`);
  console.log(bad === 0 ? "PASS reconciliation matches PayPal" : `FAIL ${bad} mismatches`);
  process.exit(bad ? 1 : 0);
}

console.log("usage: pay <n> | refund | reconcile");
process.exit(2);
